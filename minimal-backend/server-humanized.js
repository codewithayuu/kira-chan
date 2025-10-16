const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const EventEmitter = require('events');
const multer = require('multer');
require('dotenv').config();

// Import humanization modules
const { callPlanner } = require('./planner');
const { callDrafterStream } = require('./drafter');
const { callEditorStream, postProcess } = require('./editor');
const { detectEmotionLLM, detectEmotionHF, emotionToTone, getEmpathyLevel } = require('./emotion');
const { extractMemories, addMemoryIfImportant, recallMemories } = require('./memory-upgrade');
const { shouldUpdateSummary, generateSummary, extractCommitments, buildContext } = require('./summary');
const { evaluateResponse, autoRate } = require('./evaluator');

// Legacy imports (kept for compatibility)
const { ControlSchema, defaultAffect, smoothAffect } = require('./affect');
const { redactPII, isLikelyNSFW } = require('./safety');
const { embedText, cosineSim } = require('./embeddings');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Load SelfDoc
const SELFDOC_PATH = path.join(__dirname, 'selfdoc.json');
let SELFDOC = JSON.parse(fs.readFileSync(SELFDOC_PATH, 'utf8'));

// File-based storage
const CONVERSATIONS_PATH = path.join(__dirname, 'conversations.json');
const LEARNING_PATH = path.join(__dirname, 'learning.json');
const SUMMARIES_PATH = path.join(__dirname, 'summaries.json');
const EVAL_LOG_PATH = path.join(__dirname, 'eval-log.json');

// In-memory state
let CONVERSATIONS = { convos: {}, messages: {} };
let LEARNING = { users: {} };
let SUMMARIES = {}; // convoId -> { summary, commitments, turnCount }
let EVAL_LOG = [];
let userAffect = new Map();

// Load data
function loadData() {
  try {
    if (fs.existsSync(CONVERSATIONS_PATH)) {
      CONVERSATIONS = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
    }
    if (fs.existsSync(LEARNING_PATH)) {
      LEARNING = JSON.parse(fs.readFileSync(LEARNING_PATH, 'utf8'));
    }
    if (fs.existsSync(SUMMARIES_PATH)) {
      SUMMARIES = JSON.parse(fs.readFileSync(SUMMARIES_PATH, 'utf8'));
    }
    if (fs.existsSync(EVAL_LOG_PATH)) {
      EVAL_LOG = JSON.parse(fs.readFileSync(EVAL_LOG_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Data load error:', err.message);
  }
}

function saveConversations() {
  fs.writeFileSync(CONVERSATIONS_PATH, JSON.stringify(CONVERSATIONS, null, 2));
}

function saveLearning() {
  fs.writeFileSync(LEARNING_PATH, JSON.stringify(LEARNING, null, 2));
}

function saveSummaries() {
  fs.writeFileSync(SUMMARIES_PATH, JSON.stringify(SUMMARIES, null, 2));
}

function saveEvalLog() {
  fs.writeFileSync(EVAL_LOG_PATH, JSON.stringify(EVAL_LOG.slice(-100), null, 2)); // Keep last 100
}

loadData();

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Helper: Get or create user learning record
function getUserRec(userId) {
  if (!LEARNING.users[userId]) {
    LEARNING.users[userId] = {
      enabled: true,
      stripPII: true,
      memories: [],
      style: {
        emojiRate: 0,
        hinglishRatio: 0,
        avgMsgLen: 0,
        contractionRate: 0,
        samples: 0
      }
    };
  }
  return LEARNING.users[userId];
}

// Helper: Get or create conversation summary
function getSummary(convoId) {
  if (!SUMMARIES[convoId]) {
    SUMMARIES[convoId] = {
      summary: null,
      commitments: [],
      turnCount: 0,
      lastUpdated: new Date().toISOString()
    };
  }
  return SUMMARIES[convoId];
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    humanization: 'enabled',
    selfdoc: SELFDOC.name,
    models: {
      planner: process.env.PLANNER_MODEL || 'llama-3.1-8b-instant',
      drafter: process.env.DRAFTER_MODEL || 'llama-3.1-70b-versatile',
      editor: process.env.EDITOR_MODEL || 'llama-3.1-8b-instant'
    }
  });
});

// Main chat endpoint with 3-pass pipeline
app.post('/api/chat', async (req, res) => {
  const { userId = 'user-1', convoId, text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message required' });
  }

  // Safety check
  if (isLikelyNSFW(text)) {
    return res.status(400).json({ error: 'Content violates guidelines' });
  }

  const cleanText = redactPII(text);
  const userRec = getUserRec(userId);

  // Get or create conversation
  let cid = convoId;
  if (!cid || !CONVERSATIONS.convos[cid]) {
    cid = uuidv4();
    CONVERSATIONS.convos[cid] = {
      id: cid,
      userId,
      title: text.slice(0, 50),
      createdAt: new Date().toISOString(),
      lastUserAt: new Date().toISOString(),
      autoEnabled: false
    };
  }

  const convo = CONVERSATIONS.convos[cid];
  convo.lastUserAt = new Date().toISOString();

  // Initialize messages array for this convo
  if (!CONVERSATIONS.messages[cid]) {
    CONVERSATIONS.messages[cid] = [];
  }

  const messages = CONVERSATIONS.messages[cid];

  // Save user message
  const userMsgId = uuidv4();
  messages.push({
    id: userMsgId,
    role: 'user',
    content: cleanText,
    timestamp: new Date().toISOString()
  });

  try {
    // 1. EMOTION DETECTION (using your existing LLM - no extra API needed!)
    const emotion = await detectEmotionLLM(groq, cleanText);
    console.log('Emotion detected:', emotion);

    // 2. RETRIEVE CONTEXT
    const summary = getSummary(cid);
    const relevantMemories = userRec.memories.length > 0
      ? await recallMemories(userId, cleanText, userRec.memories, 5)
      : [];

    // 3. PLAN
    const plan = await callPlanner(
      groq,
      cleanText,
      summary.summary,
      relevantMemories,
      SELFDOC,
      emotion
    );
    console.log('Plan:', plan);

    // 4. STREAM RESPONSE (Draft + Edit pipeline)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send convoId first
    res.write(`data: ${JSON.stringify({ type: 'convo', convoId: cid })}\n\n`);

    // Send plan/control
    const affect = smoothAffect(
      userAffect.get(userId) || defaultAffect(),
      {
        mood: plan.tone === 'warm' ? 'happy' : plan.tone === 'playful' ? 'playful' : 'neutral',
        valence: emotion.label === 'happy' ? 0.6 : emotion.label === 'sad' ? -0.4 : 0,
        arousal: 0.5
      }
    );
    userAffect.set(userId, affect);
    res.write(`data: ${JSON.stringify({ type: 'control', affect })}\n\n`);

    // Draft
    let draft = '';
    const draftStream = callDrafterStream(
      groq,
      cleanText,
      plan,
      summary.summary,
      relevantMemories,
      SELFDOC
    );

    for await (const token of draftStream) {
      draft += token;
    }

    console.log('Draft:', draft);

    // Edit + Stream
    let final = '';
    const editStream = callEditorStream(groq, draft, plan, SELFDOC);

    for await (const token of editStream) {
      final += token;
      res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
    }

    // Post-process
    final = postProcess(final, plan);

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

    // 5. SAVE ASSISTANT MESSAGE
    const assistantMsgId = uuidv4();
    messages.push({
      id: assistantMsgId,
      role: 'assistant',
      content: final,
      timestamp: new Date().toISOString(),
      meta: { plan, emotion, evalScore: null }
    });

    saveConversations();

    // 6. LEARNING: Extract and store memories
    if (userRec.enabled) {
      const extracted = extractMemories(cleanText, final);
      for (const mem of extracted) {
        const stored = await addMemoryIfImportant(userId, mem, userRec.memories);
        if (stored) {
          userRec.memories.push(stored);
        }
      }
      saveLearning();
    }

    // 7. UPDATE SUMMARY (every 15 turns)
    summary.turnCount += 1;
    if (await shouldUpdateSummary(summary.turnCount)) {
      summary.summary = await generateSummary(groq, messages, summary.summary);
      summary.commitments = extractCommitments(summary.summary);
      summary.lastUpdated = new Date().toISOString();
      saveSummaries();
      console.log('Summary updated:', summary.summary);
    }

    // 8. EVALUATE
    const recentResponses = messages
      .filter(m => m.role === 'assistant')
      .slice(-5)
      .map(m => m.content);

    const evalResult = evaluateResponse(cleanText, final, {
      emotion,
      targetBrevity: plan.brevity,
      avoidList: plan.avoid,
      recentResponses,
      plan
    });

    console.log('Evaluation:', evalResult.overall, evalResult.summary);

    // Log low scores
    if (evalResult.overall.score < 0.7) {
      EVAL_LOG.push({
        timestamp: new Date().toISOString(),
        userMsg: cleanText,
        response: final,
        plan,
        eval: evalResult,
        convoId: cid
      });
      saveEvalLog();
    }

    // Optional: Auto-rate for analysis
    if (Math.random() < 0.1) { // Sample 10%
      const rating = await autoRate(groq, cleanText, final);
      if (rating) {
        console.log('Auto-rating:', rating);
      }
    }

  } catch (error) {
    console.error('Chat error:', error);
    
    // Fallback simple response
    const fallback = `Hey, I'm having a moment here—give me a sec to gather my thoughts? 😅`;
    
    res.write(`data: ${JSON.stringify({ type: 'token', token: fallback })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

    messages.push({
      id: uuidv4(),
      role: 'assistant',
      content: fallback,
      timestamp: new Date().toISOString(),
      meta: { error: error.message }
    });
    saveConversations();
  }
});

// Legacy endpoints (keep for compatibility)
app.get('/api/config', (req, res) => {
  res.json({
    persona: {
      name: SELFDOC.name,
      systemPrompt: SELFDOC.bio + '\n\n' + SELFDOC.boundaries.join('\n')
    },
    model: {
      provider: 'groq',
      model: process.env.DRAFTER_MODEL || 'llama-3.1-70b-versatile',
      temperature: 0.85,
      maxTokens: 400
    }
  });
});

app.get('/api/chat/:convoId/history', (req, res) => {
  const { convoId } = req.params;
  const messages = CONVERSATIONS.messages[convoId] || [];
  res.json({ messages });
});

app.get('/api/convos', (req, res) => {
  const { userId = 'user-1' } = req.query;
  const userConvos = Object.values(CONVERSATIONS.convos)
    .filter(c => c.userId === userId)
    .sort((a, b) => new Date(b.lastUserAt) - new Date(a.lastUserAt));
  res.json({ conversations: userConvos });
});

app.get('/api/learning/status', (req, res) => {
  const { userId = 'user-1' } = req.query;
  const userRec = getUserRec(userId);
  res.json({
    enabled: userRec.enabled,
    stripPII: userRec.stripPII,
    memoryCount: userRec.memories.length,
    style: userRec.style
  });
});

app.get('/api/learning/facts', (req, res) => {
  const { userId = 'user-1' } = req.query;
  const userRec = getUserRec(userId);
  const facts = userRec.memories
    .filter(m => ['fact', 'preference', 'plan'].includes(m.type))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 20);
  res.json(facts);
});

// Eval dashboard
app.get('/api/eval/recent', (req, res) => {
  res.json({ evaluations: EVAL_LOG.slice(-20) });
});

app.get('/api/eval/stats', (req, res) => {
  const scores = EVAL_LOG.map(e => e.eval.overall.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length || 0;
  
  res.json({
    totalEvaluations: EVAL_LOG.length,
    averageScore: avg.toFixed(2),
    gradeDistribution: {
      A: EVAL_LOG.filter(e => e.eval.overall.grade === 'A').length,
      B: EVAL_LOG.filter(e => e.eval.overall.grade === 'B').length,
      C: EVAL_LOG.filter(e => e.eval.overall.grade === 'C').length,
      D: EVAL_LOG.filter(e => e.eval.overall.grade === 'D').length
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Humanized AI Companion Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/chat`);
  console.log(`📊 Eval stats: http://localhost:${PORT}/api/eval/stats`);
  console.log(`\n✨ Humanization enabled:`);
  console.log(`   - SelfDoc: ${SELFDOC.name}`);
  console.log(`   - Planner → Drafter → Editor pipeline`);
  console.log(`   - Emotion detection + memory recall`);
  console.log(`   - Auto-evaluation logging\n`);
});


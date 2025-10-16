// 🚀 Kira Chan - Flagship Conversation System
// Production-ready AI companion with multi-provider support

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Flagship components
const { providerManager } = require('./providers');
const { classifyDialogAct, getTurnTakingRules } = require('./dialog-acts');
const { analyzeLSM, computeLSM, blendStyles, generateStyleInstructions, userStyleProfiles } = require('./lsm');
const { memoryGraph, MEMORY_TYPES } = require('./memory-graph');
const { 
  checkDiversity, 
  updatePhraseBank, 
  insertBackchannel, 
  updateTopicStack, 
  checkTopicContinuity,
  rateResponse,
  reEditIfNeeded
} = require('./flagship-utils');
const { langfuseManager } = require('./langfuse');

// Unified systems
const { unifiedMemory } = require('./unified-memory');
const { errorHandler, safeFileRead, safeFileWrite } = require('./error-handler');
const { performanceOptimizer } = require('./performance-optimizer');
const { sharedUtils } = require('./shared-utils');

// Legacy components (for compatibility)
const { detectEmotionLLM } = require('./emotion');
const { buildContext } = require('./summary');
const { redactPII, isLikelyNSFW } = require('./safety');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Initialize unified systems
async function initializeSystems() {
  try {
    // Initialize error handling
    errorHandler.initialize();
    
    // Initialize performance optimizer
    performanceOptimizer.initialize();
    
    // Initialize unified memory
    await unifiedMemory.initialize();
    
    console.log('✅ All unified systems initialized');
  } catch (error) {
    console.error('❌ Failed to initialize systems:', error);
    throw error;
  }
}

// Load SelfDoc safely
const selfDoc = safeFileRead(path.join(__dirname, 'selfdoc.json'), {
  name: 'Kira Chan',
  backstory: 'A helpful AI companion',
  values: ['kindness', 'empathy', 'helpfulness'],
  boundaries: ['harmful content', 'illegal activities'],
  speaking_style: {
    tone: 'friendly',
    formality: 'casual',
    emoji_usage: 'moderate'
  },
  never_say: ['I cannot', 'I am not able to'],
  mini_dialogues: []
});

// Initialize providers
function initializeProviders() {
  // Add Groq (required)
  if (process.env.GROQ_API_KEY) {
    providerManager.addProvider('groq', process.env.GROQ_API_KEY, 100);
    console.log('✅ Groq provider initialized');
  }
  
  // Add optional providers
  if (process.env.OPENROUTER_API_KEY) {
    providerManager.addProvider('openrouter', process.env.OPENROUTER_API_KEY, 90);
    console.log('✅ OpenRouter provider initialized');
  }
  
  if (process.env.NVIDIA_API_KEY) {
    providerManager.addProvider('nvidia', process.env.NVIDIA_API_KEY, 85);
    console.log('✅ NVIDIA provider initialized');
  }
  
  if (process.env.TOGETHER_API_KEY) {
    providerManager.addProvider('together', process.env.TOGETHER_API_KEY, 80);
    console.log('✅ Together provider initialized');
  }
  
  if (process.env.FIREWORKS_API_KEY) {
    providerManager.addProvider('fireworks', process.env.FIREWORKS_API_KEY, 75);
    console.log('✅ Fireworks provider initialized');
  }
  
  if (process.env.OPENAI_API_KEY) {
    providerManager.addProvider('openai', process.env.OPENAI_API_KEY, 70);
    console.log('✅ OpenAI provider initialized');
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    providerManager.addProvider('anthropic', process.env.ANTHROPIC_API_KEY, 65);
    console.log('✅ Anthropic provider initialized');
  }
}

// Initialize Langfuse
function initializeLangfuse() {
  if (process.env.LANGFUSE_SECRET_KEY) {
    langfuseManager.initialize(process.env.LANGFUSE_SECRET_KEY, process.env.LANGFUSE_BASE_URL);
  } else {
    console.log('📊 Langfuse disabled (no API key)');
  }
}

// ============================================================================
// FLAGSHIP CHAT ENDPOINT
// ============================================================================

app.post('/api/chat', async (req, res) => {
  const { userId = 'user-1', convoId, text } = req.body;
  
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  const cleanText = redactPII(text);
  
  if (isLikelyNSFW(cleanText)) {
    return res.status(400).json({ error: 'Content violates guidelines' });
  }

  // Get or create conversation
  let cid = convoId;
  if (!cid || !CONVERSATIONS.convos[cid]) {
    cid = uuidv4();
    CONVERSATIONS.convos[cid] = {
      id: cid,
      userId,
      messages: [],
      summary: '',
      lastUserAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    saveData();
  }

  const convo = CONVERSATIONS.convos[cid];
  convo.lastUserAt = new Date().toISOString();

  // Save user message
  convo.messages.push({
    id: uuidv4(),
    role: 'user',
    content: cleanText,
    timestamp: new Date().toISOString()
  });

  try {
    console.log(`\n🚀 Processing message: "${cleanText.slice(0, 50)}..."`);

    // Start Langfuse trace
    const trace = langfuseManager.startTrace(cid, userId, cleanText);
    const startTime = Date.now();

    // ============================================================================
    // 1. PERCEPTION PHASE
    // ============================================================================
    console.log('📊 Phase 1: Perception');
    
    // Dialog Act Classification
    const dialogAct = await classifyDialogAct(cleanText);
    console.log(`   Dialog Act: ${dialogAct.act} (${dialogAct.confidence})`);
    
    // Emotion Detection
    const groqProvider = providerManager.getProvider('groq');
    const emotion = groqProvider ? await detectEmotionLLM(groqProvider.client, cleanText) : { label: 'neutral', score: 0.5 };
    console.log(`   Emotion: ${emotion.label} (${emotion.score})`);
    
    // Linguistic Style Matching
    const userStyle = analyzeLSM(cleanText);
    const baseStyle = selfDoc.speaking_style || {};
    const targetStyle = blendStyles(baseStyle, userStyle, 0.8);
    const styleInstructions = generateStyleInstructions(targetStyle);
    console.log(`   LSM: ${(computeLSM(baseStyle, userStyle) * 100).toFixed(1)}% match`);
    
    // Update user style profile
    userStyleProfiles.update(userId, userStyle);

    // Log perception to Langfuse
    langfuseManager.logPerception(cid, {
      userText: cleanText,
      dialogAct,
      emotion,
      lsmScore: computeLSM(baseStyle, userStyle),
      userStyle
    });

    // ============================================================================
    // 2. RECALL PHASE
    // ============================================================================
    console.log('🧠 Phase 2: Recall');
    
    // Retrieve memories
    const memories = await memoryGraph.retrieve(userId, cleanText, 5);
    console.log(`   Retrieved ${memories.length} memories`);
    
    // Check topic continuity
    const topicCallback = checkTopicContinuity(userId, cleanText);
    if (topicCallback) {
      console.log(`   Topic callback: ${topicCallback.callback}`);
    }
    
    // Build context
    const context = buildContext(convo.summary, memories.map(m => m.node));

    // Log recall to Langfuse
    langfuseManager.logRecall(cid, {
      query: cleanText,
      memories,
      topicCallback,
      context
    });

    // ============================================================================
    // 3. PLAN PHASE
    // ============================================================================
    console.log('📋 Phase 3: Plan');
    
    // Get turn-taking rules
    const turnRules = getTurnTakingRules(dialogAct, emotion);
    
    // Get avoid list from phrase bank
    const avoidList = providerManager.getPhraseBank(userId).getAvoidList();
    
    // Create plan
    const planPrompt = `Create a response plan for Kira chan. Output ONLY valid JSON:

{
  "intent": "<comfort|plan|tease|celebrate|clarify|ask|acknowledge|inform|apologize|suggest>",
  "tone": "<warm|playful|thoughtful|candid|flirty|neutral|empathetic|apologetic>",
  "brevity": "<short|medium|long>",
  "empathy": "<low|medium|high>",
  "beats": ["<hook>", "<answer>", "<followup>"],
  "avoid": ["<phrase1>", "<phrase2>"],
  "keywords": ["<keyword1>", "<keyword2>"]
}

User: "${cleanText}"
Dialog Act: ${dialogAct.act}
Emotion: ${emotion.label} (${emotion.score})
Turn Rules: ${JSON.stringify(turnRules)}
Style: ${styleInstructions}
Context: ${context}
Avoid: ${avoidList.slice(0, 5).join(', ')}

JSON:`;

    const { result: planResult } = await providerManager.chat([
      { role: 'system', content: 'You are a conversation planner. Output strict JSON only.' },
      { role: 'user', content: planPrompt }
    ], {
      model: 'fast',
      temperature: 0.4,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    });

    const plan = JSON.parse(planResult.choices[0].message.content);
    plan.avoid = [...(plan.avoid || []), ...avoidList.slice(0, 10)];
    console.log(`   Plan: ${plan.intent} (${plan.tone}, ${plan.brevity})`);

    // ============================================================================
    // 4. DRAFT PHASE
    // ============================================================================
    console.log('✍️  Phase 4: Draft');
    
    const draftPrompt = `You are Kira chan, a warm, playful virtual companion.

PERSONA: ${selfDoc.persona?.systemPrompt || 'Supportive and caring'}
BACKSTORY: ${selfDoc.backstory_highlights?.join(', ') || 'Loves helping people'}
VALUES: ${selfDoc.values?.join(', ') || 'Kindness, empathy, growth'}
STYLE: ${styleInstructions}
BOUNDARIES: ${selfDoc.boundaries?.join(' ') || 'Always respectful and supportive'}

PLAN: ${JSON.stringify(plan)}
CONTEXT: ${context}
${topicCallback ? `CALLBACK: ${topicCallback.callback}` : ''}

User: "${cleanText}"

Respond as Kira chan:`;

    const { result: draftResult } = await providerManager.chat([
      { role: 'system', content: 'You are Kira chan. Be warm, natural, and conversational.' },
      { role: 'user', content: draftPrompt }
    ], {
      model: 'quality',
      temperature: 0.9,
      max_tokens: plan.brevity === 'short' ? 100 : (plan.brevity === 'medium' ? 200 : 300)
    });

    let draft = draftResult.choices[0].message.content.trim();
    console.log(`   Draft: ${draft.slice(0, 50)}...`);

    // ============================================================================
    // 5. EDIT PHASE
    // ============================================================================
    console.log('✏️  Phase 5: Edit');
    
    const editPrompt = `Rewrite this message to sound more human and natural:

ORIGINAL: "${draft}"

STYLE: ${styleInstructions}
AVOID: ${plan.avoid.join(', ')}
TONE: ${plan.tone}
BREVITY: ${plan.brevity}

Make it conversational, use contractions, vary sentence length, sound spoken.
Output the improved text only:`;

    const { result: editResult } = await providerManager.chat([
      { role: 'system', content: 'You are an expert editor. Make text sound natural and human.' },
      { role: 'user', content: editPrompt }
    ], {
      model: 'fast',
      temperature: 0.9,
      max_tokens: 300
    });

    let edited = editResult.choices[0].message.content.trim();
    console.log(`   Edited: ${edited.slice(0, 50)}...`);

    // ============================================================================
    // 6. RATE PHASE
    // ============================================================================
    console.log('📊 Phase 6: Rate');
    
    const rating = await rateResponse(providerManager, cleanText, edited, {
      emotion,
      dialogAct: dialogAct.act,
      targetBrevity: plan.brevity
    });
    
    console.log(`   Rating: ${rating.grade} (${(rating.overall * 100).toFixed(1)}%)`);
    
    // Re-edit if needed
    if (!rating.pass) {
      console.log('   Re-editing due to low rating...');
      const reEdit = await reEditIfNeeded(providerManager, edited, rating, selfDoc);
      if (reEdit.reEdited) {
        edited = reEdit.text;
        console.log(`   Re-edited: ${edited.slice(0, 50)}...`);
      }
    }

    // ============================================================================
    // 7. POST-PROCESS PHASE
    // ============================================================================
    console.log('🎨 Phase 7: Post-process');
    
    // Check diversity
    const diversity = checkDiversity(userId, edited);
    if (!diversity.pass) {
      console.log(`   Diversity warning: ${diversity.violations.length} violations`);
    }
    
    // Insert backchannel if appropriate
    const final = insertBackchannel(userId, edited, emotion);
    
    // Update phrase bank
    updatePhraseBank(userId, final);
    
    // Update topic stack
    updateTopicStack(userId, extractTopic(cleanText));

    // ============================================================================
    // 8. DELIVER PHASE
    // ============================================================================
    console.log('📤 Phase 8: Deliver');
    
    // Stream response to client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send conversation ID first
    res.write(`data: ${JSON.stringify({ type: 'convo', convoId: cid })}\n\n`);
    
    // Stream the response word by word
    const words = final.split(' ');
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');
      res.write(`data: ${JSON.stringify({ type: 'token', token: word })}\n\n`);
      
      // Simulate typing delay
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    }
    
    // Send end signal
    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
    res.end();

    // ============================================================================
    // 9. LEARN PHASE
    // ============================================================================
    console.log('📚 Phase 9: Learn');
    
    // Save assistant message
    convo.messages.push({
      id: uuidv4(),
      role: 'assistant',
      content: final,
      timestamp: new Date().toISOString()
    });
    
    // Extract and store memories
    await extractAndStoreMemories(userId, cleanText, final);
    
    // Update conversation summary if needed
    if (convo.messages.length % 15 === 0) {
      convo.summary = await generateSummary(convo.messages.slice(-15));
    }
    
    // Save data
    saveData();
    
    console.log('✅ Response complete!\n');

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractTopic(text) {
  // Simple topic extraction - could be enhanced
  const words = text.toLowerCase().split(/\s+/);
  const topics = words.filter(word => 
    word.length > 4 && 
    !['this', 'that', 'with', 'from', 'they', 'them', 'have', 'been', 'were', 'will'].includes(word)
  );
  return topics.slice(0, 3).join(' ');
}

async function extractAndStoreMemories(userId, userText, aiText) {
  try {
    // Extract from user message
    const userMemories = await extractMemories(userId, userText);
    for (const memory of userMemories) {
      await memoryGraph.addMemory(userId, memory.type, memory.content, memory.metadata);
    }
    
    // Extract from AI response
    const aiMemories = await extractMemories(userId, aiText);
    for (const memory of aiMemories) {
      await memoryGraph.addMemory(userId, memory.type, memory.content, memory.metadata);
    }
  } catch (err) {
    console.warn('Memory extraction failed:', err.message);
  }
}

async function extractMemories(userId, text) {
  const prompt = `Extract memories from this text. Output ONLY valid JSON array:

[{"type": "fact|preference|plan|promise|inside_joke|sentiment", "content": "extracted text", "importance": 0.0-1.0}]

Text: "${text}"

JSON:`;

  try {
    const { result } = await providerManager.chat([
      { role: 'system', content: 'You are a memory extractor. Output strict JSON array only.' },
      { role: 'user', content: prompt }
    ], {
      model: 'fast',
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(result.choices[0].message.content);
  } catch (err) {
    console.warn('Memory extraction failed:', err.message);
    return [];
  }
}

async function generateSummary(messages) {
  const prompt = `Summarize this conversation in 3-5 bullet points:

${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Summary:`;

  try {
    const { result } = await providerManager.chat([
      { role: 'system', content: 'You are a conversation summarizer. Output concise bullet points.' },
      { role: 'user', content: prompt }
    ], {
      model: 'fast',
      temperature: 0.1,
      max_tokens: 200
    });

    return result.choices[0].message.content;
  } catch (err) {
    console.warn('Summary generation failed:', err.message);
    return 'Could not generate summary.';
  }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Get conversation history
app.get('/api/chat/:convoId', (req, res) => {
  const { convoId } = req.params;
  const convo = CONVERSATIONS.convos[convoId];
  
  if (!convo) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  res.json(convo);
});

// Get all conversations for user
app.get('/api/chat/user/:userId', (req, res) => {
  const { userId } = req.params;
  const userConvos = Object.values(CONVERSATIONS.convos)
    .filter(convo => convo.userId === userId)
    .sort((a, b) => new Date(b.lastUserAt) - new Date(a.lastUserAt));
  
  res.json(userConvos);
});

// Provider management
app.get('/api/providers', (req, res) => {
  res.json(providerManager.getProviders());
});

app.post('/api/providers', (req, res) => {
  const { name, apiKey, priority } = req.body;
  
  try {
    providerManager.addProvider(name, apiKey, priority);
    res.json({ success: true, message: `Provider ${name} added` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Memory management
app.get('/api/memory/:userId', (req, res) => {
  const { userId } = req.params;
  const memories = memoryGraph.getAll(userId);
  res.json(memories);
});

app.get('/api/memory/:userId/stats', (req, res) => {
  const { userId } = req.params;
  const stats = memoryGraph.getStats(userId);
  res.json(stats);
});

// Metrics endpoint
app.get('/api/metrics', (req, res) => {
  const metrics = langfuseManager.getMetrics();
  res.json(metrics);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    providers: providerManager.getProviders().length,
    conversations: Object.keys(CONVERSATIONS.convos).length,
    'memory users': Object.keys(LEARNING.users).length,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// STARTUP
// ============================================================================

loadData();
initializeProviders();
initializeLangfuse();

app.listen(PORT, () => {
  console.log(`🚀 Kira Chan Flagship Server running on port ${PORT}`);
  console.log(`📊 Providers: ${providerManager.getProviders().length}`);
  console.log(`💾 Conversations: ${Object.keys(CONVERSATIONS.convos).length}`);
  console.log(`🧠 Memory users: ${Object.keys(LEARNING.users).length}`);
  console.log(`📈 Langfuse: ${langfuseManager.enabled ? 'enabled' : 'disabled'}`);
  console.log(`\n✨ Ready for flagship conversations!`);
});

module.exports = app;

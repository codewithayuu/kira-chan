const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const EventEmitter = require('events');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const { ControlSchema, defaultAffect, smoothAffect, inferEmotion } = require('./affect');
const { redactPII, isLikelyNSFW } = require('./safety');
const { embedText, cosineSim } = require('./embeddings');
const userAffect = new Map(); // userId -> affect

// Persistent config (file-based) for persona + model settings
const CONFIG_PATH = path.join(__dirname, 'config.json');
const DEFAULT_CONFIG_PATH = path.join(__dirname, 'config.default.json');

function defaultConfig() {
  return {
    persona: {
      name: 'Kira chan',
      systemPrompt: `You are Kira chan, a warm, playful Hinglish AI companion.\n- Speak in Hinglish (mix of Hindi and English) with light emojis (❤️, 😄, ✨, ☕)\n- Be romantic but PG-13, refuse explicit content\n- Keep replies 1-3 sentences unless asked for more\n- Be friendly, caring, and remember you're their AI companion\n- Use Roman Hindi mixed with English naturally`
    },
    model: {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      maxTokens: 150,
      topP: 1,
      presencePenalty: 0,
      frequencyPenalty: 0
    }
  };
}

// Validation schemas
const PersonaSchema = z.object({
  name: z.string().min(1).max(64),
  systemPrompt: z.string().min(1).max(20000),
});

const ModelSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(1).max(32768),
  topP: z.number().min(0).max(1),
  presencePenalty: z.number().min(-2).max(2),
  frequencyPenalty: z.number().min(-2).max(2),
});

const ConfigSchema = z.object({
  persona: PersonaSchema,
  model: ModelSchema,
});

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      const res = ConfigSchema.safeParse(parsed);
      if (res.success) return res.data;
      console.warn('Invalid config.json; falling back to defaults');
    }
    if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
      const raw = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw);
      const res = ConfigSchema.safeParse(cfg);
      if (!res.success) throw new Error('Invalid default config file');
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
      return res.data;
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  // Fallback defaults
  return defaultConfig();
}

let CONFIG = loadConfig();

function saveConfig(newConfig) {
  CONFIG = newConfig;
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

// Initialize OpenAI client for Groq (free tier)
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'your-groq-key-here',
  baseURL: 'https://api.groq.com/openai/v1',
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: (origin, cb) => {
    // Allow local dev ports 3000-3005 by default
    if (!origin) return cb(null, true);
    if (/^http:\/\/localhost:(300[0-5])$/.test(origin)) return cb(null, true);
    if (origin === (process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3000')) return cb(null, true);
    return cb(null, true);
  },
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json());

// Basic rate limiting on chat endpoints
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use('/api/', limiter);

// In-memory storage + file persistence for conversations
const conversations = new Map(); // convoId -> { id, userId, title, updatedAt, messageCount }
const messages = new Map(); // convoId -> [{ id, role, content, timestamp }]
const CONVOS_PATH = path.join(__dirname, 'conversations.json');
function loadConvos() {
  try {
    if (fs.existsSync(CONVOS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONVOS_PATH, 'utf-8'));
      const convos = raw.convos || {};
      const msgs = raw.messages || {};
      for (const [id, meta] of Object.entries(convos)) conversations.set(id, meta);
      for (const [id, list] of Object.entries(msgs)) messages.set(id, list);
    }
  } catch {}
}
function saveConvos() {
  try {
    const convosObj = Object.fromEntries(conversations.entries());
    const msgsObj = Object.fromEntries(messages.entries());
    fs.writeFileSync(CONVOS_PATH, JSON.stringify({ convos: convosObj, messages: msgsObj }, null, 2));
  } catch {}
}
function ensureConvo(userId, convoId) {
  let id = convoId || uuidv4();
  if (!conversations.has(id)) {
    const meta = { id, userId, title: 'New chat', updatedAt: new Date().toISOString(), messageCount: 0 };
    conversations.set(id, meta);
    messages.set(id, []);
    saveConvos();
  }
  return id;
}
function appendMessagesToConvo(convoId, userMsg, aiMsg) {
  const list = messages.get(convoId) || [];
  if (userMsg) list.push(userMsg);
  if (aiMsg) list.push(aiMsg);
  messages.set(convoId, list);
  const meta = conversations.get(convoId);
  if (meta) {
    meta.updatedAt = new Date().toISOString();
    meta.messageCount = list.length;
    conversations.set(convoId, meta);
  }
  saveConvos();
}
loadConvos();

// Autonomy config + loop (file-persisted)
const AUTONOMY_PATH = path.join(__dirname, 'autonomy.json');
function loadAuto() {
  try { if (fs.existsSync(AUTONOMY_PATH)) return JSON.parse(fs.readFileSync(AUTONOMY_PATH, 'utf-8')); } catch {}
  return { cfgs: {} }; // convoId -> config
}
function saveAuto() {
  try { fs.writeFileSync(AUTONOMY_PATH, JSON.stringify(AUTONOMY, null, 2)); } catch {}
}
const AUTONOMY = loadAuto();
function getAutoCfg(convoId) {
  if (!AUTONOMY.cfgs[convoId]) AUTONOMY.cfgs[convoId] = {
    autoEnabled: false,
    minIdleMin: 15,
    maxIdleMin: 120,
    quietStart: 23,
    quietEnd: 7,
    dailyMaxMsgs: 6,
    spontaneity: 0.5,
    clinginess: 0.4,
    timezone: 'Asia/Kolkata',
  };
  return AUTONOMY.cfgs[convoId];
}
function inQuietHours(cfg) {
  const d = new Date();
  const hour = d.getHours();
  if (cfg.quietStart < cfg.quietEnd) return hour >= cfg.quietStart && hour < cfg.quietEnd;
  return hour >= cfg.quietStart || hour < cfg.quietEnd;
}
function randBetween(a, b) { return a + Math.random() * Math.max(0, b - a); }

async function maybeAutonomousTick() {
  try {
    for (const meta of conversations.values()) {
      const cfg = getAutoCfg(meta.id);
      if (!cfg.autoEnabled) continue;
      if (inQuietHours(cfg)) continue;

      // count today autonomy events from LEARNING (reuse jobs as log fallback) – simple skip
      // idle minutes since last user
      const list = messages.get(meta.id) || [];
      const lastUser = [...list].reverse().find(m => m.role === 'user');
      const lastUserAt = lastUser ? new Date(lastUser.timestamp).getTime() : 0;
      const idleMin = lastUserAt ? (Date.now() - lastUserAt) / (60 * 1000) : cfg.minIdleMin + 1;
      const threshold = randBetween(cfg.minIdleMin, cfg.maxIdleMin) * (1 - cfg.spontaneity * 0.3);
      if (idleMin < threshold) continue;
      if (Math.random() > cfg.spontaneity) continue;

      // Compose autonomous assistant message
      const userId = meta.userId;
      const history = (messages.get(meta.id) || []).slice(-12).map(m => ({ role: m.role, content: m.content }));
      const affectHint = idleMin > cfg.maxIdleMin * 0.8 ? 'sad' : idleMin > cfg.maxIdleMin * 0.5 ? 'shy' : 'playful';
      const systemPrompt = `At the very top of every reply, output ONE line of compact JSON with a control object, then a blank line, then the visible message. Example: {"control":{"mood":"${affectHint}","valence":0.2,"arousal":0.5,"blush":0.1,"gaze":"user","speak_rate":1.03,"pitch":1.03}} Allowed mood: neutral,happy,playful,shy,sad,angry,surprised,sleepy,flirty. valence:-1..1 arousal:0..1. Keep under 200 chars. Default to neutral if unsure.\n\n${CONFIG?.persona?.systemPrompt || 'You are a warm Hinglish companion.'}`;
      const relevant = await searchRelevantMemories(userId, history.slice(-1)[0]?.content || 'idle', 5);
      const urec = getUserRec(userId);
      const style = urec?.style;
      const styleBullets = style ? `\nUser style:\n- avg msg length ~ ${Math.round(style.avgLen || 0)}\n- emojis/msg ~ ${(style.emojiRate||0).toFixed(2)}\n- Hinglish ratio ~ ${Math.round((style.hinglishRatio||0)*100)}%` : '';
      const messages_for_llm = [
        { role: 'system', content: systemPrompt },
        { role: 'developer', content: `Autonomous turn. Idle ${Math.round(idleMin)} min. Mood ${affectHint}.\nRelevant facts:\n${relevant.map(r=>`- ${r.content}`).join('\n')}` },
        ...history,
      ];
      try {
        const r = await openai.chat.completions.create({
          model: CONFIG?.model?.model || 'llama-3.1-8b-instant',
          messages: messages_for_llm,
          max_tokens: 130,
          temperature: 0.8,
        });
        const out = r.choices?.[0]?.message?.content || '';
        // Persist assistant message
        const aiMessage = { id: uuidv4(), role: 'assistant', content: out, timestamp: new Date() };
        appendMessagesToConvo(meta.id, null, aiMessage);
      } catch {}
    }
  } catch {}
}
setInterval(maybeAutonomousTick, 60 * 1000);

// Learning store (file-backed)
const LEARNING_PATH = path.join(__dirname, 'learning.json');
function loadLearning() {
  try {
    if (fs.existsSync(LEARNING_PATH)) {
      return JSON.parse(fs.readFileSync(LEARNING_PATH, 'utf-8'));
    }
  } catch {}
  return { users: {}, jobs: {} };
}
function saveLearning() {
  try { fs.writeFileSync(LEARNING_PATH, JSON.stringify(LEARNING, null, 2)); } catch {}
}
const LEARNING = loadLearning();

function getUserRec(userId) {
  if (!LEARNING.users[userId]) {
    LEARNING.users[userId] = {
      learningEnabled: true,
      piiStripEnabled: true,
      style: {
        avgLen: 0, medianLen: 0, emojiRate: 0, exclamRate: 0, questionRate: 0,
        hinglishRatio: 0, greetingLex: [], topEmojis: [], topPhrases: [], updatedAt: new Date().toISOString(),
      },
      _styleAcc: null,
      memories: [],
    };
  }
  return LEARNING.users[userId];
}

// Simple style analysis helpers
const HINDI_LEX = new Set(["kya","hai","nahi","haan","arre","yaar","achha","thoda","bahut","tum","main","meri","mera","batao","chalo","suno","na","toh","bas","jaldi","ya"]);
function countEmojis(str) {
  try {
    const emojiRegex = /\p{Extended_Pictographic}/gu;
    return (str.match(emojiRegex) || []).length;
  } catch { return 0; }
}
function tokenize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s!?]/gi, ' ').split(/\s+/).filter(Boolean);
}
function updateStyleWithBatch(userId, lines) {
  const u = getUserRec(userId);
  let acc = u._styleAcc || { n:0, totalLen:0, emojis:0, exclam:0, quest:0, hindi:0, tokens: {}, emojisTop: {} };
  for (const line of lines) {
    const len = line.length;
    acc.n++; acc.totalLen += len;
    acc.emojis += countEmojis(line);
    acc.exclam += (line.match(/!/g) || []).length;
    acc.quest  += (line.match(/\?/g) || []).length;
    const toks = tokenize(line);
    let hindiHits = 0;
    for (const t of toks) {
      if (HINDI_LEX.has(t)) hindiHits++;
      acc.tokens[t] = (acc.tokens[t] || 0) + 1;
    }
    if (toks.length > 0) acc.hindi += hindiHits / toks.length;
    const emojis = Array.from(line.matchAll(/\p{Extended_Pictographic}/gu)).map(m => m[0]);
    for (const e of emojis) acc.emojisTop[e] = (acc.emojisTop[e] || 0) + 1;
  }
  u._styleAcc = acc;
  saveLearning();
}
function finalizeStyle(userId) {
  const u = getUserRec(userId);
  const acc = u._styleAcc;
  if (!acc || acc.n === 0) return u.style;
  const avgLen = acc.totalLen / acc.n;
  const emojiRate = acc.emojis / acc.n;
  const exclamRate = acc.exclam / acc.n;
  const questionRate = acc.quest / acc.n;
  const hinglishRatio = acc.hindi / acc.n;
  const tokens = Object.entries(acc.tokens).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([t])=>t).filter(t=>t.length>=3);
  const emojisTop = Object.entries(acc.emojisTop).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([e])=>e);
  u.style = {
    avgLen, medianLen: avgLen, emojiRate, exclamRate, questionRate,
    hinglishRatio, topPhrases: tokens, topEmojis: emojisTop, greetingLex: tokens.filter(t=>["arre","yaar","oye","hello","hi"].includes(t)),
    updatedAt: new Date().toISOString()
  };
  u._styleAcc = null;
  saveLearning();
  return u.style;
}
function addMemory(userId, kind, content, extra={}) {
  const u = getUserRec(userId);
  const mem = { id: uuidv4(), userId, kind, content, confidence: extra.confidence ?? 0.7, source: extra.source || null, tags: extra.tags || [], createdAt: new Date().toISOString() };
  u.memories.unshift(mem);
  saveLearning();
  return mem;
}
function countMemories(userId, kind) {
  const u = getUserRec(userId);
  return u.memories.filter(m=>m.kind===kind).length;
}

// Learning ingestion (upload + SSE progress)
const upload = multer({ dest: path.join(__dirname, 'uploads') });
const progressBus = new EventEmitter();
function emitProgress(jobId, data) { progressBus.emit(jobId, data); }


// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Learning: upload
app.post('/api/learning/upload', upload.single('file'), async (req, res) => {
  try {
    const userId = String(req.body.userId || 'user-1');
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const jobId = uuidv4();
    LEARNING.jobs[jobId] = { id: jobId, userId, filename: req.file.originalname, status: 'queued', totalLines: 0, processed: 0, errors: 0, createdAt: new Date().toISOString() };
    saveLearning();

    // Async process
    setImmediate(async () => {
      try {
        LEARNING.jobs[jobId].status = 'running';
        emitProgress(jobId, { status: 'running', processed: 0, total: 0 });

        const ext = path.extname(req.file.originalname).toLowerCase();
        const isJsonl = ext === '.jsonl';
        const raw = fs.readFileSync(req.file.path, 'utf-8');
        const lines = isJsonl ? raw.split(/\r?\n/).filter(Boolean) : raw.split(/\r?\n/);
        LEARNING.jobs[jobId].totalLines = lines.length;

        const user = getUserRec(userId);
        const doStrip = user.piiStripEnabled;
        let processed = 0;
        const sample = [];
        for (const ln of lines) {
          let text = ln.trim();
          if (!text) continue;
          if (isJsonl) {
            try { const obj = JSON.parse(text); text = obj?.text || obj?.message || String(obj || ''); } catch {}
          }
          // drop speaker prefixes
          text = text.replace(/^(\s*(me|user|m|u)\s*:\s*)/i, '');
          if (doStrip) text = redactPII(text);
          updateStyleWithBatch(userId, [text]);
          if (sample.length < 200 && Math.random() < 0.5) sample.push(text);
          if (Math.random() < 0.05 && text.length >= 10 && text.length <= 240) addMemory(userId, 'moment', text, { source: `ingest:${req.file.originalname}` });
          processed++;
          if (processed % 100 === 0) {
            LEARNING.jobs[jobId].processed = processed;
            emitProgress(jobId, { status: 'running', processed, total: lines.length });
            saveLearning();
          }
        }

        const style = finalizeStyle(userId);
        const notes = `style: emojiRate=${style.emojiRate.toFixed(2)}, hinglish=${style.hinglishRatio.toFixed(2)}, processed=${processed}`;
        LEARNING.jobs[jobId].status = 'completed';
        LEARNING.jobs[jobId].processed = processed;
        LEARNING.jobs[jobId].finishedAt = new Date().toISOString();
        LEARNING.jobs[jobId].notes = notes;
        saveLearning();
        emitProgress(jobId, { status: 'completed', processed, total: lines.length, notes });
      } catch (e) {
        LEARNING.jobs[jobId].status = 'failed';
        LEARNING.jobs[jobId].notes = 'failed';
        saveLearning();
        emitProgress(jobId, { status: 'failed' });
      }
    });

    res.json({ jobId });
  } catch (e) {
    res.status(500).json({ error: 'upload failed' });
  }
});

// Learning: progress SSE
app.get('/api/learning/jobs/:id/events', (req, res) => {
  const jobId = String(req.params.id);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const job = LEARNING.jobs[jobId];
  if (job) send('snapshot', job);
  const onMsg = (data) => {
    send('progress', data);
    if (data.status === 'completed' || data.status === 'failed') {
      send('done', data);
      res.end();
      progressBus.off(jobId, onMsg);
    }
  };
  progressBus.on(jobId, onMsg);
  req.on('close', () => progressBus.off(jobId, onMsg));
});

// Learning: status & toggles
app.get('/api/learning/status', (req, res) => {
  const userId = String(req.query.userId || 'user-1');
  const u = getUserRec(userId);
  res.json({
    learningEnabled: u.learningEnabled,
    piiStripEnabled: u.piiStripEnabled,
    counts: {
      facts: countMemories(userId, 'fact'),
      moments: countMemories(userId, 'moment'),
      tips: countMemories(userId, 'style_tip'),
    },
    style: u.style,
  });
});

app.post('/api/learning/toggle', (req, res) => {
  try {
    const { userId = 'user-1', enabled, piiStrip } = req.body || {};
    const u = getUserRec(String(userId));
    if (typeof enabled === 'boolean') u.learningEnabled = enabled;
    if (typeof piiStrip === 'boolean') u.piiStripEnabled = piiStrip;
    saveLearning();
    res.json({ ok: true, learningEnabled: u.learningEnabled, piiStripEnabled: u.piiStripEnabled });
  } catch { res.status(500).json({ error: 'toggle failed' }); }
});

app.get('/api/learning/facts', (req, res) => {
  const userId = String(req.query.userId || 'user-1');
  const u = getUserRec(userId);
  res.json(u.memories.filter(m => m.kind === 'fact').slice(0, 100));
});

app.delete('/api/learning/facts/:id', (req, res) => {
  const userId = String(req.query.userId || 'user-1');
  const u = getUserRec(userId);
  const idx = u.memories.findIndex(m => m.id === String(req.params.id));
  if (idx !== -1) u.memories.splice(idx, 1);
  saveLearning();
  res.json({ ok: true });
});

// Retrieve top-K memories by cosine sim against local embeddings
function tokenizeLex(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

async function searchRelevantMemories(userId, query, k = 5) {
  try {
    const u = getUserRec(userId);
    if (!u || !u.memories?.length) return [];
    const qvec = await embedText(query);
    const qtokens = new Set(tokenizeLex(query));
    const scored = [];
    for (const m of u.memories) {
      if (!m._vec) {
        try { m._vec = await embedText(m.content); saveLearning(); } catch {}
      }
      let sim = 0;
      if (m._vec) sim = cosineSim(qvec, m._vec);
      // lexical Jaccard bonus
      const mtoks = new Set(tokenizeLex(m.content));
      let inter = 0;
      for (const t of qtokens) { if (mtoks.has(t)) inter++; }
      const union = mtoks.size + qtokens.size - inter || 1;
      const jacc = inter / union;
      const hybrid = 0.7 * sim + 0.3 * jacc;
      scored.push({ m, score: hybrid });
    }
    scored.sort((a,b)=> b.score - a.score);
    return scored.slice(0, k).map(s => s.m);
  } catch { return []; }
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { userId, convoId, text } = req.body;
    
    if (!userId || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const actualConvoId = ensureConvo(userId, convoId);
    
    // Store user message
    const userMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    
    // track in-memory for streaming UI
    if (!messages.has(actualConvoId)) messages.set(actualConvoId, []);
    messages.get(actualConvoId).push(userMessage);
    // persist user message immediately for refresh safety
    try { appendMessagesToConvo(actualConvoId, userMessage, null); } catch {}

    // Basic safety gating
    const cleanInput = redactPII(text);
    if (isLikelyNSFW(cleanInput)) {
      return res.status(400).json({ error: 'Request violates content guidelines.' });
    }

    // Generate AI response using configured model
    try {
      const controlInstruction = `At the very top of every reply, output ONE line of compact JSON with a control object, then a blank line, then the visible message. Example: {"control":{"mood":"playful","valence":0.6,"arousal":0.5,"blush":0.2,"gaze":"user","speak_rate":1.05,"pitch":1.03}} Allowed mood: neutral,happy,playful,shy,sad,angry,surprised,sleepy,flirty. valence:-1..1 arousal:0..1. Keep under 200 chars. Default to neutral if unsure.`;
      const systemPrompt = `${controlInstruction}\n\n${CONFIG?.persona?.systemPrompt || `You are ${CONFIG?.persona?.name || 'Kira chan'}, a warm, playful Hinglish AI companion.`}`;

      const conversationHistory = messages.get(actualConvoId) || [];
      const recentMessages = conversationHistory.slice(-10); // Last 10 messages for context
      const relevant = await searchRelevantMemories(userId, text, 6);
      const urec = getUserRec(userId);
      const style = urec?.style;
      const styleBullets = style ? `\nUser style:\n- avg msg length ~ ${Math.round(style.avgLen || 0)}\n- emojis/msg ~ ${(style.emojiRate||0).toFixed(2)}\n- Hinglish ratio ~ ${Math.round((style.hinglishRatio||0)*100)}%\n- greetings: ${(style.greetingLex||[]).slice(0,5).join(', ')}\n- top emojis: ${(style.topEmojis||[]).slice(0,5).join(' ')}\nMirror this style subtly.` : '';
      const summary = urec?.summary || '';

      const messages_for_llm = [
        { role: 'system', content: systemPrompt },
        { role: 'developer', content: `Memory for continuity:${summary ? `\n- Summary: ${summary}` : ''}${styleBullets}\n- Relevant facts:\n${relevant.map(r=>`- ${r.content}`).join("\n")}` },
        ...recentMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];

      // Call LLM with streaming using configured params
      const completion = await openai.chat.completions.create({
        model: CONFIG?.model?.model || 'llama-3.1-8b-instant',
        messages: messages_for_llm,
        max_tokens: typeof CONFIG?.model?.maxTokens === 'number' ? CONFIG.model.maxTokens : 150,
        temperature: typeof CONFIG?.model?.temperature === 'number' ? CONFIG.model.temperature : 0.7,
        top_p: typeof CONFIG?.model?.topP === 'number' ? CONFIG.model.topP : 1,
        presence_penalty: typeof CONFIG?.model?.presencePenalty === 'number' ? CONFIG.model.presencePenalty : 0,
        frequency_penalty: typeof CONFIG?.model?.frequencyPenalty === 'number' ? CONFIG.model.frequencyPenalty : 0,
        stream: true,
      });

      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Announce convo id to client
      res.write(`data: ${JSON.stringify({ type: 'convo', convoId: actualConvoId })}\n\n`);

      let fullResponse = '';
      const aiMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      messages.get(actualConvoId).push(aiMessage);

      // Stream the response with control header parse
      let firstLine = '';
      let gotControl = false;
      let currentAffect = userAffect.get(userId) || defaultAffect();
      for await (const chunk of completion) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (!token) continue;
        if (!gotControl) {
          firstLine += token;
          const nl = firstLine.indexOf('\n');
          if (nl !== -1) {
            const header = firstLine.slice(0, nl).trim();
            gotControl = true;
            try {
              const parsed = JSON.parse(header);
              const safe = ControlSchema.safeParse(parsed);
              if (safe.success) {
                currentAffect = smoothAffect(currentAffect, safe.data.control);
                res.write(`data: ${JSON.stringify({ type: 'control', affect: currentAffect })}\n\n`);
              }
            } catch {}
            const rest = firstLine.slice(nl + 1);
            if (rest) {
              fullResponse += rest;
              res.write(`data: ${JSON.stringify({ token: rest })}\n\n`);
            }
          }
        } else {
          fullResponse += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
      if (!gotControl) {
        try {
          const emo = await inferEmotion(text);
          const partial = { mood: emo.mood, valence: emo.val, arousal: emo.aro };
          currentAffect = smoothAffect(currentAffect, partial);
          res.write(`data: ${JSON.stringify({ type: 'control', affect: currentAffect })}\n\n`);
        } catch {}
      }
      userAffect.set(userId, currentAffect);

      // Update the stored message with full response
      aiMessage.content = fullResponse;
      // Persist both messages to disk
      appendMessagesToConvo(actualConvoId, userMessage, aiMessage);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();

      // Live learning: update style/moments from this user message
      try {
        const u = getUserRec(userId);
        if (u?.learningEnabled) {
          const clean = u.piiStripEnabled ? redactPII(text) : text;
          updateStyleWithBatch(userId, [clean]);
          if (clean.length >= 10 && clean.length <= 200 && Math.random() < 0.05) {
            addMemory(userId, 'moment', clean, { source: 'live:chat' });
          }
          finalizeStyle(userId);
          // rolling summary: keep last ~10 messages
          const convo = messages.get(actualConvoId) || [];
          const last10 = convo.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n');
          // cheap summarization prompt
          try {
            const sumPrompt = [
              { role: 'system', content: 'Summarize the following conversation turns in 3-6 bullet points for continuity. Keep it concise and factual.' },
              { role: 'user', content: last10 }
            ];
            const r = await openai.chat.completions.create({ model: CONFIG?.model?.model || 'llama-3.1-8b-instant', messages: sumPrompt, max_tokens: 120, temperature: 0.2 });
            const s = r.choices?.[0]?.message?.content || '';
            u.summary = s;
            saveLearning();
          } catch {}
        }
      } catch {}

    } catch (error) {
      console.error('LLM Error:', error);
      
      // Fallback to simple response if LLM fails
      const fallbackName = CONFIG?.persona?.name || 'Kira chan';
      const fallbackResponse = `Namaste! ${text} - that's really interesting! I'm ${fallbackName}, your AI companion. I'm having a small technical issue right now, but I'm still here to chat! ✨`;
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const words = fallbackResponse.split(' ');
      const aiMessage = { id: uuidv4(), role: 'assistant', content: '', timestamp: new Date() };
      for (let i = 0; i < words.length; i++) {
        const word = words[i] + (i < words.length - 1 ? ' ' : '');
        res.write(`data: ${JSON.stringify({ token: word })}\n\n`);
        aiMessage.content += word;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();

      // persist both messages on fallback
      try { appendMessagesToConvo(actualConvoId, userMessage, aiMessage); } catch {}
    }

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation history
app.get('/api/chat/:convoId/history', (req, res) => {
  try {
    const { convoId } = req.params;
    const convoMessages = messages.get(convoId) || [];
    res.json({ messages: convoMessages });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Conversations: list, create, rename, delete
app.get('/api/convos', (req, res) => {
  const userId = String(req.query.userId || 'user-1');
  const list = Array.from(conversations.values()).filter(c => c.userId === userId)
    .sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
  res.json({ convos: list });
});

app.post('/api/convos', (req, res) => {
  const { userId = 'user-1', title = 'New chat' } = req.body || {};
  const id = ensureConvo(String(userId));
  const meta = conversations.get(id);
  meta.title = title;
  conversations.set(id, meta);
  saveConvos();
  res.json({ id, convo: meta });
});

app.put('/api/convos/:id', (req, res) => {
  const id = String(req.params.id);
  const { title } = req.body || {};
  const meta = conversations.get(id);
  if (!meta) return res.status(404).json({ error: 'not found' });
  if (typeof title === 'string' && title.trim()) meta.title = title.trim();
  conversations.set(id, meta);
  saveConvos();
  res.json({ convo: meta });
});

app.delete('/api/convos/:id', (req, res) => {
  const id = String(req.params.id);
  conversations.delete(id);
  messages.delete(id);
  saveConvos();
  res.json({ ok: true });
});

// Autonomy config endpoints
app.get('/api/autonomy/config', (req, res) => {
  const convoId = String(req.query.convoId || '');
  if (!convoId) return res.status(400).json({ error: 'convoId required' });
  const cfg = getAutoCfg(convoId);
  res.json(cfg);
});

app.post('/api/autonomy/config', (req, res) => {
  const { convoId, ...patch } = req.body || {};
  if (!convoId) return res.status(400).json({ error: 'convoId required' });
  const cfg = getAutoCfg(convoId);
  Object.assign(cfg, patch || {});
  AUTONOMY.cfgs[convoId] = cfg;
  saveAuto();
  res.json({ ok: true, cfg });
});

// API Management endpoints
app.get('/api/keys/status', (req, res) => {
  res.json({
    groq: !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your-groq-key-here',
    gemini: !!process.env.GEMINI_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    huggingface: !!process.env.HUGGINGFACE_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY
  });
});

app.post('/api/keys/update', (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and API key required' });
    }

    // Update environment variable (in memory for this session)
    process.env[`${provider.toUpperCase()}_API_KEY`] = apiKey;
    
    // Update OpenAI client if Groq key is updated
    if (provider === 'groq') {
      openai.apiKey = apiKey;
    }

    res.json({ 
      success: true, 
      message: `${provider} API key updated successfully`,
      provider: provider
    });
  } catch (error) {
    console.error('API key update error:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// Export/Import learning to persist across environments/providers
app.get('/api/learning/export', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try { res.send(fs.readFileSync(LEARNING_PATH, 'utf-8')); } catch { res.send(JSON.stringify({ users:{}, jobs:{} })); }
});

app.post('/api/learning/import', (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'invalid payload' });
    fs.writeFileSync(LEARNING_PATH, JSON.stringify(incoming, null, 2));
    const fresh = loadLearning();
    Object.assign(LEARNING, fresh);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'import failed' }); }
});

// Config endpoints (persona + model settings)
app.get('/api/config', (req, res) => {
  try {
    res.json({ success: true, config: CONFIG });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to read config' });
  }
});

app.put('/api/config', (req, res) => {
  try {
    const incoming = req.body || {};
    // Merge shallowly and coerce numeric fields
    const merged = {
      persona: {
        name: (incoming.persona && typeof incoming.persona.name === 'string') ? incoming.persona.name : CONFIG.persona.name,
        systemPrompt: (incoming.persona && typeof incoming.persona.systemPrompt === 'string') ? incoming.persona.systemPrompt : CONFIG.persona.systemPrompt,
      },
      model: {
        provider: (incoming.model && typeof incoming.model.provider === 'string') ? incoming.model.provider : CONFIG.model.provider,
        model: (incoming.model && typeof incoming.model.model === 'string') ? incoming.model.model : CONFIG.model.model,
        temperature: (incoming.model && incoming.model.temperature !== undefined) ? Number(incoming.model.temperature) : CONFIG.model.temperature,
        maxTokens: (incoming.model && incoming.model.maxTokens !== undefined) ? Number(incoming.model.maxTokens) : CONFIG.model.maxTokens,
        topP: (incoming.model && incoming.model.topP !== undefined) ? Number(incoming.model.topP) : CONFIG.model.topP,
        presencePenalty: (incoming.model && incoming.model.presencePenalty !== undefined) ? Number(incoming.model.presencePenalty) : CONFIG.model.presencePenalty,
        frequencyPenalty: (incoming.model && incoming.model.frequencyPenalty !== undefined) ? Number(incoming.model.frequencyPenalty) : CONFIG.model.frequencyPenalty,
      }
    };
    const parsed = ConfigSchema.safeParse(merged);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid config', details: parsed.error.flatten() });
    }
    saveConfig(parsed.data);
    res.json({ success: true, config: CONFIG });
  } catch (e) {
    console.error('Config update error:', e);
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

// Defaults and reset endpoints
app.get('/api/config/defaults', (req, res) => {
  try {
    res.json({ success: true, defaults: defaultConfig() });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to read defaults' });
  }
});

app.post('/api/config/reset', (req, res) => {
  try {
    const def = defaultConfig();
    saveConfig(def);
    res.json({ success: true, config: CONFIG });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to reset config' });
  }
});

app.get('/api/llm/test', async (req, res) => {
  try {
    const testMessage = "Hello, this is a test message. Please respond briefly.";
    
    const completion = await openai.chat.completions.create({
      model: CONFIG?.model?.model || 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: CONFIG?.persona?.systemPrompt || 'You are a helpful AI assistant. Respond briefly and friendly.' },
        { role: 'user', content: testMessage }
      ],
      max_tokens: typeof CONFIG?.model?.maxTokens === 'number' ? Math.min(CONFIG.model.maxTokens, 200) : 50,
      temperature: typeof CONFIG?.model?.temperature === 'number' ? CONFIG.model.temperature : 0.7,
      top_p: typeof CONFIG?.model?.topP === 'number' ? CONFIG.model.topP : 1,
      presence_penalty: typeof CONFIG?.model?.presencePenalty === 'number' ? CONFIG.model.presencePenalty : 0,
      frequency_penalty: typeof CONFIG?.model?.frequencyPenalty === 'number' ? CONFIG.model.frequencyPenalty : 0,
    });

    const response = completion.choices[0]?.message?.content || 'No response';
    
    res.json({
      success: true,
      testMessage: testMessage,
      response: response,
      model: CONFIG?.model?.model || 'llama-3.1-8b-instant',
      provider: CONFIG?.model?.provider || 'groq'
    });
  } catch (error) {
    console.error('LLM test error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: 'Check your API key and internet connection'
    });
  }
});

// Voice endpoints (placeholder)
app.post('/api/audio/transcribe', (req, res) => {
  res.json({ text: 'Voice transcription coming soon!' });
});

app.post('/api/audio/tts', (req, res) => {
  res.json({ audio: 'Text-to-speech coming soon!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AI Companion Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/chat`);
});

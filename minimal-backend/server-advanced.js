// 🚀 Kira Chan - Advanced Flagship Server
// Implements all human-like features with latency optimization

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
require('dotenv').config();

// Core components
const { providerManager } = require('./providers');
const { humanizationEngine } = require('./humanization-engine');
const { qdrantMemory } = require('./qdrant-memory');
const { deepgramSTT } = require('./deepgram-stt');
const { elevenlabsTTS } = require('./elevenlabs-tts');
const { langfuseManager } = require('./langfuse');

// Legacy components
const { redactPII, isLikelyNSFW } = require('./safety');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// WebSocket server for real-time features
const wss = new WebSocket.Server({ port: 8080 });
console.log('🔌 WebSocket server running on port 8080');

// Data storage
const CONVERSATIONS_FILE = path.join(__dirname, 'conversations.json');
let CONVERSATIONS = { convos: {} };

// Load data
function loadData() {
  try {
    if (fs.existsSync(CONVERSATIONS_FILE)) {
      CONVERSATIONS = JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('Could not load conversations:', err.message);
  }
}

function saveData() {
  try {
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(CONVERSATIONS, null, 2));
  } catch (err) {
    console.error('Could not save conversations:', err.message);
  }
}

// Load SelfDoc
const selfDoc = JSON.parse(fs.readFileSync(path.join(__dirname, 'selfdoc.json'), 'utf8'));

// Initialize all components
async function initializeComponents() {
  console.log('🚀 Initializing advanced flagship system...');
  
  // Initialize providers
  if (process.env.GROQ_API_KEY) {
    providerManager.addProvider('groq', process.env.GROQ_API_KEY, 100);
    console.log('✅ Groq provider initialized');
  }
  
  if (process.env.OPENROUTER_API_KEY) {
    providerManager.addProvider('openrouter', process.env.OPENROUTER_API_KEY, 90);
    console.log('✅ OpenRouter provider initialized');
  }
  
  if (process.env.NVIDIA_API_KEY) {
    providerManager.addProvider('nvidia', process.env.NVIDIA_API_KEY, 85);
    console.log('✅ NVIDIA provider initialized');
  }

  // Initialize memory system
  await qdrantMemory.initialize();
  
  // Initialize STT
  await deepgramSTT.initialize();
  
  // Initialize TTS
  await elevenlabsTTS.initialize();
  
  // Initialize observability
  if (process.env.LANGFUSE_SECRET_KEY) {
    langfuseManager.initialize(process.env.LANGFUSE_SECRET_KEY, process.env.LANGFUSE_BASE_URL);
  }
  
  console.log('✅ All components initialized');
}

// ============================================================================
// ADVANCED CHAT ENDPOINT WITH LATENCY OPTIMIZATION
// ============================================================================

app.post('/api/chat', async (req, res) => {
  const { userId = 'user-1', convoId, text, voice = false } = req.body;
  
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
    timestamp: new Date().toISOString(),
    voice
  });

  try {
    console.log(`\n🚀 Processing message: "${cleanText.slice(0, 50)}..."`);

    // Start Langfuse trace
    const trace = langfuseManager.startTrace(cid, userId, cleanText);
    const startTime = Date.now();

    // ============================================================================
    // HUMANIZATION PIPELINE WITH LATENCY TARGETS
    // ============================================================================
    
    // Get context for humanization
    const context = {
      userId,
      convoId: cid,
      memories: await qdrantMemory.retrieveMemories(userId, cleanText, 8),
      summary: convo.summary,
      userText: cleanText
    };

    // Run humanization engine
    const result = await humanizationEngine.humanize(userId, cleanText, context);
    
    console.log(`⏱️ Total latency: ${result.metrics.totalTime}ms (target: 2500ms)`);
    console.log(`📊 Quality: ${result.metrics.rating?.overall?.toFixed(2) || 'N/A'}`);

    // ============================================================================
    // STREAM RESPONSE WITH LATENCY OPTIMIZATION
    // ============================================================================
    
    // Stream response to client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send conversation ID first
    res.write(`data: ${JSON.stringify({ type: 'convo', convoId: cid })}\n\n`);
    
    // Stream the response word by word with typing simulation
    const words = result.response.split(' ');
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');
      res.write(`data: ${JSON.stringify({ type: 'token', token: word })}\n\n`);
      
      // Simulate human typing delay (50-150ms per word)
      const delay = 50 + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Send end signal with metadata
    res.write(`data: ${JSON.stringify({ 
      type: 'end', 
      metadata: {
        latency: result.metrics.totalTime,
        quality: result.metrics.rating?.overall,
        withinTarget: result.metrics.withinTarget
      }
    })}\n\n`);
    res.end();

    // ============================================================================
    // LEARN AND UPDATE MEMORIES
    // ============================================================================
    
    // Save assistant message
    convo.messages.push({
      id: uuidv4(),
      role: 'assistant',
      content: result.response,
      timestamp: new Date().toISOString(),
      voice
    });
    
    // Extract and store memories
    await qdrantMemory.extractMemories(userId, cleanText, providerManager);
    await qdrantMemory.extractMemories(userId, result.response, providerManager);
    
    // Update conversation summary if needed
    if (convo.messages.length % 15 === 0) {
      convo.summary = await qdrantMemory.generateThreadSummary(userId, convo.messages, providerManager);
    }
    
    // Complete Langfuse trace
    langfuseManager.completeTrace(cid, true);
    
    // Save data
    saveData();
    
    console.log('✅ Response complete!\n');

  } catch (error) {
    console.error('❌ Chat error:', error);
    langfuseManager.logError(cid, error, 'chat');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// VOICE ENDPOINTS
// ============================================================================

// STT WebSocket proxy
app.ws('/stt-proxy', (ws, req) => {
  const userId = req.query.userId || 'user-1';
  
  ws.on('message', async (data) => {
    try {
      if (data.toString() === 'start') {
        // Create Deepgram connection
        const connection = await deepgramSTT.createConnection(
          userId,
          (transcript, confidence) => {
            // Send final transcript
            ws.send(JSON.stringify({
              type: 'final',
              transcript,
              confidence
            }));
          },
          (transcript, confidence) => {
            // Send interim transcript
            ws.send(JSON.stringify({
              type: 'interim',
              transcript,
              confidence
            }));
          }
        );
        
        ws.send(JSON.stringify({ type: 'connected' }));
      } else if (Buffer.isBuffer(data)) {
        // Send audio data to Deepgram
        await deepgramSTT.sendAudio(userId, data);
      }
    } catch (error) {
      console.error('STT proxy error:', error);
      ws.send(JSON.stringify({ type: 'error', error: error.message }));
    }
  });
  
  ws.on('close', async () => {
    await deepgramSTT.closeConnection(userId);
  });
});

// TTS endpoint
app.post('/api/tts', async (req, res) => {
  const { text, tone = 'neutral', voiceId } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  
  try {
    await elevenlabsTTS.streamSpeech(res, text, tone, voiceId);
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: 'TTS generation failed' });
  }
});

// ============================================================================
// MEMORY ENDPOINTS
// ============================================================================

// Get memories
app.get('/api/memory/:userId', async (req, res) => {
  const { userId } = req.params;
  const { query, limit = 8 } = req.query;
  
  try {
    const memories = query 
      ? await qdrantMemory.retrieveMemories(userId, query, parseInt(limit))
      : await qdrantMemory.getMemoriesByType(userId, undefined, parseInt(limit));
    
    res.json(memories);
  } catch (error) {
    console.error('Memory retrieval error:', error);
    res.status(500).json({ error: 'Memory retrieval failed' });
  }
});

// Memory stats
app.get('/api/memory/:userId/stats', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const stats = await qdrantMemory.getStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Memory stats error:', error);
    res.status(500).json({ error: 'Memory stats failed' });
  }
});

// ============================================================================
// SYSTEM ENDPOINTS
// ============================================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    providers: providerManager.getProviders().length,
    conversations: Object.keys(CONVERSATIONS.convos).length,
    memory: qdrantMemory.initialized,
    stt: deepgramSTT.initialized,
    tts: elevenlabsTTS.initialized,
    langfuse: langfuseManager.enabled,
    timestamp: new Date().toISOString()
  });
});

// Metrics
app.get('/api/metrics', (req, res) => {
  const metrics = langfuseManager.getMetrics();
  res.json(metrics);
});

// Provider management
app.get('/api/providers', (req, res) => {
  res.json(providerManager.getProviders());
});

// ============================================================================
// WEBSOCKET HANDLERS
// ============================================================================

wss.on('connection', (ws, req) => {
  console.log('🔌 New WebSocket connection');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        case 'subscribe':
          // Subscribe to real-time updates
          ws.send(JSON.stringify({ type: 'subscribed' }));
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });
});

// ============================================================================
// STARTUP
// ============================================================================

loadData();

// Initialize all components
initializeComponents().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Kira Chan Advanced Server running on port ${PORT}`);
    console.log(`📊 Providers: ${providerManager.getProviders().length}`);
    console.log(`💾 Conversations: ${Object.keys(CONVERSATIONS.convos).length}`);
    console.log(`🧠 Memory: ${qdrantMemory.initialized ? 'enabled' : 'disabled'}`);
    console.log(`🎤 STT: ${deepgramSTT.initialized ? 'enabled' : 'disabled'}`);
    console.log(`🔊 TTS: ${elevenlabsTTS.initialized ? 'enabled' : 'disabled'}`);
    console.log(`📈 Langfuse: ${langfuseManager.enabled ? 'enabled' : 'disabled'}`);
    console.log(`\n✨ Ready for human-like conversations!`);
  });
}).catch(error => {
  console.error('❌ Initialization failed:', error);
  process.exit(1);
});

module.exports = app;

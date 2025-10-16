// Optimized Flagship Server
// Uses unified systems for memory, error handling, performance, and shared utilities

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Flagship components
const { providerManager } = require('./providers');
const { classifyDialogAct, getTurnTakingRules } = require('./dialog-acts');
const { analyzeLSM, computeLSM, blendStyles, generateStyleInstructions, userStyleProfiles } = require('./lsm');
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
const { errorHandler, safeFileRead, safeFileWrite, safeAsync } = require('./error-handler');
const { performanceOptimizer } = require('./performance-optimizer');
const { sharedUtils } = require('./shared-utils');

// Legacy components (for compatibility)
const { detectEmotionLLM } = require('./emotion');
const { buildContext } = require('./summary');
const { redactPII, isLikelyNSFW } = require('./safety');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Initialize unified systems
async function initializeSystems() {
  try {
    console.log('🚀 Initializing optimized flagship system...');
    
    // Initialize error handling
    errorHandler.initialize();
    
    // Initialize performance optimizer
    performanceOptimizer.initialize();
    
    // Initialize unified memory
    await unifiedMemory.initialize();
    
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
    initializeProviders();
    
    // Initialize Langfuse
    initializeLangfuse();
    
    console.log('✅ All systems initialized successfully');
    return selfDoc;
  } catch (error) {
    console.error('❌ Failed to initialize systems:', error);
    throw error;
  }
}

// Initialize providers
function initializeProviders() {
  const providers = [
    { name: 'groq', key: process.env.GROQ_API_KEY, priority: 100 },
    { name: 'openrouter', key: process.env.OPENROUTER_API_KEY, priority: 90 },
    { name: 'nvidia', key: process.env.NVIDIA_API_KEY, priority: 85 },
    { name: 'together', key: process.env.TOGETHER_API_KEY, priority: 80 },
    { name: 'fireworks', key: process.env.FIREWORKS_API_KEY, priority: 75 },
    { name: 'openai', key: process.env.OPENAI_API_KEY, priority: 70 },
    { name: 'anthropic', key: process.env.ANTHROPIC_API_KEY, priority: 65 }
  ];

  providers.forEach(({ name, key, priority }) => {
    if (key) {
      providerManager.addProvider(name, key, priority);
      console.log(`✅ ${name} provider initialized`);
    }
  });
}

// Initialize Langfuse
function initializeLangfuse() {
  if (process.env.LANGFUSE_SECRET_KEY) {
    langfuseManager.initialize(process.env.LANGFUSE_SECRET_KEY, process.env.LANGFUSE_BASE_URL);
    console.log('✅ Langfuse initialized');
  } else {
    console.log('📊 Langfuse disabled (no API key)');
  }
}

// ============================================================================
// OPTIMIZED CHAT ENDPOINT
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

  try {
    console.log(`\n🚀 Processing message: "${cleanText.slice(0, 50)}..."`);

    // Get or create conversation using unified memory
    let conversation = await unifiedMemory.getConversation(convoId);
    if (!conversation) {
      conversation = sharedUtils.createConversation(userId, convoId);
      await unifiedMemory.saveConversation(conversation);
    }

    // Add user message
    const userMessage = sharedUtils.createMessage('user', cleanText);
    await unifiedMemory.addMessage(conversation.id, userMessage);

    // Start Langfuse trace
    const trace = langfuseManager.startTrace(conversation.id, userId, cleanText);
    const startTime = Date.now();

    // ============================================================================
    // OPTIMIZED PERCEPTION PHASE (Parallel Processing)
    // ============================================================================
    console.log('📊 Phase 1: Optimized Perception');
    
    const perceptionResult = await performanceOptimizer.optimizedResponseStream(
      userId, 
      cleanText, 
      { baseStyle: selfDoc.speaking_style }
    );

    const { memories, emotion, style, dialogAct } = perceptionResult.context;
    console.log(`   Dialog Act: ${dialogAct.act} (${dialogAct.confidence})`);
    console.log(`   Emotion: ${emotion.label} (${emotion.score})`);
    console.log(`   LSM: ${(style.lsmScore * 100).toFixed(1)}% match`);

    // Log perception to Langfuse
    langfuseManager.logPerception(conversation.id, {
      userText: cleanText,
      dialogAct,
      emotion,
      lsmScore: style.lsmScore,
      userStyle: style.userStyle
    });

    // ============================================================================
    // OPTIMIZED RECALL PHASE
    // ============================================================================
    console.log('🧠 Phase 2: Optimized Recall');
    
    // Retrieve memories using unified memory
    const retrievedMemories = await unifiedMemory.retrieveMemories(userId, cleanText, 5);
    console.log(`   Retrieved ${retrievedMemories.length} memories`);
    
    // Check topic continuity
    const topicCallback = checkTopicContinuity(userId, cleanText);
    if (topicCallback) {
      console.log(`   Topic callback: ${topicCallback.callback}`);
    }
    
    // Build context
    const context = buildContext(conversation.summary, retrievedMemories);

    // Log recall to Langfuse
    langfuseManager.logRecall(conversation.id, {
      query: cleanText,
      memories: retrievedMemories,
      topicCallback,
      context
    });

    // ============================================================================
    // OPTIMIZED PLAN PHASE
    // ============================================================================
    console.log('📋 Phase 3: Optimized Plan');
    
    // Get turn-taking rules
    const turnRules = getTurnTakingRules(dialogAct, emotion);
    
    // Get avoid list from phrase bank
    const avoidPhrases = checkDiversity(userId, cleanText);

    // Create plan using provider manager
    const plan = await safeAsync(
      () => createOptimizedPlan(cleanText, conversation.summary, retrievedMemories, style.instructions, emotion, dialogAct, turnRules, avoidPhrases),
      { intent: 'respond', tone: emotion.label, style: style.instructions, avoid: avoidPhrases },
      'plan creation'
    );

    console.log('   Plan:', plan);

    // Log plan to Langfuse
    langfuseManager.logPlan(conversation.id, plan);

    // ============================================================================
    // OPTIMIZED DRAFT PHASE
    // ============================================================================
    console.log('✍️ Phase 4: Optimized Draft');
    
    let draft = "";
    const draftSpan = langfuseManager.startSpan(conversation.id, 'draft', { input: { plan, context } });
    
    try {
      const draftResult = await safeAsync(
        () => createOptimizedDraft(selfDoc, plan, cleanText, context, style.instructions),
        "I'm having a little trouble drafting a response right now, but I'm here for you! ❤️",
        'draft creation'
      );
      draft = draftResult;
    } catch (error) {
      console.error('Draft creation failed:', error);
      draft = "I'm having a little trouble drafting a response right now, but I'm here for you! ❤️";
    }
    
    draftSpan.end({ output: draft });
    console.log('   Draft:', draft);

    // ============================================================================
    // OPTIMIZED EDIT + HUMANIZE PHASE (streamed to client)
    // ============================================================================
    console.log('✂️ Phase 5: Optimized Edit & Humanize');
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: {"type":"convo","convoId":"${conversation.id}"}\n\n`);

    let finalResponse = "";
    let editCount = 0;
    const maxEdits = 2;

    do {
      const editSpan = langfuseManager.startSpan(conversation.id, `edit-${editCount}`, { input: { draft, plan, editCount } });
      
      try {
        const editedResult = await safeAsync(
          () => createOptimizedEdit(draft, plan, avoidPhrases, style.instructions),
          draft, // Fallback to draft if edit fails
          'edit creation'
        );
        
        editSpan.end({ output: editedResult });
        finalResponse = editedResult;

        // Stream the first edit pass
        if (editCount === 0) {
          const words = finalResponse.split(' ');
          for (let i = 0; i < words.length; i++) {
            const word = words[i] + (i < words.length - 1 ? ' ' : '');
            res.write(`data: {"type":"token","token":"${word}"}\n\n`);
            await new Promise(resolve => setTimeout(resolve, 50)); // Typing delay
          }
        }

        // Rate the response
        const ratingSpan = langfuseManager.startSpan(conversation.id, `rate-${editCount}`, { input: { userMessage: cleanText, aiResponse: finalResponse, plan } });
        const evaluation = await safeAsync(
          () => rateResponse(cleanText, finalResponse, plan),
          { overallGrade: 'B', overall: 0.7, empathy: 0.7, directness: 0.7, humanness: 0.7 },
          'response rating'
        );
        ratingSpan.end({ output: evaluation });
        console.log(`   Evaluation (Edit ${editCount}):`, evaluation);

        if (evaluation.overallGrade && ['A', 'B'].includes(evaluation.overallGrade)) {
          break; // Good enough, exit loop
        }

        const reEditInstruction = reEditIfNeeded(evaluation);
        if (reEditInstruction && editCount < maxEdits) {
          console.log(`   Re-editing: ${reEditInstruction}`);
          draft = `${reEditInstruction}\n\nOriginal Draft: ${finalResponse}`;
          editCount++;
          langfuseManager.logReEdit(conversation.id, { editCount, instruction: reEditInstruction });
        } else {
          break; // No re-edit needed or max edits reached
        }
      } catch (error) {
        console.error('Edit phase failed:', error);
        break;
      }
    } while (editCount <= maxEdits);

    // Insert backchannel if applicable
    const backchannel = insertBackchannel(userId, cleanText, emotion);
    if (backchannel) {
      finalResponse = backchannel + finalResponse;
      res.write(`data: {"type":"token","token":"${backchannel}"}\n\n`);
    }

    res.write(`data: {"type":"end","token":""}\n\n`);
    res.end();

    // ============================================================================
    // OPTIMIZED LEARN PHASE
    // ============================================================================
    console.log('📚 Phase 6: Optimized Learn');
    
    // Save assistant message
    const assistantMessage = sharedUtils.createMessage('assistant', finalResponse);
    await unifiedMemory.addMessage(conversation.id, assistantMessage);

    // Update user style profile
    userStyleProfiles.update(userId, style.userStyle);

    // Extract and add memories
    await unifiedMemory.addMemory(userId, 'conversation', cleanText, { emotion: emotion.label, dialogAct: dialogAct.act });
    await unifiedMemory.addMemory(userId, 'conversation', finalResponse, { type: 'assistant_response' });

    // Update conversation summary if needed
    if (conversation.messages.length % 15 === 0) {
      conversation.summary = await safeAsync(
        () => generateOptimizedSummary(conversation.messages),
        conversation.summary,
        'summary generation'
      );
      await unifiedMemory.saveConversation(conversation);
    }

    // Update phrase bank for anti-repetition
    updatePhraseBank(userId, finalResponse);

    // Log full turn to Langfuse
    langfuseManager.logFullTurn(conversation.id, {
      userMessage: cleanText,
      aiResponse: finalResponse,
      duration: Date.now() - startTime,
      finalEvaluation: evaluation,
      editCount,
      backchannelUsed: !!backchannel
    });

    console.log('✅ Response complete!\n');

  } catch (error) {
    console.error('❌ Chat error:', error);
    errorHandler.logError(error, 'chat endpoint');
    langfuseManager.logError(conversation.id, error);
    res.status(500).write(`data: {"type":"error","error":"${error.message}"}\n\n`);
    res.end();
  }
});

// ============================================================================
// OPTIMIZED HELPER FUNCTIONS
// ============================================================================

async function createOptimizedPlan(userText, summary, memories, styleInstructions, emotion, dialogAct, turnRules, avoidPhrases) {
  const provider = providerManager.getProvider('groq');
  if (!provider) throw new Error('No provider available');

  const prompt = `Create a response plan for this user message: "${userText}"

Context:
- Summary: ${summary}
- Emotion: ${emotion.label} (${emotion.score})
- Dialog Act: ${dialogAct.act} (${dialogAct.confidence})
- Style: ${styleInstructions}
- Avoid: ${avoidPhrases.join(', ')}

Return JSON: {"intent": "respond|ask|acknowledge", "tone": "friendly|empathetic|playful", "style": "casual|formal", "avoid": ["phrase1", "phrase2"]}`;

  const result = await providerManager.chat([{ role: 'user', content: prompt }], { 
    model: 'llama-3.1-8b-instant',
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(result.result.choices[0].message.content);
}

async function createOptimizedDraft(selfDoc, plan, userText, context, styleInstructions) {
  const provider = providerManager.getProvider('groq');
  if (!provider) throw new Error('No provider available');

  const prompt = `You are ${selfDoc.name}, ${selfDoc.backstory}.

User: "${userText}"
Plan: ${JSON.stringify(plan)}
Context: ${context}
Style: ${styleInstructions}

Respond naturally and humanly.`;

  const result = await providerManager.chat([{ role: 'user', content: prompt }], { 
    model: 'llama-3.1-70b-versatile',
    temperature: 0.7
  });

  return result.result.choices[0].message.content;
}

async function createOptimizedEdit(draft, plan, avoidPhrases, styleInstructions) {
  const provider = providerManager.getProvider('groq');
  if (!provider) throw new Error('No provider available');

  const prompt = `Edit this draft to be more human and natural:

Draft: "${draft}"
Plan: ${JSON.stringify(plan)}
Avoid: ${avoidPhrases.join(', ')}
Style: ${styleInstructions}

Make it sound more conversational and human.`;

  const result = await providerManager.chat([{ role: 'user', content: prompt }], { 
    model: 'llama-3.1-8b-instant',
    temperature: 0.5
  });

  return result.result.choices[0].message.content;
}

async function generateOptimizedSummary(messages) {
  const provider = providerManager.getProvider('groq');
  if (!provider) throw new Error('No provider available');

  const recentMessages = messages.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n');
  
  const prompt = `Summarize this conversation in 3-4 bullet points:\n\n${recentMessages}`;

  const result = await providerManager.chat([{ role: 'user', content: prompt }], { 
    model: 'llama-3.1-8b-instant',
    temperature: 0.3
  });

  return result.result.choices[0].message.content;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Health check
app.get('/api/health', (req, res) => {
  const stats = sharedUtils.getStats();
  const perfStats = performanceOptimizer.getStats();
  const errorStats = errorHandler.getErrorStats();
  
  res.json({ 
    status: 'healthy', 
    providers: providerManager.getProviders().length,
    memory: unifiedMemory.getStats(),
    performance: perfStats,
    errors: errorStats,
    timestamp: new Date().toISOString()
  });
});

// Get conversation history
app.get('/api/chat/:convoId', async (req, res) => {
  try {
    const conversation = await unifiedMemory.getConversation(req.params.convoId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    errorHandler.logError(error, 'get conversation');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update provider keys
app.post('/api/keys/update', (req, res) => {
  const { provider, apiKey } = req.body;
  if (!provider || !apiKey) {
    return res.status(400).json({ error: 'Provider name and API key are required.' });
  }
  providerManager.addProvider(provider, apiKey);
  res.json({ message: `${provider} API key updated.` });
});

// Get provider status
app.get('/api/providers', (req, res) => {
  res.json(providerManager.getProviders());
});

// Get metrics
app.get('/api/metrics', (req, res) => {
  const metrics = langfuseManager.getMetrics();
  const perfMetrics = performanceOptimizer.getStats();
  res.json({ ...metrics, performance: perfMetrics });
});

// Error handling middleware
app.use(errorHandler.handleExpressError());

// ============================================================================
// STARTUP
// ============================================================================

let selfDoc;

async function startServer() {
  try {
    selfDoc = await initializeSystems();
    
    app.listen(PORT, () => {
      console.log(`🚀 Optimized Kira Chan Server running on port ${PORT}`);
      console.log(`📊 Providers: ${providerManager.getProviders().length}`);
      console.log(`💾 Memory: ${unifiedMemory.getStats().mode} mode`);
      console.log(`📈 Langfuse: ${langfuseManager.enabled ? 'enabled' : 'disabled'}`);
      console.log(`\n✨ Ready for optimized conversations!`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;

import { Router } from 'express';
import { z } from 'zod';
import { MemoryService } from '../services/memory';
import { LLMService } from '../services/llm';
import { VoiceService } from '../services/voice';
import { buildMessages, ChatRequestSchema } from '@ai-companion/shared';
import { redactPII, isLikelyNSFW, isToxic } from '../safety';

const router = Router();
const memoryService = new MemoryService();
const llmService = new LLMService();
const voiceService = new VoiceService();

// Chat endpoint with streaming
router.post('/', async (req, res) => {
  try {
    const { userId, convoId, text, voiceEnabled } = ChatRequestSchema.parse(req.body);

    // Get or create conversation
    let actualConvoId = convoId;
    if (!actualConvoId) {
      actualConvoId = await memoryService.createConversation(userId);
    }

    // Safety/guardrails
    const cleanText = redactPII(text);
    if (isLikelyNSFW(cleanText) || await isToxic(cleanText)) {
      return res.status(400).json({ error: 'Request violates content guidelines.' });
    }

    // Load memory context
    const profile = await memoryService.getUserProfile(userId);
    const summary = await memoryService.getConversationSummary(actualConvoId);
    const memories = await memoryService.getRelevantMemories(userId, cleanText);
    const history = await memoryService.getConversationHistory(actualConvoId);

    // Build prompt with memory
    const messages = buildMessages({
      profile,
      summary,
      memories,
      history,
      userMsg: text,
      convoId: actualConvoId,
      userId,
    });

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    let fullResponse = '';

    try {
      // Stream the LLM response
      for await (const token of await llmService.generateResponse(messages)) {
        fullResponse += token;
        
        // Send token to client
        res.write(`data: ${JSON.stringify({ 
          type: 'token', 
          token, 
          isComplete: false 
        })}\n\n`);
      }

      // Send completion signal
      res.write(`data: ${JSON.stringify({ 
        type: 'token', 
        token: '', 
        isComplete: true 
      })}\n\n`);

      // Generate TTS if requested
      if (voiceEnabled && fullResponse.trim()) {
        try {
          const ttsResponse = await voiceService.textToSpeech({
            text: fullResponse,
            voice: 'bella',
            language: 'en',
          });

          res.write(`data: ${JSON.stringify({ 
            type: 'audio', 
            audioUrl: ttsResponse.audioUrl,
            duration: ttsResponse.duration
          })}\n\n`);
        } catch (ttsError) {
          console.error('TTS error:', ttsError);
          // Continue without TTS
        }
      }

      // Process conversation turn for memory
      await memoryService.processConversationTurn(userId, actualConvoId, text, fullResponse);

      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        convoId: actualConvoId,
        message: fullResponse
      })}\n\n`);

    } catch (llmError) {
      console.error('LLM error:', llmError);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: 'Failed to generate response' 
      })}\n\n`);
    }

    res.end();

  } catch (error) {
    console.error('Chat error:', error);
    res.status(400).json({ error: 'Invalid request' });
  }
});

// Get conversation history
router.get('/:convoId/history', async (req, res) => {
  try {
    const { convoId } = req.params;
    const history = await memoryService.getConversationHistory(convoId);
    res.json({ history });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Get user profile
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await memoryService.getUserProfile(userId);
    res.json({ profile });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const profile = await memoryService.updateUserProfile(userId, updates);
    res.json({ profile });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get memories
router.get('/memories/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, kind } = req.query;
    
    const memories = await memoryService.getRelevantMemories(
      userId, 
      '', 
      parseInt(limit as string)
    );

    const filteredMemories = kind 
      ? memories.filter(m => m.kind === kind)
      : memories;

    res.json({ memories: filteredMemories });
  } catch (error) {
    console.error('Memories error:', error);
    res.status(500).json({ error: 'Failed to get memories' });
  }
});

// Add memory
router.post('/memories', async (req, res) => {
  try {
    const { userId, content, kind, importance, tags } = req.body;
    
    const memory = await memoryService.addMemory(
      userId, 
      content, 
      kind, 
      importance, 
      tags
    );

    res.json({ memory });
  } catch (error) {
    console.error('Add memory error:', error);
    res.status(500).json({ error: 'Failed to add memory' });
  }
});

export default router;

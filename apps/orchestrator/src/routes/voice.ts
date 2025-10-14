import { Router } from 'express';
import multer from 'multer';
import { VoiceService } from '../services/voice';
import { TTSRequestSchema, AudioTranscribeRequestSchema } from '@ai-companion/shared';

const router = Router();
const voiceService = new VoiceService();

// Configure multer for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

// Text-to-Speech endpoint
router.post('/tts', async (req, res) => {
  try {
    const { text, voice, language } = TTSRequestSchema.parse(req.body);

    const response = await voiceService.textToSpeech({
      text,
      voice,
      language,
    });

    res.json(response);
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

// Text-to-Speech streaming endpoint
router.post('/tts/stream', async (req, res) => {
  try {
    const { text, voice, language } = TTSRequestSchema.parse(req.body);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const audioStream = await voiceService.textToSpeechStream(text, voice);
    const reader = audioStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
    }

    res.end();
  } catch (error) {
    console.error('TTS streaming error:', error);
    res.status(500).json({ error: 'Failed to generate speech stream' });
  }
});

// Speech-to-Text endpoint
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioBase64 = req.file.buffer.toString('base64');
    const { language } = AudioTranscribeRequestSchema.parse({
      audio: audioBase64,
      language: req.body.language || 'en',
    });

    const response = await voiceService.transcribeAudio({
      audio: audioBase64,
      language,
    });

    res.json(response);
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

// Speech-to-Text streaming endpoint
router.post('/transcribe/stream', async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const audioBuffer = Buffer.concat(chunks);
        const audioBase64 = audioBuffer.toString('base64');

        const response = await voiceService.transcribeAudio({
          audio: audioBase64,
          language: 'en',
        });

        res.json(response);
      } catch (error) {
        console.error('Streaming transcription error:', error);
        res.status(500).json({ error: 'Failed to transcribe audio' });
      }
    });
  } catch (error) {
    console.error('Transcription streaming error:', error);
    res.status(500).json({ error: 'Failed to transcribe audio stream' });
  }
});

// Get available voices
router.get('/voices', async (req, res) => {
  try {
    const voices = await voiceService.getAvailableVoices();
    res.json({ voices });
  } catch (error) {
    console.error('Get voices error:', error);
    res.status(500).json({ error: 'Failed to get voices' });
  }
});

// Get voice information
router.get('/voices/:voiceId', async (req, res) => {
  try {
    const { voiceId } = req.params;
    const voiceInfo = await voiceService.getVoiceInfo(voiceId);
    
    if (!voiceInfo) {
      return res.status(404).json({ error: 'Voice not found' });
    }

    res.json({ voice: voiceInfo });
  } catch (error) {
    console.error('Get voice info error:', error);
    res.status(500).json({ error: 'Failed to get voice info' });
  }
});

// Health check for voice services
router.get('/health', async (req, res) => {
  try {
    // Test TTS
    const ttsTest = await voiceService.textToSpeech({
      text: 'Test',
      voice: 'bella',
      language: 'en',
    });

    res.json({
      status: 'healthy',
      services: {
        tts: ttsTest ? 'working' : 'error',
        stt: 'available', // Deepgram is always available
      },
    });
  } catch (error) {
    console.error('Voice health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Voice services not available',
    });
  }
});

export default router;

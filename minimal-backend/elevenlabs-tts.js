// ElevenLabs TTS with streaming and voice settings
// Implements voice synthesis with tone-based voice modulation

const { ElevenLabs } = require('@elevenlabs/elevenlabs-js');

class ElevenLabsTTS {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.voiceSettings = {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true
    };
  }

  async initialize() {
    if (this.initialized) return;

    const apiKey = process.env.ELEVEN_API_KEY;
    if (!apiKey) {
      console.log('🔊 ElevenLabs TTS disabled (no API key)');
      return;
    }

    try {
      this.client = new ElevenLabs({
        apiKey: apiKey
      });
      this.initialized = true;
      console.log('✅ ElevenLabs TTS initialized');
    } catch (error) {
      console.warn('❌ ElevenLabs initialization failed:', error.message);
    }
  }

  // Get available voices
  async getVoices() {
    if (!this.client) return [];

    try {
      const voices = await this.client.voices.getAll();
      return voices.voices.map(voice => ({
        id: voice.voice_id,
        name: voice.name,
        category: voice.category,
        description: voice.description
      }));
    } catch (error) {
      console.error('Failed to get voices:', error);
      return [];
    }
  }

  // Get default voice (first available)
  async getDefaultVoice() {
    const voices = await this.getVoices();
    return voices[0]?.id || 'pNInz6obpgDQGcFmaJgB'; // Default voice
  }

  // Generate speech with tone-based voice settings
  async generateSpeech(text, tone = 'neutral', voiceId = null) {
    if (!this.client) {
      throw new Error('ElevenLabs not initialized');
    }

    try {
      const voice = voiceId || await this.getDefaultVoice();
      const voiceSettings = this.getVoiceSettingsForTone(tone);

      const audioStream = await this.client.generate({
        voice: voice,
        text: text,
        voice_settings: voiceSettings,
        model_id: 'eleven_multilingual_v2'
      });

      return audioStream;
    } catch (error) {
      console.error('Speech generation failed:', error);
      throw error;
    }
  }

  // Stream speech to response
  async streamSpeech(res, text, tone = 'neutral', voiceId = null) {
    if (!this.client) {
      res.status(500).json({ error: 'TTS not available' });
      return;
    }

    try {
      const voice = voiceId || await this.getDefaultVoice();
      const voiceSettings = this.getVoiceSettingsForTone(tone);

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const audioStream = await this.client.generate({
        voice: voice,
        text: text,
        voice_settings: voiceSettings,
        model_id: 'eleven_multilingual_v2'
      });

      // Stream audio data
      audioStream.pipe(res);
    } catch (error) {
      console.error('Speech streaming failed:', error);
      res.status(500).json({ error: 'Speech generation failed' });
    }
  }

  // Get voice settings based on tone
  getVoiceSettingsForTone(tone) {
    const toneSettings = {
      warm: {
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.3,
        use_speaker_boost: true
      },
      playful: {
        stability: 0.4,
        similarity_boost: 0.9,
        style: 0.6,
        use_speaker_boost: true
      },
      thoughtful: {
        stability: 0.8,
        similarity_boost: 0.7,
        style: 0.1,
        use_speaker_boost: true
      },
      candid: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.4,
        use_speaker_boost: true
      },
      flirty: {
        stability: 0.3,
        similarity_boost: 0.9,
        style: 0.7,
        use_speaker_boost: true
      },
      neutral: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      },
      empathetic: {
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true
      },
      apologetic: {
        stability: 0.6,
        similarity_boost: 0.8,
        style: 0.1,
        use_speaker_boost: true
      }
    };

    return toneSettings[tone] || this.voiceSettings;
  }

  // Generate speech with emotion-based modulation
  async generateWithEmotion(text, emotion, intensity = 0.5) {
    if (!this.client) {
      throw new Error('ElevenLabs not initialized');
    }

    try {
      const voice = await this.getDefaultVoice();
      
      // Map emotion to voice settings
      const emotionSettings = this.getEmotionSettings(emotion, intensity);
      
      const audioStream = await this.client.generate({
        voice: voice,
        text: text,
        voice_settings: emotionSettings,
        model_id: 'eleven_multilingual_v2'
      });

      return audioStream;
    } catch (error) {
      console.error('Emotional speech generation failed:', error);
      throw error;
    }
  }

  // Get voice settings for emotions
  getEmotionSettings(emotion, intensity = 0.5) {
    const baseSettings = {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true
    };

    const emotionModifiers = {
      joy: {
        stability: 0.3 + (intensity * 0.2),
        similarity_boost: 0.8 + (intensity * 0.1),
        style: 0.4 + (intensity * 0.3)
      },
      sadness: {
        stability: 0.7 + (intensity * 0.2),
        similarity_boost: 0.6 + (intensity * 0.1),
        style: 0.1 + (intensity * 0.2)
      },
      anger: {
        stability: 0.2 + (intensity * 0.3),
        similarity_boost: 0.9,
        style: 0.6 + (intensity * 0.3)
      },
      fear: {
        stability: 0.4 + (intensity * 0.2),
        similarity_boost: 0.7 + (intensity * 0.1),
        style: 0.2 + (intensity * 0.3)
      },
      surprise: {
        stability: 0.3 + (intensity * 0.2),
        similarity_boost: 0.8 + (intensity * 0.1),
        style: 0.5 + (intensity * 0.3)
      },
      neutral: baseSettings
    };

    const modifier = emotionModifiers[emotion] || baseSettings;
    
    return {
      ...baseSettings,
      ...modifier
    };
  }

  // Generate visemes for lip-sync (if supported)
  async generateWithVisemes(text, tone = 'neutral', voiceId = null) {
    if (!this.client) {
      throw new Error('ElevenLabs not initialized');
    }

    try {
      const voice = voiceId || await this.getDefaultVoice();
      const voiceSettings = this.getVoiceSettingsForTone(tone);

      // Note: Visemes might require a different API call or model
      // This is a placeholder for future implementation
      const audioStream = await this.client.generate({
        voice: voice,
        text: text,
        voice_settings: voiceSettings,
        model_id: 'eleven_multilingual_v2'
      });

      return {
        audio: audioStream,
        visemes: [] // Placeholder - would need actual viseme data
      };
    } catch (error) {
      console.error('Viseme generation failed:', error);
      throw error;
    }
  }

  // Get usage statistics
  async getUsage() {
    if (!this.client) return null;

    try {
      const usage = await this.client.user.get();
      return {
        characterCount: usage.subscription?.character_count || 0,
        characterLimit: usage.subscription?.character_limit || 0,
        canExtendCharacterLimit: usage.subscription?.can_extend_character_limit || false
      };
    } catch (error) {
      console.error('Failed to get usage:', error);
      return null;
    }
  }

  // Check if TTS is available
  isAvailable() {
    return this.initialized && this.client !== null;
  }
}

// Singleton instance
const elevenlabsTTS = new ElevenLabsTTS();

module.exports = { elevenlabsTTS };

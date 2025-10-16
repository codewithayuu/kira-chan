// Deepgram STT with WebSocket support
// Implements real-time speech-to-text with interim captions

const { createClient } = require('@deepgram/sdk');
const WebSocket = require('ws');

class DeepgramSTT {
  constructor() {
    this.client = null;
    this.connections = new Map(); // userId -> WebSocket connection
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.log('🎤 Deepgram STT disabled (no API key)');
      return;
    }

    try {
      this.client = createClient(apiKey);
      this.initialized = true;
      console.log('✅ Deepgram STT initialized');
    } catch (error) {
      console.warn('❌ Deepgram initialization failed:', error.message);
    }
  }

  // Create WebSocket connection for real-time STT
  async createConnection(userId, onTranscript, onInterim) {
    if (!this.client) {
      throw new Error('Deepgram not initialized');
    }

    try {
      const connection = this.client.listen.live({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        interim_results: true,
        endpointing: 300,
        vad_events: true,
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1
      });

      connection.on('Open', () => {
        console.log(`🎤 Deepgram connection opened for user ${userId}`);
      });

      connection.on('Results', (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        const isFinal = data.is_final;
        const confidence = data.channel?.alternatives?.[0]?.confidence || 0;

        if (transcript && transcript.trim()) {
          if (isFinal) {
            console.log(`🎤 Final transcript: "${transcript}" (confidence: ${confidence.toFixed(2)})`);
            onTranscript(transcript, confidence);
          } else {
            console.log(`🎤 Interim: "${transcript}"`);
            onInterim(transcript, confidence);
          }
        }
      });

      connection.on('Error', (error) => {
        console.error('🎤 Deepgram error:', error);
        this.connections.delete(userId);
      });

      connection.on('Close', () => {
        console.log(`🎤 Deepgram connection closed for user ${userId}`);
        this.connections.delete(userId);
      });

      this.connections.set(userId, connection);
      return connection;
    } catch (error) {
      console.error('Deepgram connection failed:', error);
      throw error;
    }
  }

  // Send audio data to connection
  async sendAudio(userId, audioBuffer) {
    const connection = this.connections.get(userId);
    if (!connection) {
      throw new Error('No active connection for user');
    }

    try {
      connection.send(audioBuffer);
    } catch (error) {
      console.error('Audio send failed:', error);
      throw error;
    }
  }

  // Close connection
  async closeConnection(userId) {
    const connection = this.connections.get(userId);
    if (connection) {
      try {
        connection.finish();
        this.connections.delete(userId);
        console.log(`🎤 Connection closed for user ${userId}`);
      } catch (error) {
        console.error('Connection close failed:', error);
      }
    }
  }

  // Process audio file (fallback)
  async processFile(audioBuffer, options = {}) {
    if (!this.client) {
      throw new Error('Deepgram not initialized');
    }

    try {
      const { result, error } = await this.client.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          language: 'en-US',
          smart_format: true,
          ...options
        }
      );

      if (error) {
        throw new Error(error);
      }

      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

      return { transcript, confidence };
    } catch (error) {
      console.error('File transcription failed:', error);
      throw error;
    }
  }

  // Get active connections count
  getActiveConnections() {
    return this.connections.size;
  }

  // Check if user has active connection
  hasConnection(userId) {
    return this.connections.has(userId);
  }

  // Get connection status
  getConnectionStatus(userId) {
    const connection = this.connections.get(userId);
    return connection ? 'active' : 'inactive';
  }
}

// Singleton instance
const deepgramSTT = new DeepgramSTT();

module.exports = { deepgramSTT };

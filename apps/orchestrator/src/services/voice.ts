import { ElevenLabsClient } from 'elevenlabs';
import { Deepgram } from 'deepgram';
import axios from 'axios';
import { TTSRequest, TTSResponse, AudioTranscribeRequest, AudioTranscribeResponse } from '@ai-companion/shared';

export class VoiceService {
  private elevenlabs: ElevenLabsClient;
  private deepgram: Deepgram;

  constructor() {
    this.elevenlabs = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY || '',
    });

    this.deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY || '');
  }

  async textToSpeech(request: TTSRequest): Promise<TTSResponse> {
    try {
      const { text, voice = 'bella', language = 'en', speed = 1, pitch = 1, style, provider = 'elevenlabs' } = request;

      if (provider === 'azure') {
        return this.textToSpeechAzure(text, 'en-US-AriaNeural');
      }

      // ElevenLabs with controllable tone
      const audio = await this.elevenlabs.textToSpeech.convert(voice, {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: Math.max(0, Math.min(1, 0.6 - (speed - 1) * 0.2)),
          similarity_boost: Math.max(0, Math.min(1, 0.6 + (pitch - 1) * 0.2)),
          style: style,
          speaking_rate: speed,
          pitch_shift: Math.round((pitch - 1) * 12),
        } as any,
      } as any);

      // Convert to base64 for response
      const audioBuffer = Buffer.from(await audio.arrayBuffer());
      const audioBase64 = audioBuffer.toString('base64');
      const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

      // Estimate duration (rough calculation)
      const duration = text.length * 0.05; // ~50ms per character

      return {
        audioUrl,
        duration,
      };
    } catch (error) {
      console.error('TTS error:', error);
      throw new Error('Failed to generate speech');
    }
  }

  async textToSpeechStream(text: string, voice: string = 'bella'): Promise<ReadableStream<Uint8Array>> {
    try {
      const audio = await this.elevenlabs.textToSpeech.convert(voice, {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      });

      return audio as ReadableStream<Uint8Array>;
    } catch (error) {
      console.error('TTS streaming error:', error);
      throw new Error('Failed to generate speech stream');
    }
  }

  async transcribeAudio(request: AudioTranscribeRequest): Promise<AudioTranscribeResponse> {
    try {
      const { audio, language = 'en' } = request;

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audio, 'base64');

      // Use Deepgram for transcription
      const response = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          language: language,
          smart_format: true,
          punctuate: true,
        }
      );

      const transcript = response.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      const confidence = response.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

      return {
        text: transcript,
        confidence,
      };
    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  async transcribeAudioStream(audioStream: ReadableStream<Uint8Array>): Promise<ReadableStream<string>> {
    try {
      // For streaming transcription, you'd typically use WebSocket
      // This is a simplified version
      const reader = audioStream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const audioBuffer = Buffer.concat(chunks);
      const response = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          smart_format: true,
          punctuate: true,
        }
      );

      const transcript = response.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      
      return new ReadableStream({
        start(controller) {
          controller.enqueue(transcript);
          controller.close();
        },
      });
    } catch (error) {
      console.error('Streaming transcription error:', error);
      throw new Error('Failed to transcribe audio stream');
    }
  }

  async getAvailableVoices(): Promise<string[]> {
    try {
      const voices = await this.elevenlabs.voices.getAll();
      return voices.voices.map(voice => voice.voice_id);
    } catch (error) {
      console.error('Get voices error:', error);
      return ['bella', 'josh', 'arnold', 'adam', 'sam']; // Fallback voices
    }
  }

  async getVoiceInfo(voiceId: string): Promise<any> {
    try {
      const voice = await this.elevenlabs.voices.get(voiceId);
      return voice;
    } catch (error) {
      console.error('Get voice info error:', error);
      return null;
    }
  }

  // Alternative TTS using Azure Speech (if ElevenLabs fails)
  async textToSpeechAzure(text: string, voice: string = 'en-US-AriaNeural'): Promise<TTSResponse> {
    try {
      const subscriptionKey = process.env.AZURE_SPEECH_KEY;
      const region = process.env.AZURE_SPEECH_REGION;

      if (!subscriptionKey || !region) {
        throw new Error('Azure Speech credentials not configured');
      }

      const ssml = `
        <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
          <voice name='${voice}'>${text}</voice>
        </speak>
      `;

      const response = await axios.post(
        `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        ssml,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': subscriptionKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          },
          responseType: 'arraybuffer',
        }
      );

      const audioBuffer = Buffer.from(response.data);
      const audioBase64 = audioBuffer.toString('base64');
      const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

      const duration = text.length * 0.05;

      return {
        audioUrl,
        duration,
      };
    } catch (error) {
      console.error('Azure TTS error:', error);
      throw new Error('Failed to generate speech with Azure');
    }
  }
}

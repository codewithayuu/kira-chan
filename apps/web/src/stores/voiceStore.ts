import { create } from 'zustand';
import { TTSRequest, AudioTranscribeRequest } from '@ai-companion/shared';

interface VoiceState {
  // Recording state
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  
  // Playing state
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  
  // Audio context
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  setAudioContext: (context: AudioContext | null) => void;
  setAnalyser: (analyser: AnalyserNode | null) => void;
  
  // Voice settings
  selectedVoice: string;
  setSelectedVoice: (voice: string) => void;
  
  // Available voices
  availableVoices: string[];
  setAvailableVoices: (voices: string[]) => void;
  
  // Voice functions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  playAudio: (audioUrl: string) => Promise<void>;
  transcribeAudio: (audioBlob: Blob) => Promise<string>;
  textToSpeech: (text: string) => Promise<string>;
  loadVoices: () => Promise<void>;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  // Recording state
  isRecording: false,
  setIsRecording: (recording) => set({ isRecording: recording }),
  
  // Playing state
  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  
  // Audio context
  audioContext: null,
  analyser: null,
  setAudioContext: (context) => set({ audioContext: context }),
  setAnalyser: (analyser) => set({ analyser }),
  
  // Voice settings
  selectedVoice: 'bella',
  setSelectedVoice: (voice) => set({ selectedVoice: voice }),
  
  // Available voices
  availableVoices: ['bella', 'josh', 'arnold', 'adam', 'sam'],
  setAvailableVoices: (voices) => set({ availableVoices: voices }),
  
  // Voice functions
  startRecording: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create audio context for analysis
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      
      set({ 
        isRecording: true,
        audioContext,
        analyser
      });
      
      // Store stream for stopping later
      (window as any).currentStream = stream;
      
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  },
  
  stopRecording: async () => {
    const { isRecording } = get();
    if (!isRecording) return;
    
    try {
      // Stop the media stream
      const stream = (window as any).currentStream;
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        delete (window as any).currentStream;
      }
      
      set({ 
        isRecording: false,
        audioContext: null,
        analyser: null
      });
      
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  },
  
  playAudio: async (audioUrl: string) => {
    try {
      set({ isPlaying: true });
      
      const audio = new Audio(audioUrl);
      
      // Set up audio analysis for lip-sync
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaElementSource(audio);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      
      set({ audioContext, analyser });
      
      audio.onended = () => {
        set({ isPlaying: false, audioContext: null, analyser: null });
      };
      
      audio.onerror = () => {
        set({ isPlaying: false, audioContext: null, analyser: null });
      };
      
      await audio.play();
      
    } catch (error) {
      console.error('Error playing audio:', error);
      set({ isPlaying: false, audioContext: null, analyser: null });
    }
  },
  
  transcribeAudio: async (audioBlob: Blob) => {
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const request: AudioTranscribeRequest = {
        audio: base64,
        language: 'en',
      };
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_ORCHESTRATOR_URL}/api/voice/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        throw new Error('Transcription failed');
      }
      
      const result = await response.json();
      return result.text;
      
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  },
  
  textToSpeech: async (text: string) => {
    try {
      const { selectedVoice } = get();
      
      const request: TTSRequest = {
        text,
        voice: selectedVoice,
        language: 'en',
      };
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_ORCHESTRATOR_URL}/api/voice/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        throw new Error('TTS failed');
      }
      
      const result = await response.json();
      return result.audioUrl;
      
    } catch (error) {
      console.error('Error generating speech:', error);
      throw error;
    }
  },
  
  loadVoices: async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_ORCHESTRATOR_URL}/api/voice/voices`);
      
      if (!response.ok) {
        throw new Error('Failed to load voices');
      }
      
      const result = await response.json();
      set({ availableVoices: result.voices });
      
    } catch (error) {
      console.error('Error loading voices:', error);
    }
  },
}));

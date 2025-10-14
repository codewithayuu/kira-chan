import { useState, useEffect, useRef, useCallback } from 'react';

interface VADOptions {
  minSpeechFrames?: number;
  preSpeechFrames?: number;
  minSilenceFrames?: number;
  sampleRate?: number;
  frameSize?: number;
  threshold?: number;
}

interface VADState {
  isListening: boolean;
  isSpeaking: boolean;
  confidence: number;
  volume: number;
  speechStartTime: number | null;
  speechEndTime: number | null;
}

export function useVAD(options: VADOptions = {}) {
  const {
    minSpeechFrames = 3,
    preSpeechFrames = 10,
    minSilenceFrames = 8,
    sampleRate = 16000,
    frameSize = 512,
    threshold = 0.5,
  } = options;

  const [vadState, setVadState] = useState<VADState>({
    isListening: false,
    isSpeaking: false,
    confidence: 0,
    volume: 0,
    speechStartTime: null,
    speechEndTime: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speechFramesRef = useRef(0);
  const silenceFramesRef = useRef(0);
  const preSpeechBufferRef = useRef<number[]>([]);
  const isProcessingRef = useRef(false);

  const processAudio = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !isProcessingRef.current) {
      return;
    }

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    // Calculate RMS (Root Mean Square) for volume
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i] * dataArrayRef.current[i];
    }
    const rms = Math.sqrt(sum / dataArrayRef.current.length) / 255;
    
    // Calculate confidence based on volume and frequency distribution
    const confidence = Math.min(1, rms * 2);
    
    // Update volume
    setVadState(prev => ({ ...prev, volume: rms, confidence }));

    // VAD Logic
    const isCurrentlySpeaking = confidence > threshold;
    
    if (isCurrentlySpeaking) {
      speechFramesRef.current++;
      silenceFramesRef.current = 0;
      
      // Add to pre-speech buffer
      preSpeechBufferRef.current.push(confidence);
      if (preSpeechBufferRef.current.length > preSpeechFrames) {
        preSpeechBufferRef.current.shift();
      }
      
      // Start speaking if we have enough speech frames
      if (speechFramesRef.current >= minSpeechFrames && !vadState.isSpeaking) {
        setVadState(prev => ({
          ...prev,
          isSpeaking: true,
          speechStartTime: Date.now(),
        }));
      }
    } else {
      silenceFramesRef.current++;
      
      // Stop speaking if we have enough silence frames
      if (silenceFramesRef.current >= minSilenceFrames && vadState.isSpeaking) {
        setVadState(prev => ({
          ...prev,
          isSpeaking: false,
          speechEndTime: Date.now(),
        }));
        speechFramesRef.current = 0;
        preSpeechBufferRef.current = [];
      }
    }

    animationFrameRef.current = requestAnimationFrame(processAudio);
  }, [threshold, minSpeechFrames, minSilenceFrames, vadState.isSpeaking]);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate,
      });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      analyserRef.current.fftSize = frameSize * 2;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      source.connect(analyserRef.current);
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      isProcessingRef.current = true;
      setVadState(prev => ({ ...prev, isListening: true }));
      
      processAudio();
      
      return stream;
    } catch (error) {
      console.error('Error starting VAD:', error);
      throw error;
    }
  }, [sampleRate, frameSize, processAudio]);

  const stopListening = useCallback(() => {
    isProcessingRef.current = false;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    setVadState(prev => ({
      ...prev,
      isListening: false,
      isSpeaking: false,
      speechStartTime: null,
      speechEndTime: null,
    }));
    
    speechFramesRef.current = 0;
    silenceFramesRef.current = 0;
    preSpeechBufferRef.current = [];
  }, []);

  const getSpeechDuration = useCallback(() => {
    if (vadState.speechStartTime && vadState.speechEndTime) {
      return vadState.speechEndTime - vadState.speechStartTime;
    }
    if (vadState.speechStartTime && !vadState.speechEndTime) {
      return Date.now() - vadState.speechStartTime;
    }
    return 0;
  }, [vadState.speechStartTime, vadState.speechEndTime]);

  const getPreSpeechBuffer = useCallback(() => {
    return [...preSpeechBufferRef.current];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    ...vadState,
    startListening,
    stopListening,
    getSpeechDuration,
    getPreSpeechBuffer,
  };
}

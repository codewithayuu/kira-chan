import { useEffect, useRef, useState } from 'react';

export function useAudioAnalyser(audioElement: HTMLAudioElement | null) {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const animationIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioElement) return;

    const setupAudioContext = async () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = ctx.createMediaElementSource(audioElement);
        const analyserNode = ctx.createAnalyser();

        analyserNode.fftSize = 1024;
        analyserNode.smoothingTimeConstant = 0.8;

        source.connect(analyserNode);
        analyserNode.connect(ctx.destination);

        setAudioContext(ctx);
        setAnalyser(analyserNode);
      } catch (error) {
        console.error('Failed to setup audio context:', error);
      }
    };

    setupAudioContext();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [audioElement]);

  const getFrequencyData = (): Uint8Array | null => {
    if (!analyser) return null;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    return dataArray;
  };

  const getTimeDomainData = (): Uint8Array | null => {
    if (!analyser) return null;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  };

  const getRMS = (): number => {
    const data = getTimeDomainData();
    if (!data) return 0;

    let rms = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      rms += v * v;
    }
    return Math.sqrt(rms / data.length);
  };

  const getAmplitude = (): number => {
    const data = getTimeDomainData();
    if (!data) return 0;

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += Math.abs(data[i] - 128);
    }
    return sum / data.length / 128;
  };

  return {
    analyser,
    audioContext,
    getFrequencyData,
    getTimeDomainData,
    getRMS,
    getAmplitude,
  };
}

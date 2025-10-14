'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';
import { useVAD } from '@/hooks/useVAD';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Star, Sparkles, Zap } from 'lucide-react';

interface Live2DAnimation {
  name: string;
  duration: number;
  loop: boolean;
  priority: number;
}

interface Live2DParameter {
  id: string;
  value: number;
  min: number;
  max: number;
}

export function EnhancedLive2DAvatar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAnimation, setCurrentAnimation] = useState<string>('idle');
  const [isInteracting, setIsInteracting] = useState(false);
  const [mood, setMood] = useState<'happy' | 'sad' | 'excited' | 'thinking' | 'neutral'>('neutral');
  const [interactionCount, setInteractionCount] = useState(0);
  
  const { analyser, isPlaying, isRecording } = useVoiceStore();
  const { isSpeaking, volume, confidence } = useVAD({
    threshold: 0.3,
    minSpeechFrames: 2,
    minSilenceFrames: 5,
  });

  // Animation states
  const [animations, setAnimations] = useState<Live2DAnimation[]>([
    { name: 'idle', duration: 3000, loop: true, priority: 1 },
    { name: 'happy', duration: 2000, loop: false, priority: 3 },
    { name: 'sad', duration: 2500, loop: false, priority: 3 },
    { name: 'excited', duration: 1500, loop: false, priority: 4 },
    { name: 'thinking', duration: 4000, loop: true, priority: 2 },
    { name: 'talking', duration: 1000, loop: true, priority: 5 },
  ]);

  const [parameters, setParameters] = useState<Live2DParameter[]>([
    { id: 'PARAM_MOUTH_OPEN_Y', value: 0, min: 0, max: 1 },
    { id: 'PARAM_EYE_L_OPEN', value: 1, min: 0, max: 1 },
    { id: 'PARAM_EYE_R_OPEN', value: 1, min: 0, max: 1 },
    { id: 'PARAM_ANGLE_X', value: 0, min: -30, max: 30 },
    { id: 'PARAM_ANGLE_Y', value: 0, min: -30, max: 30 },
    { id: 'PARAM_ANGLE_Z', value: 0, min: -30, max: 30 },
    { id: 'PARAM_BODY_ANGLE_X', value: 0, min: -10, max: 10 },
    { id: 'PARAM_BODY_ANGLE_Y', value: 0, min: -10, max: 10 },
    { id: 'PARAM_BODY_ANGLE_Z', value: 0, min: -10, max: 10 },
  ]);

  // Initialize Live2D
  useEffect(() => {
    let app: any = null;
    let model: any = null;
    let animationId: number | null = null;
    let lastUpdateTime = 0;

    const initLive2D = async () => {
      try {
        const { Application } = await import('pixi.js');
        const { Live2DModel } = await import('pixi-live2d-display');

        if (!containerRef.current) return;

        app = new Application({
          width: 500,
          height: 700,
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
          antialias: true,
          powerPreference: 'high-performance',
        });

        containerRef.current.appendChild(app.view as HTMLCanvasElement);

        // Try to load the model
        const modelPath = '/models/hiyori/hiyori_free_t08.model3.json';
        
        try {
          model = await Live2DModel.from(modelPath);
          model.scale.set(0.35);
          model.position.set(250, 500);
          model.interactive = true;
          model.buttonMode = true;
          
          app.stage.addChild(model);
          setIsLoaded(true);
          
          // Set up model interactions
          setupModelInteractions(model);
          
        } catch (modelError) {
          console.warn('Live2D model not found, using enhanced placeholder:', modelError);
          createEnhancedPlaceholder(app);
          setIsLoaded(true);
        }

        // Enhanced animation loop
        const animate = (currentTime: number) => {
          if (currentTime - lastUpdateTime >= 16) { // ~60fps
            updateParameters();
            updateAnimations();
            lastUpdateTime = currentTime;
          }
          animationId = requestAnimationFrame(animate);
        };

        animate(0);

      } catch (error) {
        console.error('Failed to initialize Live2D:', error);
        setError('Failed to load avatar');
        createEnhancedPlaceholder(app);
        setIsLoaded(true);
      }
    };

    initLive2D();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (app) {
        app.destroy(true);
      }
    };
  }, []);

  const setupModelInteractions = (model: any) => {
    // Click interactions
    model.on('pointerdown', (event: any) => {
      setIsInteracting(true);
      setInteractionCount(prev => prev + 1);
      
      // Trigger random happy animation
      const happyAnimations = ['happy', 'excited'];
      const randomAnimation = happyAnimations[Math.floor(Math.random() * happyAnimations.length)];
      triggerAnimation(randomAnimation);
      
      // Show interaction feedback
      showInteractionFeedback(event.data.global.x, event.data.global.y);
    });

    // Hover interactions
    model.on('pointerover', () => {
      if (!isInteracting) {
        triggerAnimation('thinking');
      }
    });

    model.on('pointerout', () => {
      if (!isInteracting) {
        triggerAnimation('idle');
      }
    });
  };

  const createEnhancedPlaceholder = (app: any) => {
    if (!app) return;
    
    const graphics = new (window as any).PIXI.Graphics();
    
    // Main body
    graphics.beginFill(0xFF69B4);
    graphics.drawCircle(250, 350, 120);
    graphics.endFill();
    
    // Eyes
    graphics.beginFill(0xFFFFFF);
    graphics.drawCircle(200, 300, 20);
    graphics.drawCircle(300, 300, 20);
    graphics.endFill();
    
    // Pupils
    graphics.beginFill(0x000000);
    graphics.drawCircle(200, 300, 12);
    graphics.drawCircle(300, 300, 12);
    graphics.endFill();
    
    // Mouth
    graphics.beginFill(0xFF1493);
    graphics.drawEllipse(250, 380, 30, 15);
    graphics.endFill();
    
    // Hair
    graphics.beginFill(0x8B4513);
    graphics.drawEllipse(250, 200, 140, 80);
    graphics.endFill();
    
    // Blush
    graphics.beginFill(0xFFB6C1, 0.6);
    graphics.drawEllipse(180, 350, 20, 15);
    graphics.drawEllipse(320, 350, 20, 15);
    graphics.endFill();
    
    app.stage.addChild(graphics);
  };

  const updateParameters = () => {
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);
    
    // Calculate RMS for lip-sync
    let rms = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      rms += v * v;
    }
    rms = Math.sqrt(rms / dataArray.length);
    
    // Update mouth parameter based on voice activity
    const mouthOpen = isSpeaking ? Math.min(1, rms * 15) : 0;
    updateParameter('PARAM_MOUTH_OPEN_Y', mouthOpen);
    
    // Update eye parameters based on mood
    const eyeOpen = mood === 'excited' ? 1.2 : mood === 'sad' ? 0.7 : 1;
    updateParameter('PARAM_EYE_L_OPEN', Math.min(1, eyeOpen));
    updateParameter('PARAM_EYE_R_OPEN', Math.min(1, eyeOpen));
    
    // Add subtle breathing animation
    const breathing = Math.sin(Date.now() * 0.001) * 0.02;
    updateParameter('PARAM_BODY_ANGLE_Y', breathing);
  };

  const updateAnimations = () => {
    // Auto-trigger animations based on state
    if (isSpeaking && currentAnimation !== 'talking') {
      triggerAnimation('talking');
    } else if (!isSpeaking && currentAnimation === 'talking') {
      triggerAnimation('idle');
    }
    
    // Mood-based animations
    if (mood === 'excited' && currentAnimation === 'idle') {
      triggerAnimation('happy');
    }
  };

  const updateParameter = (id: string, value: number) => {
    setParameters(prev => prev.map(param => 
      param.id === id 
        ? { ...param, value: Math.max(param.min, Math.min(param.max, value)) }
        : param
    ));
  };

  const triggerAnimation = (animationName: string) => {
    const animation = animations.find(a => a.name === animationName);
    if (!animation) return;
    
    setCurrentAnimation(animationName);
    
    // Update mood based on animation
    if (animationName === 'happy' || animationName === 'excited') {
      setMood('happy');
    } else if (animationName === 'sad') {
      setMood('sad');
    } else if (animationName === 'thinking') {
      setMood('thinking');
    } else {
      setMood('neutral');
    }
    
    // Auto-return to idle after non-looping animations
    if (!animation.loop) {
      setTimeout(() => {
        if (currentAnimation === animationName) {
          triggerAnimation('idle');
        }
      }, animation.duration);
    }
  };

  const showInteractionFeedback = (x: number, y: number) => {
    // Create floating hearts or sparkles
    const feedback = document.createElement('div');
    feedback.className = 'absolute pointer-events-none text-pink-500 text-2xl animate-bounce';
    feedback.style.left = `${x}px`;
    feedback.style.top = `${y}px`;
    feedback.innerHTML = '❤️';
    
    containerRef.current?.appendChild(feedback);
    
    setTimeout(() => {
      feedback.remove();
    }, 1000);
  };

  const handleMoodChange = (newMood: typeof mood) => {
    setMood(newMood);
    const moodAnimations = {
      happy: 'happy',
      sad: 'sad',
      excited: 'excited',
      thinking: 'thinking',
      neutral: 'idle',
    };
    triggerAnimation(moodAnimations[newMood]);
  };

  return (
    <div className="relative w-full h-full">
      {/* Main Avatar Container */}
      <motion.div
        ref={containerRef}
        className="live2d-container w-full h-full mx-auto relative"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {!isLoaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading Aanya...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-pink-100 to-purple-100 rounded-2xl">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-bounce">🌸</div>
              <p className="text-gray-600 font-medium">Aanya is here!</p>
              <p className="text-sm text-gray-500 mt-2">Enhanced avatar loading...</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Status Indicators */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <AnimatePresence>
          {isPlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
            >
              <Zap size={14} />
              Speaking
            </motion.div>
          )}
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
            >
              <Zap size={14} />
              Listening
            </motion.div>
          )}
          {isSpeaking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
            >
              <Sparkles size={14} />
              Voice Detected
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mood Controls */}
      <div className="absolute bottom-4 left-4 flex gap-2">
        {(['happy', 'sad', 'excited', 'thinking', 'neutral'] as const).map((moodType) => (
          <button
            key={moodType}
            onClick={() => handleMoodChange(moodType)}
            className={`p-2 rounded-full transition-all duration-200 ${
              mood === moodType
                ? 'bg-pink-500 text-white shadow-lg'
                : 'bg-white/50 text-gray-600 hover:bg-white/80'
            }`}
            title={`Set mood to ${moodType}`}
          >
            {moodType === 'happy' && <Heart size={16} />}
            {moodType === 'sad' && <span className="text-sm">😢</span>}
            {moodType === 'excited' && <Star size={16} />}
            {moodType === 'thinking' && <span className="text-sm">🤔</span>}
            {moodType === 'neutral' && <span className="text-sm">😐</span>}
          </button>
        ))}
      </div>

      {/* Interaction Counter */}
      {interactionCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm text-gray-700"
        >
          Interactions: {interactionCount}
        </motion.div>
      )}

      {/* Voice Activity Indicator */}
      {isSpeaking && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 bg-pink-500 rounded-full"
                animate={{
                  height: [4, 20, 4],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
                style={{ height: 4 }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

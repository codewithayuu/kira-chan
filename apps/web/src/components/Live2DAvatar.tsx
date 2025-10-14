'use client';

import { useEffect, useRef, useState } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';
import { motion } from 'framer-motion';

export function Live2DAvatar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { analyser, isPlaying, isRecording } = useVoiceStore();

  useEffect(() => {
    let app: any = null;
    let model: any = null;
    let animationId: number | null = null;

    const initLive2D = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { Application } = await import('pixi.js');
        const { Live2DModel } = await import('pixi-live2d-display');

        if (!containerRef.current) return;

        // Create PIXI application
        app = new Application({
          width: 400,
          height: 600,
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
          antialias: true,
        });

        containerRef.current.appendChild(app.view as HTMLCanvasElement);

        // Load Live2D model
        // Note: You'll need to add a sample model to public/models/
        // For now, we'll create a placeholder
        const modelPath = '/models/hiyori/hiyori_free_t08.model3.json';
        
        try {
          model = await Live2DModel.from(modelPath);
          model.scale.set(0.3);
          model.position.set(200, 450);
          app.stage.addChild(model);
          setIsLoaded(true);
        } catch (modelError) {
          console.warn('Live2D model not found, using placeholder:', modelError);
          // Create a simple placeholder
          createPlaceholderAvatar(app);
          setIsLoaded(true);
        }

        // Set up lip-sync animation
        const animate = () => {
          if (analyser && model) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteTimeDomainData(dataArray);
            
            // Calculate RMS for lip-sync
            let rms = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const v = (dataArray[i] - 128) / 128;
              rms += v * v;
            }
            rms = Math.sqrt(rms / dataArray.length);
            
            // Map RMS to mouth opening (0-1)
            const mouthOpen = Math.min(1, rms * 10);
            
            // Update Live2D model parameters
            if (model.internalModel?.coreModel) {
              try {
                model.internalModel.coreModel.setParameterValueById('PARAM_MOUTH_OPEN_Y', mouthOpen);
              } catch (e) {
                // Parameter might not exist in all models
                console.debug('Mouth parameter not available');
              }
            }
          }
          
          animationId = requestAnimationFrame(animate);
        };

        animate();

        // Handle model interactions
        if (model) {
          model.on('hit', (hitAreas: string[]) => {
            console.log('Hit areas:', hitAreas);
            // Trigger random animations on click
            if (model.internalModel?.coreModel) {
              try {
                const motions = ['idle', 'happy', 'surprised', 'sad'];
                const randomMotion = motions[Math.floor(Math.random() * motions.length)];
                // This would trigger the actual motion in a real implementation
                console.log('Triggering motion:', randomMotion);
              } catch (e) {
                console.debug('Motion trigger not available');
              }
            }
          });
        }

      } catch (error) {
        console.error('Failed to initialize Live2D:', error);
        setError('Failed to load avatar');
        createPlaceholderAvatar(app);
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
  }, [analyser]);

  const createPlaceholderAvatar = (app: any) => {
    if (!app) return;
    
    // Create a simple circle as placeholder
    const graphics = new (window as any).PIXI.Graphics();
    graphics.beginFill(0xFF69B4);
    graphics.drawCircle(200, 300, 100);
    graphics.endFill();
    
    // Add eyes
    graphics.beginFill(0xFFFFFF);
    graphics.drawCircle(170, 270, 15);
    graphics.drawCircle(230, 270, 15);
    graphics.endFill();
    
    // Add pupils
    graphics.beginFill(0x000000);
    graphics.drawCircle(170, 270, 8);
    graphics.drawCircle(230, 270, 8);
    graphics.endFill();
    
    // Add mouth
    graphics.beginFill(0xFF1493);
    graphics.drawEllipse(200, 320, 20, 10);
    graphics.endFill();
    
    app.stage.addChild(graphics);
  };

  return (
    <div className="relative">
      <motion.div
        ref={containerRef}
        className="live2d-container w-96 h-96 mx-auto"
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
              <div className="text-6xl mb-4">🌸</div>
              <p className="text-gray-600">Aanya is here!</p>
              <p className="text-sm text-gray-500 mt-2">Avatar loading...</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Status indicators */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
        {isPlaying && (
          <motion.div
            className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            🔊 Speaking
          </motion.div>
        )}
        {isRecording && (
          <motion.div
            className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
          >
            🎤 Listening
          </motion.div>
        )}
      </div>

      {/* Welcome message */}
      {isLoaded && !isPlaying && !isRecording && (
        <motion.div
          className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <p className="text-sm text-gray-700">👋 Hi! I'm Aanya</p>
        </motion.div>
      )}
    </div>
  );
}

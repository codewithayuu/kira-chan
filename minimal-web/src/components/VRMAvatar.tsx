'use client';

import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';

interface VRMAvatarProps {
  vrmUrl?: string;
  emotion?: string;
  intensity?: number;
  isSpeaking?: boolean;
  audioLevel?: number;
  className?: string;
}

// Simplified Avatar Component (VRM temporarily disabled for build compatibility)
function VRMAvatarModel({ 
  vrmUrl, 
  emotion, 
  intensity = 0.5, 
  isSpeaking = false, 
  audioLevel = 0 
}: VRMAvatarProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simplified loading for now
  useEffect(() => {
    if (vrmUrl) {
      setIsLoaded(true);
      setError(null);
      console.log('✅ Avatar placeholder loaded');
    }
  }, [vrmUrl]);

  if (error) {
    return (
      <div className="flex items-center justify-center bg-red-100 rounded-lg">
        <div className="text-red-600 text-sm">{error}</div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center bg-gray-200 rounded-lg">
        <div className="text-gray-500">Loading avatar...</div>
      </div>
    );
  }

  // Simple placeholder avatar
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial 
        color={emotion === 'happy' ? '#ffeb3b' : emotion === 'sad' ? '#2196f3' : '#f5f5f5'} 
        transparent 
        opacity={0.8} 
      />
    </mesh>
  );
}

// Main VRM Avatar Component
export default function VRMAvatar({
  vrmUrl = '/avatars/kira.vrm',
  emotion = 'neutral',
  intensity = 0.5,
  isSpeaking = false,
  audioLevel = 0,
  className = ''
}: VRMAvatarProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className={`flex items-center justify-center bg-gray-200 rounded-lg ${className}`}>
        <div className="text-gray-500">Loading avatar...</div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Canvas
        camera={{ position: [0, 1.6, 2], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        
        <Environment preset="studio" />
        
        <VRMAvatarModel
          vrmUrl={vrmUrl}
          emotion={emotion}
          intensity={intensity}
          isSpeaking={isSpeaking}
          audioLevel={audioLevel}
        />
        
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2}
          target={[0, 1.6, 0]}
        />
      </Canvas>
      
      {/* Status indicator */}
      <div className="absolute top-2 right-2 flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${
          isSpeaking ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
        }`} />
        <span className="text-xs text-gray-600">
          {emotion} ({Math.round(intensity * 100)}%)
        </span>
      </div>
      
      {/* Audio level indicator */}
      {isSpeaking && (
        <div className="absolute bottom-2 left-2 right-2">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-400 transition-all duration-100"
              style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
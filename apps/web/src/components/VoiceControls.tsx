'use client';

import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Settings, Play, Pause } from 'lucide-react';
import { useVoiceStore } from '@/stores/voiceStore';
import { motion } from 'framer-motion';

export function VoiceControls() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  
  const {
    selectedVoice,
    setSelectedVoice,
    availableVoices,
    loadVoices,
    isPlaying,
    isRecording,
  } = useVoiceStore();

  useEffect(() => {
    loadVoices();
  }, [loadVoices]);

  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    // In a real implementation, you'd update the audio volume here
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="p-4 bg-white/30 backdrop-blur-sm border-t border-white/20">
      <div className="flex items-center justify-between">
        {/* Voice Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isPlaying ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-blue-500"
              >
                <Volume2 size={20} />
              </motion.div>
            ) : (
              <VolumeX size={20} className="text-gray-400" />
            )}
            
            <span className="text-sm text-gray-600">
              {isPlaying ? 'Speaking' : isRecording ? 'Listening' : 'Silent'}
            </span>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${(isMuted ? 0 : volume) * 100}%, #e5e7eb ${(isMuted ? 0 : volume) * 100}%, #e5e7eb 100%)`
              }}
            />
          </div>
        </div>

        {/* Settings Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Expanded Settings */}
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="mt-4 pt-4 border-t border-white/20 space-y-4">
          {/* Voice Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Voice
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              {availableVoices.map((voice) => (
                <option key={voice} value={voice}>
                  {voice.charAt(0).toUpperCase() + voice.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Preview */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Preview the selected voice
                useVoiceStore.getState().textToSpeech('Hello! This is how I sound.');
              }}
              className="btn-secondary text-sm px-4 py-2"
            >
              <Play size={16} className="mr-1" />
              Preview Voice
            </button>
            
            <span className="text-xs text-gray-500">
              Currently: {selectedVoice}
            </span>
          </div>

          {/* Audio Quality Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quality
              </label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white/90 text-sm">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Speed
              </label>
              <select className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white/90 text-sm">
                <option value="normal">Normal</option>
                <option value="slow">Slow</option>
                <option value="fast">Fast</option>
              </select>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Auto-play responses</span>
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Push-to-talk</span>
              <input
                type="checkbox"
                className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Voice activation</span>
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

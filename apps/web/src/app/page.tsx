'use client';

import { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/ChatInterface';
import { EnhancedLive2DAvatar } from '@/components/EnhancedLive2DAvatar';
import { VoiceControls } from '@/components/VoiceControls';
import { useChatStore } from '@/stores/chatStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { AdvancedSettings } from '@/components/AdvancedSettings';
import { useUIStore } from '@/stores/uiStore';

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const { isConnected } = useChatStore();
  const { isRecording, isPlaying } = useVoiceStore();
  const { isSettingsOpen, closeSettings } = useUIStore();

  useEffect(() => {
    // Initialize the app
    const init = async () => {
      try {
        // Check if orchestrator is available
        const response = await fetch(`${process.env.NEXT_PUBLIC_ORCHESTRATOR_URL}/health`);
        if (response.ok) {
          useChatStore.getState().setConnected(true);
        }
      } catch (error) {
        console.error('Failed to connect to orchestrator:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    init();
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Aanya...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="flex-1 flex">
        <Sidebar />
        
        <main className="flex-1 flex flex-col lg:flex-row">
          {/* Live2D Avatar Section */}
          <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
            <div className="relative">
              <EnhancedLive2DAvatar />
              
              {/* Voice Status Indicators */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                {isRecording && (
                  <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                    🎤 Recording...
                  </div>
                )}
                {isPlaying && (
                  <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                    🔊 Speaking...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Interface Section */}
          <div className="w-full lg:w-1/2 flex flex-col">
            <div className="flex-1 flex flex-col">
              <ChatInterface />
              <VoiceControls />
            </div>
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      <AdvancedSettings isOpen={isSettingsOpen} onClose={closeSettings} />

      {/* Connection Status */}
      {!isConnected && (
        <div className="fixed bottom-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          ⚠️ Disconnected from server
        </div>
      )}
    </div>
  );
}

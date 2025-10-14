'use client';

import { useState } from 'react';
import { Heart, Settings, User, MessageCircle, Phone, Video } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useUIStore } from '@/stores/uiStore';
import { motion } from 'framer-motion';

export function Header() {
  const [showMenu, setShowMenu] = useState(false);
  const { isConnected, startNewConversation } = useChatStore();
  const { openSettings } = useUIStore();

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Heart className="w-6 h-6 text-white" />
            </motion.div>
            
            <div>
              <h1 className="text-xl font-bold gradient-text">Aanya</h1>
              <p className="text-sm text-gray-500">Your AI Companion</p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={startNewConversation}
                className="p-2 text-gray-500 hover:text-pink-500 transition-colors"
                title="New conversation"
              >
                <MessageCircle size={20} />
              </button>

              <button
                className="p-2 text-gray-500 hover:text-pink-500 transition-colors"
                title="Voice call"
              >
                <Phone size={20} />
              </button>

              <button
                className="p-2 text-gray-500 hover:text-pink-500 transition-colors"
                title="Video call"
              >
                <Video size={20} />
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 text-gray-500 hover:text-pink-500 transition-colors"
                  title="Settings"
                >
                  <Settings size={20} />
                </button>

                {/* Dropdown Menu */}
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                  >
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        // Handle profile
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <User size={16} />
                      Profile
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        openSettings();
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Settings size={16} />
                      Settings
                    </button>
                    
                    <hr className="my-1" />
                    
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        startNewConversation();
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <MessageCircle size={16} />
                      New Chat
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}
    </header>
  );
}

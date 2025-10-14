'use client';

import { useState } from 'react';
import { MessageCircle, Plus, Trash2, Settings, Heart, Star } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { motion } from 'framer-motion';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  isActive: boolean;
}

export function Sidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      title: 'Getting to know Aanya',
      lastMessage: 'Hello! I\'m so happy to meet you! ✨',
      timestamp: new Date(),
      isActive: true,
    },
    {
      id: '2',
      title: 'Music and Technology',
      lastMessage: 'What kind of music do you enjoy?',
      timestamp: new Date(Date.now() - 3600000),
      isActive: false,
    },
    {
      id: '3',
      title: 'Travel Plans',
      lastMessage: 'I\'d love to hear about your dream destinations!',
      timestamp: new Date(Date.now() - 7200000),
      isActive: false,
    },
  ]);

  const { currentConvoId, setCurrentConvoId, startNewConversation } = useChatStore();

  const handleNewConversation = () => {
    startNewConversation();
    // In a real app, you'd add the new conversation to the list
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConvoId(id);
    // In a real app, you'd load the conversation messages
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => prev.filter(conv => conv.id !== id));
  };

  return (
    <aside className="w-64 bg-white/30 backdrop-blur-sm border-r border-white/20 p-4">
      <div className="flex flex-col h-full">
        {/* New Chat Button */}
        <button
          onClick={handleNewConversation}
          className="btn-primary w-full mb-6 flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          New Chat
        </button>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 px-2">
            Recent Conversations
          </h3>
          
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <motion.div
                key={conversation.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative group cursor-pointer rounded-lg p-3 transition-all duration-200 ${
                  conversation.isActive
                    ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-200'
                    : 'bg-white/50 hover:bg-white/70 border border-transparent hover:border-gray-200'
                }`}
                onClick={() => handleSelectConversation(conversation.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-800 truncate">
                      {conversation.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {conversation.lastMessage}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {conversation.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conversation.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all duration-200"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Active indicator */}
                {conversation.isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-pink-500 to-purple-500 rounded-l-lg" />
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-6 pt-4 border-t border-white/20">
          {/* Favorites */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2 px-2">
              Favorites
            </h3>
            <div className="space-y-1">
              <button className="flex items-center gap-2 w-full px-2 py-2 text-sm text-gray-600 hover:bg-white/50 rounded-lg transition-colors">
                <Star size={16} className="text-yellow-500" />
                Aanya's Personality
              </button>
              <button className="flex items-center gap-2 w-full px-2 py-2 text-sm text-gray-600 hover:bg-white/50 rounded-lg transition-colors">
                <Heart size={16} className="text-red-500" />
                Romantic Mode
              </button>
            </div>
          </div>

          {/* Settings */}
          <button className="flex items-center gap-2 w-full px-2 py-2 text-sm text-gray-600 hover:bg-white/50 rounded-lg transition-colors">
            <Settings size={16} />
            Settings
          </button>
        </div>
      </div>
    </aside>
  );
}

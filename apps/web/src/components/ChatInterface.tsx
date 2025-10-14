'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Settings, Trash2 } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { useUIStore } from '@/stores/uiStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export function ChatInterface() {
  const { openSettings } = useUIStore();
  const [inputText, setInputText] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isTyping,
    isStreaming,
    sendMessage,
    startNewConversation,
    addMessage,
  } = useChatStore();

  const {
    isRecording,
    startRecording,
    stopRecording,
    transcribeAudio,
  } = useVoiceStore();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const message = inputText.trim();
    setInputText('');
    
    try {
      await sendMessage(message, true); // Enable voice by default
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      try {
        await stopRecording();
        setIsVoiceMode(false);
      } catch (error) {
        console.error('Error stopping recording:', error);
        toast.error('Failed to stop recording');
      }
    } else {
      try {
        await startRecording();
        setIsVoiceMode(true);
      } catch (error) {
        console.error('Error starting recording:', error);
        toast.error('Failed to start recording. Please check microphone permissions.');
      }
    }
  };

  const handleVoiceSubmit = async () => {
    if (!isRecording) return;

    try {
      // Get the recorded audio
      const stream = (window as any).currentStream;
      if (!stream) return;

      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        try {
          const transcript = await transcribeAudio(audioBlob);
          if (transcript.trim()) {
            await sendMessage(transcript, true);
          }
        } catch (error) {
          console.error('Error transcribing audio:', error);
          toast.error('Failed to transcribe audio');
        }
      };

      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
        stopRecording();
        setIsVoiceMode(false);
      }, 3000); // Record for 3 seconds

    } catch (error) {
      console.error('Error processing voice input:', error);
      toast.error('Failed to process voice input');
    }
  };

  const handleClearChat = () => {
    startNewConversation();
    toast.success('Chat cleared');
  };

  return (
    <div className="flex flex-col h-full bg-white/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Aanya</h2>
            <p className="text-sm text-gray-500">Your AI Companion</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearChat}
            className="p-2 text-gray-500 hover:text-red-500 transition-colors"
            title="Clear chat"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={openSettings}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`chat-bubble ${
                  message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                {message.timestamp && (
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="chat-bubble chat-bubble-ai">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200/50">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isVoiceMode ? "Recording..." : "Type a message..."}
              disabled={isVoiceMode || isStreaming}
              className="input-field pr-12"
            />
            
            {isVoiceMode && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleVoiceToggle}
              className={`p-3 rounded-full transition-all duration-200 ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              disabled={isStreaming}
            >
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              onClick={isVoiceMode ? handleVoiceSubmit : handleSendMessage}
              disabled={(!inputText.trim() && !isVoiceMode) || isStreaming}
              className="btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
        </div>

        {/* Voice mode instructions */}
        {isVoiceMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-2 text-center"
          >
            <p className="text-sm text-gray-600">
              {isRecording ? 'Speak now...' : 'Click the mic to start recording'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Heart, Settings, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { APIManager } from '@/components/APIManager';
import { Avatar3D } from '@/components/Avatar3D';
import { SettingsModal } from '@/components/SettingsModal';
import { speakBrowser } from '@/lib/tts';
import { createBrowserSTT } from '@/lib/stt';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAPIManagerOpen, setIsAPIManagerOpen] = useState(false);
  const [personaName, setPersonaName] = useState<string>('Kira chan');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [affect, setAffect] = useState({ mood: 'neutral', valence: 0, arousal: 0.3, blush: 0, gaze: 'user', speak_rate: 1.0, pitch: 1.0 });
  const [mouthAmp, setMouthAmp] = useState(0);
  const [convoId, setConvoId] = useState<string | null>(null);
  const sttRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sttRef.current = createBrowserSTT('en-IN');
    }
  }, []);

  // Idle mood decay
  useEffect(() => {
    const id = setInterval(() => {
      setAffect(prev => ({ ...prev, arousal: prev.arousal * 0.98 + 0.02 * 0.3 }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://localhost:3001/api/config');
        const json = await res.json();
        if (json?.success) setPersonaName(json.config.persona.name || 'Kira chan');
      } catch {}
    })();
  }, []);

  // Load last conversation from server on refresh
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('convoId') : null;
    if (!saved) return;
    setConvoId(saved);
    (async () => {
      try {
        const r = await fetch(`http://localhost:3001/api/chat/${saved}/history`);
        if (!r.ok) return;
        const j = await r.json();
        const list = Array.isArray(j.messages) ? j.messages : [];
        const mapped: Message[] = list.map((m: any) => ({ id: m.id, role: m.role, content: m.content, timestamp: new Date(m.timestamp) }));
        setMessages(mapped);
      } catch {}
    })();
  }, []);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputText.trim();
    setInputText('');
    setIsTyping(true);

    try {
      // Call backend API
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'user-1',
          text: messageText,
          convoId: convoId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Handle streaming response (tokens + control)
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let fullResponse = '';
      let sentenceBuf = '';
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

      let decayId: any = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'convo' && data.convoId) {
                setConvoId(data.convoId);
                try { window.localStorage.setItem('convoId', data.convoId); } catch {}
              } else if (data.control || data.type === 'control') {
                const a = data.control || data.affect;
                if (a) setAffect((prev) => ({ ...prev, ...a }));
              } else if (data.token) {
                fullResponse += data.token;
                sentenceBuf += data.token;
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === aiMessage.id 
                      ? { ...msg, content: fullResponse }
                      : msg
                  )
                );
                // token-driven mouth animation
                setMouthAmp(0.9);
                if (decayId) clearInterval(decayId);
                decayId = setInterval(() => {
                  setMouthAmp((m) => {
                    const n = m * 0.8;
                    if (n < 0.05) { clearInterval(decayId); return 0; }
                    return n;
                  });
                }, 50);

                const boundary = /[\.\!\?।]+\s/;
                if (boundary.test(sentenceBuf)) {
                  const match = sentenceBuf.match(/([\s\S]*?[\.\!\?।]+\s)/);
                  if (match && match[1]) {
                    const toSpeak = match[1].trim();
                    sentenceBuf = sentenceBuf.slice(match[1].length);
                    if (toSpeak.length > 0) {
                      speakBrowser(toSpeak, affect as any);
                    }
                  }
                }
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }

      if (sentenceBuf.trim().length > 0) {
        speakBrowser(sentenceBuf.trim(), affect as any);
      }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Fallback response
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I'm having trouble connecting to the server right now. But I'm still here to chat! ${messageText} - that's really interesting! ✨`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceToggle = () => {
    if (isRecording) {
      setIsRecording(false);
      if (sttRef.current) sttRef.current.stop();
      toast.success('Stopped recording');
    } else {
      setIsRecording(true);
      if (sttRef.current) {
        sttRef.current.start((text: string, final: boolean) => {
          setInputText(text);
          if (final) {
            handleSendMessage();
          }
        });
      } else {
        toast.error('Browser STT not supported');
      }
      toast.success('Started recording - speak now!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <motion.div
                className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <Heart className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-xl font-bold gradient-text">{personaName}</h1>
                <p className="text-sm text-gray-500">Your AI Companion</p>
              </div>
              <div className="ml-3 px-3 py-1 rounded-full text-xs font-medium border border-pink-200 bg-pink-50 text-pink-700">
                Mood: {affect.mood}
              </div>
              <div className="ml-2 px-3 py-1 rounded-full text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700">
                Learning: ON
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsAPIManagerOpen(true)}
                className="p-2 text-gray-500 hover:text-pink-500 transition-colors"
                title="Manage API Keys"
              >
                <Key size={20} />
              </button>
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-500 hover:text-pink-500 transition-colors" title="Settings">
                <Settings size={20} />
              </button>
              <a href="/settings/learning" className="px-3 py-1 rounded-full text-xs font-medium border border-indigo-200 bg-indigo-50 text-indigo-700">Learning</a>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto">
        {/* Avatar Section */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full h-[540px] rounded-2xl overflow-hidden shadow-xl bg-white/40">
            <Avatar3D vrmPath="/avatars/chan.vrm" affect={affect as any} mouthAmp={mouthAmp} />
          </div>
        </div>

        {/* Chat Section */}
        <div className="w-full lg:w-1/2 flex flex-col">
          <div className="flex-1 flex flex-col bg-white/60 backdrop-blur-md rounded-2xl shadow-2xl border border-white/30 m-4">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">K</span>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-800">{personaName}</h2>
                  <p className="text-xs text-gray-500">valence {affect.valence.toFixed(2)} · arousal {affect.arousal.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
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
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
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
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200/50">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={isRecording ? "Recording..." : "Type a message..."}
                    disabled={isRecording || isTyping}
                    className="input-field pr-12"
                  />
                  
                  {isRecording && (
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
                    disabled={isTyping}
                  >
                    {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>

                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() || isTyping}
                    className="btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>

              {/* Voice mode instructions */}
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 text-center"
                >
                  <p className="text-sm text-gray-600">
                    Speak now... (Voice recognition coming soon!)
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* API Manager Modal */}
      <APIManager 
        isOpen={isAPIManagerOpen} 
        onClose={() => setIsAPIManagerOpen(false)} 
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={async () => {
          setIsSettingsOpen(false);
          try {
            const res = await fetch('http://localhost:3001/api/config');
            const json = await res.json();
            if (json?.success) setPersonaName(json.config.persona.name || 'Kira chan');
          } catch {}
        }}
      />
    </div>
  );
}

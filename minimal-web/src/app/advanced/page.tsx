'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mic, MicOff, Settings, Brain, Zap, Heart, BarChart3, Volume2, VolumeX } from 'lucide-react';
import VRMAvatar from '../../components/VRMAvatar';
import QualityDashboard from '../../components/QualityDashboard';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  voice?: boolean;
}

interface Conversation {
  id: string;
  userId: string;
  messages: Message[];
  summary: string;
  lastUserAt: string;
  createdAt: string;
}

export default function AdvancedChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  // Voice and avatar states
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [emotionIntensity, setEmotionIntensity] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  
  // WebSocket for real-time features
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [sttConnection, setSttConnection] = useState<WebSocket | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Load conversation on mount
  useEffect(() => {
    const savedConvoId = localStorage.getItem('convoId');
    if (savedConvoId) {
      loadConversation(savedConvoId);
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
      console.log('🔌 WebSocket connected');
      setWsConnection(ws);
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message:', data);
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setWsConnection(null);
    };
    
    return () => ws.close();
  }, []);

  // Load providers and stats
  useEffect(() => {
    loadProviders();
    loadStats();
  }, []);

  const loadConversation = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/chat/${id}`);
      if (response.ok) {
        const convo: Conversation = await response.json();
        setMessages(convo.messages);
        setConvoId(id);
        localStorage.setItem('convoId', id);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/providers');
      const data = await response.json();
      setProviders(data);
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string, voice = false) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      voice
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-1',
          convoId,
          text,
          voice
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'convo') {
                  setConvoId(data.convoId);
                  localStorage.setItem('convoId', data.convoId);
                } else if (data.type === 'token') {
                  assistantMessage += data.token;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    
                    if (lastMessage?.role === 'assistant') {
                      lastMessage.content = assistantMessage;
                    } else {
                      newMessages.push({
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: assistantMessage,
                        timestamp: new Date().toISOString(),
                        voice
                      });
                    }
                    
                    return newMessages;
                  });
                } else if (data.type === 'end') {
                  // Generate TTS if not muted
                  if (!isMuted && voice) {
                    await generateTTS(assistantMessage);
                  }
                  break;
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateTTS = async (text: string) => {
    try {
      setIsSpeaking(true);
      
      const response = await fetch('http://localhost:3001/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          tone: currentEmotion
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.play();
      }
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
    }
  };

  const startRecording = async () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setInput(finalTranscript);
          setIsRecording(false);
          sendMessage(finalTranscript, true);
        } else if (interimTranscript) {
          setInput(interimTranscript);
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Kira Chan - Advanced</h1>
              <p className="text-sm text-white/70">Human-like AI with voice & 3D avatar</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {stats && (
              <div className="hidden md:flex items-center space-x-4 text-sm text-white/70">
                <div className="flex items-center space-x-1">
                  <Brain className="w-4 h-4" />
                  <span>{stats.providers} providers</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Zap className="w-4 h-4" />
                  <span>{stats.conversations} convos</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Volume2 className="w-4 h-4" />
                  <span>{stats.stt ? 'STT' : 'No STT'}</span>
                </div>
              </div>
            )}
            
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <BarChart3 className="w-5 h-5 text-white" />
            </button>
            
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-lg transition-colors ${
                isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Quality Dashboard */}
      {showDashboard && (
        <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <QualityDashboard />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Messages */}
          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Heart className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Welcome to Kira Chan Advanced!</h2>
                  <p className="text-white/70 mb-6">Your human-like AI companion with voice, 3D avatar, and advanced conversation</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                        : 'bg-white/10 backdrop-blur-sm text-white border border-white/20'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                      {message.voice && (
                        <div className="flex items-center space-x-1">
                          <Volume2 className="w-3 h-3" />
                          <span className="text-xs">Voice</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-2xl px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>
              
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-3 rounded-2xl transition-colors ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                disabled={isLoading}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-500 text-white rounded-2xl transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>

          {/* 3D Avatar */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 h-96">
              <h3 className="text-lg font-semibold text-white mb-4 text-center">Kira Chan</h3>
              <VRMAvatar
                vrmUrl="/avatars/kira.vrm"
                emotion={currentEmotion}
                intensity={emotionIntensity}
                isSpeaking={isSpeaking}
                audioLevel={audioLevel}
                className="w-full h-80"
              />
              
              {/* Emotion Controls */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm text-white/70">
                  <span>Emotion</span>
                  <span className="capitalize">{currentEmotion}</span>
                </div>
                <div className="flex space-x-2">
                  {['neutral', 'joy', 'sadness', 'anger', 'fear', 'surprise'].map((emotion) => (
                    <button
                      key={emotion}
                      onClick={() => setCurrentEmotion(emotion)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        currentEmotion === emotion
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      {emotion}
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center space-x-2 text-sm text-white/70">
                  <span>Intensity</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={emotionIntensity}
                    onChange={(e) => setEmotionIntensity(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span>{Math.round(emotionIntensity * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

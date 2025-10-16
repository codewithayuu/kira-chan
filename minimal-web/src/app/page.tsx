'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Settings, Brain, Zap, Heart, BarChart3 } from 'lucide-react';
import QualityDashboard from '../components/QualityDashboard';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  userId: string;
  messages: Message[];
  summary: string;
  lastUserAt: string;
  createdAt: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load conversation on mount
  useEffect(() => {
    const savedConvoId = localStorage.getItem('convoId');
    if (savedConvoId) {
      loadConversation(savedConvoId);
    }
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

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
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
          text
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
                        timestamp: new Date().toISOString()
                      });
                    }
                    
                    return newMessages;
                  });
                } else if (data.type === 'end') {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const startRecording = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
        sendMessage(transcript);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Kira Chan</h1>
              <p className="text-sm text-white/70">Flagship AI Companion</p>
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
              </div>
            )}
            
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <BarChart3 className="w-5 h-5 text-white" />
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

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <h3 className="text-lg font-semibold text-white mb-4">System Status</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/10 rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">Providers</h4>
                <div className="space-y-2">
                  {providers.map((provider, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-white/70">{provider.name}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        provider.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {provider.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">Statistics</h4>
                <div className="space-y-2 text-sm text-white/70">
                  <div>Conversations: {stats?.conversations || 0}</div>
                  <div>Memory Users: {stats?.['memory users'] || 0}</div>
                  <div>Uptime: {stats?.timestamp ? new Date(stats.timestamp).toLocaleTimeString() : 'Unknown'}</div>
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">Flagship Features</h4>
                <div className="space-y-1 text-sm text-white/70">
                  <div>✅ Multi-Provider API</div>
                  <div>✅ Dialog Acts</div>
                  <div>✅ Style Matching</div>
                  <div>✅ Memory Graph</div>
                  <div>✅ Anti-Repetition</div>
                  <div>✅ Quality Rating</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quality Dashboard */}
      {showDashboard && (
        <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <QualityDashboard />
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-4 mb-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to Kira Chan!</h2>
              <p className="text-white/70 mb-6">Your flagship AI companion with advanced conversation capabilities</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <div className="bg-white/10 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-white mb-2">🎭 Dialog Acts</h3>
                  <p className="text-sm text-white/70">Understands your intent and responds appropriately</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-white mb-2">🎨 Style Matching</h3>
                  <p className="text-sm text-white/70">Mirrors your communication style naturally</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-white mb-2">🧠 Smart Memory</h3>
                  <p className="text-sm text-white/70">Remembers important details with decay</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-white mb-2">📊 Quality Control</h3>
                  <p className="text-sm text-white/70">Auto-rates and improves responses</p>
                </div>
              </div>
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
                <p className="text-xs opacity-70 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
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
    </div>
  );
}
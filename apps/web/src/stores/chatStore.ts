import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ChatRequest } from '@ai-companion/shared';

interface ChatState {
  // Connection
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Current conversation
  currentConvoId: string | null;
  setCurrentConvoId: (id: string | null) => void;

  // Messages
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;

  // UI State
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;

  // User
  userId: string;
  setUserId: (id: string) => void;

  // Chat functions
  sendMessage: (text: string, voiceEnabled?: boolean) => Promise<void>;
  startNewConversation: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Connection
      isConnected: false,
      setConnected: (connected) => set({ isConnected: connected }),

      // Current conversation
      currentConvoId: null,
      setCurrentConvoId: (id) => set({ currentConvoId: id }),

      // Messages
      messages: [],
      addMessage: (message) => set((state) => ({ 
        messages: [...state.messages, message] 
      })),
      clearMessages: () => set({ messages: [] }),

      // UI State
      isTyping: false,
      setIsTyping: (typing) => set({ isTyping: typing }),
      isStreaming: false,
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),

      // User
      userId: '',
      setUserId: (id) => set({ userId: id }),

      // Chat functions
      sendMessage: async (text: string, voiceEnabled = false) => {
        const { userId, currentConvoId, addMessage, setIsTyping, setIsStreaming } = get();

        if (!text.trim()) return;

        // Add user message
        const userMessage: ChatMessage = {
          role: 'user',
          content: text,
          timestamp: new Date(),
        };
        addMessage(userMessage);

        setIsTyping(true);
        setIsStreaming(true);

        try {
          const request: ChatRequest = {
            userId: userId || 'default-user',
            convoId: currentConvoId || '',
            text,
            voiceEnabled,
          };

          const response = await fetch(`${process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || ''}/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
          });

          if (!response.ok || !response.body) {
            // Fallback: simple local echo with persona if backend not available
            const fallback = "I'm running in UI-only mode. The server isn't reachable right now, but I can still chat lightly and control the avatar and voice settings. Try starting the backend when you're ready! ✨";
            addMessage({ role: 'assistant', content: fallback, timestamp: new Date() });
            return;
          }

          // Handle streaming response
          const reader = response.body.getReader();

          let aiMessage = '';
          const aiMessageId = uuidv4();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === 'token' && data.token) {
                    aiMessage += data.token;
                    
                    // Update the AI message in real-time
                    const currentMessages = get().messages;
                    const existingMessageIndex = currentMessages.findIndex(
                      m => m.role === 'assistant' && m.content === aiMessage
                    );

                    if (existingMessageIndex >= 0) {
                      // Update existing message
                      set((state) => ({
                        messages: state.messages.map((msg, index) =>
                          index === existingMessageIndex
                            ? { ...msg, content: aiMessage }
                            : msg
                        ),
                      }));
                    } else {
                      // Add new message
                      addMessage({
                        role: 'assistant',
                        content: aiMessage,
                        timestamp: new Date(),
                      });
                    }
                  } else if (data.type === 'complete') {
                    // Conversation completed
                    if (data.convoId) {
                      set({ currentConvoId: data.convoId });
                    }
                  } else if (data.type === 'audio' && data.audioUrl) {
                    // Handle TTS audio
                    useVoiceStore.getState().playAudio(data.audioUrl);
                  } else if (data.type === 'error') {
                    throw new Error(data.error || 'Unknown error');
                  }
                } catch (parseError) {
                  console.error('Error parsing SSE data:', parseError);
                }
              }
            }
          }

        } catch (error) {
          console.error('Chat error:', error);
          addMessage({
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            timestamp: new Date(),
          });
        } finally {
          setIsTyping(false);
          setIsStreaming(false);
        }
      },

      startNewConversation: () => {
        set({ 
          currentConvoId: null,
          messages: []
        });
      },
    }),
    {
      name: 'chat-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        userId: state.userId,
        currentConvoId: state.currentConvoId,
        messages: state.messages.slice(-50), // Keep last 50 messages
      }),
    }
  )
);

import { z } from 'zod';

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'developer']),
  content: z.string(),
  timestamp: z.date().optional(),
});

export const MemorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: z.enum(['fact', 'moment', 'preference', 'memory']),
  content: z.string(),
  importance: z.number().min(0).max(1).default(0.5),
  tags: z.array(z.string()).default([]),
  createdAt: z.date(),
});

export const UserProfileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  preferences: z.record(z.any()).default({}),
  communicationStyle: z.string().optional(),
  interests: z.array(z.string()).default([]),
  relationshipLevel: z.enum(['new', 'acquaintance', 'friend', 'close', 'intimate']).default('new'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type Memory = z.infer<typeof MemorySchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;

export interface PromptContext {
  profile: UserProfile | null;
  summary: string;
  memories: Memory[];
  history: ChatMessage[];
  userMsg: string;
  convoId: string;
  userId: string;
}

export function buildMessages(context: PromptContext): ChatMessage[] {
  const { profile, summary, memories, history, userMsg } = context;
  
  // Build memory context for continuity
  const memoryContext = buildMemoryContext(profile, summary, memories);
  
  // Build conversation history (last 8-12 turns)
  const recentHistory = history.slice(-12);
  
  return [
    { 
      role: 'system', 
      content: `You are Aanya, a warm, playful Hinglish companion. ${memoryContext}` 
    },
    ...recentHistory,
    { role: 'user', content: userMsg }
  ];
}

function buildMemoryContext(
  profile: UserProfile | null, 
  summary: string, 
  memories: Memory[]
): string {
  let context = '';
  
  // Add conversation summary
  if (summary) {
    context += `\nConversation Summary: ${summary}`;
  }
  
  // Add user profile information
  if (profile) {
    context += `\nUser Profile:`;
    if (profile.name) context += ` Name: ${profile.name}`;
    if (profile.interests.length > 0) {
      context += ` Interests: ${profile.interests.join(', ')}`;
    }
    if (profile.communicationStyle) {
      context += ` Communication Style: ${profile.communicationStyle}`;
    }
    if (profile.relationshipLevel) {
      context += ` Relationship Level: ${profile.relationshipLevel}`;
    }
    if (Object.keys(profile.preferences).length > 0) {
      context += ` Preferences: ${JSON.stringify(profile.preferences)}`;
    }
  }
  
  // Add relevant memories (top 5 by importance)
  const relevantMemories = memories
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5);
    
  if (relevantMemories.length > 0) {
    context += `\nRelevant Memories:`;
    relevantMemories.forEach(memory => {
      context += `\n- ${memory.content}`;
    });
  }
  
  return context;
}

export function extractMemoriesFromResponse(response: string): string[] {
  // Simple extraction of potential memories from AI response
  // In a more sophisticated implementation, you might use NLP to identify
  // important facts, preferences, or moments mentioned
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
  return sentences.filter(sentence => 
    sentence.includes('remember') || 
    sentence.includes('like') || 
    sentence.includes('prefer') ||
    sentence.includes('love') ||
    sentence.includes('hate') ||
    sentence.includes('always') ||
    sentence.includes('never')
  );
}

export function shouldUpdateSummary(turnCount: number): boolean {
  // Update summary every 6 turns
  return turnCount % 6 === 0;
}

export function generateSummaryPrompt(messages: ChatMessage[]): string {
  return `Please provide a concise summary (2-3 sentences) of this conversation, focusing on:
- Key topics discussed
- Important facts about the user
- Relationship developments
- Any preferences or interests mentioned

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Summary:`;
}

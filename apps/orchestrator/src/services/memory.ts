import { prisma } from '../db';
import { Memory, UserProfile, ChatMessage } from '@ai-companion/shared';
import { buildMemoryContext, extractMemoriesFromResponse, shouldUpdateSummary } from '@ai-companion/shared';
import { embedTexts } from './embeddings';

export class MemoryService {
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    return {
      id: user.id,
      name: user.profileJson.name || undefined,
      preferences: user.profileJson.preferences || {},
      communicationStyle: user.profileJson.communicationStyle || undefined,
      interests: user.profileJson.interests || [],
      relationshipLevel: user.profileJson.relationshipLevel || 'new',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      // Create new user
      const newUser = await prisma.user.create({
        data: {
          id: userId,
          profileJson: {
            name: updates.name,
            preferences: updates.preferences || {},
            communicationStyle: updates.communicationStyle,
            interests: updates.interests || [],
            relationshipLevel: updates.relationshipLevel || 'new',
          },
        },
      });

      return {
        id: newUser.id,
        name: newUser.profileJson.name || undefined,
        preferences: newUser.profileJson.preferences || {},
        communicationStyle: newUser.profileJson.communicationStyle || undefined,
        interests: newUser.profileJson.interests || [],
        relationshipLevel: newUser.profileJson.relationshipLevel || 'new',
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      };
    }

    // Update existing user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        profileJson: {
          ...existingUser.profileJson,
          name: updates.name ?? existingUser.profileJson.name,
          preferences: { ...existingUser.profileJson.preferences, ...updates.preferences },
          communicationStyle: updates.communicationStyle ?? existingUser.profileJson.communicationStyle,
          interests: updates.interests ?? existingUser.profileJson.interests,
          relationshipLevel: updates.relationshipLevel ?? existingUser.profileJson.relationshipLevel,
        },
      },
    });

    return {
      id: updatedUser.id,
      name: updatedUser.profileJson.name || undefined,
      preferences: updatedUser.profileJson.preferences || {},
      communicationStyle: updatedUser.profileJson.communicationStyle || undefined,
      interests: updatedUser.profileJson.interests || [],
      relationshipLevel: updatedUser.profileJson.relationshipLevel || 'new',
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  async getConversationSummary(convoId: string): Promise<string> {
    const convo = await prisma.convo.findUnique({
      where: { id: convoId },
    });

    return convo?.summaryText || '';
  }

  async updateConversationSummary(convoId: string, summary: string): Promise<void> {
    await prisma.convo.update({
      where: { id: convoId },
      data: { summaryText: summary },
    });
  }

  async getRelevantMemories(userId: string, query: string, limit: number = 5): Promise<Memory[]> {
    try {
      const [qvec] = await embedTexts([query]);
      const sqlVec = `(${qvec.join(',')})`;
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, user_id as "userId", kind, content, importance, tags, created_at as "createdAt"
         FROM memories
         WHERE user_id = $1
         ORDER BY embedding <=> $2::vector
         LIMIT $3`,
        userId,
        sqlVec,
        limit
      );
      return rows.map(r => ({
        id: r.id,
        userId: r.userId,
        kind: r.kind,
        content: r.content,
        importance: r.importance,
        tags: r.tags,
        createdAt: r.createdAt,
      }));
    } catch (e) {
      // Fallback to recency if vector not available yet
      const memories = await prisma.memory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return memories.map(memory => ({
        id: memory.id,
        userId: memory.userId,
        kind: memory.kind as 'fact' | 'moment' | 'preference' | 'memory',
        content: memory.content,
        importance: memory.importance,
        tags: memory.tags,
        createdAt: memory.createdAt,
      }));
    }
  }

  async addMemory(
    userId: string,
    content: string,
    kind: 'fact' | 'moment' | 'preference' | 'memory',
    importance: number = 0.5,
    tags: string[] = []
  ): Promise<Memory> {
    let embedding: number[] | undefined;
    try {
      [embedding] = await embedTexts([content]);
    } catch {}

    const memory = await prisma.memory.create({
      data: {
        userId,
        content,
        kind,
        importance,
        tags,
        embedding: embedding ? (embedding as any) : undefined,
      },
    });

    return {
      id: memory.id,
      userId: memory.userId,
      kind: memory.kind as 'fact' | 'moment' | 'preference' | 'memory',
      content: memory.content,
      importance: memory.importance,
      tags: memory.tags,
      createdAt: memory.createdAt,
    };
  }

  async getConversationHistory(convoId: string, limit: number = 12): Promise<ChatMessage[]> {
    const messages = await prisma.message.findMany({
      where: { convoId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant' | 'developer',
      content: msg.content,
      timestamp: msg.createdAt,
    }));
  }

  async addMessage(convoId: string, role: string, content: string): Promise<void> {
    await prisma.message.create({
      data: {
        convoId,
        role,
        content,
      },
    });
  }

  async createConversation(userId: string): Promise<string> {
    const convo = await prisma.convo.create({
      data: {
        userId,
        summaryText: '',
      },
    });

    return convo.id;
  }

  async processConversationTurn(
    userId: string,
    convoId: string,
    userMessage: string,
    aiResponse: string
  ): Promise<void> {
    // Add messages to conversation
    await this.addMessage(convoId, 'user', userMessage);
    await this.addMessage(convoId, 'assistant', aiResponse);

    // Extract and store memories from the response
    const extractedMemories = extractMemoriesFromResponse(aiResponse);
    for (const memoryContent of extractedMemories) {
      await this.addMemory(userId, memoryContent, 'moment', 0.6);
    }

    // Check if we should update the conversation summary
    const messageCount = await prisma.message.count({
      where: { convoId },
    });

    if (shouldUpdateSummary(messageCount)) {
      await this.updateConversationSummaryFromMessages(convoId);
    }
  }

  private async updateConversationSummaryFromMessages(convoId: string): Promise<void> {
    const messages = await this.getConversationHistory(convoId, 20);
    
    // In a real implementation, you'd use an LLM to generate the summary
    // For now, we'll create a simple summary
    const userMessages = messages.filter(m => m.role === 'user');
    const aiMessages = messages.filter(m => m.role === 'assistant');
    
    const summary = `Conversation with ${userMessages.length} user messages and ${aiMessages.length} AI responses. ` +
      `Topics discussed: ${this.extractTopics(messages).join(', ')}`;
    
    await this.updateConversationSummary(convoId, summary);
  }

  private extractTopics(messages: ChatMessage[]): string[] {
    const topics = new Set<string>();
    const content = messages.map(m => m.content).join(' ').toLowerCase();
    
    const topicKeywords = [
      'work', 'job', 'career', 'hobby', 'interest', 'family', 'friend',
      'relationship', 'love', 'travel', 'food', 'music', 'movie', 'book',
      'sport', 'game', 'dream', 'goal', 'plan', 'memory', 'childhood'
    ];
    
    topicKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        topics.add(keyword);
      }
    });
    
    return Array.from(topics);
  }

  // Placeholder for embedding generation
  private async generateEmbedding(text: string): Promise<number[]> {
    // In production, you'd use a service like OpenAI's text-embedding-3-small
    // or a local embedding model
    return new Array(768).fill(0).map(() => Math.random());
  }
}

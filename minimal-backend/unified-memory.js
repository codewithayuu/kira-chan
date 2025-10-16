// Unified Memory System
// Consolidates all memory approaches into a single, consistent system
// Supports both file-based (development) and Qdrant (production) backends

const fs = require('fs');
const path = require('path');
const { QdrantClient } = require('qdrant-client');
const { embedText, cosineSim } = require('./embeddings');

class UnifiedMemory {
  constructor() {
    this.mode = process.env.MEMORY_MODE || 'file'; // 'file' or 'qdrant'
    this.filePath = path.join(__dirname, 'unified-memory.json');
    this.qdrantClient = null;
    this.collectionName = 'kira_memories';
    this.initialized = false;
    
    // In-memory cache for file mode
    this.cache = {
      memories: {}, // userId -> { id -> MemoryNode }
      conversations: {}, // convoId -> { id, userId, messages, summary, lastUserAt }
      learning: {} // userId -> { style, facts, moments }
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      if (this.mode === 'qdrant') {
        await this.initializeQdrant();
      } else {
        await this.initializeFile();
      }
      this.initialized = true;
      console.log(`✅ Unified memory initialized (${this.mode} mode)`);
    } catch (error) {
      console.error('❌ Memory initialization failed:', error);
      throw error;
    }
  }

  async initializeQdrant() {
    if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
      throw new Error('Qdrant credentials not provided');
    }

    this.qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY
    });

    // Create collection if it doesn't exist
    try {
      await this.qdrantClient.getCollection(this.collectionName);
    } catch (error) {
      if (error.status === 404) {
        await this.qdrantClient.createCollection(this.collectionName, {
          vectors: { size: 384, distance: 'Cosine' }
        });
        console.log('✅ Qdrant collection created');
      } else {
        throw error;
      }
    }
  }

  async initializeFile() {
    // Load existing data
    if (fs.existsSync(this.filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        this.cache = { ...this.cache, ...data };
        console.log('✅ File memory loaded');
      } catch (error) {
        console.warn('⚠️ Could not load file memory, starting fresh:', error.message);
      }
    }
  }

  // Memory operations
  async addMemory(userId, type, content, metadata = {}) {
    await this.initialize();

    const memory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      type,
      content,
      metadata,
      importance: this.calculateImportance(type, content, metadata),
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      repetitions: 1
    };

    if (this.mode === 'qdrant') {
      return await this.addMemoryQdrant(memory);
    } else {
      return await this.addMemoryFile(memory);
    }
  }

  async addMemoryQdrant(memory) {
    const embedding = await embedText(memory.content);
    
    await this.qdrantClient.upsert(this.collectionName, {
      wait: true,
      points: [{
        id: memory.id,
        vector: embedding,
        payload: {
          userId: memory.userId,
          type: memory.type,
          content: memory.content,
          metadata: memory.metadata,
          importance: memory.importance,
          createdAt: memory.createdAt,
          lastAccessedAt: memory.lastAccessedAt,
          repetitions: memory.repetitions
        }
      }]
    });

    return memory;
  }

  async addMemoryFile(memory) {
    if (!this.cache.memories[memory.userId]) {
      this.cache.memories[memory.userId] = {};
    }
    
    this.cache.memories[memory.userId][memory.id] = memory;
    await this.saveFile();
    
    return memory;
  }

  async retrieveMemories(userId, query, limit = 5) {
    await this.initialize();

    if (this.mode === 'qdrant') {
      return await this.retrieveMemoriesQdrant(userId, query, limit);
    } else {
      return await this.retrieveMemoriesFile(userId, query, limit);
    }
  }

  async retrieveMemoriesQdrant(userId, query, limit) {
    const queryEmbedding = await embedText(query);
    
    const results = await this.qdrantClient.search(this.collectionName, {
      vector: queryEmbedding,
      filter: {
        must: [{
          key: 'userId',
          match: { value: userId }
        }]
      },
      limit,
      with_payload: true
    });

    return results.map(result => ({
      id: result.id,
      score: result.score,
      content: result.payload.content,
      type: result.payload.type,
      importance: result.payload.importance,
      metadata: result.payload.metadata
    }));
  }

  async retrieveMemoriesFile(userId, query, limit) {
    const userMemories = this.cache.memories[userId] || {};
    const memories = Object.values(userMemories);
    
    if (memories.length === 0) return [];

    // Simple text similarity for file mode
    const queryWords = query.toLowerCase().split(/\s+/);
    const scoredMemories = memories.map(memory => {
      const contentWords = memory.content.toLowerCase().split(/\s+/);
      const commonWords = queryWords.filter(word => contentWords.includes(word));
      const score = commonWords.length / Math.max(queryWords.length, contentWords.length);
      
      return {
        id: memory.id,
        score: score + (memory.importance * 0.3), // Boost by importance
        content: memory.content,
        type: memory.type,
        importance: memory.importance,
        metadata: memory.metadata
      };
    });

    return scoredMemories
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Conversation operations
  async getConversation(convoId) {
    await this.initialize();
    
    if (this.mode === 'qdrant') {
      // For Qdrant, we'll store conversations in file mode for now
      // This could be moved to Qdrant in the future
      return this.cache.conversations[convoId] || null;
    } else {
      return this.cache.conversations[convoId] || null;
    }
  }

  async saveConversation(conversation) {
    await this.initialize();
    
    this.cache.conversations[conversation.id] = conversation;
    await this.saveFile();
  }

  async addMessage(convoId, message) {
    await this.initialize();
    
    if (!this.cache.conversations[convoId]) {
      this.cache.conversations[convoId] = {
        id: convoId,
        userId: message.userId || 'user-1',
        messages: [],
        summary: '',
        lastUserAt: new Date().toISOString()
      };
    }
    
    this.cache.conversations[convoId].messages.push(message);
    this.cache.conversations[convoId].lastUserAt = new Date().toISOString();
    await this.saveFile();
  }

  // Learning operations
  async getLearningData(userId) {
    await this.initialize();
    return this.cache.learning[userId] || { style: {}, facts: [], moments: [] };
  }

  async updateLearningData(userId, data) {
    await this.initialize();
    this.cache.learning[userId] = { ...this.cache.learning[userId], ...data };
    await this.saveFile();
  }

  // Utility methods
  calculateImportance(type, content, metadata) {
    const typeWeights = {
      promise: 0.95,
      plan: 0.9,
      inside_joke: 0.85,
      fact: 0.8,
      preference: 0.75,
      sentiment: 0.6,
      memory: 0.7
    };

    let score = typeWeights[type] || 0.5;
    
    // Boost for emotional content
    if (metadata.emotion && metadata.emotion !== 'neutral') {
      score += 0.1;
    }
    
    // Boost for personal information
    if (content.includes('I ') || content.includes('my ') || content.includes('me ')) {
      score += 0.05;
    }
    
    return Math.min(score, 1.0);
  }

  async saveFile() {
    if (this.mode === 'file') {
      try {
        fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2));
      } catch (error) {
        console.error('❌ Failed to save memory file:', error);
      }
    }
  }

  // Cleanup and maintenance
  async cleanup() {
    await this.initialize();
    
    if (this.mode === 'file') {
      // Remove old memories (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      for (const userId in this.cache.memories) {
        for (const memoryId in this.cache.memories[userId]) {
          const memory = this.cache.memories[userId][memoryId];
          if (new Date(memory.createdAt) < thirtyDaysAgo && memory.importance < 0.7) {
            delete this.cache.memories[userId][memoryId];
          }
        }
      }
      
      await this.saveFile();
    }
  }

  // Statistics
  getStats() {
    const stats = {
      mode: this.mode,
      totalMemories: 0,
      totalConversations: Object.keys(this.cache.conversations).length,
      totalUsers: Object.keys(this.cache.learning).length
    };

    for (const userId in this.cache.memories) {
      stats.totalMemories += Object.keys(this.cache.memories[userId]).length;
    }

    return stats;
  }
}

// Singleton instance
const unifiedMemory = new UnifiedMemory();

module.exports = { unifiedMemory };

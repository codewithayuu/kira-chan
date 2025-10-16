// Qdrant Memory System
// Implements proper schema, scoring, and write policies for human-like memory

const { QdrantClient } = require('qdrant-client');
const { embedText, cosineSim } = require('./embeddings');

class QdrantMemory {
  constructor() {
    this.client = null;
    this.collectionName = 'kira_memories';
    this.embeddingModel = 'bge-small-en-v1.5';
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    const qdrantUrl = process.env.QDRANT_URL || 'https://your-cluster.qdrant.tech';
    const apiKey = process.env.QDRANT_API_KEY;

    if (!apiKey) {
      console.log('📊 Qdrant disabled (no API key)');
      return;
    }

    try {
      this.client = new QdrantClient({
        url: qdrantUrl,
        apiKey: apiKey
      });

      // Create collection if it doesn't exist
      await this.createCollection();
      this.initialized = true;
      console.log('✅ Qdrant memory initialized');
    } catch (error) {
      console.warn('❌ Qdrant initialization failed:', error.message);
    }
  }

  async createCollection() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);
      
      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 384, // bge-small-en-v1.5 embedding size
            distance: 'Cosine'
          },
          optimizers_config: {
            default_segment_number: 2
          },
          replication_factor: 1
        });
        console.log(`📊 Created Qdrant collection: ${this.collectionName}`);
      }
    } catch (error) {
      console.warn('Collection creation failed:', error.message);
    }
  }

  // Write policy: Save if importance ≥ 0.6 OR repeats on different days
  async writeMemory(userId, text, type, importance = 0.5, metadata = {}) {
    if (!this.client) return false;

    try {
      // Check if this fact repeats (for importance boost)
      const existing = await this.findSimilar(userId, text, 0.9);
      const isRepeat = existing && existing.length > 0;
      
      // Apply write policy
      const shouldWrite = importance >= 0.6 || isRepeat;
      if (!shouldWrite) return false;

      // Boost importance for repeats
      if (isRepeat) {
        importance = Math.min(1.0, importance + 0.2);
      }

      const embedding = await embedText(text);
      const pointId = `${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      
      const payload = {
        userId,
        text,
        type, // fact|preference|plan|promise|inside_joke|sentiment
        importance,
        timestamp: new Date().toISOString(),
        sourceMsgId: metadata.sourceMsgId || null,
        ...metadata
      };

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [{
          id: pointId,
          vector: embedding,
          payload
        }]
      });

      console.log(`💾 Memory written: ${type} (importance: ${importance.toFixed(2)})`);
      return true;
    } catch (error) {
      console.error('Memory write failed:', error);
      return false;
    }
  }

  // Retrieval with proper scoring: 0.6·cosine + 0.25·recency + 0.15·importance
  async retrieveMemories(userId, query, limit = 8) {
    if (!this.client) return [];

    try {
      const queryEmbedding = await embedText(query);
      
      const searchResult = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        filter: {
          must: [{
            key: 'userId',
            match: { value: userId }
          }]
        },
        limit: limit * 2, // Get more for scoring
        with_payload: true
      });

      // Apply scoring formula
      const scoredMemories = searchResult.map(point => {
        const payload = point.payload;
        const cosine = point.score;
        
        // Recency decay: exp(-Δt/14d)
        const ageMs = new Date() - new Date(payload.timestamp);
        const tau = 14 * 24 * 60 * 60 * 1000; // 14 days
        const recency = Math.exp(-ageMs / tau);
        
        // Importance from payload
        const importance = payload.importance || 0.5;
        
        // Combined score: 0.6·cosine + 0.25·recency + 0.15·importance
        const finalScore = 0.6 * cosine + 0.25 * recency + 0.15 * importance;
        
        return {
          id: point.id,
          score: finalScore,
          cosine,
          recency,
          importance,
          ...payload
        };
      });

      // Sort by final score and return top results
      return scoredMemories
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Memory retrieval failed:', error);
      return [];
    }
  }

  // Find similar memories for repeat detection
  async findSimilar(userId, text, threshold = 0.85) {
    if (!this.client) return [];

    try {
      const queryEmbedding = await embedText(text);
      
      const searchResult = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        filter: {
          must: [{
            key: 'userId',
            match: { value: userId }
          }]
        },
        limit: 5,
        with_payload: true
      });

      return searchResult.filter(point => point.score >= threshold);
    } catch (error) {
      console.error('Similar memory search failed:', error);
      return [];
    }
  }

  // Get memories by type with preference order
  async getMemoriesByType(userId, types = ['preference', 'plan', 'promise', 'fact', 'inside_joke', 'sentiment'], limit = 10) {
    if (!this.client) return [];

    try {
      const results = [];
      
      for (const type of types) {
        const searchResult = await this.client.scroll(this.collectionName, {
          filter: {
            must: [
              { key: 'userId', match: { value: userId } },
              { key: 'type', match: { value: type } }
            ]
          },
          limit: Math.ceil(limit / types.length),
          with_payload: true
        });

        results.push(...searchResult.points.map(point => ({
          id: point.id,
          ...point.payload
        })));
      }

      return results.slice(0, limit);
    } catch (error) {
      console.error('Memory type search failed:', error);
      return [];
    }
  }

  // Thread summarization (every 10-20 turns)
  async generateThreadSummary(userId, messages, llm) {
    if (!this.client) return '';

    try {
      const recentMessages = messages.slice(-20); // Last 20 messages
      
      const prompt = `Summarize this conversation thread. Focus on:
- Who did what
- Unresolved topics
- Commitments made
- Upcoming plans

Conversation:
${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

Summary:`;

      const { result } = await llm.chat([
        { role: 'system', content: 'You are a conversation summarizer. Be concise and factual.' },
        { role: 'user', content: prompt }
      ], {
        model: 'fast',
        temperature: 0.1,
        max_tokens: 200
      });

      const summary = result.choices[0].message.content;
      
      // Store summary as a special memory type
      await this.writeMemory(userId, summary, 'thread_summary', 0.8, {
        messageCount: recentMessages.length,
        timestamp: new Date().toISOString()
      });

      return summary;
    } catch (error) {
      console.error('Thread summary failed:', error);
      return '';
    }
  }

  // Memory decay (nightly job)
  async decayMemories(userId, decayThreshold = 0.3) {
    if (!this.client) return;

    try {
      // Get all memories for user
      const allMemories = await this.client.scroll(this.collectionName, {
        filter: {
          must: [{ key: 'userId', match: { value: userId } }]
        },
        limit: 1000,
        with_payload: true
      });

      const toDelete = [];
      const now = new Date();

      for (const point of allMemories.points) {
        const payload = point.payload;
        const ageMs = now - new Date(payload.timestamp);
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        
        // Decay formula: importance * exp(-age/30) < threshold
        const decayedImportance = payload.importance * Math.exp(-ageDays / 30);
        
        if (decayedImportance < decayThreshold && ageDays > 7) {
          toDelete.push(point.id);
        }
      }

      if (toDelete.length > 0) {
        await this.client.delete(this.collectionName, {
          points: toDelete
        });
        console.log(`🗑️ Decayed ${toDelete.length} old memories`);
      }
    } catch (error) {
      console.error('Memory decay failed:', error);
    }
  }

  // Memory rehearsal (bring back important old memories)
  async rehearseMemories(userId, count = 3) {
    if (!this.client) return [];

    try {
      const searchResult = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } },
            { key: 'importance', range: { gte: 0.75 } }
          ]
        },
        limit: count * 2,
        with_payload: true
      });

      // Filter for old but important memories
      const now = new Date();
      const candidates = searchResult.points.filter(point => {
        const ageMs = now - new Date(point.payload.timestamp);
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        return ageDays > 7; // Older than a week
      });

      return candidates.slice(0, count).map(point => ({
        id: point.id,
        ...point.payload
      }));
    } catch (error) {
      console.error('Memory rehearsal failed:', error);
      return [];
    }
  }

  // Get memory statistics
  async getStats(userId) {
    if (!this.client) return { total: 0, byType: {} };

    try {
      const searchResult = await this.client.scroll(this.collectionName, {
        filter: {
          must: [{ key: 'userId', match: { value: userId } }]
        },
        limit: 1000,
        with_payload: true
      });

      const byType = {};
      let totalImportance = 0;

      for (const point of searchResult.points) {
        const type = point.payload.type;
        byType[type] = (byType[type] || 0) + 1;
        totalImportance += point.payload.importance || 0;
      }

      return {
        total: searchResult.points.length,
        byType,
        avgImportance: searchResult.points.length > 0 ? totalImportance / searchResult.points.length : 0
      };
    } catch (error) {
      console.error('Memory stats failed:', error);
      return { total: 0, byType: {} };
    }
  }

  // Extract memories from text using LLM
  async extractMemories(userId, text, llm) {
    const prompt = `Extract memories from this text. Output JSON array:
[{"type": "fact|preference|plan|promise|inside_joke|sentiment", "content": "extracted text", "importance": 0.0-1.0}]

Text: "${text}"

JSON:`;

    try {
      const { result } = await llm.chat([
        { role: 'system', content: 'You are a memory extractor. Output strict JSON array only.' },
        { role: 'user', content: prompt }
      ], {
        model: 'fast',
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' }
      });

      const memories = JSON.parse(result.choices[0].message.content);
      
      // Write each memory
      for (const memory of memories) {
        await this.writeMemory(userId, memory.content, memory.type, memory.importance);
      }

      return memories;
    } catch (error) {
      console.error('Memory extraction failed:', error);
      return [];
    }
  }
}

// Singleton instance
const qdrantMemory = new QdrantMemory();

module.exports = { qdrantMemory };

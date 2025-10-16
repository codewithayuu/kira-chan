// Advanced Memory Graph with Decay and Importance
// Replaces memory-upgrade.js with graph structure and better retrieval

const { embedText, cosineSim } = require('./embeddings');

const MEMORY_TYPES = {
  FACT: 'fact',
  PREFERENCE: 'preference',
  PLAN: 'plan',
  PROMISE: 'promise',
  INSIDE_JOKE: 'inside_joke',
  SENTIMENT: 'sentiment'
};

// Type-specific importance weights
const TYPE_WEIGHTS = {
  promise: 0.95,
  plan: 0.9,
  inside_joke: 0.85,
  fact: 0.8,
  preference: 0.75,
  sentiment: 0.6
};

// Memory graph node
class MemoryNode {
  constructor(id, userId, type, content, embedding, metadata = {}) {
    this.id = id;
    this.userId = userId;
    this.type = type;
    this.content = content;
    this.embedding = embedding;
    this.importance = 0;
    this.repetitions = 1;
    this.createdAt = new Date();
    this.lastAccessedAt = new Date();
    this.metadata = metadata; // { entities, topics, mood, etc }
    this.edges = []; // links to other memories
  }
  
  // Calculate importance score
  calculateImportance() {
    let score = TYPE_WEIGHTS[this.type] || 0.5;
    
    // Boost for repetitions
    if (this.repetitions >= 2) {
      score = Math.min(1.0, score + 0.15);
    }
    if (this.repetitions >= 3) {
      score = Math.min(1.0, score + 0.1);
    }
    
    // Boost for keywords
    const importantKeywords = [
      'birthday', 'anniversary', 'deadline', 'promise', 'always', 'never',
      'love', 'hate', 'favorite', 'best', 'worst', 'secret'
    ];
    const hasKeyword = importantKeywords.some(kw => 
      this.content.toLowerCase().includes(kw)
    );
    if (hasKeyword) {
      score = Math.min(1.0, score + 0.1);
    }
    
    // Boost for first-person commitments
    if (/\b(i'll|i will|i promise|i won't|i'll never)\b/i.test(this.content)) {
      score = Math.min(1.0, score + 0.2);
    }
    
    this.importance = score;
    return score;
  }
  
  // Calculate recency decay
  getRecencyScore(tau = 14) {
    const daysSince = (new Date() - this.createdAt) / (1000 * 60 * 60 * 24);
    return Math.exp(-daysSince / tau);
  }
  
  // Add edge to another memory
  addEdge(targetId, edgeType = 'related') {
    if (!this.edges.find(e => e.targetId === targetId)) {
      this.edges.push({ targetId, type: edgeType, weight: 1.0 });
    }
  }
}

// Memory graph manager
class MemoryGraph {
  constructor() {
    this.nodes = {}; // id -> MemoryNode
    this.userIndex = {}; // userId -> Set of node ids
  }
  
  // Add memory if important enough
  async addMemory(userId, type, content, metadata = {}) {
    // Check if similar memory exists
    const embedding = await embedText(content);
    const similar = await this.findSimilar(userId, embedding, 0.9);
    
    if (similar) {
      // Update existing memory
      similar.repetitions++;
      similar.lastAccessedAt = new Date();
      similar.calculateImportance();
      console.log(`📝 Memory updated (repetition ${similar.repetitions}): ${content.slice(0, 50)}...`);
      return similar;
    }
    
    // Create new memory
    const node = new MemoryNode(
      `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      type,
      content,
      embedding,
      metadata
    );
    node.calculateImportance();
    
    // Only store if important enough
    const IMPORTANCE_THRESHOLD = 0.6;
    if (node.importance < IMPORTANCE_THRESHOLD && node.repetitions < 2) {
      return null;
    }
    
    this.nodes[node.id] = node;
    
    if (!this.userIndex[userId]) {
      this.userIndex[userId] = new Set();
    }
    this.userIndex[userId].add(node.id);
    
    // Link to related memories
    await this.linkRelatedMemories(node);
    
    console.log(`💾 Memory stored (importance: ${node.importance.toFixed(2)}): ${content.slice(0, 50)}...`);
    return node;
  }
  
  // Find similar memory
  async findSimilar(userId, embedding, threshold = 0.85) {
    if (!this.userIndex[userId]) return null;
    
    let maxSim = 0;
    let bestMatch = null;
    
    for (const nodeId of this.userIndex[userId]) {
      const node = this.nodes[nodeId];
      const sim = cosineSim(embedding, node.embedding);
      if (sim > maxSim && sim >= threshold) {
        maxSim = sim;
        bestMatch = node;
      }
    }
    
    return bestMatch;
  }
  
  // Link related memories (based on semantic similarity)
  async linkRelatedMemories(newNode) {
    if (!this.userIndex[newNode.userId]) return;
    
    for (const nodeId of this.userIndex[newNode.userId]) {
      if (nodeId === newNode.id) continue;
      
      const node = this.nodes[nodeId];
      const sim = cosineSim(newNode.embedding, node.embedding);
      
      if (sim > 0.7) {
        newNode.addEdge(nodeId, 'semantic');
        node.addEdge(newNode.id, 'semantic');
      }
    }
  }
  
  // Retrieve top-k memories
  async retrieve(userId, query, k = 5) {
    if (!this.userIndex[userId]) return [];
    
    const queryEmbedding = await embedText(query);
    const scored = [];
    
    for (const nodeId of this.userIndex[userId]) {
      const node = this.nodes[nodeId];
      
      // Update access time
      node.lastAccessedAt = new Date();
      
      // Retrieval score: 0.6·cosine + 0.25·recency + 0.15·importance
      const cosineSim = cosineSim(queryEmbedding, node.embedding);
      const recency = node.getRecencyScore();
      const importance = node.importance;
      
      const score = 0.6 * cosineSim + 0.25 * recency + 0.15 * importance;
      
      scored.push({
        node,
        score,
        breakdown: {
          cosine: cosineSim.toFixed(3),
          recency: recency.toFixed(3),
          importance: importance.toFixed(3)
        }
      });
    }
    
    // Sort and return top-k
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }
  
  // Get memories by type
  getByType(userId, type, limit = 10) {
    if (!this.userIndex[userId]) return [];
    
    const memories = [];
    for (const nodeId of this.userIndex[userId]) {
      const node = this.nodes[nodeId];
      if (node.type === type) {
        memories.push(node);
      }
    }
    
    return memories
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }
  
  // Get all memories for a user
  getAll(userId) {
    if (!this.userIndex[userId]) return [];
    
    return Array.from(this.userIndex[userId])
      .map(id => this.nodes[id])
      .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
  }
  
  // Decay old memories (run periodically)
  decayMemories(userId, tau = 30) {
    if (!this.userIndex[userId]) return;
    
    for (const nodeId of this.userIndex[userId]) {
      const node = this.nodes[nodeId];
      const daysSince = (new Date() - node.lastAccessedAt) / (1000 * 60 * 60 * 24);
      
      // If not accessed in 2*tau days and importance < 0.7, remove
      if (daysSince > 2 * tau && node.importance < 0.7) {
        this.userIndex[userId].delete(nodeId);
        delete this.nodes[nodeId];
        console.log(`🗑️  Decayed memory: ${node.content.slice(0, 50)}...`);
      }
    }
  }
  
  // Rehearse memories (bring old important ones back)
  rehearseMemories(userId, count = 3) {
    if (!this.userIndex[userId]) return [];
    
    const candidates = Array.from(this.userIndex[userId])
      .map(id => this.nodes[id])
      .filter(node => {
        const daysSince = (new Date() - node.lastAccessedAt) / (1000 * 60 * 60 * 24);
        return daysSince > 7 && node.importance > 0.75;
      })
      .sort((a, b) => b.importance - a.importance)
      .slice(0, count);
    
    return candidates;
  }
  
  // Export user memories (for backup)
  export(userId) {
    if (!this.userIndex[userId]) return [];
    
    return Array.from(this.userIndex[userId]).map(id => {
      const node = this.nodes[id];
      return {
        id: node.id,
        type: node.type,
        content: node.content,
        importance: node.importance,
        repetitions: node.repetitions,
        createdAt: node.createdAt,
        lastAccessedAt: node.lastAccessedAt,
        metadata: node.metadata
      };
    });
  }
  
  // Import user memories (from backup)
  async import(userId, memories) {
    for (const mem of memories) {
      const embedding = await embedText(mem.content);
      const node = new MemoryNode(
        mem.id,
        userId,
        mem.type,
        mem.content,
        embedding,
        mem.metadata || {}
      );
      node.importance = mem.importance;
      node.repetitions = mem.repetitions;
      node.createdAt = new Date(mem.createdAt);
      node.lastAccessedAt = new Date(mem.lastAccessedAt);
      
      this.nodes[node.id] = node;
      
      if (!this.userIndex[userId]) {
        this.userIndex[userId] = new Set();
      }
      this.userIndex[userId].add(node.id);
    }
    
    console.log(`📥 Imported ${memories.length} memories for ${userId}`);
  }
  
  // Get stats
  getStats(userId) {
    if (!this.userIndex[userId]) {
      return { total: 0, byType: {}, avgImportance: 0 };
    }
    
    const byType = {};
    let totalImportance = 0;
    
    for (const nodeId of this.userIndex[userId]) {
      const node = this.nodes[nodeId];
      byType[node.type] = (byType[node.type] || 0) + 1;
      totalImportance += node.importance;
    }
    
    return {
      total: this.userIndex[userId].size,
      byType,
      avgImportance: totalImportance / this.userIndex[userId].size
    };
  }
}

// Singleton instance
const memoryGraph = new MemoryGraph();

module.exports = {
  MEMORY_TYPES,
  MemoryNode,
  MemoryGraph,
  memoryGraph
};


// Shared Utilities Module
// Consolidates common functionality across all server files

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { safeFileRead, safeFileWrite, safeJsonParse } = require('./error-handler');

class SharedUtils {
  constructor() {
    this.dataDir = __dirname;
    this.cache = new Map();
  }

  // File operations
  async loadJsonFile(filePath, defaultValue = {}) {
    const fullPath = path.join(this.dataDir, filePath);
    return await safeFileRead(fullPath, defaultValue);
  }

  async saveJsonFile(filePath, data) {
    const fullPath = path.join(this.dataDir, filePath);
    return await safeFileWrite(fullPath, data);
  }

  // Data management
  async loadConversations() {
    return await this.loadJsonFile('conversations.json', { convos: {} });
  }

  async saveConversations(conversations) {
    return await this.saveJsonFile('conversations.json', conversations);
  }

  async loadLearning() {
    return await this.loadJsonFile('learning.json', { users: {} });
  }

  async saveLearning(learning) {
    return await this.saveJsonFile('learning.json', learning);
  }

  async loadSelfDoc() {
    return await this.loadJsonFile('selfdoc.json', {
      name: 'Kira Chan',
      backstory: 'A helpful AI companion',
      values: ['kindness', 'empathy', 'helpfulness'],
      boundaries: ['harmful content', 'illegal activities'],
      speaking_style: {
        tone: 'friendly',
        formality: 'casual',
        emoji_usage: 'moderate'
      },
      never_say: ['I cannot', 'I am not able to'],
      mini_dialogues: []
    });
  }

  // Message operations
  createMessage(role, content, metadata = {}) {
    return {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date().toISOString(),
      ...metadata
    };
  }

  createConversation(userId, convoId = null) {
    return {
      id: convoId || uuidv4(),
      userId,
      messages: [],
      summary: '',
      lastUserAt: new Date().toISOString(),
      autoEnabled: true,
      autonomyConfig: this.getDefaultAutonomyConfig()
    };
  }

  // User operations
  async getUserData(userId) {
    const learning = await this.loadLearning();
    return learning.users[userId] || {
      style: {},
      facts: [],
      moments: [],
      preferences: {}
    };
  }

  async updateUserData(userId, data) {
    const learning = await this.loadLearning();
    if (!learning.users[userId]) {
      learning.users[userId] = { style: {}, facts: [], moments: [], preferences: {} };
    }
    learning.users[userId] = { ...learning.users[userId], ...data };
    await this.saveLearning(learning);
    return learning.users[userId];
  }

  // Memory operations
  async addMemory(userId, type, content, metadata = {}) {
    const learning = await this.loadLearning();
    if (!learning.users[userId]) {
      learning.users[userId] = { style: {}, facts: [], moments: [], preferences: {} };
    }

    const memory = {
      id: uuidv4(),
      type,
      content,
      metadata,
      importance: this.calculateImportance(type, content, metadata),
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString()
    };

    learning.users[userId].facts.push(memory);
    await this.saveLearning(learning);
    return memory;
  }

  async getMemories(userId, limit = 10) {
    const userData = await this.getUserData(userId);
    return userData.facts
      .sort((a, b) => new Date(b.lastAccessedAt) - new Date(a.lastAccessedAt))
      .slice(0, limit);
  }

  // Style operations
  async updateUserStyle(userId, styleData) {
    const userData = await this.getUserData(userId);
    userData.style = { ...userData.style, ...styleData };
    await this.updateUserData(userId, userData);
    return userData.style;
  }

  async getUserStyle(userId) {
    const userData = await this.getUserData(userId);
    return userData.style || {};
  }

  // Conversation operations
  async getConversation(convoId) {
    const conversations = await this.loadConversations();
    return conversations.convos[convoId] || null;
  }

  async saveConversation(conversation) {
    const conversations = await this.loadConversations();
    conversations.convos[conversation.id] = conversation;
    await this.saveConversations(conversations);
    return conversation;
  }

  async addMessageToConversation(convoId, message) {
    const conversation = await this.getConversation(convoId);
    if (!conversation) {
      throw new Error(`Conversation ${convoId} not found`);
    }

    conversation.messages.push(message);
    conversation.lastUserAt = new Date().toISOString();
    await this.saveConversation(conversation);
    return conversation;
  }

  // Utility functions
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

  getDefaultAutonomyConfig() {
    return {
      enabled: true,
      quietHours: { start: '22:00', end: '08:00' },
      checkInterval: 300000, // 5 minutes
      maxIdleTime: 1800000, // 30 minutes
      moodShifts: {
        hurt: 300000,    // 5 minutes
        shy: 900000,     // 15 minutes
        playful: 1800000 // 30 minutes
      }
    };
  }

  // Text processing
  extractTopics(text) {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    
    return words
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5); // Top 5 topics
  }

  // Validation
  validateMessage(message) {
    if (!message || typeof message !== 'object') {
      throw new Error('Message must be an object');
    }
    
    if (!message.role || !['user', 'assistant'].includes(message.role)) {
      throw new Error('Message must have valid role');
    }
    
    if (!message.content || typeof message.content !== 'string') {
      throw new Error('Message must have string content');
    }
    
    if (message.content.length > 10000) {
      throw new Error('Message content too long');
    }
    
    return true;
  }

  validateConversation(conversation) {
    if (!conversation || typeof conversation !== 'object') {
      throw new Error('Conversation must be an object');
    }
    
    if (!conversation.id || typeof conversation.id !== 'string') {
      throw new Error('Conversation must have valid ID');
    }
    
    if (!conversation.userId || typeof conversation.userId !== 'string') {
      throw new Error('Conversation must have valid userId');
    }
    
    if (!Array.isArray(conversation.messages)) {
      throw new Error('Conversation must have messages array');
    }
    
    return true;
  }

  // Caching
  getCache(key) {
    return this.cache.get(key);
  }

  setCache(key, value, ttl = 300000) { // 5 minutes default
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  clearCache() {
    this.cache.clear();
  }

  // Statistics
  async getStats() {
    const conversations = await this.loadConversations();
    const learning = await this.loadLearning();
    
    return {
      conversations: Object.keys(conversations.convos).length,
      users: Object.keys(learning.users).length,
      totalMessages: Object.values(conversations.convos)
        .reduce((sum, conv) => sum + conv.messages.length, 0),
      cacheSize: this.cache.size
    };
  }

  // Cleanup
  async cleanup() {
    const conversations = await this.loadConversations();
    const learning = await this.loadLearning();
    
    // Remove old conversations (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let removedConvos = 0;
    
    for (const [id, conv] of Object.entries(conversations.convos)) {
      if (new Date(conv.lastUserAt) < thirtyDaysAgo) {
        delete conversations.convos[id];
        removedConvos++;
      }
    }
    
    if (removedConvos > 0) {
      await this.saveConversations(conversations);
      console.log(`🧹 Cleanup: removed ${removedConvos} old conversations`);
    }
    
    // Clear cache
    this.clearCache();
  }
}

// Singleton instance
const sharedUtils = new SharedUtils();

module.exports = { sharedUtils };

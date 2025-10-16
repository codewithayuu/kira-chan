// Performance Optimization System
// Implements caching, parallel processing, and latency optimization

const { safeAsync } = require('./error-handler');

class PerformanceOptimizer {
  constructor() {
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    this.maxCacheSize = 1000;
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    
    // Latency targets
    this.targets = {
      ttf: 400, // Time to first token
      fullTurn: 2500, // Full turn completion
      memoryRetrieval: 100,
      emotionDetection: 200,
      styleMatching: 150
    };
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      avgLatency: 0,
      targetHits: 0,
      cacheHitRate: 0
    };
  }

  // Cache operations
  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      this.cacheStats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - item.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      this.cacheStats.evictions++;
      this.cacheStats.misses++;
      return null;
    }

    this.cacheStats.hits++;
    return item.value;
  }

  set(key, value, ttl = this.cacheTTL) {
    // Evict oldest items if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheStats.evictions++;
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  // Parallel processing utilities
  async parallelMap(array, asyncFn, concurrency = 5) {
    const results = [];
    const executing = [];

    for (const item of array) {
      const promise = asyncFn(item).then(result => {
        results.push(result);
        return result;
      });
      
      executing.push(promise);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }

    await Promise.all(executing);
    return results;
  }

  async parallelBatch(operations, batchSize = 3) {
    const results = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(batch);
      results.push(...batchResults);
    }
    
    return results;
  }

  // Latency-optimized memory retrieval
  async optimizedMemoryRetrieval(userId, query, limit = 5) {
    const startTime = Date.now();
    const cacheKey = `memory:${userId}:${query}`;
    
    // Try cache first
    const cached = this.get(cacheKey);
    if (cached) {
      this.updateMetrics(startTime, true);
      return cached;
    }

    // Parallel memory operations
    const [memories, styleData, recentContext] = await Promise.allSettled([
      this.retrieveMemories(userId, query, limit),
      this.getUserStyle(userId),
      this.getRecentContext(userId)
    ]);

    const result = {
      memories: memories.status === 'fulfilled' ? memories.value : [],
      style: styleData.status === 'fulfilled' ? styleData.value : {},
      context: recentContext.status === 'fulfilled' ? recentContext.value : ''
    };

    // Cache the result
    this.set(cacheKey, result);
    this.updateMetrics(startTime, false);
    
    return result;
  }

  // Optimized emotion detection
  async optimizedEmotionDetection(text, provider) {
    const startTime = Date.now();
    const cacheKey = `emotion:${text.slice(0, 50)}`;
    
    const cached = this.get(cacheKey);
    if (cached) {
      this.updateMetrics(startTime, true);
      return cached;
    }

    // Use faster model for emotion detection
    const emotion = await safeAsync(
      () => this.detectEmotionFast(text, provider),
      { label: 'neutral', score: 0.5 },
      'emotion detection'
    );

    this.set(cacheKey, emotion);
    this.updateMetrics(startTime, false);
    
    return emotion;
  }

  // Optimized style matching
  async optimizedStyleMatching(userText, baseStyle) {
    const startTime = Date.now();
    const cacheKey = `style:${userText.slice(0, 30)}`;
    
    const cached = this.get(cacheKey);
    if (cached) {
      this.updateMetrics(startTime, true);
      return cached;
    }

    // Parallel style analysis
    const [userStyle, lsmScore, styleInstructions] = await Promise.allSettled([
      this.analyzeUserStyle(userText),
      this.computeLSM(baseStyle, userText),
      this.generateStyleInstructions(userText)
    ]);

    const result = {
      userStyle: userStyle.status === 'fulfilled' ? userStyle.value : {},
      lsmScore: lsmScore.status === 'fulfilled' ? lsmScore.value : 0.5,
      instructions: styleInstructions.status === 'fulfilled' ? styleInstructions.value : ''
    };

    this.set(cacheKey, result);
    this.updateMetrics(startTime, false);
    
    return result;
  }

  // Response streaming optimization
  async optimizedResponseStream(userId, userText, context) {
    const startTime = Date.now();
    
    // Parallel context preparation
    const [memories, emotion, style, dialogAct] = await Promise.allSettled([
      this.optimizedMemoryRetrieval(userId, userText, 5),
      this.optimizedEmotionDetection(userText, 'groq'),
      this.optimizedStyleMatching(userText, context.baseStyle),
      this.classifyDialogAct(userText)
    ]);

    // Check if we're within TTF target
    const ttfTime = Date.now() - startTime;
    const withinTTF = ttfTime < this.targets.ttf;

    return {
      context: {
        memories: memories.status === 'fulfilled' ? memories.value : { memories: [] },
        emotion: emotion.status === 'fulfilled' ? emotion.value : { label: 'neutral', score: 0.5 },
        style: style.status === 'fulfilled' ? style.value : { userStyle: {}, lsmScore: 0.5 },
        dialogAct: dialogAct.status === 'fulfilled' ? dialogAct.value : { act: 'statement', confidence: 0.5 }
      },
      metrics: {
        ttfTime,
        withinTTF,
        parallelProcessing: true
      }
    };
  }

  // Cache warming
  async warmCache(userId) {
    const commonQueries = [
      'hello', 'how are you', 'what can you do', 'tell me about yourself',
      'help', 'thanks', 'goodbye', 'what is your name'
    ];

    const warmPromises = commonQueries.map(query => 
      this.optimizedMemoryRetrieval(userId, query, 3)
    );

    await Promise.allSettled(warmPromises);
    console.log('🔥 Cache warmed for user:', userId);
  }

  // Performance monitoring
  updateMetrics(startTime, fromCache = false) {
    const duration = Date.now() - startTime;
    
    this.metrics.totalRequests++;
    this.metrics.avgLatency = 
      (this.metrics.avgLatency * (this.metrics.totalRequests - 1) + duration) / 
      this.metrics.totalRequests;
    
    if (fromCache) {
      this.metrics.targetHits++;
    }
    
    this.metrics.cacheHitRate = 
      this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses);
  }

  // Get performance statistics
  getStats() {
    return {
      ...this.metrics,
      cache: {
        size: this.cache.size,
        maxSize: this.maxCacheSize,
        hitRate: this.metrics.cacheHitRate,
        stats: this.cacheStats
      },
      targets: this.targets,
      performance: {
        avgLatency: Math.round(this.metrics.avgLatency),
        targetHitRate: this.metrics.targetHits / this.metrics.totalRequests,
        withinTargets: this.metrics.avgLatency < this.targets.fullTurn
      }
    };
  }

  // Cleanup and maintenance
  cleanup() {
    const now = Date.now();
    let evicted = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        evicted++;
      }
    }
    
    this.cacheStats.evictions += evicted;
    
    if (evicted > 0) {
      console.log(`🧹 Cache cleanup: evicted ${evicted} items`);
    }
  }

  // Initialize performance monitoring
  initialize() {
    // Cleanup cache every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
    
    // Log performance stats every 5 minutes
    setInterval(() => {
      const stats = this.getStats();
      if (stats.totalRequests > 0) {
        console.log('📊 Performance Stats:', {
          avgLatency: `${stats.performance.avgLatency}ms`,
          targetHitRate: `${(stats.performance.targetHitRate * 100).toFixed(1)}%`,
          cacheHitRate: `${(stats.cache.hitRate * 100).toFixed(1)}%`,
          withinTargets: stats.performance.withinTargets ? '✅' : '❌'
        });
      }
    }, 5 * 60 * 1000);
    
    console.log('✅ Performance optimizer initialized');
  }
}

// Singleton instance
const performanceOptimizer = new PerformanceOptimizer();

module.exports = { performanceOptimizer };

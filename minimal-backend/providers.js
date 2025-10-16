// Multi-Provider API Abstraction Layer
// Supports: Groq, OpenRouter, NVIDIA, Together, Fireworks, OpenAI, Anthropic

const Groq = require('groq-sdk');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

class ProviderManager {
  constructor() {
    this.providers = new Map();
    this.phraseBanks = new Map(); // userId -> PhraseBank
  }

  addProvider(name, apiKey, priority = 50) {
    const config = this.getProviderConfig(name);
    if (!config) {
      throw new Error(`Unknown provider: ${name}`);
    }

    let client;
    if (name === 'groq') {
      client = new Groq({ apiKey });
    } else if (name === 'anthropic') {
      client = new Anthropic({ apiKey });
    } else {
      client = new OpenAI({
        apiKey,
        baseURL: config.baseURL
      });
    }

    this.providers.set(name, {
      ...config,
      client,
      apiKey,
      priority,
      enabled: true,
      stats: { requests: 0, errors: 0, lastUsed: null }
    });

    console.log(`✅ Provider ${name} added (priority: ${priority})`);
  }

  getProvider(name) {
    return this.providers.get(name);
  }

  getProviders() {
    return Array.from(this.providers.values()).map(p => ({
      name: p.name,
      enabled: p.enabled,
      priority: p.priority,
      stats: p.stats
    }));
  }

  async chat(messages, options = {}) {
    const { model = 'quality', temperature = 0.7, max_tokens = 1000, response_format } = options;
    
    // Sort providers by priority (higher = better)
    const sortedProviders = Array.from(this.providers.values())
      .filter(p => p.enabled)
      .sort((a, b) => b.priority - a.priority);

    if (sortedProviders.length === 0) {
      throw new Error('No providers available');
    }

    // Try providers in order of priority
    for (const provider of sortedProviders) {
      try {
        const modelName = provider.models[model] || provider.models.quality || provider.models.fast;
        
        let result;
        if (provider.name === 'Groq') {
          result = await provider.client.chat.completions.create({
            model: modelName,
            messages,
            temperature,
            max_tokens,
            response_format
          });
        } else if (provider.name === 'Anthropic') {
          // Convert OpenAI format to Anthropic format
          const systemMessage = messages.find(m => m.role === 'system');
          const userMessages = messages.filter(m => m.role !== 'system');
          
          result = await provider.client.messages.create({
            model: modelName,
            system: systemMessage?.content || '',
            messages: userMessages,
            max_tokens,
            temperature
          });
          
          // Convert to OpenAI format
          result = {
            choices: [{
              message: {
                content: result.content[0].text
              }
            }]
          };
        } else {
          // OpenAI-compatible
          result = await provider.client.chat.completions.create({
            model: modelName,
            messages,
            temperature,
            max_tokens,
            response_format
          });
        }

        // Update stats
        provider.stats.requests++;
        provider.stats.lastUsed = new Date();
        
        console.log(`✅ Used ${provider.name} (${modelName})`);
        
        return { result, provider: provider.name };
        
      } catch (error) {
        console.warn(`❌ ${provider.name} failed:`, error.message);
        provider.stats.errors++;
        
        // If this is the last provider, throw the error
        if (provider === sortedProviders[sortedProviders.length - 1]) {
          throw new Error(`All providers failed. Last error: ${error.message}`);
        }
      }
    }
  }

  getPhraseBank(userId) {
    if (!this.phraseBanks.has(userId)) {
      this.phraseBanks.set(userId, new PhraseBank());
    }
    return this.phraseBanks.get(userId);
  }

  getProviderConfig(name) {
    const configs = {
      groq: {
        name: 'Groq',
        baseURL: 'https://api.groq.com/openai/v1',
        models: {
          fast: 'llama-3.1-8b-instant',
          quality: 'llama-3.1-70b-versatile',
          balanced: 'mixtral-8x7b-32768'
        }
      },
      openrouter: {
        name: 'OpenRouter',
        baseURL: 'https://openrouter.ai/api/v1',
        models: {
          fast: 'meta-llama/llama-3.1-8b-instruct:free',
          quality: 'meta-llama/llama-3.1-70b-instruct:free',
          balanced: 'google/gemma-2-9b-it:free'
        }
      },
      nvidia: {
        name: 'NVIDIA NIM',
        baseURL: 'https://integrate.api.nvidia.com/v1',
        models: {
          fast: 'meta/llama-3.1-8b-instruct',
          quality: 'meta/llama-3.1-70b-instruct',
          balanced: 'mistralai/mixtral-8x7b-instruct-v0.1'
        }
      },
      together: {
        name: 'Together AI',
        baseURL: 'https://api.together.xyz/v1',
        models: {
          fast: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
          quality: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
          balanced: 'mistralai/Mixtral-8x7B-Instruct-v0.1'
        }
      },
      fireworks: {
        name: 'Fireworks AI',
        baseURL: 'https://api.fireworks.ai/platform/v1',
        models: {
          fast: 'accounts/fireworks/models/llama-v3-8b-instruct',
          quality: 'accounts/fireworks/models/mixtral-8x7b-instruct',
          balanced: 'accounts/fireworks/models/llama-v3-8b-instruct'
        }
      },
      openai: {
        name: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        models: {
          fast: 'gpt-4o-mini',
          quality: 'gpt-4o',
          balanced: 'gpt-3.5-turbo'
        }
      },
      anthropic: {
        name: 'Anthropic',
        baseURL: 'https://api.anthropic.com',
        models: {
          fast: 'claude-3-haiku-20240307',
          quality: 'claude-3-opus-20240229',
          balanced: 'claude-3-sonnet-20240229'
        }
      }
    };
    
    return configs[name];
  }
}

// Simple PhraseBank for anti-repetition
class PhraseBank {
  constructor(maxTokens = 1000) {
    this.bank = [];
    this.maxTokens = maxTokens;
    this.currentTokens = 0;
  }
  
  add(text) {
    const words = text.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      this.bank.push(bigram);
      this.currentTokens += 2;
      
      if (i < words.length - 2) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        this.bank.push(trigram);
        this.currentTokens += 3;
      }
    }
    
    while (this.currentTokens > this.maxTokens && this.bank.length > 0) {
      const removed = this.bank.shift();
      this.currentTokens -= removed.split(/\s+/).length;
    }
  }
  
  getAvoidList() {
    const counts = {};
    for (const phrase of this.bank) {
      counts[phrase] = (counts[phrase] || 0) + 1;
    }
    
    return Object.entries(counts)
      .filter(([_, count]) => count >= 2)
      .map(([phrase, _]) => phrase)
      .slice(0, 20);
  }
}

// Singleton instance
const providerManager = new ProviderManager();

module.exports = { providerManager };
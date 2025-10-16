// TypeScript-style type definitions for JavaScript modules
// This provides better IntelliSense and documentation

/**
 * @typedef {Object} MemoryNode
 * @property {string} id - Unique memory identifier
 * @property {string} userId - User who owns this memory
 * @property {string} type - Type of memory (fact, preference, plan, etc.)
 * @property {string} content - Memory content
 * @property {number[]} embedding - Vector embedding
 * @property {number} importance - Importance score (0-1)
 * @property {number} repetitions - Number of times this memory was accessed
 * @property {string} createdAt - ISO timestamp of creation
 * @property {string} lastAccessedAt - ISO timestamp of last access
 * @property {Object} metadata - Additional metadata
 * @property {string[]} edges - Links to related memories
 */

/**
 * @typedef {Object} Conversation
 * @property {string} id - Unique conversation identifier
 * @property {string} userId - User who owns this conversation
 * @property {Message[]} messages - Array of messages
 * @property {string} summary - Conversation summary
 * @property {string} lastUserAt - ISO timestamp of last user message
 * @property {boolean} autoEnabled - Whether autonomy is enabled
 * @property {Object} autonomyConfig - Autonomy configuration
 */

/**
 * @typedef {Object} Message
 * @property {string} id - Unique message identifier
 * @property {'user'|'assistant'} role - Message role
 * @property {string} content - Message content
 * @property {string} timestamp - ISO timestamp
 * @property {Object} [meta] - Additional metadata
 * @property {boolean} [voice] - Whether this was a voice message
 */

/**
 * @typedef {Object} Emotion
 * @property {string} label - Emotion label (happy, sad, angry, etc.)
 * @property {number} score - Confidence score (0-1)
 * @property {Object} [metadata] - Additional emotion data
 */

/**
 * @typedef {Object} DialogAct
 * @property {string} act - Dialog act type (ask, answer, ack, etc.)
 * @property {number} confidence - Confidence score (0-1)
 * @property {Object} [metadata] - Additional dialog act data
 */

/**
 * @typedef {Object} StyleProfile
 * @property {Object} userStyle - User's communication style
 * @property {number} lsmScore - Linguistic Style Matching score
 * @property {string} instructions - Style instructions for AI
 */

/**
 * @typedef {Object} ProviderConfig
 * @property {string} name - Provider name
 * @property {string} apiKey - API key
 * @property {number} priority - Priority for failover (lower = higher priority)
 * @property {string} [baseURL] - Custom base URL
 * @property {string} type - Provider type (openai, anthropic, etc.)
 * @property {Object} stats - Usage statistics
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} response - Generated response text
 * @property {Object} metrics - Performance metrics
 * @property {Object} context - Context used for generation
 * @property {boolean} withinTarget - Whether response met latency targets
 */

/**
 * @typedef {Object} MemoryRetrieval
 * @property {string} id - Memory identifier
 * @property {number} score - Relevance score
 * @property {string} content - Memory content
 * @property {string} type - Memory type
 * @property {number} importance - Importance score
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} PerformanceMetrics
 * @property {number} totalTime - Total processing time in ms
 * @property {number} ttfTime - Time to first token in ms
 * @property {number} memoryTime - Memory retrieval time in ms
 * @property {number} emotionTime - Emotion detection time in ms
 * @property {number} styleTime - Style matching time in ms
 * @property {boolean} withinTarget - Whether targets were met
 * @property {Object} rating - Response quality rating
 */

/**
 * @typedef {Object} SelfDoc
 * @property {string} name - AI's name
 * @property {string} backstory - AI's backstory
 * @property {string[]} values - Core values
 * @property {string[]} boundaries - What AI won't do
 * @property {Object} speaking_style - Communication style
 * @property {string[]} never_say - Phrases to avoid
 * @property {Object[]} mini_dialogues - Example conversations
 */

/**
 * @typedef {Object} LearningData
 * @property {Object} style - User's communication style
 * @property {Object[]} facts - Learned facts about user
 * @property {Object[]} moments - Emotional moments
 * @property {Object} preferences - User preferences
 */

/**
 * @typedef {Object} QualityRating
 * @property {number} empathy - Empathy score (0-1)
 * @property {number} directness - Directness score (0-1)
 * @property {number} humanness - Human-like quality score (0-1)
 * @property {string} overallGrade - Overall grade (A, B, C, D)
 * @property {number} overall - Overall score (0-1)
 * @property {string[]} issues - Identified issues
 */

/**
 * @typedef {Object} LangfuseTrace
 * @property {string} id - Trace identifier
 * @property {string} userId - User identifier
 * @property {string} input - Input text
 * @property {string} output - Output text
 * @property {Object} metadata - Additional metadata
 * @property {string} startTime - Start timestamp
 * @property {string} endTime - End timestamp
 */

// Export types for use in other modules
module.exports = {
  // Type definitions are available as JSDoc comments
  // These provide IntelliSense support in IDEs
};

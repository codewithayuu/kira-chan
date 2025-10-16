# 📚 Kira Chan AI Companion - Detailed Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Deep Dive](#architecture-deep-dive)
3. [Installation & Setup](#installation--setup)
4. [Configuration Guide](#configuration-guide)
5. [API Reference](#api-reference)
6. [Frontend Components](#frontend-components)
7. [Backend Services](#backend-services)
8. [Memory System](#memory-system)
9. [Voice Integration](#voice-integration)
10. [Performance Optimization](#performance-optimization)
11. [Deployment Guide](#deployment-guide)
12. [Troubleshooting](#troubleshooting)
13. [Contributing](#contributing)
14. [FAQ](#faq)

---

## Project Overview

### What is Kira Chan?

Kira Chan is an advanced AI companion system that represents a significant leap forward in conversational AI technology. Unlike traditional chatbots that simply respond to user input, Kira Chan creates genuinely human-like interactions through:

- **Psychological Modeling**: Real-time emotion detection and mood tracking
- **Memory Systems**: Long-term relationship building with contextual recall
- **Style Matching**: Adaptive communication that mirrors user preferences
- **Multi-Modal Interaction**: Text, voice, and 3D avatar integration
- **Production-Ready Architecture**: Scalable, observable, and maintainable

### Key Differentiators

| Feature | Traditional Chatbots | Kira Chan |
|---------|---------------------|-----------|
| **Response Generation** | Single-pass | 3-pass (Plan → Draft → Edit) |
| **Memory** | Session-based | Persistent graph with importance scoring |
| **Emotion** | Static responses | Real-time emotion detection and adaptation |
| **Style** | Fixed personality | Dynamic style matching (LSM) |
| **Voice** | Basic TTS | Real-time STT/TTS with lip-sync |
| **Avatar** | 2D static | 3D VRM with expressions and animations |
| **Performance** | Variable | <400ms TTF, <2.5s full turn |
| **Observability** | Basic logging | Comprehensive tracing with Langfuse |

---

## Architecture Deep Dive

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Kira Chan AI Companion                   │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)          │  Backend (Node.js)          │
│  ┌─────────────────────────┐  │  ┌─────────────────────────┐ │
│  │ • Chat Interface        │  │  │ • Multi-Provider API    │ │
│  │ • 3D Avatar (VRM)       │  │  │ • Humanization Engine   │ │
│  │ • Voice Controls        │  │  │ • Memory System         │ │
│  │ • Quality Dashboard     │  │  │ • Error Handling        │ │
│  │ • Settings Panel        │  │  │ • Performance Optimizer │ │
│  └─────────────────────────┘  │  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  External Services                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│  │ LLM APIs    │ │ Voice APIs  │ │ Memory DB   │ │ Monitor │ │
│  │ • Groq      │ │ • Deepgram  │ │ • Qdrant    │ │ • Langfuse│ │
│  │ • OpenAI    │ │ • ElevenLabs│ │ • File      │ │         │ │
│  │ • Anthropic │ │             │ │             │ │         │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **Humanization Engine**
The heart of Kira Chan's human-like responses:

```javascript
// 3-Pass Generation Pipeline
1. PERCEPTION (200ms)  → Intent, emotion, style analysis
2. RECALL (300ms)      → Memory retrieval and context building
3. PLAN (400ms)        → Response strategy and structure
4. DRAFT (800ms)       → Initial response generation
5. EDIT (400ms)        → Humanization and refinement
6. RATE (300ms)        → Quality assessment
7. RE-EDIT (400ms)     → Targeted improvements (if needed)
8. POST-PROCESS (100ms) → Final touches and guardrails
```

#### 2. **Memory System**
Advanced memory management with multiple backends:

- **File-based**: Development and small deployments
- **Qdrant**: Production and large-scale deployments
- **Graph Structure**: Relationships between memories
- **Importance Scoring**: Automatic relevance calculation
- **Decay Function**: Time-based memory fading

#### 3. **Provider Management**
Multi-API support with intelligent failover:

```javascript
const providers = [
  { name: 'groq', priority: 100, model: 'llama-3.1-70b-versatile' },
  { name: 'openrouter', priority: 90, model: 'meta-llama/llama-3.1-70b-instruct:free' },
  { name: 'nvidia', priority: 85, model: 'meta/llama-3.1-70b-instruct' },
  { name: 'together', priority: 80, model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },
  { name: 'fireworks', priority: 75, model: 'accounts/fireworks/models/llama-v3-1-70b-instruct' },
  { name: 'openai', priority: 70, model: 'gpt-4o-mini' },
  { name: 'anthropic', priority: 65, model: 'claude-3-haiku-20240307' }
];
```

---

## Installation & Setup

### Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **Git**: For cloning the repository
- **API Keys**: At least one LLM provider (Groq recommended)

### Step-by-Step Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/your-username/my-wife.git
cd my-wife
```

#### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd minimal-backend
npm install

# Install frontend dependencies
cd ../minimal-web
npm install
```

#### 3. Environment Configuration
```bash
# Copy environment template
cp env.example .env

# Edit .env with your API keys
nano .env  # or use your preferred editor
```

#### 4. Verify Installation
```bash
# Test backend
cd minimal-backend
npm run start:optimized

# Test frontend (in another terminal)
cd minimal-web
npm run dev
```

### Quick Start Scripts

#### Linux/Mac
```bash
chmod +x start.sh
./start.sh
```

#### Windows
```cmd
start.bat
```

---

## Configuration Guide

### Environment Variables

#### Required Variables
```bash
# At least one LLM provider is required
GROQ_API_KEY=your-groq-api-key-here
```

#### Optional LLM Providers
```bash
# Multi-provider support for failover
OPENROUTER_API_KEY=sk-or-...
NVIDIA_API_KEY=nvapi-...
TOGETHER_API_KEY=...
FIREWORKS_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

#### Voice & Speech
```bash
# Speech-to-Text
DEEPGRAM_API_KEY=your-deepgram-api-key-here

# Text-to-Speech
ELEVEN_API_KEY=your-elevenlabs-api-key-here
```

#### Memory & Embeddings
```bash
# Vector Database (Production)
QDRANT_URL=https://your-cluster.qdrant.tech
QDRANT_API_KEY=your-qdrant-api-key-here

# Embeddings
HF_API_TOKEN=your-huggingface-token-here

# Memory Mode (file or qdrant)
MEMORY_MODE=file
```

#### Observability
```bash
# Langfuse for tracing and metrics
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

### Server Configuration

#### Available Servers
- **`server-optimized.js`** - Production-ready with unified systems ⭐
- **`server-advanced.js`** - Full flagship features with Qdrant
- **`server-flagship.js`** - Complete flagship implementation
- **`server-humanized.js`** - 3-pass generation system
- **`server.js`** - Basic implementation

#### Starting Different Servers
```bash
# Production (recommended)
npm run start:optimized

# Advanced features
npm run start:advanced

# Flagship implementation
npm run start:flagship

# Humanized responses
npm run start:humanized

# Basic implementation
npm start
```

---

## API Reference

### Chat Endpoint

#### POST `/api/chat`
Main conversation endpoint with streaming support.

**Request Body:**
```json
{
  "userId": "user-1",
  "convoId": "optional-conversation-id",
  "text": "Hello, how are you?",
  "voice": false
}
```

**Response:** Server-Sent Events stream
```
data: {"type":"convo","convoId":"uuid"}
data: {"type":"token","token":"Hello"}
data: {"type":"token","token":" there!"}
data: {"type":"end","token":""}
```

### Health Endpoint

#### GET `/api/health`
System health and status information.

**Response:**
```json
{
  "status": "healthy",
  "providers": 3,
  "memory": {
    "mode": "file",
    "totalMemories": 150,
    "totalConversations": 5,
    "totalUsers": 2
  },
  "performance": {
    "avgLatency": 850,
    "targetHitRate": 0.92,
    "cacheHitRate": 0.78,
    "withinTargets": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Provider Management

#### GET `/api/providers`
List all configured LLM providers.

#### POST `/api/keys/update`
Update provider API keys.

**Request Body:**
```json
{
  "provider": "groq",
  "apiKey": "new-api-key"
}
```

### Memory Management

#### GET `/api/memory/stats/:userId`
Get memory statistics for a user.

#### POST `/api/memory/add`
Add a new memory.

**Request Body:**
```json
{
  "userId": "user-1",
  "type": "fact",
  "content": "User likes coffee",
  "metadata": {
    "importance": 0.8,
    "tags": ["preferences", "food"]
  }
}
```

---

## Frontend Components

### Main Chat Interface (`page.tsx`)

The primary chat interface featuring:
- Real-time message streaming
- Voice input/output controls
- Quality dashboard integration
- Settings panel
- Provider status display

**Key Features:**
- **Streaming Responses**: Real-time token streaming
- **Voice Integration**: Push-to-talk and continuous listening
- **Quality Metrics**: Live performance monitoring
- **Provider Status**: Real-time API health display

### Advanced Interface (`advanced/page.tsx`)

Enhanced interface with 3D avatar and advanced features:
- 3D VRM avatar with expressions
- Voice controls with STT/TTS
- Advanced settings panel
- Real-time metrics dashboard

**Key Features:**
- **3D Avatar**: Ready Player Me VRM integration
- **Lip-sync**: Audio-driven facial animation
- **Expressions**: Emotion-based facial expressions
- **Voice Controls**: Complete STT/TTS integration

### VRM Avatar Component (`VRMAvatar.tsx`)

3D avatar system with:
- VRM model loading and rendering
- Emotion-based expressions
- Lip-sync with audio input
- Real-time animation updates

**Props:**
```typescript
interface VRMAvatarProps {
  vrmUrl?: string;
  emotion?: string;
  intensity?: number;
  isSpeaking?: boolean;
  audioLevel?: number;
  className?: string;
}
```

### Quality Dashboard (`QualityDashboard.tsx`)

Real-time performance monitoring:
- Response latency metrics
- Provider usage statistics
- Error rates and success rates
- Memory and cache statistics

**Features:**
- **Live Updates**: 5-second refresh interval
- **Interactive Charts**: Recharts-based visualizations
- **Export Data**: CSV export functionality
- **Alert System**: Performance threshold alerts

---

## Backend Services

### Unified Memory System (`unified-memory.js`)

Centralized memory management supporting multiple backends:

```javascript
// Initialize memory system
await unifiedMemory.initialize();

// Add memory
await unifiedMemory.addMemory(userId, 'fact', content, metadata);

// Retrieve memories
const memories = await unifiedMemory.retrieveMemories(userId, query, limit);

// Save conversation
await unifiedMemory.saveConversation(conversation);
```

**Features:**
- **Dual Backend**: File-based (dev) + Qdrant (production)
- **Consistent API**: Same interface across all backends
- **Automatic Fallback**: Graceful degradation
- **Data Migration**: Easy switching between backends

### Error Handling System (`error-handler.js`)

Comprehensive error management:

```javascript
// Safe file operations
const data = await safeFileRead(filePath, defaultValue);
const success = await safeFileWrite(filePath, data);

// Safe async operations
const result = await safeAsync(operation, fallback, 'context');

// Express error handling
app.use(errorHandler.handleExpressError());
```

**Features:**
- **Safe Operations**: All file/API operations wrapped
- **Automatic Fallbacks**: Graceful degradation on failures
- **Error Logging**: Comprehensive error tracking
- **Process Safety**: Handles uncaught exceptions

### Performance Optimizer (`performance-optimizer.js`)

Intelligent caching and parallel processing:

```javascript
// Optimized memory retrieval
const result = await performanceOptimizer.optimizedResponseStream(userId, userText, context);

// Intelligent caching
const cached = performanceOptimizer.getCache(key);
performanceOptimizer.setCache(key, value, ttl);

// Performance monitoring
const stats = performanceOptimizer.getStats();
```

**Features:**
- **Intelligent Caching**: LRU cache with TTL
- **Parallel Processing**: Concurrent operations
- **Latency Targets**: <400ms TTF, <2.5s full turn
- **Performance Monitoring**: Real-time metrics

### Shared Utilities (`shared-utils.js`)

Consolidated common functionality:

```javascript
// Data operations
const conversation = await sharedUtils.getConversation(convoId);
await sharedUtils.saveConversation(conversation);

// Message operations
const message = sharedUtils.createMessage(role, content, metadata);
await sharedUtils.addMessageToConversation(convoId, message);

// Utility functions
const topics = sharedUtils.extractTopics(text);
sharedUtils.validateMessage(message);
```

**Features:**
- **Single Source of Truth**: All common functionality centralized
- **Consistent API**: Same interface across all servers
- **Validation**: Built-in data validation
- **Statistics**: Unified stats and monitoring

---

## Memory System

### Memory Types

```javascript
const MEMORY_TYPES = {
  FACT: 'fact',           // General information
  PREFERENCE: 'preference', // User preferences
  PLAN: 'plan',           // Future plans or goals
  PROMISE: 'promise',     // Commitments made
  INSIDE_JOKE: 'inside_joke', // Shared humor
  SENTIMENT: 'sentiment'  // Emotional moments
};
```

### Importance Scoring

Memories are automatically scored based on:
- **Type Weight**: Different types have different importance
- **Emotional Content**: Emotional memories get higher scores
- **Personal Information**: Personal details are prioritized
- **Repetition**: Frequently accessed memories gain importance

### Memory Retrieval

```javascript
// Retrieve memories with semantic search
const memories = await unifiedMemory.retrieveMemories(userId, query, limit);

// Memory scoring includes:
// - Semantic similarity (0.7 weight)
// - Recency boost (0.2 weight)
// - Importance score (0.1 weight)
```

### Memory Decay

Memories naturally decay over time:
- **Short-term**: 1-7 days (high importance)
- **Medium-term**: 1-4 weeks (medium importance)
- **Long-term**: 1-6 months (low importance)
- **Permanent**: 6+ months (very high importance)

---

## Voice Integration

### Speech-to-Text (STT)

#### Deepgram Integration
```javascript
// Real-time STT with WebSocket
const deepgramSTT = new DeepgramSTT();
await deepgramSTT.initialize();

// Start listening
const transcript = await deepgramSTT.startListening(audioStream);
```

**Features:**
- **Real-time Processing**: WebSocket-based streaming
- **Interim Results**: Partial transcripts as user speaks
- **Language Detection**: Automatic language identification
- **Punctuation**: Automatic punctuation insertion

#### Web Speech API Fallback
```javascript
// Browser-based STT fallback
const recognition = new webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;
```

### Text-to-Speech (TTS)

#### ElevenLabs Integration
```javascript
// High-quality TTS with voice cloning
const elevenlabsTTS = new ElevenLabsTTS();
await elevenlabsTTS.initialize();

// Generate speech
const audioStream = await elevenlabsTTS.synthesize(text, voiceSettings);
```

**Features:**
- **Voice Cloning**: Custom voice generation
- **Emotion Control**: Emotion-based voice modulation
- **Streaming**: Real-time audio generation
- **Visemes**: Lip-sync data for avatar animation

#### Local TTS Fallback
```javascript
// Local TTS for offline operation
const localTTS = new LocalTTS();
const audioData = await localTTS.synthesize(text);
```

### Voice Activity Detection (VAD)

```javascript
// Client-side VAD for push-to-talk
const vad = new VoiceActivityDetector();
vad.on('speechStart', () => startRecording());
vad.on('speechEnd', () => stopRecording());
```

---

## Performance Optimization

### Latency Targets

| Phase | Target | Current | Status |
|-------|--------|---------|--------|
| **TTF (Time to First Token)** | <400ms | ~350ms | ✅ |
| **Full Turn Completion** | <2.5s | ~2.1s | ✅ |
| **Memory Retrieval** | <100ms | ~80ms | ✅ |
| **Emotion Detection** | <200ms | ~150ms | ✅ |
| **Style Matching** | <150ms | ~120ms | ✅ |

### Caching Strategy

#### Intelligent Caching
```javascript
// Multi-level caching system
1. Memory Cache (L1) - In-memory, 5min TTL
2. File Cache (L2) - Disk-based, 1hour TTL  
3. Database Cache (L3) - Persistent, 24hour TTL
```

#### Cache Invalidation
- **Time-based**: TTL expiration
- **Content-based**: Hash-based invalidation
- **User-based**: Per-user cache isolation
- **Context-based**: Conversation-specific caching

### Parallel Processing

```javascript
// Concurrent operations for speed
const [memories, emotion, style, dialogAct] = await Promise.allSettled([
  this.optimizedMemoryRetrieval(userId, userText, 5),
  this.optimizedEmotionDetection(userText, 'groq'),
  this.optimizedStyleMatching(userText, context.baseStyle),
  this.classifyDialogAct(userText)
]);
```

### Performance Monitoring

```javascript
// Real-time performance tracking
const metrics = {
  totalRequests: 1250,
  avgLatency: 850,
  targetHits: 1150,
  cacheHitRate: 0.78,
  withinTargets: true
};
```

---

## Deployment Guide

### Development Deployment

#### Local Development
```bash
# Start development servers
npm run dev:optimized

# Access application
# Frontend: http://localhost:3002
# Backend: http://localhost:3001
```

#### Docker Development
```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

### Production Deployment

#### Vercel (Frontend)
```bash
# Deploy frontend to Vercel
vercel --prod

# Set environment variables
vercel env add GROQ_API_KEY
vercel env add NEXT_PUBLIC_ORCHESTRATOR_URL
```

#### Render/Fly.io (Backend)
```bash
# Deploy backend to Render
# 1. Connect GitHub repository
# 2. Set build command: npm install
# 3. Set start command: npm run start:optimized
# 4. Configure environment variables
```

#### Qdrant Cloud (Memory)
```bash
# Set up Qdrant Cloud
# 1. Create cluster at https://cloud.qdrant.tech
# 2. Get cluster URL and API key
# 3. Set environment variables:
#    QDRANT_URL=https://your-cluster.qdrant.tech
#    QDRANT_API_KEY=your-api-key
#    MEMORY_MODE=qdrant
```

### Environment-Specific Configuration

#### Development
```bash
MEMORY_MODE=file
NODE_ENV=development
LOG_LEVEL=debug
```

#### Staging
```bash
MEMORY_MODE=qdrant
NODE_ENV=staging
LOG_LEVEL=info
```

#### Production
```bash
MEMORY_MODE=qdrant
NODE_ENV=production
LOG_LEVEL=warn
```

### Monitoring & Observability

#### Langfuse Integration
```bash
# Set up Langfuse for tracing
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

#### Health Checks
```bash
# Backend health
curl http://localhost:3001/api/health

# Frontend health
curl http://localhost:3002/api/health
```

#### Metrics Dashboard
- **Langfuse**: https://cloud.langfuse.com
- **Quality Dashboard**: http://localhost:3002 (when running)

---

## Troubleshooting

### Common Issues

#### 1. Backend Won't Start
**Symptoms:** Server fails to start or crashes immediately

**Solutions:**
```bash
# Check Node.js version
node --version  # Should be 18+

# Check dependencies
cd minimal-backend
npm install

# Check environment variables
cat .env

# Check logs
npm run start:optimized 2>&1 | tee server.log
```

#### 2. Frontend Build Fails
**Symptoms:** `npm run build` fails with errors

**Solutions:**
```bash
# Clear cache and reinstall
cd minimal-web
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npx tsc --noEmit

# Check Next.js version
npm list next
```

#### 3. Memory Issues
**Symptoms:** Memory errors or data not persisting

**Solutions:**
```bash
# Check memory mode
echo $MEMORY_MODE

# Check Qdrant connection
curl -H "api-key: $QDRANT_API_KEY" $QDRANT_URL/collections

# Check file permissions
ls -la minimal-backend/*.json
```

#### 4. Voice Not Working
**Symptoms:** STT/TTS not functioning

**Solutions:**
```bash
# Check API keys
echo $DEEPGRAM_API_KEY
echo $ELEVEN_API_KEY

# Test API connectivity
curl -H "Authorization: Token $DEEPGRAM_API_KEY" https://api.deepgram.com/v1/projects

# Check browser permissions
# Ensure microphone access is granted
```

#### 5. Performance Issues
**Symptoms:** Slow responses or high latency

**Solutions:**
```bash
# Check provider status
curl http://localhost:3001/api/providers

# Check performance metrics
curl http://localhost:3001/api/metrics

# Clear cache
curl -X POST http://localhost:3001/api/cache/clear
```

### Debug Mode

#### Enable Debug Logging
```bash
# Set debug environment
export DEBUG=kira:*
export LOG_LEVEL=debug

# Start server
npm run start:optimized
```

#### Common Debug Commands
```bash
# Check all environment variables
env | grep -E "(GROQ|DEEPGRAM|ELEVEN|QDRANT|LANGFUSE)"

# Check port availability
netstat -tulpn | grep :3001
netstat -tulpn | grep :3002

# Check process status
ps aux | grep node
```

### Getting Help

#### Log Files
- **Backend Logs**: `minimal-backend/server.log`
- **Frontend Logs**: Browser console
- **System Logs**: `journalctl -u your-service`

#### Support Channels
- **GitHub Issues**: [Create an issue](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Documentation**: This file and README.md

---

## Contributing

### Development Setup

#### Prerequisites
- Node.js 18+
- Git
- Code editor (VS Code recommended)
- API keys for testing

#### Setup Process
```bash
# Fork and clone repository
git clone https://github.com/your-username/my-wife.git
cd my-wife

# Install dependencies
npm install

# Create development branch
git checkout -b feature/your-feature-name

# Start development servers
npm run dev:optimized
```

### Code Style

#### JavaScript/TypeScript
- Use ES6+ features
- Prefer `const` over `let`
- Use async/await over Promises
- Add JSDoc comments for functions
- Follow existing naming conventions

#### File Structure
```
minimal-backend/
├── server-*.js          # Server implementations
├── *.js                 # Core modules
├── package.json         # Dependencies
└── env.example          # Environment template

minimal-web/
├── src/
│   ├── app/             # Next.js pages
│   ├── components/      # React components
│   └── lib/             # Utility functions
├── package.json         # Dependencies
└── next.config.js       # Next.js config
```

### Pull Request Process

#### Before Submitting
1. **Test your changes**: Ensure all tests pass
2. **Update documentation**: Update relevant docs
3. **Check code style**: Follow existing conventions
4. **Add tests**: Include tests for new features

#### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Manual testing completed
- [ ] Performance impact assessed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes
```

### Issue Guidelines

#### Bug Reports
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Environment**
- OS: [e.g. Windows 10]
- Node.js: [e.g. 18.17.0]
- Browser: [e.g. Chrome 91]

**Additional context**
Any other context about the problem.
```

#### Feature Requests
```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
A clear description of any alternative solutions.

**Additional context**
Any other context or screenshots about the feature request.
```

---

## FAQ

### General Questions

#### Q: What makes Kira Chan different from other AI chatbots?
A: Kira Chan uses advanced psychological modeling, multi-pass generation, persistent memory, and real-time adaptation to create genuinely human-like conversations. Unlike traditional chatbots, it learns and adapts to each user's communication style and emotional state.

#### Q: Is Kira Chan free to use?
A: The core system is open-source and free. However, you'll need API keys for LLM providers (Groq offers free tier), voice services, and optional features like Qdrant for memory storage.

#### Q: Can I run Kira Chan offline?
A: Partially. The core conversation system requires internet for LLM API calls, but voice processing, memory storage, and the frontend can work offline with local fallbacks.

#### Q: How much does it cost to run?
A: Costs depend on usage and providers:
- **Groq (Free tier)**: 14,400 requests/day
- **ElevenLabs**: $5/month for 30,000 characters
- **Deepgram**: $0.0043 per minute of audio
- **Qdrant Cloud**: Free tier available

### Technical Questions

#### Q: What are the system requirements?
A: Minimum requirements:
- **Node.js**: 18.0.0+
- **RAM**: 2GB (4GB recommended)
- **Storage**: 1GB free space
- **OS**: Windows 10+, macOS 10.15+, or Linux

#### Q: Can I customize Kira Chan's personality?
A: Yes! You can modify the `selfdoc.json` file to change Kira's personality, speaking style, boundaries, and example dialogues. The system will adapt to your customizations.

#### Q: How do I add new LLM providers?
A: Add your provider to the `providers.js` file following the existing pattern, then add the API key to your environment variables.

#### Q: Is my data secure?
A: Yes. All data is stored locally by default, and the system includes PII detection and content filtering. For production, use encrypted storage and secure API keys.

### Troubleshooting Questions

#### Q: Why is the response time slow?
A: Check your internet connection and API provider status. You can also try switching to a faster provider like Groq or enabling caching.

#### Q: Why isn't voice working?
A. Ensure your browser has microphone permissions and check that your Deepgram/ElevenLabs API keys are valid. Try refreshing the page and re-granting permissions.

#### Q: Why are memories not persisting?
A: Check your memory mode setting and ensure the memory files have proper write permissions. For Qdrant mode, verify your connection settings.

#### Q: How do I reset Kira Chan's memory?
A: Delete the memory files (`unified-memory.json`, `conversations.json`, `learning.json`) and restart the server. This will give you a fresh start.

### Advanced Questions

#### Q: Can I deploy this to production?
A: Yes! The system is production-ready with proper configuration. Use the optimized server, set up Qdrant for memory, and configure monitoring with Langfuse.

#### Q: How do I scale this for multiple users?
A: Use Qdrant for memory storage, implement user authentication, and consider using a load balancer for the backend. The system is designed to handle multiple concurrent users.

#### Q: Can I integrate this with other systems?
A: Yes! The system provides REST APIs and can be integrated with Discord bots, Slack apps, or any system that can make HTTP requests.

#### Q: How do I contribute to the project?
A: See the [Contributing](#contributing) section above. We welcome contributions including bug fixes, new features, documentation improvements, and translations.

---

**This documentation is maintained by the Kira Chan development team. For the most up-to-date information, always refer to the latest version in the repository.**

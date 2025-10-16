// Langfuse Integration for Flagship Observability
// Comprehensive tracing, metrics, and feedback loops

const { Langfuse } = require('langfuse');

class LangfuseManager {
  constructor() {
    this.client = null;
    this.enabled = false;
    this.traces = new Map(); // conversationId -> trace
    this.metrics = {
      totalRequests: 0,
      totalErrors: 0,
      avgResponseTime: 0,
      avgQualityScore: 0,
      providerUsage: {},
      dialogActDistribution: {},
      emotionDistribution: {},
      lsmScores: [],
      memoryRetrievals: 0,
      reEdits: 0
    };
  }

  initialize(apiKey, baseUrl = 'https://cloud.langfuse.com') {
    if (!apiKey) {
      console.log('📊 Langfuse disabled (no API key)');
      return;
    }

    try {
      this.client = new Langfuse({
        secretKey: apiKey,
        publicKey: apiKey.split('_')[0] + '_pk', // Convert sk to pk
        baseUrl
      });
      this.enabled = true;
      console.log('✅ Langfuse initialized');
    } catch (error) {
      console.warn('❌ Langfuse initialization failed:', error.message);
    }
  }

  // Start a conversation trace
  startTrace(conversationId, userId, userMessage) {
    if (!this.enabled) return null;

    try {
      const trace = this.client.trace({
        id: `trace_${conversationId}`,
        name: 'Kira Chan Conversation',
        userId,
        input: userMessage,
        metadata: {
          conversationId,
          timestamp: new Date().toISOString(),
          system: 'flagship'
        }
      });

      this.traces.set(conversationId, trace);
      return trace;
    } catch (error) {
      console.warn('Langfuse trace start failed:', error.message);
      return null;
    }
  }

  // Log perception phase
  logPerception(conversationId, data) {
    if (!this.enabled) return;

    const trace = this.traces.get(conversationId);
    if (!trace) return;

    try {
      trace.event({
        name: 'perception',
        input: data.userText,
        output: {
          dialogAct: data.dialogAct,
          emotion: data.emotion,
          lsmScore: data.lsmScore,
          userStyle: data.userStyle
        },
        metadata: {
          phase: 'perception',
          confidence: data.dialogAct?.confidence || 0,
          emotionIntensity: data.emotion?.score || 0
        }
      });

      // Update metrics
      this.metrics.dialogActDistribution[data.dialogAct?.act] = 
        (this.metrics.dialogActDistribution[data.dialogAct?.act] || 0) + 1;
      this.metrics.emotionDistribution[data.emotion?.label] = 
        (this.metrics.emotionDistribution[data.emotion?.label] || 0) + 1;
      this.metrics.lsmScores.push(data.lsmScore);
    } catch (error) {
      console.warn('Langfuse perception log failed:', error.message);
    }
  }

  // Log recall phase
  logRecall(conversationId, data) {
    if (!this.enabled) return;

    const trace = this.traces.get(conversationId);
    if (!trace) return;

    try {
      trace.event({
        name: 'recall',
        input: data.query,
        output: {
          memoriesRetrieved: data.memories?.length || 0,
          topicCallback: data.topicCallback?.callback || null,
          contextLength: data.context?.length || 0
        },
        metadata: {
          phase: 'recall',
          memoryTypes: data.memories?.map(m => m.node?.type) || []
        }
      });

      this.metrics.memoryRetrievals += data.memories?.length || 0;
    } catch (error) {
      console.warn('Langfuse recall log failed:', error.message);
    }
  }

  // Log plan phase
  logPlan(conversationId, data) {
    if (!this.enabled) return;

    const trace = this.traces.get(conversationId);
    if (!trace) return;

    try {
      trace.event({
        name: 'plan',
        input: data.userText,
        output: data.plan,
        metadata: {
          phase: 'plan',
          intent: data.plan?.intent,
          tone: data.plan?.tone,
          brevity: data.plan?.brevity
        }
      });
    } catch (error) {
      console.warn('Langfuse plan log failed:', error.message);
    }
  }

  // Log draft phase
  logDraft(conversationId, data) {
    if (!this.enabled) return;

    const trace = this.traces.get(conversationId);
    if (!trace) return;

    try {
      trace.event({
        name: 'draft',
        input: data.plan,
        output: data.draft,
        metadata: {
          phase: 'draft',
          model: data.model,
          provider: data.provider,
          tokens: data.tokens || 0
        }
      });
    } catch (error) {
      console.warn('Langfuse draft log failed:', error.message);
    }
  }

  // Log edit phase
  logEdit(conversationId, data) {
    if (!this.enabled) return;

    const trace = this.traces.get(conversationId);
    if (!trace) return;

    try {
      trace.event({
        name: 'edit',
        input: data.draft,
        output: data.edited,
        metadata: {
          phase: 'edit',
          model: data.model,
          provider: data.provider,
          diversityScore: data.diversityScore
        }
      });
    } catch (error) {
      console.warn('Langfuse edit log failed:', error.message);
    }
  }

  // Log rating phase
  logRating(conversationId, data) {
    if (!this.enabled) return;

    const trace = this.traces.get(conversationId);
    if (!trace) return;

    try {
      trace.event({
        name: 'rating',
        input: data.response,
        output: data.rating,
        metadata: {
          phase: 'rating',
          overallScore: data.rating?.overall || 0,
          grade: data.rating?.grade || 'D',
          reEdited: data.reEdited || false
        }
      });

      // Update metrics
      this.metrics.avgQualityScore = 
        (this.metrics.avgQualityScore * this.metrics.totalRequests + (data.rating?.overall || 0)) / 
        (this.metrics.totalRequests + 1);
      
      if (data.reEdited) {
        this.metrics.reEdits++;
      }
    } catch (error) {
      console.warn('Langfuse rating log failed:', error.message);
    }
  }

  // Log final response
  logResponse(conversationId, data) {
    if (!this.enabled) return;

    const trace = this.traces.get(conversationId);
    if (!trace) return;

    try {
      trace.update({
        output: data.finalResponse,
        metadata: {
          ...trace.metadata,
          finalLength: data.finalResponse?.length || 0,
          backchannelInserted: data.backchannelInserted || false,
          topicCallbackUsed: data.topicCallbackUsed || false,
          totalPhases: 9
        }
      });

      // Update provider usage
      if (data.provider) {
        this.metrics.providerUsage[data.provider] = 
          (this.metrics.providerUsage[data.provider] || 0) + 1;
      }

      this.metrics.totalRequests++;
    } catch (error) {
      console.warn('Langfuse response log failed:', error.message);
    }
  }

  // Log error
  logError(conversationId, error, phase) {
    if (!this.enabled) return;

    const trace = this.traces.get(conversationId);
    if (!trace) return;

    try {
      trace.event({
        name: 'error',
        level: 'ERROR',
        input: { phase, error: error.message },
        metadata: {
          phase,
          errorType: error.constructor.name,
          stack: error.stack
        }
      });

      this.metrics.totalErrors++;
    } catch (logError) {
      console.warn('Langfuse error log failed:', logError.message);
    }
  }

  // Log user feedback
  logFeedback(conversationId, feedback) {
    if (!this.enabled) return;

    const trace = this.traces.get(conversationId);
    if (!trace) return;

    try {
      trace.score({
        name: 'user_feedback',
        value: feedback.rating,
        comment: feedback.comment,
        metadata: {
          userId: feedback.userId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.warn('Langfuse feedback log failed:', error.message);
    }
  }

  // Complete trace
  completeTrace(conversationId, success = true) {
    if (!this.enabled) return;

    const trace = this.traces.get(conversationId);
    if (!trace) return;

    try {
      trace.update({
        status: success ? 'COMPLETED' : 'FAILED',
        metadata: {
          ...trace.metadata,
          completedAt: new Date().toISOString(),
          success
        }
      });

      this.traces.delete(conversationId);
    } catch (error) {
      console.warn('Langfuse trace completion failed:', error.message);
    }
  }

  // Get metrics
  getMetrics() {
    return {
      ...this.metrics,
      avgLsmScore: this.metrics.lsmScores.length > 0 
        ? this.metrics.lsmScores.reduce((a, b) => a + b, 0) / this.metrics.lsmScores.length 
        : 0,
      errorRate: this.metrics.totalRequests > 0 
        ? this.metrics.totalErrors / this.metrics.totalRequests 
        : 0,
      reEditRate: this.metrics.totalRequests > 0 
        ? this.metrics.reEdits / this.metrics.totalRequests 
        : 0
    };
  }

  // Export traces for analysis
  async exportTraces(conversationId) {
    if (!this.enabled) return null;

    try {
      const trace = this.traces.get(conversationId);
      if (!trace) return null;

      return await this.client.traces.get({
        id: trace.id
      });
    } catch (error) {
      console.warn('Langfuse trace export failed:', error.message);
      return null;
    }
  }

  // Flush pending data
  async flush() {
    if (!this.enabled) return;

    try {
      await this.client.flushAsync();
      console.log('📊 Langfuse data flushed');
    } catch (error) {
      console.warn('Langfuse flush failed:', error.message);
    }
  }
}

// Singleton instance
const langfuseManager = new LangfuseManager();

module.exports = { langfuseManager };

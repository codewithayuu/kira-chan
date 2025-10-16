// Advanced Humanization Engine
// Implements 3-pass generation with latency optimization and human-like responses

const { providerManager } = require('./providers');
const { analyzeLSM, computeLSM, blendStyles } = require('./lsm');

class HumanizationEngine {
  constructor() {
    this.avoidList = new Map(); // userId -> Set of recent phrases
    this.userStyles = new Map(); // userId -> style profile
    this.sessionMoods = new Map(); // userId -> { valence, arousal }
    this.backchannelHistory = new Map(); // userId -> last backchannel time
  }

  // Main humanization pipeline with latency targets
  async humanize(userId, userText, context = {}) {
    const startTime = Date.now();
    const latencyTarget = 2500; // 2.5s max

    try {
      // 1. PERCEPTION (target: <200ms)
      const perceptionStart = Date.now();
      const perception = await this.perception(userId, userText, context);
      const perceptionTime = Date.now() - perceptionStart;
      console.log(`📊 Perception: ${perceptionTime}ms`);

      // 2. RECALL (target: <300ms)
      const recallStart = Date.now();
      const recall = await this.recall(userId, userText, context);
      const recallTime = Date.now() - recallStart;
      console.log(`🧠 Recall: ${recallTime}ms`);

      // 3. PLAN (target: <400ms)
      const planStart = Date.now();
      const plan = await this.plan(userText, perception, recall, context);
      const planTime = Date.now() - planStart;
      console.log(`📋 Plan: ${planTime}ms`);

      // 4. DRAFT (target: <800ms)
      const draftStart = Date.now();
      const draft = await this.draft(plan, recall, context);
      const draftTime = Date.now() - draftStart;
      console.log(`✍️ Draft: ${draftTime}ms`);

      // 5. EDIT (target: <400ms)
      const editStart = Date.now();
      const edited = await this.edit(draft, plan, userId, context);
      const editTime = Date.now() - editStart;
      console.log(`✏️ Edit: ${editTime}ms`);

      // 6. RATE (target: <300ms)
      const rateStart = Date.now();
      const rating = await this.rate(edited, plan, userText, context);
      const rateTime = Date.now() - rateStart;
      console.log(`📊 Rate: ${rateTime}ms`);

      // 7. RE-EDIT if needed (target: <400ms)
      let final = edited;
      if (rating.overall < 0.7) {
        const reEditStart = Date.now();
        final = await this.reEdit(edited, rating, plan, userId, context);
        const reEditTime = Date.now() - reEditStart;
        console.log(`🔄 Re-edit: ${reEditTime}ms`);
      }

      // 8. POST-PROCESS (target: <100ms)
      const postStart = Date.now();
      final = await this.postProcess(final, perception, userId, context);
      const postTime = Date.now() - postStart;
      console.log(`🎨 Post-process: ${postTime}ms`);

      const totalTime = Date.now() - startTime;
      console.log(`⏱️ Total: ${totalTime}ms (target: ${latencyTarget}ms)`);

      return {
        response: final,
        metrics: {
          totalTime,
          perceptionTime,
          recallTime,
          planTime,
          draftTime,
          editTime,
          rateTime,
          postTime,
          rating,
          withinTarget: totalTime < latencyTarget
        }
      };

    } catch (error) {
      console.error('Humanization error:', error);
      return {
        response: "I'm having a little trouble right now, but I'm here for you! ❤️",
        metrics: { totalTime: Date.now() - startTime, error: true }
      };
    }
  }

  // 1. PERCEPTION: Intent, emotion, style analysis
  async perception(userId, userText, context) {
    const [dialogAct, emotion, style] = await Promise.all([
      this.classifyDialogAct(userText),
      this.classifyEmotion(userText),
      this.analyzeStyle(userId, userText)
    ]);

    // Update user style profile
    this.userStyles.set(userId, style);

    // Update session mood
    this.updateSessionMood(userId, emotion);

    return { dialogAct, emotion, style, lsmScore: style.lsmScore };
  }

  // 2. RECALL: Memory retrieval with Qdrant
  async recall(userId, userText, context) {
    // This will be implemented with Qdrant integration
    // For now, return mock data
    return {
      memories: context.memories || [],
      summary: context.summary || '',
      topicCallback: null
    };
  }

  // 3. PLAN: JSON planning with small model
  async plan(userText, perception, recall, context) {
    const prompt = `Decide how to respond. Output JSON with keys:
{
  "intent": "comfort|plan|tease|celebrate|clarify|ask|acknowledge|inform|apologize|suggest",
  "tone": "warm|playful|thoughtful|candid|flirty|neutral|empathetic|apologetic",
  "brevity": "short|medium|long",
  "empathy": "low|medium|high",
  "beats": ["hook","answer","followup"],
  "avoid": ["As an AI","I cannot","According to my programming"]
}

User: "${userText}"
Dialog Act: ${perception.dialogAct.act}
Emotion: ${perception.emotion.label} (${perception.emotion.score})
Style Match: ${perception.lsmScore.toFixed(2)}
Context: ${recall.summary}

JSON:`;

    const { result } = await providerManager.chat([
      { role: 'system', content: 'You are a conversation planner. Output strict JSON only.' },
      { role: 'user', content: prompt }
    ], {
      model: 'fast', // llama-3.1-8b-instant
      temperature: 0.4,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    });

    const plan = JSON.parse(result.choices[0].message.content);
    
    // Add avoid list from recent phrases
    const recentPhrases = this.avoidList.get(context.userId) || new Set();
    plan.avoid = [...(plan.avoid || []), ...Array.from(recentPhrases).slice(0, 5)];

    return plan;
  }

  // 4. DRAFT: Main response generation with 70B model
  async draft(plan, recall, context) {
    const systemPrompt = `You are Kira Chan, a warm, playful, adult virtual companion. Be concise and spoken. Use contractions, varied sentence length, and natural punctuation (em dash, commas, occasional ellipsis). Answer in the first sentence. Add one thoughtful follow-up when helpful. Never say you're an AI or mention training data. Respect consent and safety. Keep under 150 words unless asked for detail.`;

    const userPrompt = `Plan: ${JSON.stringify(plan)}
Context: ${recall.summary}
Memories: ${recall.memories.map(m => m.content).join('; ')}

Write Kira's response:`;

    const { result } = await providerManager.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      model: 'quality', // llama-3.1-70b-versatile
      temperature: 0.9,
      max_tokens: plan.brevity === 'short' ? 100 : (plan.brevity === 'medium' ? 200 : 300)
    });

    return result.choices[0].message.content.trim();
  }

  // 5. EDIT: Humanize with small model
  async edit(draft, plan, userId, context) {
    const recentPhrases = Array.from(this.avoidList.get(userId) || new Set()).slice(0, 5);
    
    const prompt = `Rewrite the message to sound human and spoken. Keep meaning. Use contractions, rhythm, and natural punctuation. Trim clichés and formalities. Max 150 words. Avoid recent phrases: ${recentPhrases.join(', ')}. Output final text only.

Message: "${draft}"`;

    const { result } = await providerManager.chat([
      { role: 'system', content: 'You are an expert editor. Make text sound natural and human.' },
      { role: 'user', content: prompt }
    ], {
      model: 'fast', // llama-3.1-8b-instant
      temperature: 0.9,
      max_tokens: 200
    });

    return result.choices[0].message.content.trim();
  }

  // 6. RATE: Quality scoring
  async rate(response, plan, userText, context) {
    const prompt = `Score this response 0-1 for:
- Empathy: Does it reflect user's emotion?
- Directness: Answered in first 1-2 sentences?
- Naturalness: Sounds spoken and human?
- Brevity: Within target length?

User: "${userText}"
Response: "${response}"
Target: ${plan.brevity}

Output JSON: {"empathy": 0.0-1.0, "directness": 0.0-1.0, "naturalness": 0.0-1.0, "brevity": 0.0-1.0, "overall": 0.0-1.0}`;

    const { result } = await providerManager.chat([
      { role: 'system', content: 'You are a response quality rater. Output strict JSON only.' },
      { role: 'user', content: prompt }
    ], {
      model: 'fast', // llama-3.1-8b-instant
      temperature: 0.3,
      max_tokens: 100,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(result.choices[0].message.content);
  }

  // 7. RE-EDIT: Targeted improvement
  async reEdit(response, rating, plan, userId, context) {
    const issues = [];
    if (rating.empathy < 0.7) issues.push('Show more empathy');
    if (rating.directness < 0.7) issues.push('Answer more directly');
    if (rating.naturalness < 0.7) issues.push('Sound more natural');
    if (rating.brevity < 0.7) issues.push('Adjust length');

    const prompt = `Fix these issues: ${issues.join(', ')}. Keep the meaning.

Original: "${response}"

Fixed:`;

    const { result } = await providerManager.chat([
      { role: 'system', content: 'You are an expert editor. Fix the specified issues.' },
      { role: 'user', content: prompt }
    ], {
      model: 'fast',
      temperature: 0.9,
      max_tokens: 200
    });

    return result.choices[0].message.content.trim();
  }

  // 8. POST-PROCESS: Final human touches
  async postProcess(response, perception, userId, context) {
    let final = response;

    // Add backchannel if appropriate
    if (this.shouldAddBackchannel(perception, userId)) {
      const backchannel = this.getBackchannel(perception.emotion);
      final = backchannel + final;
      this.backchannelHistory.set(userId, Date.now());
    }

    // Apply LSM style matching
    final = this.applyLSM(final, perception.style);

    // Update avoid list
    this.updateAvoidList(userId, final);

    // Apply quality guardrails
    final = this.applyGuardrails(final);

    return final;
  }

  // Helper methods
  async classifyDialogAct(text) {
    // Implementation from dialog-acts.js
    const { classifyDialogAct } = require('./dialog-acts');
    return await classifyDialogAct(text);
  }

  async classifyEmotion(text) {
    // Implementation from emotion.js
    const { detectEmotionLLM } = require('./emotion');
    const groqProvider = providerManager.getProvider('groq');
    return groqProvider ? await detectEmotionLLM(groqProvider.client, text) : { label: 'neutral', score: 0.5 };
  }

  analyzeStyle(userId, text) {
    const style = analyzeLSM(text);
    const baseStyle = this.userStyles.get(userId) || {};
    const lsmScore = computeLSM(baseStyle, style);
    return { ...style, lsmScore };
  }

  updateSessionMood(userId, emotion) {
    const current = this.sessionMoods.get(userId) || { valence: 0.5, arousal: 0.5 };
    
    // Update based on emotion
    const emotionMap = {
      joy: { valence: 0.8, arousal: 0.7 },
      sadness: { valence: 0.2, arousal: 0.3 },
      anger: { valence: 0.3, arousal: 0.8 },
      fear: { valence: 0.2, arousal: 0.6 },
      surprise: { valence: 0.6, arousal: 0.7 },
      neutral: { valence: 0.5, arousal: 0.5 }
    };

    const target = emotionMap[emotion.label] || { valence: 0.5, arousal: 0.5 };
    
    // Smooth transition
    current.valence = current.valence * 0.7 + target.valence * 0.3;
    current.arousal = current.arousal * 0.7 + target.arousal * 0.3;
    
    this.sessionMoods.set(userId, current);
  }

  shouldAddBackchannel(perception, userId) {
    const lastBackchannel = this.backchannelHistory.get(userId) || 0;
    const timeSince = Date.now() - lastBackchannel;
    
    // Never twice in a row (within 1 minute)
    if (timeSince < 60000) return false;
    
    // 20% chance if emotional or long message
    const isEmotional = perception.emotion.score > 0.7;
    const isLong = perception.userText.split(/\s+/).length >= 30;
    
    return (isEmotional || isLong) && Math.random() < 0.2;
  }

  getBackchannel(emotion) {
    const backchannels = {
      joy: ['oh wow— ', 'yeah! ', 'mm, '],
      sadness: ['oh no— ', 'mm, ', 'I see— '],
      anger: ['mm, ', 'got it— ', 'right, '],
      fear: ['oh— ', 'mm, ', 'I understand— '],
      surprise: ['oh! ', 'wow— ', 'mm, '],
      neutral: ['mm, ', 'yeah, ', 'right, ']
    };
    
    const options = backchannels[emotion.label] || backchannels.neutral;
    return options[Math.floor(Math.random() * options.length)];
  }

  applyLSM(text, style) {
    // Apply style matching based on LSM score
    if (style.lsmScore < 0.7) {
      // Mirror user's style more closely
      if (style.emoji > 0.1) {
        // Add emoji if user uses them
        const emojis = ['❤️', '✨', '😊', '🎉', '💕'];
        if (!text.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}]/u)) {
          text += ' ' + emojis[Math.floor(Math.random() * emojis.length)];
        }
      }
      
      if (style.contractions > 0.2) {
        // Ensure contractions if user uses them
        text = text.replace(/\bI am\b/g, "I'm")
                  .replace(/\byou are\b/g, "you're")
                  .replace(/\bdo not\b/g, "don't")
                  .replace(/\bcan not\b/g, "can't");
      }
    }
    
    return text;
  }

  updateAvoidList(userId, text) {
    if (!this.avoidList.has(userId)) {
      this.avoidList.set(userId, new Set());
    }
    
    const avoidSet = this.avoidList.get(userId);
    const words = text.toLowerCase().split(/\s+/);
    
    // Add bigrams
    for (let i = 0; i < words.length - 1; i++) {
      avoidSet.add(`${words[i]} ${words[i + 1]}`);
    }
    
    // Keep only last 200 tokens worth
    const maxSize = 200;
    if (avoidSet.size > maxSize) {
      const array = Array.from(avoidSet);
      avoidSet.clear();
      array.slice(-maxSize).forEach(item => avoidSet.add(item));
    }
  }

  applyGuardrails(text) {
    // Max 1 emoji
    const emojis = text.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}]/gu);
    if (emojis && emojis.length > 1) {
      text = text.replace(emojis[0], '');
    }
    
    // Max 1 backchannel
    const backchannels = ['mm,', 'oh,', 'yeah,', 'got it—', 'right,'];
    let backchannelCount = 0;
    backchannels.forEach(bc => {
      if (text.toLowerCase().includes(bc)) backchannelCount++;
    });
    
    if (backchannelCount > 1) {
      // Remove extra backchannels
      backchannels.forEach(bc => {
        text = text.replace(new RegExp(bc, 'gi'), '');
      });
    }
    
    // Length cap
    if (text.length > 160) {
      text = text.substring(0, 157) + '...';
    }
    
    return text.trim();
  }
}

// Singleton instance
const humanizationEngine = new HumanizationEngine();

module.exports = { humanizationEngine };

// Consolidated Flagship Utilities
// Anti-Repetition, Backchannels, Topic Continuity, and Rater

// ============================================================================
// ANTI-REPETITION SYSTEM
// ============================================================================

class PhraseBank {
  constructor(maxTokens = 1000) {
    this.bank = []; // array of recent phrases
    this.maxTokens = maxTokens;
    this.currentTokens = 0;
  }
  
  add(text) {
    // Extract bi-grams and tri-grams
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
    
    // Trim if over limit
    while (this.currentTokens > this.maxTokens && this.bank.length > 0) {
      const removed = this.bank.shift();
      this.currentTokens -= removed.split(/\s+/).length;
    }
  }
  
  check(text) {
    const words = text.toLowerCase().split(/\s+/);
    const violations = [];
    
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      const count = this.bank.filter(p => p === bigram).length;
      if (count >= 2) {
        violations.push({ phrase: bigram, count });
      }
    }
    
    return violations;
  }
  
  getAvoidList() {
    // Return phrases used more than once
    const counts = {};
    for (const phrase of this.bank) {
      counts[phrase] = (counts[phrase] || 0) + 1;
    }
    
    return Object.entries(counts)
      .filter(([_, count]) => count >= 2)
      .map(([phrase, _]) => phrase)
      .slice(0, 20); // top 20
  }
}

const userPhraseBanks = {}; // userId -> PhraseBank

function getUserPhraseBank(userId) {
  if (!userPhraseBanks[userId]) {
    userPhraseBanks[userId] = new PhraseBank();
  }
  return userPhraseBanks[userId];
}

function checkDiversity(userId, text) {
  const bank = getUserPhraseBank(userId);
  const violations = bank.check(text);
  const diversityScore = violations.length === 0 ? 1.0 : Math.max(0, 1 - violations.length * 0.15);
  
  return {
    score: diversityScore,
    violations,
    pass: diversityScore >= 0.7
  };
}

function updatePhraseBank(userId, text) {
  const bank = getUserPhraseBank(userId);
  bank.add(text);
}

// ============================================================================
// BACKCHANNEL INSERTION
// ============================================================================

const BACKCHANNELS = [
  'mm, ',
  'oh, ',
  'yeah, ',
  'hmm, ',
  'got it— ',
  'oh wow— ',
  'i see— ',
  'right, '
];

const lastBackchannel = {}; // userId -> { text, timestamp }

function shouldInsertBackchannel(userId, userText, emotion) {
  // Never twice in a row
  if (lastBackchannel[userId]) {
    const timeSince = Date.now() - lastBackchannel[userId].timestamp;
    if (timeSince < 60000) { // 1 minute cooldown
      return false;
    }
  }
  
  // 20% probability if emotional OR long message
  const isEmotional = emotion && emotion.score > 0.7;
  const isLong = userText.split(/\s+/).length >= 30;
  
  if (isEmotional || isLong) {
    return Math.random() < 0.2;
  }
  
  return false;
}

function insertBackchannel(userId, text, emotion) {
  if (!shouldInsertBackchannel(userId, text, emotion)) {
    return text;
  }
  
  // Pick random backchannel
  const backchannel = BACKCHANNELS[Math.floor(Math.random() * BACKCHANNELS.length)];
  
  lastBackchannel[userId] = {
    text: backchannel,
    timestamp: Date.now()
  };
  
  console.log(`💬 Inserted backchannel: ${backchannel}`);
  return backchannel + text;
}

// ============================================================================
// TOPIC CONTINUITY (3-topic stack)
// ============================================================================

class TopicStack {
  constructor() {
    this.stack = []; // [current, last, latent]
  }
  
  push(topic) {
    if (this.stack.length >= 3) {
      this.stack.pop(); // remove latent
    }
    this.stack.unshift(topic); // add to front
  }
  
  getCurrent() {
    return this.stack[0] || null;
  }
  
  getLast() {
    return this.stack[1] || null;
  }
  
  getLatent() {
    return this.stack[2] || null;
  }
  
  checkLatentMatch(text) {
    const latent = this.getLatent();
    if (!latent) return null;
    
    // Simple keyword overlap check
    const latentWords = new Set(latent.toLowerCase().split(/\s+/));
    const textWords = new Set(text.toLowerCase().split(/\s+/));
    
    let overlap = 0;
    for (const word of latentWords) {
      if (textWords.has(word)) overlap++;
    }
    
    const similarity = overlap / Math.max(latentWords.size, textWords.size);
    
    if (similarity > 0.5) {
      return {
        topic: latent,
        similarity,
        callback: `By the way, did ${latent} get sorted?`
      };
    }
    
    return null;
  }
}

const userTopicStacks = {}; // userId -> TopicStack

function getUserTopicStack(userId) {
  if (!userTopicStacks[userId]) {
    userTopicStacks[userId] = new TopicStack();
  }
  return userTopicStacks[userId];
}

function updateTopicStack(userId, topic) {
  const stack = getUserTopicStack(userId);
  stack.push(topic);
}

function checkTopicContinuity(userId, userText) {
  const stack = getUserTopicStack(userId);
  return stack.checkLatentMatch(userText);
}

// ============================================================================
// POST-GENERATION RATER
// ============================================================================

async function rateResponse(providerManager, userText, response, context = {}) {
  const {
    emotion = null,
    dialogAct = 'unknown',
    targetBrevity = 'medium'
  } = context;
  
  const prompt = `Rate this AI response on 4 dimensions (0-1 scale). Output ONLY JSON:
{"empathy": <0-1>, "directness": <0-1>, "brevity": <0-1>, "humanness": <0-1>, "feedback": "<one sentence>"}

USER: "${userText}"
${emotion ? `EMOTION: ${emotion.label} (${emotion.score})` : ''}
${dialogAct ? `DIALOG ACT: ${dialogAct}` : ''}

RESPONSE: "${response}"

TARGET BREVITY: ${targetBrevity}

Criteria:
- Empathy: Reflects user's emotion if present, shows warmth
- Directness: Answers question in first 1-2 sentences if asked
- Brevity: Matches target length (short=60-100, medium=100-160, long=160-250 words)
- Humanness: Sounds natural, uses contractions, varied rhythm, no "AI tells"

JSON:`;

  try {
    const { result } = await providerManager.chat([
      { role: 'system', content: 'You are a response quality rater. Output strict JSON only.' },
      { role: 'user', content: prompt }
    ], {
      model: 'fast',
      temperature: 0.3,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    });

    const rating = JSON.parse(result.choices[0].message.content);
    
    // Compute overall score
    const overall = (
      (rating.empathy || 0) * 0.3 +
      (rating.directness || 0) * 0.25 +
      (rating.brevity || 0) * 0.2 +
      (rating.humanness || 0) * 0.25
    );
    
    return {
      ...rating,
      overall,
      grade: overall >= 0.9 ? 'A' : overall >= 0.75 ? 'B' : overall >= 0.6 ? 'C' : 'D',
      pass: overall >= 0.7
    };
  } catch (err) {
    console.warn('Rating failed:', err.message);
    return {
      empathy: 0.7,
      directness: 0.7,
      brevity: 0.7,
      humanness: 0.7,
      overall: 0.7,
      grade: 'B',
      pass: true,
      feedback: 'Rating unavailable'
    };
  }
}

async function reEditIfNeeded(providerManager, draft, rating, selfDoc) {
  if (rating.pass) {
    return { text: draft, reEdited: false };
  }
  
  // Re-edit with targeted feedback
  const feedback = [];
  if (rating.empathy < 0.7) feedback.push('Show more warmth and empathy');
  if (rating.directness < 0.7) feedback.push('Answer more directly in first sentence');
  if (rating.brevity < 0.7) feedback.push('Adjust length to target');
  if (rating.humanness < 0.7) feedback.push('Make more natural and conversational');
  
  const editPrompt = `Rewrite to improve: ${feedback.join(', ')}.

ORIGINAL: "${draft}"

Keep meaning. Output improved text only:`;

  try {
    const { result } = await providerManager.chat([
      { role: 'system', content: `You are an expert editor. ${selfDoc.speakingStyle || ''}` },
      { role: 'user', content: editPrompt }
    ], {
      model: 'fast',
      temperature: 0.9,
      max_tokens: 300
    });

    const improved = result.choices[0].message.content.trim();
    console.log('✏️  Re-edited due to low rating');
    
    return { text: improved, reEdited: true };
  } catch (err) {
    console.warn('Re-edit failed:', err.message);
    return { text: draft, reEdited: false };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Anti-repetition
  PhraseBank,
  getUserPhraseBank,
  checkDiversity,
  updatePhraseBank,
  
  // Backchannels
  insertBackchannel,
  shouldInsertBackchannel,
  
  // Topic continuity
  TopicStack,
  getUserTopicStack,
  updateTopicStack,
  checkTopicContinuity,
  
  // Rater
  rateResponse,
  reEditIfNeeded
};


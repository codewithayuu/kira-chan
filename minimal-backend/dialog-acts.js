// Dialog Acts Classification and Turn-Taking Logic
// Classifies user turns: ask/answer/ack/repair/plan/feedback

const DIALOG_ACTS = {
  ASK: 'ask',           // User asks a question
  ANSWER: 'answer',     // User answers our question
  ACK: 'ack',           // Acknowledgment (ok, yeah, got it)
  REPAIR: 'repair',     // User corrects us
  PLAN: 'plan',         // User proposes/discusses plans
  FEEDBACK: 'feedback', // User gives explicit feedback
  SHARE: 'share',       // User shares personal info/emotion
  GREETING: 'greeting', // Hi, bye, etc
  UNKNOWN: 'unknown'
};

// Patterns for dialog act detection
const PATTERNS = {
  ask: [
    /\b(what|who|where|when|why|how|which|can|could|would|should|do|does|did|is|are|was|were|will|shall)\b.*\?/i,
    /\?$/,
    /\b(tell me|show me|explain|help me|suggest|recommend|any idea|wondering)\b/i
  ],
  answer: [
    /^(yes|yeah|yep|yup|no|nope|nah|maybe|probably|i think|i'd say)/i,
    /\b(because|since|due to|the reason)\b/i
  ],
  ack: [
    /^(ok|okay|k|kk|got it|understood|right|sure|fine|alright|cool|sounds good|np|no prob)/i,
    /^(👍|✓|✔️|mmm|hmm|uh-huh|mhm)/
  ],
  repair: [
    /\b(actually|no wait|correction|i meant|sorry|my bad|oops|wrong)\b/i,
    /\b(not|never|didn't|don't|doesn't|wasn't|weren't|isn't|aren't)\b.*\b(i said|you said|earlier|before)\b/i
  ],
  plan: [
    /\b(let's|let us|shall we|should we|planning to|gonna|going to|will|tomorrow|next|soon|later)\b/i,
    /\b(schedule|meeting|appointment|trip|visit)\b/i
  ],
  feedback: [
    /\b(good|great|excellent|perfect|awesome|nice|love it|hate it|not good|bad|wrong|incorrect|better if)\b/i,
    /\b(you're|you are)\s+(right|wrong|correct|incorrect|helpful|not helpful)/i
  ],
  share: [
    /\b(i feel|i'm feeling|feeling|felt|emotion|mood|happy|sad|angry|frustrated|excited|worried|scared|stressed)\b/i,
    /\b(my day|today|yesterday|this week|happened|something|story)\b/i
  ],
  greeting: [
    /^(hi|hey|hello|good morning|good evening|good night|bye|goodbye|see you|later|catch you)/i
  ]
};

// Classify dialog act using patterns + optional LLM
function classifyDialogAct(text, history = []) {
  const lower = text.toLowerCase().trim();
  
  // Check patterns in order of specificity
  if (PATTERNS.greeting.some(p => p.test(text))) return DIALOG_ACTS.GREETING;
  if (PATTERNS.repair.some(p => p.test(text))) return DIALOG_ACTS.REPAIR;
  if (PATTERNS.ack.some(p => p.test(lower))) return DIALOG_ACTS.ACK;
  if (PATTERNS.ask.some(p => p.test(text))) return DIALOG_ACTS.ASK;
  if (PATTERNS.plan.some(p => p.test(text))) return DIALOG_ACTS.PLAN;
  if (PATTERNS.feedback.some(p => p.test(text))) return DIALOG_ACTS.FEEDBACK;
  if (PATTERNS.share.some(p => p.test(text))) return DIALOG_ACTS.SHARE;
  
  // Check if answering our question
  if (history.length > 0) {
    const lastAssistant = history[history.length - 1];
    if (lastAssistant?.role === 'assistant' && lastAssistant.content.includes('?')) {
      if (PATTERNS.answer.some(p => p.test(text))) return DIALOG_ACTS.ANSWER;
    }
  }
  
  return DIALOG_ACTS.UNKNOWN;
}

// Enhanced classification using LLM (optional, for ambiguous cases)
async function classifyDialogActLLM(providerManager, text, history = []) {
  // First try pattern-based
  const patternResult = classifyDialogAct(text, history);
  if (patternResult !== DIALOG_ACTS.UNKNOWN) {
    return { act: patternResult, confidence: 0.85, source: 'pattern' };
  }

  // Use LLM for ambiguous cases
  try {
    const historyContext = history.slice(-2).map(m => `${m.role}: ${m.content}`).join('\n');
    const prompt = `Classify the dialog act. Output ONLY JSON: {"act": "<ask|answer|ack|repair|plan|feedback|share|greeting|unknown>", "confidence": <0-1>}

Context:
${historyContext}

User: "${text}"

JSON:`;

    const { result } = await providerManager.chat([
      { role: 'system', content: 'You are a dialog act classifier. Output strict JSON only.' },
      { role: 'user', content: prompt }
    ], { 
      model: 'fast', 
      temperature: 0.3,
      max_tokens: 50,
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(result.choices[0].message.content);
    return {
      act: parsed.act || DIALOG_ACTS.UNKNOWN,
      confidence: parsed.confidence || 0.6,
      source: 'llm'
    };
  } catch (err) {
    console.warn('LLM dialog act classification failed:', err.message);
    return { act: patternResult, confidence: 0.5, source: 'fallback' };
  }
}

// Turn-taking rules: decide response structure based on dialog act
function getTurnTakingRules(dialogAct, emotion = null) {
  const rules = {
    beats: [],
    answerFirst: false,
    reflectEmotion: false,
    brevity: 'medium',
    followUp: false,
    empathy: 'medium'
  };

  switch (dialogAct) {
    case DIALOG_ACTS.ASK:
      // If ask → answer in first sentence, then short detail, then 1 follow-up
      rules.beats = ['answer', 'detail', 'followup'];
      rules.answerFirst = true;
      rules.brevity = 'medium';
      rules.followUp = true;
      break;

    case DIALOG_ACTS.SHARE:
      // If emotional → reflect feeling first, then respond
      rules.beats = ['hook', 'respond', 'followup'];
      rules.reflectEmotion = true;
      rules.empathy = emotion?.score > 0.7 ? 'high' : 'medium';
      rules.brevity = 'medium';
      rules.followUp = true;
      break;

    case DIALOG_ACTS.REPAIR:
      // If repair → apologize quickly, restate corrected fact, continue
      rules.beats = ['apology', 'correction', 'continue'];
      rules.answerFirst = true;
      rules.brevity = 'short';
      rules.followUp = false;
      break;

    case DIALOG_ACTS.ACK:
      // Brief acknowledgment, then optional callback or new topic
      rules.beats = ['ack', 'callback'];
      rules.brevity = 'short';
      rules.followUp = false;
      break;

    case DIALOG_ACTS.PLAN:
      // Engage with the plan, offer help or alternative
      rules.beats = ['engage', 'offer'];
      rules.brevity = 'medium';
      rules.followUp = true;
      break;

    case DIALOG_ACTS.FEEDBACK:
      // Accept feedback gracefully, adjust if needed
      rules.beats = ['accept', 'adjust'];
      rules.brevity = 'short';
      rules.followUp = false;
      break;

    case DIALOG_ACTS.GREETING:
      // Warm greeting, optional context check
      rules.beats = ['greeting', 'context'];
      rules.brevity = 'short';
      rules.followUp = false;
      break;

    case DIALOG_ACTS.ANSWER:
      // Acknowledge answer, build on it
      rules.beats = ['ack', 'build'];
      rules.brevity = 'short';
      rules.followUp = true;
      break;

    default:
      // Unknown: default conversational structure
      rules.beats = ['respond', 'followup'];
      rules.brevity = 'medium';
      rules.followUp = true;
  }

  return rules;
}

// Generate turn-taking instructions for planner
function generateTurnInstructions(dialogAct, rules) {
  const instructions = [];

  if (rules.answerFirst) {
    instructions.push('Answer the question in the FIRST sentence');
  }

  if (rules.reflectEmotion) {
    instructions.push('Reflect their emotion first (one clause), then respond');
  }

  instructions.push(`Structure: ${rules.beats.join(' → ')}`);

  if (dialogAct === DIALOG_ACTS.REPAIR) {
    instructions.push('Quick apology → restate correct info → move forward');
  }

  if (dialogAct === DIALOG_ACTS.ACK) {
    instructions.push('Brief ack only, unless there\'s a natural callback');
  }

  if (rules.followUp) {
    instructions.push('End with ONE warm, specific follow-up question');
  } else {
    instructions.push('NO follow-up question');
  }

  return instructions.join('. ');
}

module.exports = {
  DIALOG_ACTS,
  classifyDialogAct,
  classifyDialogActLLM,
  getTurnTakingRules,
  generateTurnInstructions
};


// Linguistic Style Matching (LSM)
// Analyzes and mirrors user's communication style

const STYLE_DIMENSIONS = {
  CONTRACTIONS: 'contractions',       // I'm, you're, can't
  EMOJI: 'emoji',                     // 😊, 🎉, ❤️
  PUNCTUATION: 'punctuation',         // !!!, ..., —
  FORMALITY: 'formality',             // hey vs hello, yeah vs yes
  SENTENCE_LENGTH: 'sentenceLength',  // avg words per sentence
  QUESTION_MARKS: 'questionMarks',    // frequency of ?
  CAPITALIZATION: 'capitalization',   // ALL CAPS usage
  HINGLISH: 'hinglish',              // Hindi/English code-mixing
  HEDGE_WORDS: 'hedgeWords'          // like, kinda, sort of, maybe
};

// Analyze user's linguistic style
function analyzeLSM(text) {
  const style = {};
  
  // Contractions
  const contractionPattern = /\b(i'm|you're|we're|they're|he's|she's|it's|can't|won't|don't|doesn't|isn't|aren't|wasn't|weren't|i'll|you'll|we'll|they'll|i'd|you'd|we'd|they'd|i've|you've|we've|they've)\b/gi;
  const contractions = (text.match(contractionPattern) || []).length;
  const words = text.split(/\s+/).length;
  style.contractions = words > 0 ? contractions / words : 0;
  
  // Emoji
  const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojis = (text.match(emojiPattern) || []).length;
  style.emoji = words > 0 ? emojis / words : 0;
  
  // Punctuation density
  const exclamations = (text.match(/!/g) || []).length;
  const ellipses = (text.match(/\.{2,}/g) || []).length;
  const emDashes = (text.match(/—/g) || []).length;
  style.punctuation = words > 0 ? (exclamations + ellipses + emDashes) / words : 0;
  
  // Formality (informal vs formal words)
  const informalWords = /\b(hey|yeah|yep|yup|nah|nope|gonna|wanna|gotta|kinda|sorta|dunno|lemme|gimme|sup|yo)\b/gi;
  const formalWords = /\b(hello|yes|certainly|perhaps|however|therefore|consequently|furthermore|nevertheless)\b/gi;
  const informal = (text.match(informalWords) || []).length;
  const formal = (text.match(formalWords) || []).length;
  style.formality = informal + formal > 0 ? informal / (informal + formal) : 0.5; // 0=formal, 1=informal
  
  // Sentence length
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0
    ? sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length
    : 10;
  style.sentenceLength = avgSentenceLength;
  
  // Question marks
  const questions = (text.match(/\?/g) || []).length;
  style.questionMarks = sentences.length > 0 ? questions / sentences.length : 0;
  
  // Capitalization (ALL CAPS usage)
  const capsWords = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
  style.capitalization = words > 0 ? capsWords / words : 0;
  
  // Hinglish (Hindi words in Roman script)
  const hindiWords = /\b(acha|accha|theek|hai|nahi|kya|kyun|kaise|haan|thoda|bahut|kuch|abhi|phir|yaar|bhai|didi|ji|mein|tum|aap|karo|kar|ho|hoon|hoga|tha|thi|the|matlab|yeh|woh|aise|waisa)\b/gi;
  const hindi = (text.match(hindiWords) || []).length;
  style.hinglish = words > 0 ? hindi / words : 0;
  
  // Hedge words
  const hedges = /\b(like|kinda|sorta|maybe|probably|perhaps|seems|appears|might|could|would|i think|i guess|i suppose|you know|i mean)\b/gi;
  const hedgeCount = (text.match(hedges) || []).length;
  style.hedgeWords = words > 0 ? hedgeCount / words : 0;
  
  return style;
}

// Compute LSM score (similarity between two styles)
function computeLSM(style1, style2) {
  const dimensions = Object.keys(STYLE_DIMENSIONS);
  let totalSim = 0;
  let count = 0;
  
  for (const dim of dimensions) {
    const key = STYLE_DIMENSIONS[dim];
    if (style1[key] !== undefined && style2[key] !== undefined) {
      // For ratio dimensions (0-1), use 1 - abs difference
      if (key !== 'sentenceLength') {
        totalSim += 1 - Math.abs(style1[key] - style2[key]);
      } else {
        // For sentence length, normalize and compare
        const maxLen = Math.max(style1[key], style2[key], 1);
        const minLen = Math.min(style1[key], style2[key]);
        totalSim += minLen / maxLen;
      }
      count++;
    }
  }
  
  return count > 0 ? totalSim / count : 0.5;
}

// Blend two styles (for mirroring)
function blendStyles(baseStyle, targetStyle, weight = 0.8) {
  const blended = {};
  const dimensions = Object.keys(STYLE_DIMENSIONS);
  
  for (const dim of dimensions) {
    const key = STYLE_DIMENSIONS[dim];
    if (baseStyle[key] !== undefined && targetStyle[key] !== undefined) {
      blended[key] = baseStyle[key] * (1 - weight) + targetStyle[key] * weight;
    } else if (baseStyle[key] !== undefined) {
      blended[key] = baseStyle[key];
    } else if (targetStyle[key] !== undefined) {
      blended[key] = targetStyle[key];
    }
  }
  
  return blended;
}

// Generate style instructions for planner/drafter
function generateStyleInstructions(targetStyle) {
  const instructions = [];
  
  // Contractions
  if (targetStyle.contractions > 0.15) {
    instructions.push('Use contractions frequently (I\'m, you\'re, can\'t)');
  } else if (targetStyle.contractions < 0.05) {
    instructions.push('Avoid contractions, use full forms');
  }
  
  // Emoji
  if (targetStyle.emoji > 0.05) {
    instructions.push(`Use ${Math.round(targetStyle.emoji * 100)} emojis per 10 words`);
  } else {
    instructions.push('Minimal or no emojis');
  }
  
  // Punctuation
  if (targetStyle.punctuation > 0.1) {
    instructions.push('Use expressive punctuation (!, ..., —)');
  } else {
    instructions.push('Keep punctuation minimal and standard');
  }
  
  // Formality
  if (targetStyle.formality > 0.7) {
    instructions.push('Very informal tone (hey, yeah, gonna)');
  } else if (targetStyle.formality < 0.3) {
    instructions.push('More formal tone (hello, yes, going to)');
  }
  
  // Sentence length
  if (targetStyle.sentenceLength < 8) {
    instructions.push('Short, punchy sentences (5-8 words)');
  } else if (targetStyle.sentenceLength > 15) {
    instructions.push('Longer, flowing sentences (15-20 words)');
  }
  
  // Hinglish
  if (targetStyle.hinglish > 0.05) {
    instructions.push('Mix in Hinglish naturally (acha, yaar, matlab)');
  }
  
  // Hedge words
  if (targetStyle.hedgeWords > 0.08) {
    instructions.push('Use hedges/softeners (maybe, kinda, I think)');
  } else if (targetStyle.hedgeWords < 0.02) {
    instructions.push('Be direct, avoid hedges');
  }
  
  return instructions.join('. ');
}

// Maintain per-user style profile
class UserStyleProfile {
  constructor() {
    this.profiles = {}; // userId -> { style, samples, lastUpdated }
  }
  
  update(userId, newStyle) {
    if (!this.profiles[userId]) {
      this.profiles[userId] = {
        style: newStyle,
        samples: 1,
        lastUpdated: new Date()
      };
    } else {
      const profile = this.profiles[userId];
      // Exponential moving average
      const alpha = 0.3; // weight for new sample
      for (const key in newStyle) {
        if (profile.style[key] !== undefined) {
          profile.style[key] = profile.style[key] * (1 - alpha) + newStyle[key] * alpha;
        } else {
          profile.style[key] = newStyle[key];
        }
      }
      profile.samples++;
      profile.lastUpdated = new Date();
    }
  }
  
  get(userId) {
    return this.profiles[userId]?.style || null;
  }
  
  getSamples(userId) {
    return this.profiles[userId]?.samples || 0;
  }
}

const userStyleProfiles = new UserStyleProfile();

module.exports = {
  STYLE_DIMENSIONS,
  analyzeLSM,
  computeLSM,
  blendStyles,
  generateStyleInstructions,
  userStyleProfiles
};


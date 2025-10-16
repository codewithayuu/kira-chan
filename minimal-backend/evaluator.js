// Response evaluation: heuristics + optional auto-rater

// Heuristic evaluators
function evaluateDirectness(userMsg, response) {
  // Check if response answers within first 1-2 sentences
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Look for question indicators in user message
  const isQuestion = /\b(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does)\b/i.test(userMsg);
  
  if (!isQuestion) return { score: 1.0, pass: true, reason: 'Not a question' };
  
  // Check if first sentence contains answer-like content
  const firstSentence = sentences[0] || '';
  const hasAnswer = firstSentence.length > 10; // basic check
  
  return {
    score: hasAnswer ? 1.0 : 0.5,
    pass: hasAnswer,
    reason: hasAnswer ? 'Answered directly' : 'Answer buried or missing'
  };
}

function evaluateEmpathy(userMsg, response, emotion) {
  // Check for emotion acknowledgment if user expressed strong emotion
  if (!emotion || emotion.score < 0.7) {
    return { score: 1.0, pass: true, reason: 'No strong emotion to reflect' };
  }
  
  const emotionWords = {
    'sad': ['sorry', 'hear', 'rough', 'tough', 'understand', 'feel'],
    'happy': ['awesome', 'amazing', 'congrats', 'celebrate', 'love that'],
    'angry': ['frustrating', 'that sucks', 'totally get', 'valid'],
    'fear': ['okay', 'safe', 'here', 'understand']
  };
  
  const relevantWords = emotionWords[emotion.label] || [];
  const hasEmpathy = relevantWords.some(word => 
    response.toLowerCase().includes(word)
  );
  
  return {
    score: hasEmpathy ? 1.0 : 0.6,
    pass: hasEmpathy,
    reason: hasEmpathy ? 'Emotion reflected' : 'Missed emotional context'
  };
}

function evaluateBrevity(response, targetBrevity) {
  const wordCount = response.split(/\s+/).length;
  
  const targets = {
    short: { min: 40, max: 110 },
    medium: { min: 80, max: 170 },
    long: { min: 140, max: 260 }
  };
  
  const target = targets[targetBrevity] || targets.medium;
  const inRange = wordCount >= target.min && wordCount <= target.max;
  
  return {
    score: inRange ? 1.0 : (Math.abs(wordCount - target.max) < 50 ? 0.7 : 0.4),
    pass: inRange,
    reason: `${wordCount} words (target: ${target.min}-${target.max})`,
    wordCount
  };
}

function evaluateDiversity(response, recentResponses = []) {
  // Check for phrase repetition in last 5 responses
  const phrases = response.match(/\b\w+\s+\w+\s+\w+\b/g) || [];
  
  let repeatedPhrases = 0;
  for (const phrase of phrases) {
    const phraseCount = recentResponses.filter(r => 
      r.toLowerCase().includes(phrase.toLowerCase())
    ).length;
    if (phraseCount > 0) repeatedPhrases++;
  }
  
  const repetitionRate = phrases.length > 0 ? repeatedPhrases / phrases.length : 0;
  
  return {
    score: repetitionRate < 0.2 ? 1.0 : (repetitionRate < 0.4 ? 0.7 : 0.4),
    pass: repetitionRate < 0.3,
    reason: `${Math.round(repetitionRate * 100)}% phrase repetition`,
    repetitionRate
  };
}

function evaluateAvoidance(response, avoidList) {
  const violations = avoidList.filter(phrase => 
    response.toLowerCase().includes(phrase.toLowerCase())
  );
  
  return {
    score: violations.length === 0 ? 1.0 : 0.0,
    pass: violations.length === 0,
    reason: violations.length > 0 ? `Contains: ${violations.join(', ')}` : 'Clean',
    violations
  };
}

function evaluateSentenceVariety(response) {
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length < 2) {
    return { score: 0.8, pass: true, reason: 'Single sentence response' };
  }
  
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  
  // Good variety if standard deviation > 3
  const hasVariety = stdDev > 3;
  
  return {
    score: hasVariety ? 1.0 : 0.7,
    pass: hasVariety,
    reason: `Sentence length std dev: ${stdDev.toFixed(1)}`,
    stdDev
  };
}

// Composite evaluation
function evaluateResponse(userMsg, response, context = {}) {
  const {
    emotion = null,
    targetBrevity = 'medium',
    avoidList = [],
    recentResponses = [],
    plan = {}
  } = context;
  
  const results = {
    directness: evaluateDirectness(userMsg, response),
    empathy: evaluateEmpathy(userMsg, response, emotion),
    brevity: evaluateBrevity(response, targetBrevity),
    diversity: evaluateDiversity(response, recentResponses),
    avoidance: evaluateAvoidance(response, avoidList),
    sentenceVariety: evaluateSentenceVariety(response)
  };
  
  // Calculate overall score (weighted)
  const weights = {
    directness: 0.25,
    empathy: 0.20,
    brevity: 0.15,
    diversity: 0.15,
    avoidance: 0.15,
    sentenceVariety: 0.10
  };
  
  const overallScore = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + (results[key].score * weight),
    0
  );
  
  const allPassed = Object.values(results).every(r => r.pass);
  
  return {
    overall: {
      score: overallScore,
      pass: overallScore >= 0.75,
      grade: overallScore >= 0.9 ? 'A' : overallScore >= 0.75 ? 'B' : overallScore >= 0.6 ? 'C' : 'D'
    },
    details: results,
    summary: Object.entries(results)
      .filter(([_, r]) => !r.pass)
      .map(([key, r]) => `${key}: ${r.reason}`)
      .join('; ') || 'All checks passed'
  };
}

// Auto-rater using LLM (optional, for logging/analysis)
async function autoRate(groq, userMsg, response, rubric = 'empathy|directness|naturalness') {
  const prompt = `Rate this AI response on a scale of 0-10 for: ${rubric}

USER: "${userMsg}"
RESPONSE: "${response}"

Output only a JSON object like: {"empathy": 8, "directness": 9, "naturalness": 7, "reasoning": "one sentence why"}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are an expert evaluator. Output strict JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    console.error('Auto-rate error:', err.message);
    return null;
  }
}

module.exports = {
  evaluateResponse,
  autoRate,
  evaluateDirectness,
  evaluateEmpathy,
  evaluateBrevity,
  evaluateDiversity,
  evaluateAvoidance,
  evaluateSentenceVariety
};


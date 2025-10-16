// Emotion detection using LLM (Groq/OpenAI/any provider) as primary, local as fallback

// Fallback: local sentiment using Transformers.js
let localClassifier = null;

async function detectEmotionLLM(groq, text) {
  // Use whatever LLM you're already using (Groq, OpenAI, etc.)
  // This way you never need a separate API key!
  
  try {
    const prompt = `Analyze the emotion in this message. Output ONLY valid JSON with this exact format:
{"emotion": "<joy|sadness|anger|fear|surprise|neutral>", "intensity": <0.0-1.0>}

Message: "${text}"

JSON:`;

    const completion = await groq.chat.completions.create({
      model: process.env.EMOTION_MODEL || "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are an emotion classifier. Output strict JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 50,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    
    return {
      label: result.emotion || 'neutral',
      score: result.intensity || 0.5,
      source: 'llm'
    };
  } catch (err) {
    console.warn('LLM emotion detection failed, using local fallback:', err.message);
    return detectEmotionLocal(text);
  }
}

// Legacy HuggingFace method (optional, if you have the key)
async function detectEmotionHF(text) {
  const HF_API_KEY = process.env.HF_API_KEY;
  if (!HF_API_KEY) {
    return detectEmotionLocal(text);
  }

  const HF_EMOTION_MODEL = "j-hartmann/emotion-english-distilroberta-base";

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${HF_EMOTION_MODEL}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: text })
      }
    );

    if (!response.ok) {
      console.warn('HF API failed, using local fallback');
      return detectEmotionLocal(text);
    }

    const result = await response.json();
    
    if (Array.isArray(result) && result[0]) {
      const emotions = Array.isArray(result[0]) ? result[0] : result;
      const top = emotions.sort((a, b) => b.score - a.score)[0];
      
      return {
        label: top.label.toLowerCase(),
        score: top.score,
        source: 'huggingface'
      };
    }
    
    return detectEmotionLocal(text);
  } catch (err) {
    console.error('HF emotion detection error:', err.message);
    return detectEmotionLocal(text);
  }
}

// Local fallback using Transformers.js
async function detectEmotionLocal(text) {
  try {
    if (!localClassifier) {
      const { pipeline } = await import('@xenova/transformers');
      localClassifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
    }

    const result = await localClassifier(text);
    const sentiment = Array.isArray(result) ? result[0] : result;
    
    // Map sentiment to basic emotions
    const emotionMap = {
      'POSITIVE': { label: 'happy', score: sentiment.score },
      'NEGATIVE': { label: 'sad', score: sentiment.score }
    };
    
    return emotionMap[sentiment.label] || { label: 'neutral', score: 0.5 };
  } catch (err) {
    console.error('Local emotion detection error:', err.message);
    return { label: 'neutral', score: 0.5 };
  }
}

// Map detected emotion to tone
function emotionToTone(emotion) {
  const toneMap = {
    'joy': 'playful',
    'happy': 'warm',
    'sadness': 'thoughtful',
    'sad': 'concerned',
    'anger': 'candid',
    'fear': 'concerned',
    'surprise': 'playful',
    'disgust': 'thoughtful',
    'neutral': 'neutral'
  };
  
  return toneMap[emotion.label] || 'neutral';
}

// Boost empathy based on emotion intensity
function getEmpathyLevel(emotion) {
  if (!emotion || emotion.score < 0.6) return 'medium';
  
  const highEmpathyEmotions = ['sadness', 'sad', 'fear', 'anger'];
  if (highEmpathyEmotions.includes(emotion.label)) {
    return emotion.score > 0.8 ? 'high' : 'medium';
  }
  
  return 'medium';
}

module.exports = {
  detectEmotionLLM,      // Primary: uses your existing LLM (Groq/OpenAI/etc)
  detectEmotionHF,       // Optional: if you have HF key
  detectEmotionLocal,    // Fallback: local Transformers.js
  emotionToTone,
  getEmpathyLevel
};


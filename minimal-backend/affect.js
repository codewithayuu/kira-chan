const { z } = require('zod');

const ControlSchema = z.object({
  control: z.object({
    mood: z.enum(["neutral","happy","playful","shy","sad","angry","surprised","sleepy","flirty"]).optional(),
    valence: z.number().min(-1).max(1).optional(),
    arousal: z.number().min(0).max(1).optional(),
    blush: z.number().min(0).max(1).optional(),
    gaze: z.enum(["user","down","left","right","away"]).optional(),
    speak_rate: z.number().min(0.8).max(1.2).optional(),
    pitch: z.number().min(0.8).max(1.2).optional(),
  })
});

function defaultAffect() {
  return { mood: "neutral", valence: 0, arousal: 0.3, blush: 0, gaze: "user", speak_rate: 1.0, pitch: 1.0 };
}

function smoothAffect(prev, next, alpha = 0.25) {
  const out = { ...prev };
  const keys = ["valence","arousal","blush","speak_rate","pitch"];
  for (const k of keys) {
    if (typeof next[k] === 'number') out[k] = prev[k] + alpha * (next[k] - prev[k]);
  }
  if (next.mood) out.mood = next.mood;
  if (next.gaze) out.gaze = next.gaze;
  return out;
}

let clf = null;
const MAP = {
  positive: { val: 0.6, aro: 0.5, mood: 'happy' },
  negative: { val: -0.6, aro: 0.6, mood: 'sad' },
  neutral: { val: 0.0, aro: 0.3, mood: 'neutral' },
};

async function inferEmotion(text) {
  try {
    if (!clf) {
      const { pipeline } = await import('@xenova/transformers');
      clf = await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
    }
    const out = await clf(text, { topk: 1 });
    const label = (Array.isArray(out) && out[0]?.label ? out[0].label : 'neutral').toLowerCase();
    return MAP[label] || MAP.neutral;
  } catch (e) {
    return MAP.neutral;
  }
}

module.exports = {
  ControlSchema,
  defaultAffect,
  smoothAffect,
  inferEmotion,
};


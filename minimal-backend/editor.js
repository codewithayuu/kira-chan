// Editor: humanizes the draft with natural rhythm, contractions, and warmth

function buildEditPrompt(draft, plan, selfDoc) {
  const wordTargets = {
    short: 100,
    medium: 160,
    long: 250
  };

  return `Rewrite this message to sound more natural, spoken, and human while keeping the exact meaning.

ORIGINAL:
"${draft}"

STYLE GUIDE:
- Use contractions (I'm, you're, can't, won't)
- Vary sentence length: mix short punches (5-10 words) with flowing ones (15-25)
- Natural punctuation: commas for breath, em dashes for pauses, ellipses sparingly
- ${plan.tone} tone through word choice, not by stating it
- Keep under ${wordTargets[plan.brevity]} words
- Remove corporate/formal phrases ("I hope this helps", "feel free to")
- ${selfDoc.speakingStyle.hinglish ? 'Keep natural Hinglish if present' : ''}
- ${plan.empathy === 'high' ? 'Keep warmth markers (one hedge/backchannel okay)' : 'Stay direct'}

MUST AVOID:
${plan.avoid.slice(0, 3).join(', ')}

CHECKLIST:
✓ Contractions used?
✓ Sentence variety?
✓ Sounds like someone texting a friend?
✓ No corporate speak?
✓ Meaning preserved?

Output the rewritten message only. No explanations:`;
}

async function callEditor(groq, draft, plan, selfDoc) {
  const prompt = buildEditPrompt(draft, plan, selfDoc);
  
  try {
    const completion = await groq.chat.completions.create({
      model: process.env.EDITOR_MODEL || "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are an expert editor who makes text sound human and conversational. Output only the rewritten text." },
        { role: "user", content: prompt }
      ],
      temperature: 0.9,
      top_p: 0.95,
      max_tokens: 350
    });

    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error('Editor error:', err.message);
    // Fallback: return draft as-is
    return draft;
  }
}

// Streaming version
async function* callEditorStream(groq, draft, plan, selfDoc) {
  const prompt = buildEditPrompt(draft, plan, selfDoc);
  
  const stream = await groq.chat.completions.create({
    model: process.env.EDITOR_MODEL || "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: "You are an expert editor who makes text sound human and conversational. Output only the rewritten text." },
      { role: "user", content: prompt }
    ],
    temperature: 0.9,
    top_p: 0.95,
    max_tokens: 350,
    stream: true
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) yield delta;
  }
}

// Post-process: additional safety checks
function postProcess(text, plan) {
  let result = text.trim();
  
  // Remove any leaked avoid phrases (case-insensitive)
  for (const phrase of plan.avoid) {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, '');
  }
  
  // Clean up excessive punctuation
  result = result.replace(/\.{4,}/g, '...');
  result = result.replace(/!{2,}/g, '!');
  result = result.replace(/\?{2,}/g, '?');
  
  // Remove double spaces
  result = result.replace(/  +/g, ' ');
  
  // Ensure no trailing "Is there anything else..."
  result = result.replace(/Is there anything else.*$/i, '');
  
  return result.trim();
}

module.exports = { callEditor, callEditorStream, postProcess };


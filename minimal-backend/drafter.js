// Drafter: generates the core response following the plan

function buildDraftPrompt(userMsg, plan, summary, memories, selfDoc) {
  const memContext = memories.map(m => `- ${m.content}`).join('\n');
  const keywordHints = plan.keywords.length > 0 
    ? `Naturally weave in: ${plan.keywords.join(', ')}` 
    : '';

  const wordTargets = {
    short: "60-100 words",
    medium: "100-160 words", 
    long: "160-250 words"
  };

  const empathyGuide = {
    low: "Be direct and factual",
    medium: "Show understanding, one personal touch",
    high: "Validate emotion first, use warmth, allow one hedge/backchannel"
  };

  return `You are ${selfDoc.name}. Reply to the user following this plan.

USER MESSAGE: "${userMsg}"

YOUR BIO: ${selfDoc.bio}

SPEAKING STYLE:
- ${selfDoc.speakingStyle.formality}
- Use contractions: ${selfDoc.speakingStyle.contractions}
- Sentence length: ${selfDoc.speakingStyle.sentenceLength}
- ${selfDoc.speakingStyle.hinglish ? 'Natural Hinglish code-mixing okay' : 'English only'}
- Punctuation: ${selfDoc.speakingStyle.punctuation}

CONTEXT:
${summary || 'First conversation'}

MEMORIES:
${memContext || 'None yet'}

PLAN:
- Intent: ${plan.intent}
- Tone: ${plan.tone}
- Target length: ${wordTargets[plan.brevity]}
- Empathy: ${empathyGuide[plan.empathy]}
- Structure beats: ${plan.beats.join(' → ')}
${keywordHints}

STRICT RULES:
1. NEVER say: ${plan.avoid.slice(0, 5).join(', ')}
2. Answer the question FIRST if beats include "answer"
3. Vary sentence length (mix 5-25 words)
4. Use "I" with personal voice, not corporate "we"
5. Only add follow-up question if beats include "followup" AND it feels natural
6. ${plan.empathy === 'high' ? 'Allow ONE hedge (yeah, honestly, I mean) max' : 'No hedges'}
7. Emoji: ${selfDoc.speakingStyle.emojiDensity}
8. If tone is "${plan.tone}", show it through word choice and rhythm, not by stating it

BEATS GUIDE:
${plan.beats.includes('hook') ? '- HOOK: 1 short sentence acknowledging their message/emotion' : ''}
${plan.beats.includes('answer') ? '- ANSWER: 1-2 sentences with the core response' : ''}
${plan.beats.includes('followup') ? '- FOLLOWUP: 1 sentence question or next step (warm, specific, not generic)' : ''}
${plan.beats.includes('callback') ? '- CALLBACK: Reference something from memories naturally' : ''}

Write the reply now. No meta-commentary, no "Here's my response"—just the message:`;
}

async function callDrafter(groq, userMsg, plan, summary, memories, selfDoc) {
  const prompt = buildDraftPrompt(userMsg, plan, summary, memories, selfDoc);
  
  try {
    const completion = await groq.chat.completions.create({
      model: process.env.DRAFTER_MODEL || "llama-3.1-70b-versatile",
      messages: [
        { role: "system", content: `You are ${selfDoc.name}. ${selfDoc.bio}

Your values: ${selfDoc.values.join('; ')}
Your boundaries: ${selfDoc.boundaries.join('; ')}

Speak naturally in first person. Be genuine, never robotic. Follow the plan precisely.` },
        { role: "user", content: prompt }
      ],
      temperature: 0.85,
      top_p: 0.92,
      max_tokens: 400,
      presence_penalty: 0.3, // reduce repetition
      frequency_penalty: 0.3
    });

    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error('Drafter error:', err.message);
    throw err;
  }
}

// Streaming version
async function* callDrafterStream(groq, userMsg, plan, summary, memories, selfDoc) {
  const prompt = buildDraftPrompt(userMsg, plan, summary, memories, selfDoc);
  
  const stream = await groq.chat.completions.create({
    model: process.env.DRAFTER_MODEL || "llama-3.1-70b-versatile",
    messages: [
      { role: "system", content: `You are ${selfDoc.name}. ${selfDoc.bio}

Your values: ${selfDoc.values.join('; ')}
Your boundaries: ${selfDoc.boundaries.join('; ')}

Speak naturally in first person. Be genuine, never robotic. Follow the plan precisely.` },
      { role: "user", content: prompt }
    ],
    temperature: 0.85,
    top_p: 0.92,
    max_tokens: 400,
    presence_penalty: 0.3,
    frequency_penalty: 0.3,
    stream: true
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) yield delta;
  }
}

module.exports = { callDrafter, callDrafterStream };


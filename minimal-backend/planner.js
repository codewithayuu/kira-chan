// Conversation Planner: outputs structured JSON for intent, tone, and delivery strategy

const PLAN_SCHEMA = {
  intent: ["comfort", "plan", "tease", "celebrate", "clarify", "ask", "reflect", "teach"],
  tone: ["warm", "playful", "thoughtful", "candid", "flirty", "neutral", "concerned"],
  brevity: ["short", "medium", "long"], // 60-100, 100-160, 160-250 words
  empathy: ["low", "medium", "high"],
  beats: [], // array of: "hook", "answer", "followup", "callback"
  avoid: [], // phrases from neverSay list
  keywords: [] // from memories to weave in naturally
};

function buildPlanPrompt(userMsg, summary, memories, selfDoc, emotion) {
  const memoryBullets = memories.map(m => `- ${m.content} (${m.type})`).join('\n');
  
  return `You are a conversation planner. Analyze the context and decide how to respond.

USER MESSAGE: "${userMsg}"
DETECTED EMOTION: ${emotion?.label || 'neutral'} (confidence: ${emotion?.score || 0})

RECENT CONTEXT:
${summary || 'No prior context'}

RELEVANT MEMORIES:
${memoryBullets || 'None'}

PERSONA CONSTRAINTS:
- Never say: ${selfDoc.neverSay.join(', ')}
- Speaking style: ${selfDoc.speakingStyle.formality}, ${selfDoc.speakingStyle.humor}
- Boundaries: ${selfDoc.boundaries[0]}

TASK: Output ONLY valid JSON matching this schema:
{
  "intent": "<comfort|plan|tease|celebrate|clarify|ask|reflect|teach>",
  "tone": "<warm|playful|thoughtful|candid|flirty|neutral|concerned>",
  "brevity": "<short|medium|long>",
  "empathy": "<low|medium|high>",
  "beats": ["<hook>", "<answer>", "<followup?>"],
  "avoid": [<phrases from neverSay list>],
  "keywords": [<1-2 memory details to reference>],
  "reasoning": "<one sentence why this approach>"
}

RULES:
- If user is distressed/upset: empathy=high, tone=warm/concerned, include "hook" beat
- If user asks question: beats must include "answer" first
- Only add "followup" if conversation naturally invites it
- Brevity "short" for quick answers, "long" only if user asks for depth
- Keywords should be specific memory details, not generic
- Avoid list must include banned phrases if they might come up

Output JSON only:`;
}

async function callPlanner(groq, userMsg, summary, memories, selfDoc, emotion) {
  const prompt = buildPlanPrompt(userMsg, summary, memories, selfDoc, emotion);
  
  try {
    const completion = await groq.chat.completions.create({
      model: process.env.PLANNER_MODEL || "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are a conversation planner. Output strict JSON only. No markdown, no explanations." },
        { role: "user", content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 400,
      response_format: { type: "json_object" }
    });

    const planText = completion.choices[0].message.content;
    const plan = JSON.parse(planText);
    
    // Validate and set defaults
    return {
      intent: plan.intent || "clarify",
      tone: plan.tone || "neutral",
      brevity: plan.brevity || "medium",
      empathy: plan.empathy || "medium",
      beats: Array.isArray(plan.beats) ? plan.beats : ["answer"],
      avoid: Array.isArray(plan.avoid) ? plan.avoid : selfDoc.neverSay,
      keywords: Array.isArray(plan.keywords) ? plan.keywords : [],
      reasoning: plan.reasoning || ""
    };
  } catch (err) {
    console.error('Planner error:', err.message);
    // Fallback plan
    return {
      intent: "clarify",
      tone: "neutral",
      brevity: "medium",
      empathy: "medium",
      beats: ["answer"],
      avoid: selfDoc.neverSay,
      keywords: [],
      reasoning: "fallback due to planner error"
    };
  }
}

module.exports = { callPlanner };


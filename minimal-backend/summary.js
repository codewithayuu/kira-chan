// Rolling thread summary: condense every N turns into bullet-style context

const SUMMARY_INTERVAL = 15; // turns
const MAX_SUMMARY_TOKENS = 300;

async function shouldUpdateSummary(messageCount) {
  return messageCount % SUMMARY_INTERVAL === 0;
}

async function generateSummary(groq, recentMessages, previousSummary = null) {
  // Take last 15-20 messages
  const messagesToSummarize = recentMessages.slice(-20);
  
  const conversationText = messagesToSummarize
    .map(m => `${m.role === 'user' ? 'User' : 'Kira'}: ${m.content}`)
    .join('\n');
  
  const prompt = previousSummary
    ? `Update this conversation summary with new developments.

PREVIOUS SUMMARY:
${previousSummary}

NEW MESSAGES:
${conversationText}

Create an updated bullet-point summary covering:
- Key topics discussed
- User preferences/facts mentioned
- Plans or commitments made
- Unresolved questions
- Emotional context

Keep it concise (under 200 words). Use bullet points:`
    : `Summarize this conversation in bullet points.

CONVERSATION:
${conversationText}

Cover:
- Key topics discussed
- User preferences/facts mentioned
- Plans or commitments made
- Unresolved questions
- Emotional context

Keep it concise (under 200 words). Use bullet points:`;

  try {
    const completion = await groq.chat.completions.create({
      model: process.env.SUMMARIZER_MODEL || "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are a conversation summarizer. Output concise bullet-point summaries only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: MAX_SUMMARY_TOKENS
    });

    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error('Summary generation error:', err.message);
    return previousSummary || 'No summary available';
  }
}

// Extract unresolved commitments/promises from summary
function extractCommitments(summary) {
  const commitmentPattern = /(?:promised|said i'll|will|going to|planning to)\s+([^.\n]+)/gi;
  const commitments = [];
  let match;
  
  while ((match = commitmentPattern.exec(summary)) !== null) {
    commitments.push(match[1].trim());
  }
  
  return commitments;
}

// Build compact context from summary + top memories
function buildContext(summary, memories, commitments = []) {
  const parts = [];
  
  if (summary) {
    parts.push('RECENT CONTEXT:\n' + summary);
  }
  
  if (memories.length > 0) {
    parts.push('\nRELEVANT MEMORIES:\n' + memories.map(m => 
      `- ${m.content} (${m.type}${m.importance > 0.8 ? ', important' : ''})`
    ).join('\n'));
  }
  
  if (commitments.length > 0) {
    parts.push('\nPENDING COMMITMENTS:\n' + commitments.map(c => `- ${c}`).join('\n'));
  }
  
  return parts.join('\n');
}

module.exports = {
  SUMMARY_INTERVAL,
  shouldUpdateSummary,
  generateSummary,
  extractCommitments,
  buildContext
};


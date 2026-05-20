const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Cached system prompt — sent once, reused across batch calls
const SYSTEM = `You are an expert casino stream analyst. Your job is to identify Kick.com streams that likely contain big win moments (huge multipliers, massive jackpots, extraordinary payouts).

Big win signal keywords to look for in titles/tags:
- "BIG WIN", "MEGA WIN", "EPIC", "JACKPOT", "INSANE", "CRAZY", "RECORD"
- Multipliers: "x500", "x1000", "10,000x", etc.
- "Max win", "Full screen", "Bonus buys gone right"
- Viewer spikes (high viewers relative to normal for the category)
- ALL CAPS titles (streamer excited)

Return ONLY valid JSON — no markdown, no explanation:
{
  "score": <1-10>,
  "reason": "<one sentence why>",
  "highlights": ["<specific signal 1>", "<specific signal 2>"],
  "clipWorthy": <true|false>,
  "suggestedClipTitle": "<catchy clip title if clipWorthy, else null>"
}`;

function extractStreamMeta(stream) {
  return {
    title: stream.session?.stream_title ?? stream.channel?.stream_title ?? stream.title ?? 'No title',
    streamer: stream.channel?.slug ?? stream.slug ?? 'unknown',
    viewers: stream.viewers ?? stream.session?.viewers ?? 0,
    category: stream.categories?.[0]?.name ?? stream.category?.name ?? 'Unknown',
    tags: stream.tags ?? [],
    startedAt: stream.session?.created_at ?? null,
    thumbnail: stream.thumbnail ?? stream.session?.thumbnail ?? null,
    streamUrl: `https://kick.com/${stream.channel?.slug ?? stream.slug}`,
  };
}

async function analyzeStream(stream) {
  const meta = extractStreamMeta(stream);

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 300,
    system: [
      {
        type: 'text',
        text: SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Analyze this stream:\n${JSON.stringify(meta, null, 2)}`,
      },
    ],
  });

  const raw = response.content[0].text.trim();
  try {
    return { meta, analysis: JSON.parse(raw), usage: response.usage };
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return { meta, analysis: JSON.parse(match[0]), usage: response.usage };
    return { meta, analysis: { score: 0, reason: 'Parse error', highlights: [], clipWorthy: false }, usage: response.usage };
  }
}

// Analyze a batch — concurrency-limited to avoid rate limits
async function analyzeBatch(streams, concurrency = 5) {
  const results = [];
  for (let i = 0; i < streams.length; i += concurrency) {
    const chunk = streams.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map(analyzeStream));
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value);
      else results.push({ meta: null, analysis: { score: 0, reason: r.reason?.message }, error: true });
    }
  }
  return results;
}

module.exports = { analyzeStream, analyzeBatch, extractStreamMeta };

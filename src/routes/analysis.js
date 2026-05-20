const express = require('express');
const { getMultiCategoryStreams } = require('../kickClient');
const { analyzeStream, analyzeBatch } = require('../claudeAnalyzer');

const router = express.Router();

// POST /api/analyze — analyze raw stream objects you supply
router.post('/', async (req, res) => {
  const { streams } = req.body;
  if (!Array.isArray(streams) || streams.length === 0) {
    return res.status(400).json({ error: 'Body must be { streams: [...] }' });
  }
  if (streams.length > 50) {
    return res.status(400).json({ error: 'Max 50 streams per request' });
  }
  try {
    const results = await analyzeBatch(streams);
    res.json({ count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: 'Analysis failed', detail: err.message });
  }
});

// GET /api/analyze/scan — fetch live casino streams + analyze in one shot
// ?category=slots-casino&limit=20&threshold=7
router.get('/scan', async (req, res) => {
  const categories = (req.query.category || process.env.KICK_CATEGORIES || 'slots-casino')
    .split(',').map(s => s.trim());
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const threshold = parseInt(req.query.threshold ?? process.env.BIGWIN_THRESHOLD ?? 7);
  const minViewers = parseInt(req.query.minViewers ?? process.env.MIN_VIEWERS ?? 0);

  try {
    let streams = await getMultiCategoryStreams(categories, { limit });

    if (minViewers > 0) {
      streams = streams.filter(s => (s.viewers ?? s.session?.viewers ?? 0) >= minViewers);
    }

    if (streams.length === 0) {
      return res.json({ scanned: 0, bigWins: [], all: [] });
    }

    const results = await analyzeBatch(streams);
    const sorted = results.sort((a, b) => (b.analysis?.score ?? 0) - (a.analysis?.score ?? 0));
    const bigWins = sorted.filter(r => (r.analysis?.score ?? 0) >= threshold);

    res.json({
      scanned: results.length,
      bigWinsFound: bigWins.length,
      threshold,
      bigWins,
      all: sorted,
    });
  } catch (err) {
    res.status(500).json({ error: 'Scan failed', detail: err.message });
  }
});

// GET /api/analyze/:slug — analyze a specific channel's live stream
router.get('/:slug', async (req, res) => {
  const { getChannel } = require('../kickClient');
  try {
    const channel = await getChannel(req.params.slug);
    if (!channel?.livestream && !channel?.session) {
      return res.status(404).json({ error: 'Channel is not live' });
    }
    const streamData = channel.livestream ?? channel;
    const result = await analyzeStream(streamData);
    res.json(result);
  } catch (err) {
    const status = err.response?.status === 404 ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;

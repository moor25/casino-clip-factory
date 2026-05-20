require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { getMultiCategoryStreams } = require('./kickClient');
const { analyzeBatch } = require('./claudeAnalyzer');
const streamsRouter = require('./routes/streams');
const analysisRouter = require('./routes/analysis');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../docs')));

// In-memory store for the latest auto-scan results
let lastScanResults = null;
let lastScanAt = null;

app.use('/api/streams', streamsRouter);
app.use('/api/analyze', analysisRouter);

// GET /api/latest — returns results from the most recent scheduled scan
app.get('/api/latest', (req, res) => {
  if (!lastScanResults) {
    return res.status(404).json({ error: 'No scan has run yet. POST /api/analyze/scan or wait for the next scheduled run.' });
  }
  res.json({ scannedAt: lastScanAt, ...lastScanResults });
});

app.get('/', (req, res) => {
  res.json({
    service: 'Casino Clip Factory',
    endpoints: {
      'GET  /api/streams': 'List live casino streams from Kick',
      'GET  /api/streams/categories': 'Browse Kick categories (?q=casino)',
      'GET  /api/streams/:slug': 'Get a specific channel',
      'GET  /api/analyze/scan': 'Fetch + analyze streams for big wins',
      'GET  /api/analyze/:slug': 'Analyze a single channel',
      'POST /api/analyze': 'Analyze custom stream array { streams: [...] }',
      'GET  /api/latest': 'Latest scheduled scan results',
    },
  });
});

// Scheduled auto-scan
const intervalMinutes = parseInt(process.env.SCAN_INTERVAL_MINUTES ?? 5);
if (intervalMinutes > 0) {
  const cronExpr = `*/${intervalMinutes} * * * *`;
  console.log(`Scheduled scan every ${intervalMinutes} minutes (${cronExpr})`);

  cron.schedule(cronExpr, async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled scan...`);
    const categories = (process.env.KICK_CATEGORIES || 'slots-casino').split(',').map(s => s.trim());
    const threshold = parseInt(process.env.BIGWIN_THRESHOLD ?? 7);
    const minViewers = parseInt(process.env.MIN_VIEWERS ?? 0);

    try {
      let streams = await getMultiCategoryStreams(categories, { limit: 25 });
      if (minViewers > 0) streams = streams.filter(s => (s.viewers ?? s.session?.viewers ?? 0) >= minViewers);

      const results = await analyzeBatch(streams);
      const sorted = results.sort((a, b) => (b.analysis?.score ?? 0) - (a.analysis?.score ?? 0));
      const bigWins = sorted.filter(r => (r.analysis?.score ?? 0) >= threshold);

      lastScanAt = new Date().toISOString();
      lastScanResults = { scanned: results.length, bigWinsFound: bigWins.length, threshold, bigWins, all: sorted };

      console.log(`  → ${results.length} streams scanned, ${bigWins.length} big wins found (threshold=${threshold})`);
      if (bigWins.length > 0) {
        bigWins.forEach(r => console.log(`    🎰 ${r.meta?.streamer} — score ${r.analysis?.score}/10 — ${r.analysis?.reason}`));
      }
    } catch (err) {
      console.error('Scheduled scan failed:', err.message);
    }
  });
}

app.listen(PORT, () => {
  console.log(`Casino Clip Factory running on http://localhost:${PORT}`);
  console.log(`Categories: ${process.env.KICK_CATEGORIES || 'slots-casino'}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('WARNING: ANTHROPIC_API_KEY is not set. Analysis will fail.');
  }
});

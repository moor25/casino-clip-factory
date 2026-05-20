const express = require('express');
const { getCategoryStreams, getChannel, searchCategories, getMultiCategoryStreams } = require('../kickClient');

const router = express.Router();

// GET /api/streams?category=slots-casino&page=1&limit=25
router.get('/', async (req, res) => {
  const categories = (req.query.category || process.env.KICK_CATEGORIES || 'slots-casino')
    .split(',').map(s => s.trim());
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 25;

  try {
    if (categories.length === 1) {
      const data = await getCategoryStreams(categories[0], { page, limit });
      return res.json(data);
    }
    const streams = await getMultiCategoryStreams(categories, { page, limit });
    res.json({ data: streams, total: streams.length });
  } catch (err) {
    res.status(502).json({ error: 'Kick API error', detail: err.message });
  }
});

// GET /api/streams/categories?q=casino
router.get('/categories', async (req, res) => {
  try {
    const cats = await searchCategories(req.query.q || '');
    res.json(cats);
  } catch (err) {
    res.status(502).json({ error: 'Kick API error', detail: err.message });
  }
});

// GET /api/streams/:slug
router.get('/:slug', async (req, res) => {
  try {
    const data = await getChannel(req.params.slug);
    res.json(data);
  } catch (err) {
    const status = err.response?.status === 404 ? 404 : 502;
    res.status(status).json({ error: status === 404 ? 'Channel not found' : 'Kick API error', detail: err.message });
  }
});

module.exports = router;

const axios = require('axios');

const BASE = 'https://kick.com/api/v2';

const headers = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Referer: 'https://kick.com',
};

async function getCategoryStreams(categorySlug, { page = 1, limit = 25 } = {}) {
  const res = await axios.get(`${BASE}/categories/${categorySlug}/streams`, {
    params: { page, limit },
    headers,
    timeout: 10_000,
  });
  return res.data;
}

async function getChannel(slug) {
  const res = await axios.get(`${BASE}/channels/${slug}`, { headers, timeout: 10_000 });
  return res.data;
}

async function searchCategories(query = '') {
  const res = await axios.get(`${BASE}/categories`, {
    params: { page: 1, limit: 100 },
    headers,
    timeout: 10_000,
  });
  const all = res.data?.data ?? res.data ?? [];
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter(c => c.name?.toLowerCase().includes(q) || c.slug?.toLowerCase().includes(q));
}

// Fetch streams from multiple categories, deduped by channel slug
async function getMultiCategoryStreams(slugs, opts = {}) {
  const results = await Promise.allSettled(slugs.map(s => getCategoryStreams(s, opts)));
  const seen = new Set();
  const streams = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const list = r.value?.data ?? r.value ?? [];
    for (const stream of list) {
      const key = stream.channel?.slug ?? stream.slug;
      if (key && !seen.has(key)) {
        seen.add(key);
        streams.push(stream);
      }
    }
  }

  return streams;
}

module.exports = { getCategoryStreams, getChannel, searchCategories, getMultiCategoryStreams };

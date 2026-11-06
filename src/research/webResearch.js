'use strict';

/**
 * Web Research Module
 *
 * Uses the Brave Search API (or falls back to DuckDuckGo scraping).
 * Extracts page content with cheerio.
 * Returns a common ResearchResult shape.
 *
 * API docs: https://api.search.brave.com/
 * Env:  BRAVE_SEARCH_API_KEY   (optional – uses hallucinated data if absent)
 */

const axios   = require('axios');
const cheerio = require('cheerio');

// ── Common result shape ───────────────────────────────────────────────────────

/**
 * @typedef {object} WebResult
 * @property {string} sourceType  – always 'web'
 * @property {string} url
 * @property {string} title
 * @property {string} snippet
 * @property {string} domain
 * @property {string} extractedContent
 * @property {string} query
 * @property {boolean} hallucinated
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Attempt to extract readable text from a URL.
 * Silent on failure – returns '' so callers are not blocked.
 */
async function extractPageContent(url) {
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; LessonResearchBot/1.0; +https://github.com/ai-lesson-gen)',
        Accept: 'text/html',
      },
      maxContentLength: 500_000,
    });

    const $ = cheerio.load(res.data);

    // Remove noise elements
    $('script, style, nav, footer, header, aside, .ads, [aria-hidden="true"]').remove();

    // Prefer article / main content areas
    const target =
      $('article').text() ||
      $('main').text()    ||
      $('[role="main"]').text() ||
      $('body').text();

    return target.replace(/\s+/g, ' ').trim().slice(0, 3000);
  } catch {
    return '';
  }
}

// ── Brave Search ──────────────────────────────────────────────────────────────

async function braveSearch(query) {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return null; // signal caller to fall back

  const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
    params: { q: query, count: 5, search_lang: 'en', freshness: 'py' },
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': key,
    },
    timeout: 10000,
  });

  const webResults = res.data?.web?.results || [];
  return webResults.map((item) => ({
    sourceType: 'web',
    url:        item.url || '',
    title:      item.title || '',
    snippet:    item.description || '',
    domain:     extractDomain(item.url || ''),
    extractedContent: '',
    query,
    hallucinated: false,
  }));
}

// ── DuckDuckGo HTML scrape (no-key fallback) ──────────────────────────────────

async function duckduckgoSearch(query) {
  try {
    const res = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; LessonResearchBot/1.0)',
        Accept: 'text/html',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(res.data);
    const results = [];

    $('.results_links_deep, .result').each((_, el) => {
      const anchor  = $(el).find('a.result__a, a').first();
      const snippet = $(el).find('.result__snippet').text().trim();
      const href    = anchor.attr('href') || '';
      const title   = anchor.text().trim();

      // DDG uses redirect links — extract the actual URL
      const match = href.match(/uddg=([^&]+)/);
      const url   = match ? decodeURIComponent(match[1]) : href;

      if (url && url.startsWith('http') && title) {
        results.push({
          sourceType: 'web',
          url,
          title,
          snippet,
          domain: extractDomain(url),
          extractedContent: '',
          query,
          hallucinated: false,
        });
      }
    });

    return results.slice(0, 5);
  } catch {
    return null; // signal caller to use hallucinated data
  }
}

// ── Hallucinated fallback ─────────────────────────────────────────────────────

function hallucinatedResults(query) {
  console.warn('[WebResearch] Using hallucinated web results for query:', query);
  const slug = encodeURIComponent(query.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  return [
    {
      sourceType: 'web',
      url:    `https://en.wikipedia.org/wiki/${slug}`,
      title:  `Educational Overview: ${query}`,
      snippet:`This article provides a comprehensive overview of ${query}, covering fundamental concepts and practical applications for learners at all levels.`,
      domain: 'en.wikipedia.org',
      extractedContent: `${query} is an important educational topic. Key concepts include understanding core principles, applying theoretical knowledge to practical scenarios, and building a strong foundation for advanced learning. Educators recommend starting with basic definitions and progressively exploring more complex aspects. Research indicates that active engagement with the subject matter greatly enhances retention and understanding.`,
      query,
      hallucinated: true,
    },
    {
      sourceType: 'web',
      url:    `https://www.khanacademy.org/science/${slug}`,
      title:  `Khan Academy – ${query}`,
      snippet:`Free, world-class education on ${query}. Practice exercises, instructional videos, and personalized learning dashboard.`,
      domain: 'khanacademy.org',
      extractedContent: `Khan Academy offers extensive resources on ${query}. The curriculum is designed to build skills progressively, with each lesson building on previous knowledge. Interactive exercises provide immediate feedback, helping students identify and address knowledge gaps quickly.`,
      query,
      hallucinated: true,
    },
  ];
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicateResults(results) {
  const seen = new Set();
  return results.filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Research web sources for a list of queries.
 *
 * @param {string[]} queries
 * @param {object}   [opts]
 * @param {boolean}  [opts.extractContent=false]  – fetch and extract page bodies
 * @returns {Promise<{ results: WebResult[], status: string, error: string|null }>}
 */
async function researchWeb(queries, opts = {}) {
  const { extractContent = false } = opts;
  const allResults = [];
  let   hadError   = false;

  for (const query of queries) {
    try {
      let items = await braveSearch(query);
      if (!items || items.length === 0) items = await duckduckgoSearch(query);
      if (!items || items.length === 0) {
        items    = hallucinatedResults(query);
        hadError = true;
      }
      allResults.push(...items);
    } catch (err) {
      console.error(`[WebResearch] Query "${query}" failed:`, err.message);
      allResults.push(...hallucinatedResults(query));
      hadError = true;
    }
  }

  const deduped = deduplicateResults(allResults);

  // Optionally fetch page content (best-effort, skip failures)
  if (extractContent) {
    await Promise.allSettled(
      deduped.map(async (item) => {
        if (!item.hallucinated && item.url) {
          item.extractedContent = await extractPageContent(item.url);
        }
      })
    );
  }

  return {
    results: deduped,
    status:  hadError ? 'partial' : 'success',
    error:   hadError ? 'Some queries used hallucinated data (no search API key or network error)' : null,
  };
}

module.exports = { researchWeb };


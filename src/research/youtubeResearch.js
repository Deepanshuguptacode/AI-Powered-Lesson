'use strict';

/**
 * YouTube Research Module
 *
 * Searches YouTube Data API v3 for relevant educational videos.
 * Attempts to extract transcripts using the youtube-transcript package.
 * Returns a common ResearchResult shape.
 *
 * API docs: https://developers.google.com/youtube/v3/docs/search/list
 * Env: YOUTUBE_API_KEY (required for real data)
 */

const axios = require('axios');

// youtube-transcript is a CommonJS package
let YoutubeTranscript;
try {
  const pkg = require('youtube-transcript');
  // handles both default-export and named-export styles
  YoutubeTranscript = pkg.YoutubeTranscript || pkg.default || pkg;
} catch {
  YoutubeTranscript = null;
}

// ── Common result shape ───────────────────────────────────────────────────────

/**
 * @typedef {object} YouTubeResult
 * @property {string}  sourceType  – always 'youtube'
 * @property {string}  url         – https://www.youtube.com/watch?v=<videoId>
 * @property {string}  title
 * @property {string}  videoId
 * @property {string}  channelTitle
 * @property {string}  publishedAt
 * @property {string}  thumbnailUrl
 * @property {string}  snippet
 * @property {string}  transcript
 * @property {string}  query
 * @property {boolean} hallucinated
 */

// ── Transcript extraction ─────────────────────────────────────────────────────

/**
 * Extract plain-text transcript for a YouTube videoId.
 * Silent on failure – transcript is best-effort.
 */
async function fetchTranscript(videoId) {
  if (!YoutubeTranscript) return '';
  try {
    const lines = await YoutubeTranscript.fetchTranscript(videoId);
    return lines
      .map((l) => l.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
  } catch {
    return ''; // transcript not available (captions disabled, region-locked, etc.)
  }
}

// ── YouTube Data API ──────────────────────────────────────────────────────────

async function youtubeAPISearch(query) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;

  const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
    params: {
      key,
      q:              query,
      part:           'snippet',
      type:           'video',
      maxResults:     5,
      relevanceLanguage: 'en',
      videoDuration:  'medium', // 4–20 min — avoids shorts and very long lectures
      safeSearch:     'strict',
      videoEmbeddable: true,
    },
    timeout: 10000,
  });

  const items = res.data?.items || [];
  return items
    .filter((item) => item.id?.videoId)
    .map((item) => {
      const s = item.snippet || {};
      const videoId = item.id.videoId;
      return {
        sourceType:   'youtube',
        url:          `https://www.youtube.com/watch?v=${videoId}`,
        title:        s.title || '',
        videoId,
        channelTitle: s.channelTitle || '',
        publishedAt:  s.publishedAt || '',
        thumbnailUrl: s.thumbnails?.medium?.url || s.thumbnails?.default?.url || '',
        snippet:      (s.description || '').slice(0, 500),
        transcript:   '',
        query,
        hallucinated: false,
      };
    });
}

// ── Hallucinated fallback ─────────────────────────────────────────────────────

function hallucinatedResults(query) {
  console.warn('[YouTubeResearch] Using hallucinated YouTube results for query:', query);
  const id1 = 'yt_' + Buffer.from(query + '_1').toString('hex').slice(0, 10);
  const id2 = 'yt_' + Buffer.from(query + '_2').toString('hex').slice(0, 10);
  return [
    {
      sourceType:   'youtube',
      url:          `https://www.youtube.com/watch?v=${id1}`,
      title:        `Introduction to ${query} – Full Lecture`,
      videoId:      id1,
      channelTitle: 'Academic Learning Hub',
      publishedAt:  '2023-01-15T00:00:00Z',
      thumbnailUrl: `https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg`,
      snippet:      `A comprehensive introduction to ${query} covering all the key concepts, examples, and practice problems you need to master this topic.`,
      transcript:   `Welcome to this introduction to ${query}. In today's lesson, we will cover the fundamental concepts that form the backbone of this subject. We'll begin with basic definitions, then move into practical examples. ${query} is important because it underpins many real-world applications. Let's start with the core principles...`,
      query,
      hallucinated: true,
    },
    {
      sourceType:   'youtube',
      url:          `https://www.youtube.com/watch?v=${id2}`,
      title:        `${query} Explained Simply`,
      videoId:      id2,
      channelTitle: 'EduSimplified',
      publishedAt:  '2023-06-20T00:00:00Z',
      thumbnailUrl: `https://img.youtube.com/vi/abc123xyz/mqdefault.jpg`,
      snippet:      `Simple, clear explanations of ${query} designed for students and teachers alike.`,
      transcript:   `Today we're breaking down ${query} into easy-to-understand concepts. Many students find this topic challenging at first, but with the right approach it becomes straightforward. The key is to understand the foundational ideas first...`,
      query,
      hallucinated: true,
    },
  ];
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicateVideos(videos) {
  const seenIds = new Set();
  return videos.filter((v) => {
    if (!v.videoId || seenIds.has(v.videoId)) return false;
    seenIds.add(v.videoId);
    return true;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Research YouTube videos for a list of queries.
 * Optionally fetches transcripts for each found video.
 *
 * @param {string[]} queries
 * @param {object}   [opts]
 * @param {boolean}  [opts.fetchTranscripts=true]
 * @returns {Promise<{ results: YouTubeResult[], status: string, error: string|null }>}
 */
async function researchYouTube(queries, opts = {}) {
  const { fetchTranscripts = true } = opts;
  const allResults = [];
  let   hadError   = false;

  for (const query of queries) {
    try {
      let items = await youtubeAPISearch(query);
      if (!items || items.length === 0) {
        items    = hallucinatedResults(query);
        hadError = true;
      }
      allResults.push(...items);
    } catch (err) {
      console.error(`[YouTubeResearch] Query "${query}" failed:`, err.message);
      allResults.push(...hallucinatedResults(query));
      hadError = true;
    }
  }

  const deduped = deduplicateVideos(allResults);

  // Fetch transcripts (best-effort, in parallel)
  if (fetchTranscripts) {
    await Promise.allSettled(
      deduped
        .filter((v) => !v.hallucinated && v.videoId)
        .map(async (video) => {
          video.transcript = await fetchTranscript(video.videoId);
        })
    );
  }

  return {
    results: deduped,
    status:  hadError ? 'partial' : 'success',
    error:   hadError ? 'Some queries used hallucinated data (no YouTube API key or network error)' : null,
  };
}

module.exports = { researchYouTube };


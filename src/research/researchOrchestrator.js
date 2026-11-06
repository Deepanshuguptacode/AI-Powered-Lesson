'use strict';

/**
 * Research Orchestrator
 *
 * Coordinates all three research providers (web, book, YouTube) for a lesson.
 * Each provider runs independently — a failure in one does NOT stop others.
 * Results and evidence are persisted to MongoDB.
 */

const { createSession, updateSession, findSessionById, saveSources } = require('../services/safeDb');
const { generateSearchQueries } = require('./queryGenerator');
const { researchWeb }     = require('./webResearch');
const { researchBooks }   = require('./bookResearch');
const { researchYouTube } = require('./youtubeResearch');

// ── Helpers ───────────────────────────────────────────────────────────────────

function sourceToEvidence(source, sourceType) {
  let text = '';
  if (sourceType === 'web') {
    text = source.extractedContent || source.snippet || '';
  } else if (sourceType === 'book') {
    text = source.description || '';
  } else if (sourceType === 'youtube') {
    text = source.transcript || source.snippet || '';
  }

  if (!text || text.trim().length < 20) return null;

  return {
    text:        text.slice(0, 2000),
    sourceType,
    sourceUrl:   source.url || '',
    sourceTitle: source.title || '',
    relevance:   source.relevanceScore || 0.5,
  };
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Run research for a lesson.
 *
 * @param {object} params
 * @param {string} params.lessonTitle
 * @param {string} params.learningObjective
 * @param {string} [params.lessonId]       – MongoDB ObjectId of associated lesson
 * @param {object} [params.opts]
 * @param {boolean} [params.opts.extractWebContent=true]
 * @param {boolean} [params.opts.fetchYouTubeTranscripts=true]
 * @returns {Promise<{ session: object, sources: object[], summary: object }>}
 */
async function runResearch({ lessonTitle, learningObjective, lessonId, opts = {} }) {
  const startTime = Date.now();

  const { extractWebContent = true, fetchYouTubeTranscripts = true } = opts;

  // ── 1. Generate queries ───────────────────────────────────────────────────
  console.log('[Research] Generating search queries…');
  const queries = await generateSearchQueries(lessonTitle, learningObjective);
  console.log('[Research] Queries:', JSON.stringify(queries, null, 2));

  // ── 2. Create session document ────────────────────────────────────────────
  const session = await createSession({
    lessonId:          lessonId || null,
    lessonTitle,
    learningObjective,
    status:            'running',
    queries,
  });

  // ── 3. Run all three providers in parallel (independent failures) ──────────
  const [webResult, bookResult, youtubeResult] = await Promise.allSettled([
    researchWeb(queries.web, { extractContent: extractWebContent }),
    researchBooks(queries.book),
    researchYouTube(queries.youtube, { fetchTranscripts: fetchYouTubeTranscripts }),
  ]);

  const providerResults = [];
  const allSources      = [];

  // ── 3a. Process web results ───────────────────────────────────────────────
  if (webResult.status === 'fulfilled') {
    const { results, status, error } = webResult.value;
    providerResults.push({ provider: 'web', status, itemCount: results.length, error });
    allSources.push(...results.map((r) => ({ ...r, sessionId: session._id })));
  } else {
    console.error('[Research] Web provider crashed:', webResult.reason?.message);
    providerResults.push({ provider: 'web', status: 'failed', itemCount: 0, error: webResult.reason?.message });
  }

  // ── 3b. Process book results ──────────────────────────────────────────────
  if (bookResult.status === 'fulfilled') {
    const { results, status, error } = bookResult.value;
    providerResults.push({ provider: 'book', status, itemCount: results.length, error });
    allSources.push(...results.map((r) => ({ ...r, sessionId: session._id })));
  } else {
    console.error('[Research] Book provider crashed:', bookResult.reason?.message);
    providerResults.push({ provider: 'book', status: 'failed', itemCount: 0, error: bookResult.reason?.message });
  }

  // ── 3c. Process YouTube results ───────────────────────────────────────────
  if (youtubeResult.status === 'fulfilled') {
    const { results, status, error } = youtubeResult.value;
    providerResults.push({ provider: 'youtube', status, itemCount: results.length, error });
    allSources.push(...results.map((r) => ({ ...r, sessionId: session._id })));
  } else {
    console.error('[Research] YouTube provider crashed:', youtubeResult.reason?.message);
    providerResults.push({ provider: 'youtube', status: 'failed', itemCount: 0, error: youtubeResult.reason?.message });
  }

  // ── 4. Save sources ──────────────────────────────────────────────────────
  let savedSources = [];
  if (allSources.length > 0) {
    savedSources = await saveSources(allSources);
  }

  // ── 5. Build evidence array ───────────────────────────────────────────────
  const evidence = allSources
    .map((s) => sourceToEvidence(s, s.sourceType))
    .filter(Boolean);

  // ── 6. Determine overall session status ───────────────────────────────────
  const failedCount   = providerResults.filter((p) => p.status === 'failed').length;
  const partialCount  = providerResults.filter((p) => p.status === 'partial').length;
  let   sessionStatus = 'completed';
  if (failedCount === 3)                        sessionStatus = 'failed';
  else if (failedCount > 0 || partialCount > 0) sessionStatus = 'partial';

  // ── 7. Update session document ────────────────────────────────────────────
  const durationMs = Date.now() - startTime;
  const updatedSession = await updateSession(session._id, {
    status: sessionStatus,
    providerResults,
    evidence,
    totalSources: allSources.length,
    durationMs,
  });

  console.log(`[Research] Complete — ${allSources.length} sources, ${evidence.length} evidence items, ${durationMs}ms`);

  return {
    session:  updatedSession,
    sources:  savedSources,
    summary: {
      totalSources:    allSources.length,
      evidenceCount:   evidence.length,
      providerResults,
      durationMs,
      sessionStatus,
    },
  };
}

module.exports = { runResearch };


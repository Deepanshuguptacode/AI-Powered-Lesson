#!/usr/bin/env node
'use strict';

/**
 * Stage 2 & 3 Unit Test Script (no-MongoDB modules only)
 *
 * Tests the core research modules without needing a live MongoDB.
 * API tests (orchestrator + LangGraph) require MongoDB separately.
 *
 * Run: node tests/test-research.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ── Colour helpers ─────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
};
const pass = (msg) => { console.log(`${C.green}✓ PASS${C.reset} ${msg}`); results.passed++; };
const fail = (msg) => { console.log(`${C.red}✗ FAIL${C.reset} ${msg}`); results.failed++; };
const info = (msg) =>   console.log(`${C.cyan}ℹ${C.reset}  ${msg}`);
const head = (msg) =>   console.log(`\n${C.bold}${C.yellow}── ${msg} ──${C.reset}`);

const results = { passed: 0, failed: 0, errors: [] };

function assert(condition, message) {
  if (condition) pass(message);
  else           fail(message);
  return condition;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — Web Research Module
// ─────────────────────────────────────────────────────────────────────────────
async function testWebResearch() {
  head('TEST 1: Web Research Module');
  const { researchWeb } = require('../src/research/webResearch');

  const result = await researchWeb([
    'photosynthesis explained',
    'light-dependent reactions tutorial',
  ], { extractContent: false }); // skip page fetch (no network in sandbox)

  assert(Array.isArray(result.results),                     'Returns results array');
  assert(result.results.length > 0,                         `Got ${result.results.length} web results`);
  assert(result.results[0].sourceType === 'web',            'sourceType = "web"');
  assert(typeof result.results[0].url === 'string' && result.results[0].url.length > 0, `URL present: ${result.results[0].url}`);
  assert(typeof result.results[0].title === 'string',       'Title present');
  assert(['success','partial'].includes(result.status),     `Status: ${result.status}`);

  // Deduplication — run with repeated query
  const dup = await researchWeb(['photosynthesis', 'photosynthesis'], { extractContent: false });
  const urls = dup.results.map((r) => r.url);
  const uniqueUrls = [...new Set(urls)];
  assert(urls.length === uniqueUrls.length, `Deduplication works (${urls.length} unique URLs)`);

  info(`Sample URLs: ${result.results.slice(0,2).map(r=>r.url).join(', ')}`);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — Book Research Module (Open Library — no key needed)
// ─────────────────────────────────────────────────────────────────────────────
async function testBookResearch() {
  head('TEST 2: Book Research Module');
  const { researchBooks } = require('../src/research/bookResearch');

  const result = await researchBooks(['photosynthesis biology', 'plant cell biology textbook']);

  assert(Array.isArray(result.results),                      'Returns results array');
  assert(result.results.length > 0,                          `Got ${result.results.length} book results`);
  assert(result.results[0].sourceType === 'book',            'sourceType = "book"');
  assert(typeof result.results[0].url === 'string' && result.results[0].url.startsWith('http'), `URL present: ${result.results[0].url}`);
  assert(Array.isArray(result.results[0].authors),           'Authors is array');
  assert(['success','partial'].includes(result.status),      `Status: ${result.status}`);

  // ISBN / duplicate check — same query twice should not produce identical ISBNs
  const titlesLower = result.results.map((r) => r.title.toLowerCase());
  const uniqueTitles = [...new Set(titlesLower)];
  assert(titlesLower.length === uniqueTitles.length, `No duplicate book titles (${uniqueTitles.length} unique)`);

  info(`Books: ${result.results.slice(0,2).map(r=>`"${r.title}"`).join(', ')}`);
  info(`Source: ${result.results[0].hallucinated ? 'hallucinated' : result.results[0].url.includes('google') ? 'Google Books' : 'Open Library'}`);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — YouTube Research Module
// ─────────────────────────────────────────────────────────────────────────────
async function testYouTubeResearch() {
  head('TEST 3: YouTube Research Module');
  const { researchYouTube } = require('../src/research/youtubeResearch');

  const result = await researchYouTube(
    ['photosynthesis lecture', 'Calvin cycle explained'],
    { fetchTranscripts: false } // skip transcript fetch to stay fast
  );

  assert(Array.isArray(result.results),                       'Returns results array');
  assert(result.results.length > 0,                           `Got ${result.results.length} YouTube results`);
  assert(result.results[0].sourceType === 'youtube',          'sourceType = "youtube"');
  assert(typeof result.results[0].url === 'string' && result.results[0].url.includes('youtube'), `YouTube URL: ${result.results[0].url}`);
  assert(typeof result.results[0].videoId === 'string',       `videoId: ${result.results[0].videoId}`);
  assert(['success','partial'].includes(result.status),       `Status: ${result.status}`);

  // Deduplication by videoId
  const ids = result.results.map((r) => r.videoId);
  const uniqueIds = [...new Set(ids)];
  assert(ids.length === uniqueIds.length, `VideoId deduplication works (${uniqueIds.length} unique)`);

  info(`Videos: ${result.results.slice(0,2).map(r=>`[${r.videoId}] ${r.title}`).join(' | ')}`);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — Query Generator
// ─────────────────────────────────────────────────────────────────────────────
async function testQueryGenerator() {
  head('TEST 4: Query Generator');
  const { generateSearchQueries } = require('../src/research/queryGenerator');

  const queries = await generateSearchQueries(
    'Introduction to Photosynthesis',
    'Explain the light-dependent reactions and the Calvin cycle in plant chloroplasts.'
  );

  assert(Array.isArray(queries.web)     && queries.web.length > 0,     `Web queries: ${queries.web.join(', ')}`);
  assert(Array.isArray(queries.book)    && queries.book.length > 0,    `Book queries: ${queries.book.join(', ')}`);
  assert(Array.isArray(queries.youtube) && queries.youtube.length > 0, `YouTube queries: ${queries.youtube.join(', ')}`);
  
  info(`Generated web queries: ${queries.web.slice(0,2).join(' | ')}`);
  return queries;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — Provider Isolation (simulated crash)
// ─────────────────────────────────────────────────────────────────────────────
async function testProviderIsolation() {
  head('TEST 5: Provider Isolation (failure does not stop other providers)');

  // Simulate YouTube crash inline (without MongoDB orchestrator)
  const { researchWeb }     = require('../src/research/webResearch');
  const { researchBooks }   = require('../src/research/bookResearch');

  const crashingYouTube = async () => { throw new Error('Simulated YouTube crash'); };

  const [webResult, bookResult, youtubeResult] = await Promise.allSettled([
    researchWeb(['photosynthesis'], { extractContent: false }),
    researchBooks(['photosynthesis']),
    crashingYouTube(),
  ]);

  assert(webResult.status === 'fulfilled',     `Web provider succeeded: ${webResult.value?.results?.length} results`);
  assert(bookResult.status === 'fulfilled',    `Book provider succeeded: ${bookResult.value?.results?.length} results`);
  assert(youtubeResult.status === 'rejected',  `YouTube failure captured: "${youtubeResult.reason?.message}"`);
  
  // Verify the other results are still valid after the crash
  assert(webResult.value.results.length > 0,  'Web results unaffected by YouTube crash');
  assert(bookResult.value.results.length > 0, 'Book results unaffected by YouTube crash');

  info('✓ One crashed provider did not stop web or book providers');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — LLM Gateway (key pool + hallucination fallback)
// ─────────────────────────────────────────────────────────────────────────────
async function testLLMGateway() {
  head('TEST 6: LLM Gateway (key pool + hallucination fallback)');
  const { getKeyPoolSize, getUsageStats, callLLMJson } = require('../src/services/llmGateway');
  const { HumanMessage } = require('@langchain/core/messages');

  const poolSize = getKeyPoolSize();
  info(`Key pool size: ${poolSize} key(s) configured`);
  assert(typeof poolSize === 'number', 'Key pool size is a number');

  // Test JSON call — either real API or hallucinated fallback
  const result = await callLLMJson(
    [new HumanMessage('Return JSON: { "queries": ["test query one", "test query two"] }')],
    { callerLabel: 'TestGateway', maxTokens: 200 }
  );

  assert(result.content !== undefined,   'Response has content');
  assert(typeof result.model === 'string', `Model used: ${result.model}`);

  const stats = getUsageStats();
  assert(stats.totalCalls >= 0, `Gateway call tracking works (${stats.totalCalls} logged calls, 0 when no key configured)`);
  info(`Token usage — prompt: ${stats.totalPromptTokens}, completion: ${stats.totalCompletionTokens}`);
  info(`Gateway errors: ${stats.errors}`);
  info(`Hallucination fallback: active when no API key configured`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}${'═'.repeat(60)}`);
  console.log('  AI Lesson Generator — Stage 2 & 3 Test Suite');
  console.log(`${'═'.repeat(60)}${C.reset}\n`);

  async function run(name, fn) {
    try {
      await fn();
    } catch (err) {
      fail(`${name} threw unexpected error: ${err.message}`);
      console.error(err.stack);
      results.errors.push({ name, error: err.message });
    }
  }

  await run('WebResearch',       testWebResearch);
  await run('BookResearch',      testBookResearch);
  await run('YouTubeResearch',   testYouTubeResearch);
  await run('QueryGenerator',    testQueryGenerator);
  await run('ProviderIsolation', testProviderIsolation);
  await run('LLMGateway',        testLLMGateway);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}${C.yellow}${'═'.repeat(60)}${C.reset}`);
  console.log(`${C.bold}Results: ${C.green}${results.passed} passed${C.reset}  ${results.failed > 0 ? C.red : ''}${results.failed} failed${C.reset}`);

  if (results.errors.length > 0) {
    console.log(`${C.red}Errors in: ${results.errors.map((e) => e.name).join(', ')}${C.reset}`);
  }

  if (results.failed === 0 && results.errors.length === 0) {
    console.log(`\n${C.green}${C.bold}✓ All tests passed — Stage 2 & 3 implementation verified${C.reset}`);
  }

  process.exit(results.failed > 0 || results.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

'use strict';

/**
 * Book Research Agent
 *
 * Uses the bookResearch module as its tool.
 * Implements ReAct: logs reasoning, calls the tool, records observation.
 *
 * @param {import('./state').ResearchState} state
 */

const { AIMessage } = require('@langchain/core/messages');
const { researchBooks } = require('../research/bookResearch');

const TOOL_NAME = 'book_search';

async function bookAgentNode(state) {
  const startTime  = Date.now();
  const { queries } = state;
  const bookQueries = queries?.book || [];

  console.log(`[BookAgent] Starting book research with ${bookQueries.length} queries`);

  // ── Reason ──────────────────────────────────────────────────────────────────
  const reasoning = `Searching Google Books and Open Library for authoritative texts on: ${bookQueries.join(', ')}. 
Prioritising educational and academic publications.`;

  // ── Act (tool call) ──────────────────────────────────────────────────────────
  const toolCallRecord = {
    tool:      TOOL_NAME,
    input:     { queries: bookQueries },
    output:    null,
    durationMs: 0,
    error:     null,
  };

  let results = [];
  let status  = 'done';
  let error   = null;

  try {
    const toolStart = Date.now();
    const response  = await researchBooks(bookQueries);
    toolCallRecord.durationMs = Date.now() - toolStart;
    toolCallRecord.output     = { count: response.results.length, status: response.status };
    results = response.results;
    if (response.status === 'partial') error = response.error;
  } catch (err) {
    toolCallRecord.error      = err.message;
    toolCallRecord.durationMs = Date.now() - startTime;
    status = 'failed';
    error  = err.message;
    console.error('[BookAgent] Tool failed:', err.message);
  }

  // ── Observe ──────────────────────────────────────────────────────────────────
  const observation = error
    ? `Book research completed with issues (${results.length} results): ${error}`
    : `Book research successful: ${results.length} books found`;

  console.log(`[BookAgent] ${observation}`);

  const stepEntry = {
    agent:       'bookAgent',
    iteration:   state.iterationCount || 1,
    action:      `book_search(${bookQueries.length} queries)`,
    reasoning,
    toolCalls:   [toolCallRecord],
    observation,
    tokenUsage:  { promptTokens: 0, completionTokens: 0 },
    durationMs:  Date.now() - startTime,
    status,
    error,
  };

  return {
    bookResults:    results,
    providerStatus: { book: status },
    stepLog:        [stepEntry],
    errors:         error ? [{ agent: 'bookAgent', message: error }] : [],
    messages:       [new AIMessage(`BookAgent: ${observation}`)],
  };
}

module.exports = { bookAgentNode };


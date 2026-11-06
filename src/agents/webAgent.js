'use strict';

/**
 * Web Research Agent
 *
 * Uses the webResearch module as its tool.
 * Implements ReAct: logs reasoning, calls the tool, records observation.
 *
 * @param {import('./state').ResearchState} state
 */

const { AIMessage } = require('@langchain/core/messages');
const { researchWeb } = require('../research/webResearch');

const TOOL_NAME = 'web_search';

async function webAgentNode(state) {
  const startTime = Date.now();
  const { queries, sessionId } = state;
  const webQueries = queries?.web || [];

  console.log(`[WebAgent] Starting web research with ${webQueries.length} queries`);

  // ── Reason ──────────────────────────────────────────────────────────────────
  const reasoning = `Searching the web for educational content on: ${webQueries.join(', ')}. 
Extracting page content where possible. Using Brave Search API or DuckDuckGo fallback.`;

  // ── Act (tool call) ──────────────────────────────────────────────────────────
  const toolCallRecord = {
    tool:  TOOL_NAME,
    input: { queries: webQueries, extractContent: true },
    output: null,
    durationMs: 0,
    error: null,
  };

  let results = [];
  let status  = 'done';
  let error   = null;

  try {
    const toolStart = Date.now();
    const response  = await researchWeb(webQueries, { extractContent: true });
    toolCallRecord.durationMs = Date.now() - toolStart;
    toolCallRecord.output     = { count: response.results.length, status: response.status };
    results = response.results;
    if (response.status === 'partial') error = response.error;
  } catch (err) {
    toolCallRecord.error = err.message;
    toolCallRecord.durationMs = Date.now() - startTime;
    status = 'failed';
    error  = err.message;
    console.error('[WebAgent] Tool failed:', err.message);
  }

  // ── Observe ──────────────────────────────────────────────────────────────────
  const observation = error
    ? `Web research completed with issues (${results.length} results): ${error}`
    : `Web research successful: ${results.length} unique sources retrieved`;

  console.log(`[WebAgent] ${observation}`);

  const stepEntry = {
    agent:       'webAgent',
    iteration:   state.iterationCount || 1,
    action:      `web_search(${webQueries.length} queries)`,
    reasoning,
    toolCalls:   [toolCallRecord],
    observation,
    tokenUsage:  { promptTokens: 0, completionTokens: 0 },
    durationMs:  Date.now() - startTime,
    status,
    error,
  };

  return {
    webResults:     results,
    providerStatus: { web: status },
    stepLog:        [stepEntry],
    errors:         error ? [{ agent: 'webAgent', message: error }] : [],
    messages:       [new AIMessage(`WebAgent: ${observation}`)],
  };
}

module.exports = { webAgentNode };


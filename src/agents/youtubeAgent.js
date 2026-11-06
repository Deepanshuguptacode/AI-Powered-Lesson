'use strict';

/**
 * YouTube Research Agent
 *
 * Uses the youtubeResearch module as its tool.
 * Implements ReAct: logs reasoning, calls the tool, records observation.
 *
 * @param {import('./state').ResearchState} state
 */

const { AIMessage } = require('@langchain/core/messages');
const { researchYouTube } = require('../research/youtubeResearch');

const TOOL_NAME = 'youtube_search';

async function youtubeAgentNode(state) {
  const startTime    = Date.now();
  const { queries }  = state;
  const ytQueries    = queries?.youtube || [];

  console.log(`[YouTubeAgent] Starting YouTube research with ${ytQueries.length} queries`);

  // ── Reason ──────────────────────────────────────────────────────────────────
  const reasoning = `Searching YouTube for educational videos on: ${ytQueries.join(', ')}. 
Will attempt to extract transcripts where available for deeper content analysis.`;

  // ── Act (tool call) ──────────────────────────────────────────────────────────
  const toolCallRecord = {
    tool:      TOOL_NAME,
    input:     { queries: ytQueries, fetchTranscripts: true },
    output:    null,
    durationMs: 0,
    error:     null,
  };

  let results = [];
  let status  = 'done';
  let error   = null;

  try {
    const toolStart = Date.now();
    const response  = await researchYouTube(ytQueries, { fetchTranscripts: true });
    toolCallRecord.durationMs = Date.now() - toolStart;
    toolCallRecord.output     = {
      count:            response.results.length,
      withTranscripts:  response.results.filter((r) => r.transcript?.length > 0).length,
      status:           response.status,
    };
    results = response.results;
    if (response.status === 'partial') error = response.error;
  } catch (err) {
    toolCallRecord.error      = err.message;
    toolCallRecord.durationMs = Date.now() - startTime;
    status = 'failed';
    error  = err.message;
    console.error('[YouTubeAgent] Tool failed:', err.message);
  }

  // ── Observe ──────────────────────────────────────────────────────────────────
  const withTranscripts = results.filter((r) => r.transcript?.length > 0).length;
  const observation     = error
    ? `YouTube research completed with issues (${results.length} videos): ${error}`
    : `YouTube research successful: ${results.length} videos, ${withTranscripts} with transcripts`;

  console.log(`[YouTubeAgent] ${observation}`);

  const stepEntry = {
    agent:       'youtubeAgent',
    iteration:   state.iterationCount || 1,
    action:      `youtube_search(${ytQueries.length} queries)`,
    reasoning,
    toolCalls:   [toolCallRecord],
    observation,
    tokenUsage:  { promptTokens: 0, completionTokens: 0 },
    durationMs:  Date.now() - startTime,
    status,
    error,
  };

  return {
    youtubeResults: results,
    providerStatus: { youtube: status },
    stepLog:        [stepEntry],
    errors:         error ? [{ agent: 'youtubeAgent', message: error }] : [],
    messages:       [new AIMessage(`YouTubeAgent: ${observation}`)],
  };
}

module.exports = { youtubeAgentNode };


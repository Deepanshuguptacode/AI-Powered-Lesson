'use strict';

/**
 * Research Supervisor Agent
 *
 * Responsibilities:
 *  1. Analyze the lesson title and learning objective.
 *  2. Generate targeted search queries for each research provider.
 *  3. Decide when research is complete (after all three providers have run).
 *  4. Combine and summarise final results.
 *
 * Uses ReAct pattern: Reason → Act → Observe → (repeat if needed)
 * Max iterations: 3  (configurable via SUPERVISOR_MAX_ITERATIONS env var)
 */

const { HumanMessage, SystemMessage, AIMessage } = require('@langchain/core/messages');
const { callLLMJson } = require('../services/llmGateway');

const MAX_ITERATIONS = parseInt(process.env.SUPERVISOR_MAX_ITERATIONS || '3', 10);

// ── System prompt ─────────────────────────────────────────────────────────────

const SUPERVISOR_SYSTEM = `You are the Research Supervisor for an AI Lesson Generator.
Your job is to:
1. Analyze the lesson title and learning objective.
2. Generate specific, high-quality search queries for three research agents: Web, Book, and YouTube.
3. After all agents have reported back, decide if the research is complete.

Always return valid JSON only — no prose, no markdown code fences.`;

// ── Node: Supervisor Plan ─────────────────────────────────────────────────────

/**
 * Supervisor planning node — generates queries and task breakdown.
 * This runs ONCE at the start of the graph.
 *
 * @param {import('./state').ResearchState} state
 */
async function supervisorPlanNode(state) {
  const startTime = Date.now();

  const { lessonTitle, learningObjective, iterationCount } = state;
  const newIteration = iterationCount + 1;

  console.log(`[Supervisor] Planning iteration ${newIteration} for: "${lessonTitle}"`);

  const human = new HumanMessage(
    `Lesson Title: ${lessonTitle}
Learning Objective: ${learningObjective}

Generate 3 search queries for each provider. Return exactly this JSON:
{
  "reasoning": "Brief explanation of your research approach",
  "queries": {
    "web":     ["query1", "query2", "query3"],
    "book":    ["query1", "query2", "query3"],
    "youtube": ["query1", "query2", "query3"]
  },
  "taskDelegation": {
    "web":     "What to focus on for web research",
    "book":    "What to focus on for book research",
    "youtube": "What to focus on for YouTube research"
  }
}`
  );

  const result = await callLLMJson(
    [new SystemMessage(SUPERVISOR_SYSTEM), human],
    { callerLabel: 'Supervisor', maxTokens: 800 }
  );

  const data = result.data || {};
  const queries = data.queries || {
    web:     [`${lessonTitle} tutorial`, `${lessonTitle} explained`, `${lessonTitle} learning`],
    book:    [`${lessonTitle} textbook`, `${lessonTitle} education`],
    youtube: [`${lessonTitle} lecture`, `${lessonTitle} tutorial`],
  };

  const stepEntry = {
    agent:       'supervisor',
    iteration:   newIteration,
    action:      'planning',
    reasoning:   data.reasoning || 'Generating search queries for all providers',
    toolCalls:   [],
    observation: `Generated queries: web(${queries.web?.length || 0}), book(${queries.book?.length || 0}), youtube(${queries.youtube?.length || 0})`,
    tokenUsage:  { promptTokens: result.usage?.promptTokens || 0, completionTokens: result.usage?.completionTokens || 0 },
    durationMs:  Date.now() - startTime,
    status:      'done',
  };

  return {
    queries,
    iterationCount: newIteration,
    stepLog:    [stepEntry],
    tokenUsage: stepEntry.tokenUsage,
    messages:   [new AIMessage(`Supervisor planned research. Queries generated for web, book, and YouTube.`)],
  };
}

// ── Node: Supervisor Review ───────────────────────────────────────────────────

/**
 * Supervisor review node — checks if all agents have finished and decides
 * whether to finalise or allow another iteration.
 *
 * @param {import('./state').ResearchState} state
 */
async function supervisorReviewNode(state) {
  const startTime = Date.now();

  const { providerStatus, iterationCount, webResults, bookResults, youtubeResults } = state;

  const allDone = ['web', 'book', 'youtube'].every(
    (p) => providerStatus[p] === 'done' || providerStatus[p] === 'failed'
  );

  const totalResults = (webResults?.length || 0) + (bookResults?.length || 0) + (youtubeResults?.length || 0);

  const isComplete = allDone || iterationCount >= MAX_ITERATIONS;

  console.log(`[Supervisor] Review — allDone:${allDone}, totalResults:${totalResults}, complete:${isComplete}`);

  const stepEntry = {
    agent:       'supervisor',
    iteration:   iterationCount,
    action:      'review',
    reasoning:   `All providers done: ${allDone}. Total results: ${totalResults}. Max iterations: ${MAX_ITERATIONS}.`,
    toolCalls:   [],
    observation: isComplete ? 'Research complete — compiling final result' : 'Some providers still running',
    tokenUsage:  { promptTokens: 0, completionTokens: 0 },
    durationMs:  Date.now() - startTime,
    status:      'done',
  };

  return {
    isComplete,
    stepLog:    [stepEntry],
    messages:   [new AIMessage(`Supervisor review: ${isComplete ? 'Research complete.' : 'Waiting for providers.'}`)],
  };
}

// ── Node: Supervisor Finalise ─────────────────────────────────────────────────

/**
 * Builds the final combined result object.
 *
 * @param {import('./state').ResearchState} state
 */
async function supervisorFinaliseNode(state) {
  const startTime = Date.now();

  const {
    lessonTitle, learningObjective, sessionId,
    webResults, bookResults, youtubeResults,
    providerStatus, errors, iterationCount, tokenUsage,
  } = state;

  const finalResult = {
    lessonTitle,
    learningObjective,
    sessionId,
    providerStatus,
    totalSources: (webResults?.length || 0) + (bookResults?.length || 0) + (youtubeResults?.length || 0),
    webSources:     (webResults     || []).length,
    bookSources:    (bookResults    || []).length,
    youtubeSources: (youtubeResults || []).length,
    errors,
    iterationsUsed: iterationCount,
    tokenUsage,
  };

  const stepEntry = {
    agent:       'supervisor',
    iteration:   iterationCount,
    action:      'finalise',
    reasoning:   'Compiling all research results into final output',
    toolCalls:   [],
    observation: `Final result: ${finalResult.totalSources} sources across all providers`,
    tokenUsage:  { promptTokens: 0, completionTokens: 0 },
    durationMs:  Date.now() - startTime,
    status:      'done',
  };

  return {
    finalResult,
    isComplete: true,
    stepLog:    [stepEntry],
    messages:   [new AIMessage(`Research finalised. Total sources: ${finalResult.totalSources}`)],
  };
}

module.exports = { supervisorPlanNode, supervisorReviewNode, supervisorFinaliseNode };


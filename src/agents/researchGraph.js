'use strict';

/**
 * Research Graph — LangGraph.js Workflow
 *
 * Graph topology:
 *
 *   START
 *     │
 *     ▼
 *  supervisorPlan   ← generates queries, sets up task delegation
 *     │
 *     ├──────────────────────────┐──────────────────────────┐
 *     ▼                          ▼                          ▼
 *  webAgent              bookAgent                  youtubeAgent
 *     │                          │                          │
 *     └──────────────────────────┴──────────────────────────┘
 *                                │
 *                                ▼
 *                        supervisorReview
 *                                │
 *                       isComplete? ──No──► (loop back — max 3 iterations)
 *                                │
 *                               Yes
 *                                │
 *                                ▼
 *                        supervisorFinalise
 *                                │
 *                                ▼
 *                              END
 *
 * All three research agents run in parallel (fan-out from supervisorPlan,
 * fan-in at supervisorReview).  Agent failures are recorded in state but
 * do not crash the graph.
 */

const { StateGraph, START, END } = require('@langchain/langgraph');
const { ResearchState } = require('./state');

const { supervisorPlanNode, supervisorReviewNode, supervisorFinaliseNode } = require('./supervisorAgent');
const { webAgentNode }     = require('./webAgent');
const { bookAgentNode }    = require('./bookAgent');
const { youtubeAgentNode } = require('./youtubeAgent');

const {
  createSession,
  updateSession,
  saveSources,
  createExecution,
  updateExecution
} = require('../services/safeDb');

// ── Graph definition ──────────────────────────────────────────────────────────

function buildResearchGraph() {
  const graph = new StateGraph(ResearchState);

  // Register nodes
  graph.addNode('supervisorPlan',     supervisorPlanNode);
  graph.addNode('webAgent',           webAgentNode);
  graph.addNode('bookAgent',          bookAgentNode);
  graph.addNode('youtubeAgent',       youtubeAgentNode);
  graph.addNode('supervisorReview',   supervisorReviewNode);
  graph.addNode('supervisorFinalise', supervisorFinaliseNode);

  // Edges: START → plan
  graph.addEdge(START, 'supervisorPlan');

  // Fan-out: plan → all three agents (parallel)
  graph.addEdge('supervisorPlan', 'webAgent');
  graph.addEdge('supervisorPlan', 'bookAgent');
  graph.addEdge('supervisorPlan', 'youtubeAgent');

  // Fan-in: all three → review
  graph.addEdge('webAgent',     'supervisorReview');
  graph.addEdge('bookAgent',    'supervisorReview');
  graph.addEdge('youtubeAgent', 'supervisorReview');

  // Conditional: review → finalise OR END
  graph.addConditionalEdges(
    'supervisorReview',
    (state) => (state.isComplete ? 'finalise' : 'finalise'), // always finalise after first pass
    {
      finalise: 'supervisorFinalise',
    }
  );

  graph.addEdge('supervisorFinalise', END);

  return graph.compile();
}

// ── Execution helper ──────────────────────────────────────────────────────────

/**
 * Run the full multi-agent research graph.
 *
 * @param {object} params
 * @param {string} params.lessonTitle
 * @param {string} params.learningObjective
 * @param {string} [params.lessonId]
 * @returns {Promise<{ executionId: string, sessionId: string, finalResult: object, stepLog: object[] }>}
 */
async function runResearchGraph({ lessonTitle, learningObjective, lessonId }) {
  const graphStartTime = Date.now();

  // ── Create AgentExecution record ───────────────────────────────────────────
  const execution = await createExecution({
    lessonId:          lessonId || null,
    lessonTitle,
    learningObjective,
    status:            'running',
  });

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[ResearchGraph] Starting execution: ${execution._id}`);
  console.log(`[ResearchGraph] Lesson: "${lessonTitle}"`);
  console.log(`${'═'.repeat(60)}`);

  let finalState;
  try {
    // ── Create ResearchSession early ─────────────────────────────────────────
    const session = await createSession({
      lessonId:          lessonId || null,
      lessonTitle,
      learningObjective,
      status:            'running',
      agentRunId:        execution._id.toString(),
    });

    // ── Build and run the graph ───────────────────────────────────────────────
    const compiledGraph = buildResearchGraph();

    finalState = await compiledGraph.invoke({
      lessonTitle,
      learningObjective,
      lessonId:    lessonId || null,
      sessionId:   session._id.toString(),
      executionId: execution._id.toString(),
    });

    // ── Persist research sources ─────────────────────────────────────────────
    const allSources = [
      ...(finalState.webResults     || []).map((r) => ({ ...r, sessionId: session._id })),
      ...(finalState.bookResults    || []).map((r) => ({ ...r, sessionId: session._id })),
      ...(finalState.youtubeResults || []).map((r) => ({ ...r, sessionId: session._id })),
    ];

    if (allSources.length > 0) {
      await saveSources(allSources);
    }

    // Build evidence
    const evidence = allSources
      .map((s) => {
        const text =
          s.sourceType === 'web'     ? (s.extractedContent || s.snippet || '') :
          s.sourceType === 'book'    ? (s.description || '')                   :
          s.sourceType === 'youtube' ? (s.transcript    || s.snippet || '')    : '';
        if (!text || text.trim().length < 20) return null;
        return {
          text:        text.slice(0, 2000),
          sourceType:  s.sourceType,
          sourceUrl:   s.url || '',
          sourceTitle: s.title || '',
          relevance:   0.5,
        };
      })
      .filter(Boolean);

    // Update ResearchSession
    const providerResults = ['web', 'book', 'youtube'].map((p) => ({
      provider:  p,
      status:    finalState.providerStatus?.[p] === 'failed' ? 'failed' : 'success',
      itemCount: p === 'web'     ? (finalState.webResults?.length     || 0)
                 : p === 'book'  ? (finalState.bookResults?.length    || 0)
                                 : (finalState.youtubeResults?.length || 0),
    }));

    const sessionStatus = providerResults.every((p) => p.status === 'failed')
      ? 'failed'
      : providerResults.some((p) => p.status === 'failed') ? 'partial' : 'completed';

    await updateSession(session._id, {
      status:         sessionStatus,
      providerResults,
      evidence,
      totalSources:   allSources.length,
      durationMs:     Date.now() - graphStartTime,
      agentRunId:     execution._id.toString(),
    });

    // ── Update AgentExecution ─────────────────────────────────────────────────
    const stepLog    = finalState.stepLog || [];
    const tokenUsage = finalState.tokenUsage || {};
    const totalTokens =
      (tokenUsage.promptTokens || 0) + (tokenUsage.completionTokens || 0);

    await updateExecution(execution._id, {
      status:            sessionStatus === 'failed' ? 'failed' : sessionStatus === 'partial' ? 'partial' : 'completed',
      steps:             stepLog,
      researchSessionId: session._id,
      totalTokenUsage:   {
        promptTokens:     tokenUsage.promptTokens     || 0,
        completionTokens: tokenUsage.completionTokens || 0,
        totalTokens,
      },
      iterationCount: finalState.iterationCount || 1,
      durationMs:     Date.now() - graphStartTime,
      finalResult:    finalState.finalResult,
    });

    console.log(`[ResearchGraph] Complete — ${allSources.length} sources, ${evidence.length} evidence items`);
    console.log(`${'═'.repeat(60)}\n`);

    return {
      executionId:  execution._id.toString(),
      sessionId:    session._id.toString(),
      finalResult:  finalState.finalResult,
      stepLog,
      providerStatus: finalState.providerStatus,
      tokenUsage,
      totalSources: allSources.length,
      durationMs:   Date.now() - graphStartTime,
    };
  } catch (err) {
    console.error('[ResearchGraph] Fatal error:', err);

    await updateExecution(execution._id, {
      status:    'failed',
      error:     err.message,
      durationMs: Date.now() - graphStartTime,
    }).catch(() => {});

    throw err;
  }
}

module.exports = { buildResearchGraph, runResearchGraph };

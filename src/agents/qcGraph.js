'use strict';

/**
 * QC Graph — LangGraph.js Workflows
 *
 * Two independent QC graphs run in parallel via Promise.all():
 *
 *   Factual QC Graph:
 *     START → factualLoadData → factualCheck → factualSaveReport → END
 *
 *   Instructional QC Graph:
 *     START → instructionalLoadData → instructionalCheck → instructionalSaveReport → END
 *
 * Both graphs are compiled independently and invoked concurrently.
 * Individual failures are captured and do not affect the other agent.
 */

const { StateGraph, START, END } = require('@langchain/langgraph');
const { QcState } = require('./qcState');

const {
  factualLoadDataNode,
  factualCheckNode,
  factualSaveReportNode,
} = require('./factualQcAgent');

const {
  instructionalLoadDataNode,
  instructionalCheckNode,
  instructionalSaveReportNode,
} = require('./instructionalQcAgent');

// ── Build Factual QC Graph ────────────────────────────────────────────────────

function buildFactualQcGraph() {
  const graph = new StateGraph(QcState);

  graph.addNode('factualLoadData',    factualLoadDataNode);
  graph.addNode('factualCheck',       factualCheckNode);
  graph.addNode('factualSaveReport',  factualSaveReportNode);

  graph.addEdge(START,                'factualLoadData');
  graph.addEdge('factualLoadData',    'factualCheck');
  graph.addEdge('factualCheck',       'factualSaveReport');
  graph.addEdge('factualSaveReport',  END);

  return graph.compile();
}

// ── Build Instructional QC Graph ──────────────────────────────────────────────

function buildInstructionalQcGraph() {
  const graph = new StateGraph(QcState);

  graph.addNode('instructionalLoadData',    instructionalLoadDataNode);
  graph.addNode('instructionalCheck',       instructionalCheckNode);
  graph.addNode('instructionalSaveReport',  instructionalSaveReportNode);

  graph.addEdge(START,                      'instructionalLoadData');
  graph.addEdge('instructionalLoadData',    'instructionalCheck');
  graph.addEdge('instructionalCheck',       'instructionalSaveReport');
  graph.addEdge('instructionalSaveReport',  END);

  return graph.compile();
}

// ── Parallel QC Execution ─────────────────────────────────────────────────────

/**
 * Run both QC agents independently and in parallel.
 *
 * @param {object} params
 * @param {string} params.generatedLessonId — MongoDB GeneratedLesson._id
 * @param {string} [params.lessonId]        — MongoDB Lesson._id (optional)
 * @returns {Promise<{ factual: object, instructional: object, durationMs: number }>}
 */
async function runQcGraphs({ generatedLessonId, lessonId }) {
  const startTime = Date.now();

  if (!generatedLessonId) {
    throw new Error('generatedLessonId is required to run QC agents');
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[QcGraph] Starting parallel QC for lesson: ${generatedLessonId}`);
  console.log(`${'═'.repeat(60)}`);

  const sharedInput = {
    generatedLessonId,
    lessonId: lessonId || null,
  };

  // Run both QC graphs in parallel — failures are isolated
  const [factualResult, instructionalResult] = await Promise.allSettled([
    runFactualQc(sharedInput),
    runInstructionalQc(sharedInput),
  ]);

  const factualReport = factualResult.status === 'fulfilled'
    ? factualResult.value
    : { error: factualResult.reason?.message, status: 'error', agentType: 'factual' };

  const instructionalReport = instructionalResult.status === 'fulfilled'
    ? instructionalResult.value
    : { error: instructionalResult.reason?.message, status: 'error', agentType: 'instructional' };

  const durationMs = Date.now() - startTime;

  console.log(`[QcGraph] Factual QC: ${factualReport.status} (report: ${factualReport.savedReportId || 'none'})`);
  console.log(`[QcGraph] Instructional QC: ${instructionalReport.status} (report: ${instructionalReport.savedReportId || 'none'})`);
  console.log(`[QcGraph] Both agents completed in ${durationMs}ms`);
  console.log(`${'═'.repeat(60)}\n`);

  return {
    factual:       factualReport,
    instructional: instructionalReport,
    durationMs,
  };
}

// ── Individual QC runners ─────────────────────────────────────────────────────

async function runFactualQc(input) {
  const graph = buildFactualQcGraph();
  const finalState = await graph.invoke({ ...input, agentType: 'factual' });
  return {
    agentType:     'factual',
    savedReportId: finalState.savedReportId,
    status:        finalState.status,
    scores:        finalState.scores,
    issues:        finalState.issues,
    summary:       finalState.summary,
    recommendation:finalState.recommendation,
    stepLog:       finalState.stepLog,
    tokenUsage:    finalState.tokenUsage,
  };
}

async function runInstructionalQc(input) {
  const graph = buildInstructionalQcGraph();
  const finalState = await graph.invoke({ ...input, agentType: 'instructional' });
  return {
    agentType:     'instructional',
    savedReportId: finalState.savedReportId,
    status:        finalState.status,
    scores:        finalState.scores,
    issues:        finalState.issues,
    summary:       finalState.summary,
    recommendation:finalState.recommendation,
    stepLog:       finalState.stepLog,
    tokenUsage:    finalState.tokenUsage,
  };
}

module.exports = {
  buildFactualQcGraph,
  buildInstructionalQcGraph,
  runQcGraphs,
};


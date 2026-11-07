'use strict';

/**
 * Lesson QC Loop Graph — Unified LangGraph.js Workflow
 *
 * This graph drives both lesson generation AND the outer production QC feedback
 * loop using native LangGraph conditional edges (addConditionalEdges).
 * No external while-loops exist — the loop is entirely inside the graph topology.
 *
 * Graph topology:
 *
 *   START
 *     │
 *     ▼
 *   loadResearch         ← Load evidence from MongoDB ResearchSession
 *     │
 *     ▼
 *   generateLesson  ◄────────────────────────────────────────────┐
 *     │                                                           │  (loop back with feedback)
 *     ▼                                                           │
 *   validateLesson                                                │
 *     │                                                           │
 *     ▼                                                           │
 *   saveDraftLesson      ← Persist intermediate lesson version    │
 *     │                                                           │
 *     ▼                                                           │
 *   runParallelQc        ← Run production Factual + Instructional QC graphs
 *     │                                                           │
 *     ▼                                                           │
 *   [qcLoopRouter] ─── QC failed & passes < max ────────────────►┘
 *     │
 *     └── QC passed OR passes exhausted ──→ finalizeLessonNode → END
 *
 * State fields used (defined in lessonState.js):
 *   - qcLoopPass      : current outer QC loop pass counter
 *   - maxQcLoops      : maximum outer QC loop passes (from env MAX_QC_LOOPS)
 *   - qcLoopPassed    : whether production QC passed the threshold
 *   - qcReports       : { factual, instructional } from last runQcGraphs call
 *   - qcLoopHistory   : array of loop pass summaries for telemetry
 *   - onQcLoopProgress: optional callback fn injected by orchestratorService for SSE
 *   - qcFeedback      : suggestions fed back into generateLesson on retry
 */

const { StateGraph, START, END } = require('@langchain/langgraph');
const { LessonGeneratorState } = require('./lessonState');
const { runQcGraphs } = require('./qcGraph');

const {
  loadResearchNode,
  generateLessonNode,
  validateLessonNode,
  saveLessonNode,
} = require('./lessonGeneratorAgent');

// ── QC score threshold ────────────────────────────────────────────────────────

const QC_THRESHOLD = parseInt(process.env.QC_THRESHOLD || process.env.LESSON_QC_THRESHOLD || '80', 10);
const MAX_QC_LOOPS = parseInt(process.env.MAX_QC_LOOPS || '3', 10);

// ── Node: saveDraftLesson ─────────────────────────────────────────────────────

/**
 * Persist the current lesson version to MongoDB (intermediate draft).
 * On subsequent loop passes this creates new lesson versions, preserving history.
 * Delegates entirely to the existing saveLessonNode from lessonGeneratorAgent.
 *
 * @param {import('./lessonState').LessonGeneratorState} state
 */
async function saveDraftLessonNode(state) {
  const { savedLessonId, qcLoopPass, maxQcLoops, validatedLesson, isValid, validationErrors } = state;
  const loopPass = (qcLoopPass || 0) + 1;
  console.log(`[LessonQcLoopGraph] saveDraftLesson — QC loop pass ${loopPass}/${maxQcLoops}`);

  if (savedLessonId && loopPass > 1 && validatedLesson) {
    const { saveGeneratedLessonVersion } = require('../services/safeDb');
    try {
      const versionDoc = await saveGeneratedLessonVersion(savedLessonId, {
        title: validatedLesson.title,
        learningObjective: validatedLesson.learningObjective,
        totalDurationMinutes: validatedLesson.totalDurationMinutes || 45,
        sections: validatedLesson.sections || {},
        youtubeVideos: validatedLesson.youtubeVideos || [],
        references: validatedLesson.references || [],
        isValid: isValid !== undefined ? isValid : true,
        validationErrors: validationErrors || [],
      }, {
        editedBy: 'qc_feedback_loop',
        editSummary: `QC Feedback Loop pass ${loopPass} (addressed previous QC suggestions)`,
      });

      const newId = versionDoc._id ? versionDoc._id.toString() : (versionDoc.id || savedLessonId);
      console.log(`[LessonQcLoopGraph] Saved improved lesson version ${versionDoc.versionTag || `v${loopPass}.0`} (ID: ${newId})`);

      return {
        savedLessonId: newId,
        validatedLesson: {
          ...validatedLesson,
          version: versionDoc.version || loopPass,
          versionTag: versionDoc.versionTag || `v${loopPass}.0 (QC Improved)`,
        },
        stepLog: [{
          agent: 'lessonGenerator', action: 'saveLessonVersion',
          reasoning: `Saved improved lesson version ${versionDoc.versionTag || `v${loopPass}.0`}`,
          observation: `New version ID: ${newId}`,
          durationMs: 0,
          status: 'done',
        }],
      };
    } catch (verErr) {
      console.warn(`[LessonQcLoopGraph] Version save warning: ${verErr.message}, falling back to saveLessonNode`);
    }
  }

  return saveLessonNode(state);
}

// ── Node: runParallelQcNode ───────────────────────────────────────────────────

/**
 * Run the production parallel QC pipeline (Factual + Instructional QC graphs).
 * Extracts QC feedback suggestions into qcFeedback for the next generateLesson pass.
 * Emits SSE progress via onQcLoopProgress callback if provided.
 *
 * @param {import('./lessonState').LessonGeneratorState} state
 * @returns {Partial<import('./lessonState').LessonGeneratorState>}
 */
async function runParallelQcNode(state) {
  const { savedLessonId, qcLoopPass, maxQcLoops, onQcLoopProgress } = state;
  const loopPass = (qcLoopPass || 0) + 1;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[LessonQcLoopGraph] Running parallel QC — pass ${loopPass}/${maxQcLoops}`);
  console.log(`[LessonQcLoopGraph] Lesson version ID: ${savedLessonId}`);
  console.log(`[LessonQcLoopGraph] QC threshold: ${QC_THRESHOLD}%`);

  if (typeof onQcLoopProgress === 'function') {
    onQcLoopProgress({
      type:      'qc_running',
      loopPass,
      maxLoops:  maxQcLoops,
      activeNode: 'node_qc_parallel',
      message:   `[QC Loop ${loopPass}/${maxQcLoops}] Running Factual & Instructional QC agents in parallel (threshold ≥ ${QC_THRESHOLD}%)...`,
    });
  }

  if (!savedLessonId) {
    console.error('[LessonQcLoopGraph] No savedLessonId — cannot run QC');
    return {
      qcLoopPass:   loopPass,
      qcLoopPassed: false,
      qcReports:    { factual: null, instructional: null },
      qcFeedback:   [],
      stepLog: [{
        agent: 'lessonQcLoopGraph', action: 'runParallelQc',
        status: 'error', reasoning: 'No savedLessonId to run QC on',
        durationMs: 0,
      }],
    };
  }

  const startMs = Date.now();
  let qcResult;

  try {
    qcResult = await runQcGraphs({ generatedLessonId: savedLessonId });
  } catch (err) {
    console.error(`[LessonQcLoopGraph] runQcGraphs failed: ${err.message}`);
    // Treat QC failure as a non-pass but don't abort the entire graph
    return {
      qcLoopPass:   loopPass,
      qcLoopPassed: false,
      qcReports:    { factual: null, instructional: null },
      qcFeedback:   [`[QC System Error] QC agent failed: ${err.message}. Please manually review the lesson.`],
      stepLog: [{
        agent: 'lessonQcLoopGraph', action: 'runParallelQc',
        status: 'error', reasoning: err.message,
        durationMs: Date.now() - startMs,
      }],
    };
  }

  const factScore  = qcResult.factual?.scores?.overall ?? 0;
  const instScore  = qcResult.instructional?.scores?.overall ?? 0;
  const factPass   = qcResult.factual?.status === 'passed'  && factScore  >= QC_THRESHOLD;
  const instPass   = qcResult.instructional?.status === 'passed' && instScore >= QC_THRESHOLD;
  const loopPassed = factPass && instPass;

  console.log(`[LessonQcLoopGraph] QC results — Factual: ${factScore}% (${factPass ? 'PASS' : 'FAIL'}), Instructional: ${instScore}% (${instPass ? 'PASS' : 'FAIL'})`);
  console.log(`[LessonQcLoopGraph] Loop pass ${loopPass} ${loopPassed ? 'PASSED ✓' : `FAILED — will ${loopPass < maxQcLoops ? 'regenerate' : 'finalize with best'}`}`);

  // ── Extract feedback suggestions for next generateLesson pass ─────────────
  const qcFeedback = [];

  if (!factPass) {
    const f = qcResult.factual;
    if (f?.recommendation) qcFeedback.push(`[Factual QC Recommendation] ${f.recommendation}`);
    if (f?.summary)        qcFeedback.push(`[Factual QC Summary] ${f.summary}`);
    (f?.issues || []).forEach((issue) => {
      const fix = issue.suggestedImprovement || issue.fix || '';
      qcFeedback.push(`[Factual QC Issue in "${issue.affectedSection || issue.section || 'content'}"] ${issue.description || ''}${fix ? ` → Fix: ${fix}` : ''}`);
    });
  }

  if (!instPass) {
    const i = qcResult.instructional;
    if (i?.recommendation) qcFeedback.push(`[Instructional QC Recommendation] ${i.recommendation}`);
    if (i?.summary)        qcFeedback.push(`[Instructional QC Summary] ${i.summary}`);
    (i?.issues || []).forEach((issue) => {
      const fix = issue.suggestedImprovement || issue.fix || '';
      qcFeedback.push(`[Instructional QC Issue in "${issue.affectedSection || issue.section || 'content'}"] ${issue.description || ''}${fix ? ` → Fix: ${fix}` : ''}`);
    });
  }

  // ── Emit SSE progress event ───────────────────────────────────────────────
  if (typeof onQcLoopProgress === 'function') {
    if (loopPassed) {
      onQcLoopProgress({
        type:        'qc_passed',
        loopPass,
        maxLoops:    maxQcLoops,
        factScore,
        instScore,
        activeNode:  'node_qc_parallel',
        message:     `[QC Loop ${loopPass}/${maxQcLoops}] PASSED ✓ — Factual: ${factScore}%, Instructional: ${instScore}%. Both meet ${QC_THRESHOLD}% threshold!`,
      });
    } else if (loopPass < maxQcLoops) {
      onQcLoopProgress({
        type:            'qc_failed_loop',
        loopPass,
        maxLoops:        maxQcLoops,
        factScore,
        instScore,
        suggestionsCount: qcFeedback.length,
        activeNode:      'node_qc_parallel',
        message:         `[QC Loop ${loopPass}/${maxQcLoops}] Below threshold (${QC_THRESHOLD}%). Factual: ${factScore}%, Instructional: ${instScore}%. Regenerating with ${qcFeedback.length} QC suggestions...`,
      });
    } else {
      onQcLoopProgress({
        type:       'qc_exhausted',
        loopPass,
        maxLoops:   maxQcLoops,
        factScore,
        instScore,
        activeNode: 'node_qc_parallel',
        message:    `[QC Loop ${loopPass}/${maxQcLoops}] Max passes reached. Final — Factual: ${factScore}%, Instructional: ${instScore}%. Preserving best lesson for Instructor Review.`,
      });
    }
  }

  // ── Build loop history entry ──────────────────────────────────────────────
  const historyEntry = {
    loopPass,
    factScore,
    instScore,
    factPass,
    instPass,
    passed:          loopPassed,
    suggestionsCount: qcFeedback.length,
    factualReportId: qcResult.factual?.savedReportId || null,
    instructionalReportId: qcResult.instructional?.savedReportId || null,
    timestamp:       new Date().toISOString(),
  };

  return {
    qcLoopPass:   loopPass,
    qcLoopPassed: loopPassed,
    qcReports:    { factual: qcResult.factual, instructional: qcResult.instructional },
    qcFeedback:   loopPassed ? [] : qcFeedback,
    qcLoopHistory: [historyEntry],
    stepLog: [{
      agent:       'lessonQcLoopGraph',
      action:      'runParallelQc',
      reasoning:   `Pass ${loopPass}: Factual ${factScore}%, Instructional ${instScore}%`,
      observation: loopPassed ? 'QC passed threshold' : `QC below threshold — ${qcFeedback.length} suggestions collected`,
      status:      loopPassed ? 'passed' : 'failed',
      durationMs:  Date.now() - startMs,
    }],
  };
}

// ── Node: finalizeLessonNode ──────────────────────────────────────────────────

/**
 * Finalize the pipeline — emit SSE completion event and mark status done.
 * This node runs after QC passed (or max loops exhausted).
 *
 * @param {import('./lessonState').LessonGeneratorState} state
 */
async function finalizeLessonNode(state) {
  const { qcLoopPassed, qcLoopPass, maxQcLoops, qcReports, onQcLoopProgress } = state;

  const factScore = qcReports?.factual?.scores?.overall ?? 0;
  const instScore = qcReports?.instructional?.scores?.overall ?? 0;

  console.log(`[LessonQcLoopGraph] Finalizing — QC passed: ${qcLoopPassed}, loop pass: ${qcLoopPass}/${maxQcLoops}`);

  if (typeof onQcLoopProgress === 'function') {
    onQcLoopProgress({
      type:         'finalized',
      loopPass:     qcLoopPass,
      maxLoops:     maxQcLoops,
      factScore,
      instScore,
      qcPassed:     qcLoopPassed,
      activeNode:   'node_instructor_gate',
      message:      `Pipeline complete! Lesson finalized after ${qcLoopPass} QC pass(es). Factual: ${factScore}%, Instructional: ${instScore}%. Delivering to Instructor Dashboard.`,
    });
  }

  return {
    status: qcLoopPassed ? 'completed' : 'completed_with_warnings',
    stepLog: [{
      agent:      'lessonQcLoopGraph',
      action:     'finalize',
      reasoning:  `QC loop complete after ${qcLoopPass} pass(es)`,
      observation: qcLoopPassed ? `Passed at ${QC_THRESHOLD}%+ on both agents` : `Best available accepted after ${maxQcLoops} passes`,
      status:     'done',
      durationMs: 0,
    }],
  };
}

// ── Conditional edge: qcLoopRouter ────────────────────────────────────────────

/**
 * After runParallelQc, decide whether to loop back to generateLesson or finalize.
 *
 * Returns:
 *   'generateLesson'    — QC failed and we have remaining loop passes → regenerate
 *   'finalizeLessonNode'— QC passed OR loop passes exhausted → finalize
 *
 * @param {import('./lessonState').LessonGeneratorState} state
 * @returns {'generateLesson' | 'finalizeLessonNode'}
 */
function qcLoopRouter(state) {
  const { qcLoopPassed, qcLoopPass, maxQcLoops } = state;

  if (qcLoopPassed) {
    console.log(`[LessonQcLoopGraph] QC PASSED at loop pass ${qcLoopPass} — finalizing`);
    return 'finalizeLessonNode';
  }

  if (qcLoopPass >= maxQcLoops) {
    console.log(`[LessonQcLoopGraph] Max QC loops (${maxQcLoops}) reached — finalizing with best available lesson`);
    return 'finalizeLessonNode';
  }

  console.log(`[LessonQcLoopGraph] QC not passed (pass ${qcLoopPass}/${maxQcLoops}) — looping back to generateLesson with ${(state.qcFeedback || []).length} suggestions`);
  return 'generateLesson';
}

// ── Build graph ───────────────────────────────────────────────────────────────

/**
 * Build and compile the full Lesson + QC feedback loop LangGraph.
 *
 * The graph uses native LangGraph conditional edges to loop:
 *   generateLesson ← qcLoopRouter (when QC fails & passes remain)
 *
 * @returns {import('@langchain/langgraph').CompiledGraph}
 */
function buildFullLessonQcGraph() {
  const graph = new StateGraph(LessonGeneratorState);

  // Register nodes
  graph.addNode('loadResearch',        loadResearchNode);
  graph.addNode('generateLesson',      generateLessonNode);
  graph.addNode('validateLesson',      validateLessonNode);
  graph.addNode('saveDraftLesson',     saveDraftLessonNode);
  graph.addNode('runParallelQc',       runParallelQcNode);
  graph.addNode('finalizeLessonNode',  finalizeLessonNode);

  // Forward edges (sequential flow)
  graph.addEdge(START,               'loadResearch');
  graph.addEdge('loadResearch',      'generateLesson');
  graph.addEdge('generateLesson',    'validateLesson');
  graph.addEdge('validateLesson',    'saveDraftLesson');
  graph.addEdge('saveDraftLesson',   'runParallelQc');

  // Conditional edge — the LangGraph iterative QC loop
  graph.addConditionalEdges('runParallelQc', qcLoopRouter, {
    generateLesson:    'generateLesson',    // ← loops back (QC failed, passes remain)
    finalizeLessonNode: 'finalizeLessonNode', // → finalizes (QC passed or exhausted)
  });

  graph.addEdge('finalizeLessonNode', END);

  return graph.compile();
}

// ── Execution helper ──────────────────────────────────────────────────────────

/**
 * Run the full unified Lesson Generation + QC Feedback Loop graph.
 *
 * The QC feedback loop is implemented entirely as a native LangGraph iterative
 * workflow via addConditionalEdges. No external while-loops are used.
 *
 * @param {object}   params
 * @param {string}   params.lessonTitle
 * @param {string}   params.learningObjective
 * @param {string}   [params.lessonId]            — MongoDB Lesson._id
 * @param {string}   [params.researchSessionId]   — MongoDB ResearchSession._id
 * @param {number}   [params.maxReactIterations]  — max inner ReAct iterations (default: 3)
 * @param {number}   [params.qcThreshold]         — min QC overall score to pass (default: 80)
 * @param {number}   [params.maxQcLoops]          — max outer QC feedback loop passes (default: 3)
 * @param {Function} [params.onQcLoopProgress]    — SSE callback(eventObj) for orchestratorService
 * @returns {Promise<object>} Final state summary
 */
async function runFullLessonQcGraph({
  lessonTitle,
  learningObjective,
  lessonId,
  researchSessionId,
  maxReactIterations = parseInt(process.env.LESSON_MAX_REACT_ITERATIONS || '3', 10),
  qcThreshold        = parseInt(process.env.QC_THRESHOLD || process.env.LESSON_QC_THRESHOLD || '80', 10),
  maxQcLoops: maxQcLoopsParam = parseInt(process.env.MAX_QC_LOOPS || '3', 10),
  initialQcFeedback  = [],
  onQcLoopProgress   = null,
}) {
  const graphStartTime = Date.now();

  // Basic input guard
  if (!lessonTitle || !lessonTitle.trim()) {
    const err = new Error('lessonTitle is required and cannot be empty');
    err.code = 'INVALID_INPUT';
    throw err;
  }
  if (!learningObjective || !learningObjective.trim()) {
    const err = new Error('learningObjective is required and cannot be empty');
    err.code = 'INVALID_INPUT';
    throw err;
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[LessonQcLoopGraph] Starting full Lesson+QC iterative workflow`);
  console.log(`[LessonQcLoopGraph] Title: "${lessonTitle}"`);
  console.log(`[LessonQcLoopGraph] Session: ${researchSessionId || 'none'}`);
  console.log(`[LessonQcLoopGraph] QC threshold: ${qcThreshold}%, Max QC loops: ${maxQcLoopsParam}`);
  if (initialQcFeedback && initialQcFeedback.length > 0) {
    console.log(`[LessonQcLoopGraph] Seeded with ${initialQcFeedback.length} initial QC feedback items`);
  }
  console.log(`${'═'.repeat(60)}`);

  const compiledGraph = buildFullLessonQcGraph();

  const finalState = await compiledGraph.invoke({
    lessonTitle:        lessonTitle.trim(),
    learningObjective:  learningObjective.trim(),
    lessonId:           lessonId || null,
    researchSessionId:  researchSessionId || null,
    maxReactIterations,
    qcThreshold,
    maxQcLoops:         maxQcLoopsParam,
    qcLoopPass:         0,
    qcLoopPassed:       false,
    qcReports:          { factual: null, instructional: null },
    qcLoopHistory:      [],
    qcFeedback:         Array.isArray(initialQcFeedback) ? [...initialQcFeedback] : [],
    reactIteration:     0,
    qcPassed:           false,
    // Inject SSE callback into graph state
    onQcLoopProgress:   typeof onQcLoopProgress === 'function' ? onQcLoopProgress : null,
  });

  const totalDurationMs = Date.now() - graphStartTime;
  const loopHistory = finalState.qcLoopHistory || [];
  const lastPass = loopHistory.length > 0 ? loopHistory[loopHistory.length - 1] : null;

  console.log(`[LessonQcLoopGraph] Complete — lesson ID: ${finalState.savedLessonId}`);
  console.log(`[LessonQcLoopGraph] QC loop passes: ${finalState.qcLoopPass}/${maxQcLoopsParam}, QC passed: ${finalState.qcLoopPassed}`);
  console.log(`[LessonQcLoopGraph] Final scores — Factual: ${lastPass?.factScore ?? 'N/A'}%, Instructional: ${lastPass?.instScore ?? 'N/A'}%`);
  console.log(`${'═'.repeat(60)}\n`);

  return {
    savedLessonId:    finalState.savedLessonId,
    isValid:          finalState.isValid,
    validationErrors: finalState.validationErrors || [],
    lesson:           finalState.validatedLesson,
    stepLog:          finalState.stepLog || [],
    tokenUsage:       finalState.tokenUsage || {},
    status:           finalState.status,
    durationMs:       totalDurationMs,
    // QC loop specific output
    qcLoopPassed:     finalState.qcLoopPassed,
    qcLoopPass:       finalState.qcLoopPass,
    maxQcLoops:       maxQcLoopsParam,
    qcThreshold,
    qcReports:        finalState.qcReports,
    qcLoopHistory:    loopHistory,
    // Inner ReAct info (from last generateLesson run)
    qcPassed:         finalState.qcPassed,
    reactIterations:  finalState.reactIteration || 1,
    reactHistory:     finalState.reactHistory || [],
  };
}

module.exports = {
  buildFullLessonQcGraph,
  runFullLessonQcGraph,
};


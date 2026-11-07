'use strict';

/**
 * Lesson Generator Graph — LangGraph.js Workflow
 *
 * ReAct Loop Graph topology:
 *
 *   START
 *     │
 *     ▼
 *  loadResearch    ← load evidence from MongoDB ResearchSession
 *     │
 *     ▼
 *  generateLesson  ← LLM generates full 45-minute lesson
 *     │             (uses QC feedback on retry iterations)
 *     ▼
 *  validateLesson  ← validate structure + 45-min duration
 *     │
 *     ▼
 *  qcObserver      ← ReAct "Observe" step: inline QC evaluation
 *     │
 *     ├── qcPassed OR maxIterations reached ──→ saveLesson → END
 *     │
 *     └── qc failed, iteration < max ──────────→ generateLesson (loop)
 */

const { StateGraph, START, END } = require('@langchain/langgraph');
const { LessonGeneratorState } = require('./lessonState');

const {
  loadResearchNode,
  generateLessonNode,
  validateLessonNode,
  saveLessonNode,
  qcObserverNode,
} = require('./lessonGeneratorAgent');

// ── Input validation ──────────────────────────────────────────────────────────

/**
 * Validate inputs before the graph runs.
 * Throws a descriptive error for empty/missing title or learningObjective.
 */
function validateInputs({ lessonTitle, learningObjective }) {
  const errors = [];
  if (!lessonTitle || !lessonTitle.trim()) {
    errors.push('lessonTitle is required and cannot be empty');
  }
  if (!learningObjective || !learningObjective.trim()) {
    errors.push('learningObjective is required and cannot be empty');
  }
  if (lessonTitle && lessonTitle.trim().length < 3) {
    errors.push('lessonTitle must be at least 3 characters');
  }
  if (learningObjective && learningObjective.trim().length < 10) {
    errors.push('learningObjective must be at least 10 characters');
  }
  if (errors.length > 0) {
    const err = new Error(`Input validation failed: ${errors.join('; ')}`);
    err.code = 'INVALID_INPUT';
    err.validationErrors = errors;
    throw err;
  }
}

// ── Conditional edge: should we loop or finalize? ─────────────────────────────

/**
 * After qcObserver, decide whether to loop back to generateLesson or proceed to saveLesson.
 *
 * @param {import('./lessonState').LessonGeneratorState} state
 * @returns {'generateLesson' | 'saveLesson'}
 */
function reactLoopRouter(state) {
  const { qcPassed, reactIteration, maxReactIterations } = state;

  if (qcPassed) {
    console.log(`[LessonGraph] QC passed at iteration ${reactIteration} — proceeding to save`);
    return 'saveLesson';
  }

  if (reactIteration >= maxReactIterations) {
    console.log(`[LessonGraph] Max ReAct iterations (${maxReactIterations}) reached — saving best available lesson`);
    return 'saveLesson';
  }

  console.log(`[LessonGraph] QC not passed (iteration ${reactIteration}/${maxReactIterations}) — regenerating with feedback`);
  return 'generateLesson';
}

// ── Build graph ───────────────────────────────────────────────────────────────

function buildLessonGraph() {
  const graph = new StateGraph(LessonGeneratorState);

  graph.addNode('loadResearch',   loadResearchNode);
  graph.addNode('generateLesson', generateLessonNode);
  graph.addNode('validateLesson', validateLessonNode);
  graph.addNode('qcObserver',     qcObserverNode);
  graph.addNode('saveLesson',     saveLessonNode);

  // Forward flow
  graph.addEdge(START,            'loadResearch');
  graph.addEdge('loadResearch',   'generateLesson');
  graph.addEdge('generateLesson', 'validateLesson');
  graph.addEdge('validateLesson', 'qcObserver');

  // ReAct conditional: loop or finalize
  graph.addConditionalEdges('qcObserver', reactLoopRouter, {
    generateLesson: 'generateLesson',
    saveLesson:     'saveLesson',
  });

  graph.addEdge('saveLesson', END);

  return graph.compile();
}

// ── Execution helper ──────────────────────────────────────────────────────────

/**
 * Run the full lesson generation graph with the ReAct QC loop.
 *
 * @param {object} params
 * @param {string} params.lessonTitle
 * @param {string} params.learningObjective
 * @param {string} [params.lessonId]            — MongoDB Lesson._id
 * @param {string} [params.researchSessionId]   — MongoDB ResearchSession._id
 * @param {number} [params.maxReactIterations]  — max QC retry iterations (default: 3)
 * @param {number} [params.qcThreshold]         — min QC overall score to pass (default: 80)
 * @param {string[]} [params.initialQcFeedback] — previous QC suggestions for regeneration
 * @returns {Promise<object>}
 */
async function runLessonGraph({
  lessonTitle,
  learningObjective,
  lessonId,
  researchSessionId,
  maxReactIterations = parseInt(process.env.LESSON_MAX_REACT_ITERATIONS || '3', 10),
  qcThreshold = parseInt(process.env.QC_THRESHOLD || process.env.LESSON_QC_THRESHOLD || '80', 10),
  initialQcFeedback = [],
}) {
  const graphStartTime = Date.now();

  // ── Input validation (fail fast before invoking the graph) ────────────────
  try {
    validateInputs({ lessonTitle, learningObjective });
  } catch (validationErr) {
    console.error(`[LessonGraph] Input validation failed: ${validationErr.message}`);
    throw validationErr;
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[LessonGraph] Starting ReAct lesson generation`);
  console.log(`[LessonGraph] Title: "${lessonTitle}"`);
  console.log(`[LessonGraph] Session: ${researchSessionId || 'none'}`);
  console.log(`[LessonGraph] QC threshold: ${qcThreshold}, Max iterations: ${maxReactIterations}`);
  if (initialQcFeedback && initialQcFeedback.length > 0) {
    console.log(`[LessonGraph] Seeded with ${initialQcFeedback.length} initial QC suggestions from previous loop`);
  }
  console.log(`${'═'.repeat(60)}`);

  let finalState;
  try {
    const compiledGraph = buildLessonGraph();

    finalState = await compiledGraph.invoke({
      lessonTitle:       lessonTitle.trim(),
      learningObjective: learningObjective.trim(),
      lessonId:          lessonId || null,
      researchSessionId: researchSessionId || null,
      maxReactIterations,
      qcThreshold,
      reactIteration: 0,
      qcPassed: false,
      qcFeedback: Array.isArray(initialQcFeedback) ? [...initialQcFeedback] : [],
    });

    const totalDurationMs = Date.now() - graphStartTime;
    const finalIteration = finalState.reactIteration || 1;
    const reactHistory = finalState.reactHistory || [];
    const finalQcScore = reactHistory.length > 0
      ? reactHistory[reactHistory.length - 1].overall
      : null;

    console.log(`[LessonGraph] Complete — saved ID: ${finalState.savedLessonId}`);
    console.log(`[LessonGraph] Valid: ${finalState.isValid}, QC passed: ${finalState.qcPassed}`);
    console.log(`[LessonGraph] ReAct iterations used: ${finalIteration}/${maxReactIterations}`);
    console.log(`[LessonGraph] Final QC score: ${finalQcScore ?? 'N/A'}`);
    console.log(`${'═'.repeat(60)}\n`);

    return {
      savedLessonId:     finalState.savedLessonId,
      isValid:           finalState.isValid,
      validationErrors:  finalState.validationErrors || [],
      lesson:            finalState.validatedLesson,
      stepLog:           finalState.stepLog || [],
      tokenUsage:        finalState.tokenUsage || {},
      status:            finalState.status,
      durationMs:        totalDurationMs,
      // ReAct-specific output
      qcPassed:          finalState.qcPassed,
      qcThreshold,
      reactIterations:   finalIteration,
      reactHistory:      reactHistory,
      finalQcScore,
    };
  } catch (err) {
    // Preserve any work done before the error
    console.error('[LessonGraph] Fatal error:', err.message);

    if (err.code === 'INVALID_INPUT') {
      throw err; // Re-throw validation errors as-is
    }

    // For other errors, return a structured failure with any partial state
    const totalDurationMs = Date.now() - graphStartTime;
    throw Object.assign(err, {
      durationMs: totalDurationMs,
      partialState: finalState || null,
    });
  }
}

module.exports = { buildLessonGraph, runLessonGraph };

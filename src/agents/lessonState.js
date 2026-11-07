'use strict';

/**
 * LangGraph State — Lesson Generator
 *
 * Shared state object for the lesson generation graph.
 * Flows through: loadResearch → generateLesson → validateLesson → qcObserver → (loop or saveLesson)
 *
 * ReAct Pattern:
 *   Thought  → generateLesson (LLM reasons about what lesson to produce)
 *   Act      → validateLesson (structural check)
 *   Observe  → qcObserverNode (QC scores act as observation; loop back if below threshold)
 *   Loop     → up to maxReactIterations, then saveLesson
 *
 * Full QC Loop (lessonQcLoopGraph):
 *   After saveLesson, the full production QC graphs (Factual + Instructional) are run.
 *   If QC does not pass the threshold and qcLoopPass < maxQcLoops, the graph loops back
 *   to generateLesson with qcFeedback populated from the QC reports.
 *   This is driven entirely by LangGraph conditional edges (not an external while-loop).
 */

const { Annotation } = require('@langchain/langgraph');

const LessonGeneratorState = Annotation.Root({
  // ── Input context ────────────────────────────────────────────────────────
  lessonId:          Annotation({ reducer: (_, v) => v, default: () => null }),
  researchSessionId: Annotation({ reducer: (_, v) => v, default: () => null }),
  lessonTitle:       Annotation({ reducer: (_, v) => v, default: () => '' }),
  learningObjective: Annotation({ reducer: (_, v) => v, default: () => '' }),

  // ── Research evidence (loaded from MongoDB) ──────────────────────────────
  evidence: Annotation({
    reducer: (_, v) => v,
    default: () => [],
  }),
  youtubeResults: Annotation({
    reducer: (_, v) => v,
    default: () => [],
  }),
  webResults: Annotation({
    reducer: (_, v) => v,
    default: () => [],
  }),

  // ── Generated lesson (raw LLM output) ───────────────────────────────────
  rawLessonJson: Annotation({ reducer: (_, v) => v, default: () => null }),

  // ── Validated lesson object ──────────────────────────────────────────────
  validatedLesson: Annotation({ reducer: (_, v) => v, default: () => null }),
  isValid:         Annotation({ reducer: (_, v) => v, default: () => false }),
  validationErrors: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // ── Saved lesson (MongoDB doc) ───────────────────────────────────────────
  savedLessonId: Annotation({ reducer: (_, v) => v, default: () => null }),

  // ── ReAct loop control (inner loop: inline LLM QC heuristic) ────────────
  reactIteration:    Annotation({ reducer: (_, v) => v, default: () => 0 }),
  maxReactIterations: Annotation({ reducer: (_, v) => v, default: () => 3 }),
  qcPassed:          Annotation({ reducer: (_, v) => v, default: () => false }),
  qcThreshold:       Annotation({ reducer: (_, v) => v, default: () => 70 }),
  qcFeedback: Annotation({
    reducer: (_, v) => v,
    default: () => [],
  }),
  reactHistory: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // ── Full QC loop control (outer loop: production Factual+Instructional QC) ──
  /** Number of outer QC feedback loop passes completed so far. */
  qcLoopPass: Annotation({ reducer: (_, v) => v, default: () => 0 }),
  /** Maximum outer QC loop passes before accepting best-available lesson. */
  maxQcLoops: Annotation({ reducer: (_, v) => v, default: () => 3 }),
  /** Whether the production parallel QC (Factual + Instructional) has passed. */
  qcLoopPassed: Annotation({ reducer: (_, v) => v, default: () => false }),
  /** Factual and Instructional QC report results from last runParallelQc pass. */
  qcReports: Annotation({
    reducer: (_, v) => v,
    default: () => ({ factual: null, instructional: null }),
  }),
  /** History of each outer QC loop pass result for telemetry / audit. */
  qcLoopHistory: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  /** Callback fn injected by orchestratorService to emit SSE events per loop pass. */
  onQcLoopProgress: Annotation({ reducer: (_, v) => v, default: () => null }),

  // ── Execution trace ──────────────────────────────────────────────────────
  stepLog: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  tokenUsage: Annotation({
    reducer: (prev, next) => ({
      promptTokens:     (prev.promptTokens     || 0) + (next.promptTokens     || 0),
      completionTokens: (prev.completionTokens || 0) + (next.completionTokens || 0),
    }),
    default: () => ({ promptTokens: 0, completionTokens: 0 }),
  }),

  // ── Control ──────────────────────────────────────────────────────────────
  errors: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  status: Annotation({ reducer: (_, v) => v, default: () => 'pending' }),
});

module.exports = { LessonGeneratorState };

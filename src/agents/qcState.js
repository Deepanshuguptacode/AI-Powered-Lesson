'use strict';

/**
 * LangGraph State — QC Agent
 *
 * Shared state for each QC graph (factual and instructional run independently).
 */

const { Annotation } = require('@langchain/langgraph');

const QcState = Annotation.Root({
  // ── Input ────────────────────────────────────────────────────────────────
  generatedLessonId: Annotation({ reducer: (_, v) => v, default: () => null }),
  lessonId:          Annotation({ reducer: (_, v) => v, default: () => null }),
  agentType:         Annotation({ reducer: (_, v) => v, default: () => 'factual' }),

  // ── Loaded data ───────────────────────────────────────────────────────────
  lesson:            Annotation({ reducer: (_, v) => v, default: () => null }),
  researchEvidence:  Annotation({ reducer: (_, v) => v, default: () => [] }),
  researchSources:   Annotation({ reducer: (_, v) => v, default: () => [] }),
  learningObjective: Annotation({ reducer: (_, v) => v, default: () => '' }),

  // ── QC results ────────────────────────────────────────────────────────────
  issues: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  scores: Annotation({ reducer: (_, v) => v, default: () => ({}) }),
  status: Annotation({ reducer: (_, v) => v, default: () => 'running' }),
  summary:        Annotation({ reducer: (_, v) => v, default: () => '' }),
  recommendation: Annotation({ reducer: (_, v) => v, default: () => '' }),

  // ── Saved report ──────────────────────────────────────────────────────────
  savedReportId: Annotation({ reducer: (_, v) => v, default: () => null }),

  // ── Execution trace ───────────────────────────────────────────────────────
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
  errors: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

module.exports = { QcState };


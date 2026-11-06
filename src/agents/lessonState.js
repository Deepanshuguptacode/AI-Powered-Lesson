'use strict';

/**
 * LangGraph State — Lesson Generator
 *
 * Shared state object for the lesson generation graph.
 * Flows through: loadResearch → generateLesson → validateLesson → saveLesson
 */

const { Annotation } = require('@langchain/langgraph');

const LessonGeneratorState = Annotation.Root({
  // ── Input context ────────────────────────────────────────────────────────
  lessonId:          Annotation({ reducer: (_, v) => v, default: () => null }),
  researchSessionId: Annotation({ reducer: (_, v) => v, default: () => null }),
  lessonTitle:       Annotation({ reducer: (_, v) => v, default: () => '' }),
  learningObjective: Annotation({ reducer: (_, v) => v, default: () => '' }),

  // ── Research evidence (loaded from MongoDB) ───────────────────────────────
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

  // ── Generated lesson (raw LLM output) ────────────────────────────────────
  rawLessonJson: Annotation({ reducer: (_, v) => v, default: () => null }),

  // ── Validated lesson object ────────────────────────────────────────────────
  validatedLesson: Annotation({ reducer: (_, v) => v, default: () => null }),
  isValid:         Annotation({ reducer: (_, v) => v, default: () => false }),
  validationErrors: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // ── Saved lesson (MongoDB doc) ────────────────────────────────────────────
  savedLessonId: Annotation({ reducer: (_, v) => v, default: () => null }),

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

  // ── Control ────────────────────────────────────────────────────────────────
  errors: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  status: Annotation({ reducer: (_, v) => v, default: () => 'pending' }),
});

module.exports = { LessonGeneratorState };


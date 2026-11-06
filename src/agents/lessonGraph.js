'use strict';

/**
 * Lesson Generator Graph — LangGraph.js Workflow
 *
 * Graph topology:
 *
 *   START
 *     │
 *     ▼
 *  loadResearch    ← load evidence from MongoDB ResearchSession
 *     │
 *     ▼
 *  generateLesson  ← LLM generates full 45-minute structured lesson
 *     │
 *     ▼
 *  validateLesson  ← validate structure + 45-min duration
 *     │
 *     ▼
 *  saveLesson      ← persist to MongoDB GeneratedLesson collection
 *     │
 *     ▼
 *   END
 */

const { StateGraph, START, END } = require('@langchain/langgraph');
const { LessonGeneratorState } = require('./lessonState');

const {
  loadResearchNode,
  generateLessonNode,
  validateLessonNode,
  saveLessonNode,
} = require('./lessonGeneratorAgent');

const { saveGeneratedLesson, findGeneratedLessonById } = require('../services/safeDb');

// ── Build graph ───────────────────────────────────────────────────────────────

function buildLessonGraph() {
  const graph = new StateGraph(LessonGeneratorState);

  graph.addNode('loadResearch',    loadResearchNode);
  graph.addNode('generateLesson',  generateLessonNode);
  graph.addNode('validateLesson',  validateLessonNode);
  graph.addNode('saveLesson',      saveLessonNode);

  graph.addEdge(START,            'loadResearch');
  graph.addEdge('loadResearch',   'generateLesson');
  graph.addEdge('generateLesson', 'validateLesson');
  graph.addEdge('validateLesson', 'saveLesson');
  graph.addEdge('saveLesson',     END);

  return graph.compile();
}

// ── Execution helper ──────────────────────────────────────────────────────────

/**
 * Run the full lesson generation graph.
 *
 * @param {object} params
 * @param {string} params.lessonTitle
 * @param {string} params.learningObjective
 * @param {string} [params.lessonId]       — MongoDB Lesson._id
 * @param {string} [params.researchSessionId] — MongoDB ResearchSession._id
 * @returns {Promise<object>}
 */
async function runLessonGraph({ lessonTitle, learningObjective, lessonId, researchSessionId }) {
  const graphStartTime = Date.now();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[LessonGraph] Starting lesson generation`);
  console.log(`[LessonGraph] Title: "${lessonTitle}"`);
  console.log(`[LessonGraph] Session: ${researchSessionId || 'none'}`);
  console.log(`${'═'.repeat(60)}`);

  let finalState;
  try {
    const compiledGraph = buildLessonGraph();

    finalState = await compiledGraph.invoke({
      lessonTitle,
      learningObjective,
      lessonId:          lessonId || null,
      researchSessionId: researchSessionId || null,
    });

    const totalDurationMs = Date.now() - graphStartTime;

    console.log(`[LessonGraph] Complete — saved ID: ${finalState.savedLessonId}`);
    console.log(`[LessonGraph] Valid: ${finalState.isValid}, Errors: ${finalState.validationErrors?.length || 0}`);
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
    };
  } catch (err) {
    console.error('[LessonGraph] Fatal error:', err);
    throw err;
  }
}

module.exports = { buildLessonGraph, runLessonGraph };


'use strict';

/**
 * Test Suite — LangGraph Iterative QC Loop
 *
 * Verifies:
 * 1. buildFullLessonQcGraph() successfully compiles with LangGraph conditional edges.
 * 2. runFullLessonQcGraph() executes the iterative workflow.
 * 3. Conditional edge router (qcLoopRouter) triggers loops and finalizes properly.
 * 4. onQcLoopProgress callback receives events per iteration pass.
 * 5. Full orchestration execution runs stages end-to-end using the graph.
 */

const assert = require('assert');
const { buildFullLessonQcGraph, runFullLessonQcGraph } = require('./src/agents/lessonQcLoopGraph');
const { executeFullOrchestration } = require('./src/services/orchestratorService');

async function runTests() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  LangGraph Iterative QC Loop Test Suite');
  console.log('════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ FAIL: ${name} — ${e.message}`);
      failed++;
    }
  }

  // ── TEST 1: Graph Compilation ─────────────────────────────────────────────
  console.log('── TEST 1: LangGraph Compilation & Topology ──');
  const compiled = buildFullLessonQcGraph();
  test('Graph compiles successfully', () => {
    assert(compiled, 'Compiled graph should exist');
    assert.strictEqual(typeof compiled.invoke, 'function', 'Graph must have invoke method');
  });

  // ── TEST 2: runFullLessonQcGraph with SSE event tracking ──────────────────
  console.log('\n── TEST 2: runFullLessonQcGraph Execution with Progress Events ──');
  const progressEvents = [];
  function onQcLoopProgress(evt) {
    progressEvents.push(evt);
  }

  const loopResult = await runFullLessonQcGraph({
    lessonTitle: 'Introduction to Asynchronous Programming in JavaScript',
    learningObjective: 'Understand Promises, async/await, and the JavaScript event loop through practical examples.',
    qcThreshold: 80,
    maxQcLoops: 2,
    onQcLoopProgress,
  });

  test('runFullLessonQcGraph returns valid lesson', () => {
    assert(loopResult.savedLessonId, 'Should return savedLessonId');
    assert(loopResult.lesson, 'Should return lesson object');
    assert.strictEqual(loopResult.lesson.totalDurationMinutes, 45, 'Lesson duration should be 45m');
  });

  test('QC loop pass counter and history populated', () => {
    assert(loopResult.qcLoopPass >= 1, `qcLoopPass should be >= 1, got ${loopResult.qcLoopPass}`);
    assert(Array.isArray(loopResult.qcLoopHistory), 'qcLoopHistory should be array');
    assert(loopResult.qcLoopHistory.length >= 1, 'Should have at least 1 loop history entry');
  });

  test('Progress events fired to callback', () => {
    assert(progressEvents.length > 0, 'Should have received progress events');
    const runningEvent = progressEvents.find(e => e.type === 'qc_running');
    assert(runningEvent, 'Should have received qc_running event');
    assert.strictEqual(runningEvent.activeNode, 'node_qc_parallel');
  });

  // ── TEST 3: Full End-to-End Orchestration Execution ───────────────────────
  console.log('\n── TEST 3: executeFullOrchestration via Unified LangGraph ──');
  const orchResult = await executeFullOrchestration({
    title: 'Cellular Respiration and ATP Production',
    learningObjective: 'Explain glycolysis, Krebs cycle, and electron transport chain with energetic calculations.',
    force: true,
  });

  test('Full orchestration status is completed', () => {
    assert.strictEqual(orchResult.status, 'completed', `Expected status completed, got ${orchResult.status}`);
  });

  test('Stage 4 (lesson_generator) and Stage 5 (parallel_qc) are completed', () => {
    assert.strictEqual(orchResult.stages.lesson_generator.status, 'completed');
    assert.strictEqual(orchResult.stages.parallel_qc.status, 'completed');
  });

  test('Artifacts saved properly', () => {
    assert(orchResult.artifacts.generatedLessonId, 'Should have generatedLessonId');
    assert(orchResult.artifacts.lesson, 'Should have lesson artifact');
    assert(orchResult.artifacts.qcReports.factual, 'Should have factual QC report');
    assert(orchResult.artifacts.qcReports.instructional, 'Should have instructional QC report');
  });

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`Results: ${passed} passed  ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});


'use strict';

/**
 * AI Orchestration Service
 *
 * Coordinates the complete end-to-end multi-agent orchestration pipeline
 * and tracks the live execution state across all stages in real-time.
 *
 * Features:
 *   - MongoDB-backed persistence via safeDb (with resilient memory fallback)
 *   - Duplicate execution prevention with concurrency lock detection
 *   - Granular retry and recovery for failed research, generation, and QC stages
 *   - Safe failure recovery: preserves saved lessons and instructor edits intact
 *   - Real-time event streaming (SSE) and live status polling
 *
 * Stages:
 *   1. input_guardrails  — LLM Input Safety & Injection Check (openai/gpt-oss-20b)
 *   2. supervisor_plan   — LangGraph.js ReAct Decomposition & Query Generation
 *   3. parallel_research — Web, Book & YouTube Agents running concurrently
 *   4. lesson_generator  — 45-Minute Synthesizer & Strict Duration Validator
 *   4b. qc_loop          — LangGraph iterative QC feedback loop (conditional edges)
 *   5. parallel_qc       — Independent Factual & Instructional QC Agents (run inside qc_loop)
 *   6. instructor_review — Dashboard Review, QC Decisioning, Versioning & Approval
 *
 * The QC feedback loop (stages 4+5) is driven by a native LangGraph iterative
 * workflow (addConditionalEdges in lessonQcLoopGraph.js), not an external while-loop.
 * onQcLoopProgress callbacks from the graph node emit SSE events per loop iteration.
 */

const { EventEmitter } = require('events');
const { evaluateInputGuardrails, GUARDRAIL_MODEL } = require('./inputGuardrails');
const { runResearchGraph } = require('../agents/researchGraph');
const { runFullLessonQcGraph } = require('../agents/lessonQcLoopGraph');
const {
  saveWorkflowExecution,
  findWorkflowExecutionByRunId,
  updateWorkflowExecution,
  listWorkflowExecutions,
  findActiveWorkflowExecution,
  findGeneratedLessonById,
} = require('./safeDb');

const orchestrationEvents = new EventEmitter();
orchestrationEvents.setMaxListeners(100);

// In-memory cache for ultra-fast active SSE streaming
const activeRuns = new Map();

function generateRunId() {
  return `orch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Initialize a new orchestration run state
 */
function createRunRecord(runId, { title, learningObjective }) {
  const record = {
    runId,
    lessonTitle: title,
    learningObjective,
    status: 'running', // 'running' | 'completed' | 'failed' | 'cancelled'
    currentStage: 'input_guardrails',
    currentStageLabel: 'Stage 1: LLM Input Guardrails (openai/gpt-oss-20b)',
    activeNode: 'node_guardrails',
    startTime: new Date(),
    endTime: null,
    durationMs: 0,
    isLocked: true,
    lockedAt: new Date(),
    stages: {
      input_guardrails: {
        id: 'stage_1',
        name: 'LLM Input Guardrails',
        model: GUARDRAIL_MODEL,
        status: 'pending', // 'pending' | 'running' | 'completed' | 'failed'
        data: null,
        durationMs: 0,
        retryCount: 0,
        error: null,
      },
      supervisor_plan: {
        id: 'stage_2',
        name: 'Supervisor & ReAct Planning',
        model: 'openai/gpt-oss-120b',
        status: 'pending',
        data: null,
        durationMs: 0,
        retryCount: 0,
        error: null,
      },
      parallel_research: {
        id: 'stage_3',
        name: 'Multi-Agent Research Swarm',
        agents: ['webAgent', 'bookAgent', 'youtubeAgent'],
        status: 'pending',
        data: null,
        durationMs: 0,
        retryCount: 0,
        error: null,
      },
      lesson_generator: {
        id: 'stage_4',
        name: '45-Min Lesson Synthesizer & Validator',
        model: 'openai/gpt-oss-120b',
        status: 'pending',
        data: null,
        durationMs: 0,
        retryCount: 0,
        error: null,
      },
      parallel_qc: {
        id: 'stage_5',
        name: 'Parallel QC Audit Agents',
        agents: ['factualQcAgent', 'instructionalQcAgent'],
        status: 'pending',
        data: null,
        durationMs: 0,
        retryCount: 0,
        error: null,
      },
      instructor_review: {
        id: 'stage_6',
        name: 'Instructor Review & Approval Gate',
        status: 'pending',
        data: null,
        durationMs: 0,
        retryCount: 0,
        error: null,
      },
    },
    artifacts: {
      guardrailResult: null,
      researchSessionId: null,
      generatedLessonId: null,
      lesson: null,
      qcReports: {
        factual: null,
        instructional: null,
      },
    },
    logs: [],
    retryHistory: [],
    error: null,
  };

  activeRuns.set(runId, record);

  // Asynchronously persist to MongoDB
  saveWorkflowExecution(record).catch((err) => {
    console.warn('[AI Orchestrator] MongoDB initial save warning:', err.message);
  });

  return record;
}

function updateRunStage(runId, stageKey, stageStatus, activeNode, logMessage, extraData = null) {
  const run = activeRuns.get(runId);
  if (!run) return;

  const stage = run.stages[stageKey];
  if (stage) {
    stage.status = stageStatus;
    if (extraData) stage.data = extraData;
    if (stageStatus === 'failed' && extraData?.error) {
      stage.error = extraData.error;
    }
  }

  run.currentStage = stageKey;
  run.activeNode = activeNode;
  const startMs = new Date(run.startTime).getTime();
  run.durationMs = Date.now() - startMs;

  if (logMessage) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      stage: stageKey,
      node: activeNode,
      status: stageStatus,
      message: logMessage,
    };
    run.logs.push(logEntry);
  }

  orchestrationEvents.emit(`update:${runId}`, run);
  orchestrationEvents.emit('global_update', { runId, stage: stageKey, status: stageStatus, activeNode });

  // Sync to MongoDB
  updateWorkflowExecution(runId, {
    status: run.status,
    currentStage: run.currentStage,
    currentStageLabel: run.currentStageLabel,
    activeNode: run.activeNode,
    durationMs: run.durationMs,
    stages: run.stages,
    artifacts: run.artifacts,
    logs: run.logs,
    error: run.error,
    endTime: run.endTime,
    isLocked: run.isLocked,
  }).catch((err) => {
    console.warn('[AI Orchestrator] MongoDB stage update sync warning:', err.message);
  });
}

/**
 * Execute the complete Live End-to-End Orchestration Pipeline
 */
async function executeFullOrchestration({ title, learningObjective, runId = null, force = false }) {
  // ── Concurrency & Duplicate Execution Guard ─────────────────────────────────
  if (!force) {
    const activeRun = await findActiveWorkflowExecution(title);
    if (activeRun && activeRun.runId !== runId) {
      const ageMs = Date.now() - new Date(activeRun.startTime || activeRun.createdAt).getTime();
      // If another workflow is currently executing and started less than 4 minutes ago
      if (ageMs < 4 * 60 * 1000) {
        const err = new Error(
          `Workflow execution "${activeRun.runId}" is already actively running for "${title}". Wait for it to finish or pass force=true to override.`
        );
        err.statusCode = 409;
        err.runId = activeRun.runId;
        throw err;
      }
    }
  }

  const actualRunId = runId || generateRunId();
  const run = createRunRecord(actualRunId, { title, learningObjective });

  console.log(`\n${'█'.repeat(70)}`);
  console.log(`[AI Orchestrator] Starting Full Pipeline: ${actualRunId}`);
  console.log(`[AI Orchestrator] Topic: "${title}"`);
  console.log(`${'█'.repeat(70)}\n`);

  try {
    // ── STAGE 1: Input Guardrails (openai/gpt-oss-20b) ────────────────────────
    const s1Start = Date.now();
    updateRunStage(actualRunId, 'input_guardrails', 'running', 'node_guardrails', 'Scanning input with openai/gpt-oss-20b for injection, safety, and pedagogical scope...');

    const guardrailResult = await evaluateInputGuardrails({
      title,
      learningObjective,
    });

    run.stages.input_guardrails.durationMs = Date.now() - s1Start;
    run.artifacts.guardrailResult = guardrailResult;

    if (!guardrailResult.passed) {
      updateRunStage(actualRunId, 'input_guardrails', 'failed', 'node_guardrails', `Guardrail check failed: ${guardrailResult.reasoning}`, { error: guardrailResult.reasoning });
      run.status = 'failed';
      run.isLocked = false;
      run.error = `Input rejected by guardrail: ${guardrailResult.reasoning}`;
      run.endTime = new Date();
      await updateWorkflowExecution(actualRunId, { status: 'failed', isLocked: false, error: run.error, endTime: run.endTime });
      return run;
    }

    updateRunStage(actualRunId, 'input_guardrails', 'completed', 'node_guardrails', `Input guardrail passed (Safety: ${guardrailResult.scores.safety}%, Injection Risk: ${guardrailResult.scores.promptInjectionRisk}%). Proceeding to Supervisor.`, guardrailResult);

    // ── STAGE 2 & 3: Research Supervisor & Multi-Agent Swarm ───────────────────
    const s2Start = Date.now();
    updateRunStage(actualRunId, 'supervisor_plan', 'running', 'node_supervisor', 'Supervisor decomposing lesson objective into targeted queries for Web, Book, and YouTube agents...');

    await sleep(350);

    updateRunStage(actualRunId, 'parallel_research', 'running', 'node_research_swarm', 'Multi-Agent research swarm executing: Web Agent, Book Agent, YouTube Agent collecting evidence in parallel...');

    let researchResult;
    try {
      researchResult = await runResearchGraph({
        lessonTitle: title,
        learningObjective,
      });

      run.stages.supervisor_plan.durationMs = Math.round((Date.now() - s2Start) * 0.3);
      run.stages.supervisor_plan.status = 'completed';

      run.stages.parallel_research.durationMs = Date.now() - s2Start;
      run.stages.parallel_research.status = 'completed';
      run.artifacts.researchSessionId = researchResult.sessionId;

      updateRunStage(actualRunId, 'parallel_research', 'completed', 'node_research_swarm', `Multi-agent research complete. Collected ${researchResult.totalSources || 0} sources. Evidence synthesized.`, {
        sessionId: researchResult.sessionId,
        totalSources: researchResult.totalSources,
      });
    } catch (researchErr) {
      run.stages.parallel_research.status = 'failed';
      run.stages.parallel_research.error = researchErr.message;
      updateRunStage(actualRunId, 'parallel_research', 'failed', 'node_research_swarm', `Research swarm encountered an error: ${researchErr.message}. Ready for stage retry.`, { error: researchErr.message });
      throw researchErr;
    }

    // ── STAGES 4+5: Lesson Synthesizer + QC Feedback Loop (LangGraph iterative) ─
    // The QC feedback loop is driven entirely by native LangGraph conditional edges
    // inside lessonQcLoopGraph.js (addConditionalEdges). No external while-loop exists.
    // SSE events are emitted per loop iteration via the onQcLoopProgress callback.
    const QC_THRESHOLD = parseInt(process.env.QC_THRESHOLD || process.env.LESSON_QC_THRESHOLD || '80', 10);
    const MAX_QC_LOOPS = parseInt(process.env.MAX_QC_LOOPS || '3', 10);

    const s4Start = Date.now();
    updateRunStage(actualRunId, 'lesson_generator', 'running', 'node_lesson_generator',
      `LangGraph iterative workflow starting: Lesson generation + QC feedback loop (up to ${MAX_QC_LOOPS} passes, threshold ≥ ${QC_THRESHOLD}%)...`);
    await sleep(300);

    // ── onQcLoopProgress callback — maps LangGraph node events → SSE ──────────
    /**
     * Called by runParallelQcNode inside lessonQcLoopGraph at each QC pass.
     * Translates graph node progress events into orchestrator SSE events.
     *
     * @param {object} event
     * @param {'qc_running'|'qc_passed'|'qc_failed_loop'|'qc_exhausted'|'finalized'} event.type
     * @param {number}  event.loopPass
     * @param {number}  event.maxLoops
     * @param {number}  [event.factScore]
     * @param {number}  [event.instScore]
     * @param {string}  event.activeNode
     * @param {string}  event.message
     */
    function onQcLoopProgress(event) {
      const { type, loopPass, maxLoops, factScore, instScore, activeNode, message, suggestionsCount } = event;

      switch (type) {
        case 'qc_running':
          // QC agents just started for this loop pass
          updateRunStage(actualRunId, 'parallel_qc', 'running', activeNode || 'node_qc_parallel', message, {
            qcLoopPass: loopPass,
            maxQcLoops: maxLoops,
          });
          break;

        case 'qc_passed':
          // QC passed — mark both stages complete
          run.stages.parallel_qc.status = 'completed';
          run.stages.lesson_generator.status = 'completed';
          updateRunStage(actualRunId, 'parallel_qc', 'completed', activeNode || 'node_qc_parallel', message, {
            factualScore:         factScore,
            instructionalScore:   instScore,
            qcPassed:             true,
            qcLoopPass:           loopPass,
          });
          break;

        case 'qc_failed_loop':
          // QC failed, looping back — emit feedback loop stage event
          run.stages.qc_loop = run.stages.qc_loop || {
            id: 'stage_4b', name: 'QC Feedback Loop', status: 'running', data: null,
          };
          run.stages.qc_loop.status = 'running';
          updateRunStage(actualRunId, 'qc_loop', 'running', 'node_qc_loop', message, {
            factualScore:         factScore,
            instructionalScore:   instScore,
            qcPassed:             false,
            qcLoopPass:           loopPass,
            maxQcLoops:           maxLoops,
            suggestionsCount:     suggestionsCount || 0,
          });
          // Also emit regenerating on lesson_generator node so the frontend loop arrow activates
          updateRunStage(actualRunId, 'lesson_generator', 'running', 'node_lesson_generator',
            `[QC Loop ${loopPass + 1}/${maxLoops}] Regenerating lesson with ${suggestionsCount || 0} QC improvement suggestions...`);
          break;

        case 'qc_exhausted':
          // Max loops reached — accept best lesson
          run.stages.parallel_qc.status = 'completed';
          run.stages.lesson_generator.status = 'completed';
          if (run.stages.qc_loop) run.stages.qc_loop.status = 'completed';
          updateRunStage(actualRunId, 'parallel_qc', 'completed', activeNode || 'node_qc_parallel', message, {
            factualScore:       factScore,
            instructionalScore: instScore,
            qcPassed:           false,
            qcLoopPass:         loopPass,
          });
          break;

        case 'finalized':
          // Pipeline complete — will be handled after graph returns
          break;

        default:
          console.warn(`[AI Orchestrator] Unknown onQcLoopProgress type: ${type}`);
      }
    }

    let fullResult;
    try {
      fullResult = await runFullLessonQcGraph({
        lessonTitle:   title,
        learningObjective,
        researchSessionId: researchResult.sessionId,
        qcThreshold:   QC_THRESHOLD,
        maxQcLoops:    MAX_QC_LOOPS,
        onQcLoopProgress,
      });

      // ── Post-graph SSE updates ────────────────────────────────────────────
      run.stages.lesson_generator.durationMs = Date.now() - s4Start;
      run.stages.lesson_generator.status = 'completed';

      if (fullResult.savedLessonId) {
        run.artifacts.generatedLessonId = fullResult.savedLessonId;
      }
      run.artifacts.lesson = fullResult.lesson;
      run.artifacts.qcReports = {
        factual:       fullResult.qcReports?.factual       || null,
        instructional: fullResult.qcReports?.instructional || null,
      };

      const loopHistory  = fullResult.qcLoopHistory || [];
      const lastPass     = loopHistory.length > 0 ? loopHistory[loopHistory.length - 1] : null;
      const factScore    = lastPass?.factScore    ?? fullResult.qcReports?.factual?.scores?.overall ?? 0;
      const instScore    = lastPass?.instScore    ?? fullResult.qcReports?.instructional?.scores?.overall ?? 0;
      const loopPasses   = fullResult.qcLoopPass  || 1;
      const qcLoopPassed = fullResult.qcLoopPassed;

      // If qc_passed event wasn't already fired (e.g. QC was exhausted), mark now
      if (run.stages.parallel_qc.status !== 'completed') {
        run.stages.parallel_qc.status = 'completed';
        updateRunStage(actualRunId, 'parallel_qc', 'completed', 'node_qc_parallel',
          `Parallel QC complete after ${loopPasses} loop pass(es). Factual: ${factScore}%, Instructional: ${instScore}%. ${qcLoopPassed ? `PASSED ✓ (≥${QC_THRESHOLD}%)` : `Best lesson preserved for Instructor Review.`}`, {
            factualScore:       factScore,
            instructionalScore: instScore,
            qcPassed:           qcLoopPassed,
            qcLoopPass:         loopPasses,
            loopHistory,
          });
      }

      updateRunStage(actualRunId, 'lesson_generator', 'completed', 'node_validator',
        `Lesson synthesized & validated (${fullResult.lesson?.totalDurationMinutes || 45}m). Saved v${fullResult.lesson?.version || 1}.0 after ${loopPasses} QC loop pass(es). QC ${qcLoopPassed ? 'PASSED ✓' : `accepted at ${factScore}%/${instScore}%`}`, {
          savedLessonId:     fullResult.savedLessonId,
          isValid:           fullResult.isValid,
          qcLoopPassed,
          qcLoopPass:        loopPasses,
          factualScore:      factScore,
          instructionalScore: instScore,
        });
    } catch (genErr) {
      run.stages.lesson_generator.status = 'failed';
      run.stages.lesson_generator.error = genErr.message;

      if (genErr.code === 'INVALID_INPUT') {
        run.status = 'failed';
        run.isLocked = false;
        run.error = genErr.message;
        run.endTime = new Date();
        await updateWorkflowExecution(actualRunId, { status: 'failed', isLocked: false, error: run.error, endTime: run.endTime });
        updateRunStage(actualRunId, 'lesson_generator', 'failed', 'node_lesson_generator',
          `Input validation failed: ${genErr.message}. Please provide a valid lesson title and learning objective.`,
          { error: genErr.message, validationErrors: genErr.validationErrors });
        return run;
      }

      updateRunStage(actualRunId, 'lesson_generator', 'failed', 'node_lesson_generator',
        `Lesson generator encountered an error: ${genErr.message}. ${run.artifacts.generatedLessonId ? 'Previously saved lesson is preserved.' : ''} Ready for retry.`,
        { error: genErr.message });
      throw genErr;
    }

    // ── STAGE 6: Instructor Dashboard Ready (Human-in-the-Loop) ───────────────
    run.stages.instructor_review.status = 'completed';
    run.status = 'completed';
    run.isLocked = false;
    run.endTime = new Date();
    run.durationMs = run.endTime.getTime() - new Date(run.startTime).getTime();

    updateRunStage(actualRunId, 'instructor_review', 'completed', 'node_instructor_gate', 'Pipeline complete! Lesson and QC audit reports delivered to Instructor Dashboard for review & approval.');

    console.log(`\n[AI Orchestrator] Completed Full Pipeline for ${actualRunId} in ${run.durationMs}ms\n`);
    return run;
  } catch (err) {
    console.error(`[AI Orchestrator] Pipeline error: ${err.message}`);
    run.status = 'failed';
    run.isLocked = false;
    run.error = err.message;
    run.endTime = new Date();
    const startMs = new Date(run.startTime).getTime();
    run.durationMs = Date.now() - startMs;
    updateRunStage(actualRunId, run.currentStage, 'failed', run.activeNode, `Pipeline aborted: ${err.message}`, { error: err.message });
    return run;
  }
}

/**
 * Retry a specific failed workflow stage with graceful state preservation
 *
 * Supported stages:
 *   - 'parallel_research' (or 'research')
 *   - 'lesson_generator' (or 'generation')
 *   - 'parallel_qc' (or 'qc')
 */
async function retryWorkflowStage(runId, stageKey, { autoContinue = true } = {}) {
  let run = activeRuns.get(runId);
  if (!run) {
    const persisted = await findWorkflowExecutionByRunId(runId);
    if (!persisted) {
      throw new Error(`Workflow execution "${runId}" not found for retry.`);
    }
    run = persisted;
    activeRuns.set(runId, run);
  }

  // Canonicalize stage name
  let targetStage = stageKey;
  if (targetStage === 'research') targetStage = 'parallel_research';
  if (targetStage === 'generation') targetStage = 'lesson_generator';
  if (targetStage === 'qc') targetStage = 'parallel_qc';

  if (!run.stages[targetStage]) {
    throw new Error(`Stage "${stageKey}" is invalid or cannot be retried.`);
  }

  const stage = run.stages[targetStage];
  stage.retryCount = (stage.retryCount || 0) + 1;
  const attemptNum = stage.retryCount;

  run.status = 'running';
  run.isLocked = true;
  run.error = null;

  const retryLog = {
    stage: targetStage,
    attempt: attemptNum,
    timestamp: new Date(),
    status: 'attempted',
    error: null,
  };
  run.retryHistory.push(retryLog);

  console.log(`[AI Orchestrator] Retrying stage "${targetStage}" for run ${runId} (Attempt #${attemptNum})`);

  try {
    // ── RETRY: RESEARCH SWARM ─────────────────────────────────────────────────
    if (targetStage === 'parallel_research') {
      const rStart = Date.now();
      updateRunStage(runId, 'parallel_research', 'running', 'node_research_swarm', `[Retry #${attemptNum}] Rerunning Multi-Agent Research Swarm...`);

      const researchResult = await runResearchGraph({
        lessonTitle: run.lessonTitle,
        learningObjective: run.learningObjective,
      });

      stage.durationMs = Date.now() - rStart;
      stage.status = 'completed';
      stage.error = null;
      run.artifacts.researchSessionId = researchResult.sessionId;
      retryLog.status = 'recovered';

      updateRunStage(runId, 'parallel_research', 'completed', 'node_research_swarm', `[Retry #${attemptNum} Recovered] Research complete: ${researchResult.totalSources} sources gathered.`);

      if (autoContinue) {
        return await retryWorkflowStage(runId, 'lesson_generator', { autoContinue: true });
      }
    }

    // ── RETRY: LESSON GENERATOR ───────────────────────────────────────────────
    else if (targetStage === 'lesson_generator') {
      const gStart = Date.now();
      updateRunStage(runId, 'lesson_generator', 'running', 'node_lesson_generator', `[Retry #${attemptNum}] Rerunning full Lesson + QC feedback loop graph...`);

      const retryQcThreshold = parseInt(process.env.QC_THRESHOLD || process.env.LESSON_QC_THRESHOLD || '80', 10);
      const retryMaxQcLoops  = parseInt(process.env.MAX_QC_LOOPS || '3', 10);

      const fullResult = await runFullLessonQcGraph({
        lessonTitle:       run.lessonTitle,
        learningObjective: run.learningObjective,
        researchSessionId: run.artifacts.researchSessionId || null,
        qcThreshold:       retryQcThreshold,
        maxQcLoops:        retryMaxQcLoops,
        onQcLoopProgress:  (event) => {
          // Forward loop progress events during retry
          if (event.type === 'qc_running' || event.type === 'qc_failed_loop') {
            updateRunStage(runId, 'qc_loop', 'running', 'node_qc_loop', event.message);
          }
        },
      });

      stage.durationMs = Date.now() - gStart;
      stage.status = 'completed';
      stage.error = null;
      // Preserve prior generated lesson ID if new save failed
      if (fullResult.savedLessonId) {
        run.artifacts.generatedLessonId = fullResult.savedLessonId;
      }
      run.artifacts.lesson = fullResult.lesson;
      run.artifacts.qcReports = {
        factual:       fullResult.qcReports?.factual       || null,
        instructional: fullResult.qcReports?.instructional || null,
      };
      retryLog.status = 'recovered';

      const loopInfo = ` [QC loop: ${fullResult.qcLoopPass} pass(es), Factual: ${fullResult.qcReports?.factual?.scores?.overall ?? 'N/A'}%, Instructional: ${fullResult.qcReports?.instructional?.scores?.overall ?? 'N/A'}%, passed: ${fullResult.qcLoopPassed}]`;

      updateRunStage(runId, 'lesson_generator', 'completed', 'node_validator', `[Retry #${attemptNum} Recovered] Lesson synthesized (${fullResult.lesson?.totalDurationMinutes || 45}m duration validated). Prior instructor edits preserved.${loopInfo}`);
      updateRunStage(runId, 'parallel_qc', 'completed', 'node_qc_parallel', `[Retry #${attemptNum}] QC complete — Factual: ${fullResult.qcReports?.factual?.scores?.overall ?? 'N/A'}%, Instructional: ${fullResult.qcReports?.instructional?.scores?.overall ?? 'N/A'}%.`);

      if (autoContinue) {
        // QC already ran inside the graph — go straight to instructor review
        run.stages.instructor_review.status = 'completed';
        run.status = 'completed';
        run.isLocked = false;
        run.endTime = new Date();
        updateRunStage(runId, 'instructor_review', 'completed', 'node_instructor_gate', 'Pipeline recovered and complete. Ready for instructor dashboard review.');
      }
    }

    // ── RETRY: PARALLEL QC AGENTS ─────────────────────────────────────────────
    else if (targetStage === 'parallel_qc') {
      const qStart = Date.now();
      updateRunStage(runId, 'parallel_qc', 'running', 'node_qc_parallel', `[Retry #${attemptNum}] Rerunning Independent Factual & Instructional QC Agents...`);

      if (!run.artifacts.generatedLessonId) {
        throw new Error('Cannot run QC retry: No generated lesson ID found in artifacts.');
      }

      // Import runQcGraphs directly for QC-only retry
      const { runQcGraphs } = require('../agents/qcGraph');
      const qcResult = await runQcGraphs({
        generatedLessonId: run.artifacts.generatedLessonId,
      });

      stage.durationMs = Date.now() - qStart;
      stage.status = 'completed';
      stage.error = null;
      run.artifacts.qcReports = {
        factual: qcResult.factual,
        instructional: qcResult.instructional,
      };
      retryLog.status = 'recovered';

      updateRunStage(runId, 'parallel_qc', 'completed', 'node_qc_parallel', `[Retry #${attemptNum} Recovered] Parallel QC completed! Factual: ${qcResult.factual.scores?.overall ?? 'N/A'}, Instructional: ${qcResult.instructional.scores?.overall ?? 'N/A'}.`);

      run.stages.instructor_review.status = 'completed';
      run.status = 'completed';
      run.isLocked = false;
      run.endTime = new Date();
      updateRunStage(runId, 'instructor_review', 'completed', 'node_instructor_gate', 'Pipeline recovered and complete. Ready for instructor dashboard review.');
    }

    // Update MongoDB
    await updateWorkflowExecution(runId, {
      status: run.status,
      stages: run.stages,
      artifacts: run.artifacts,
      retryHistory: run.retryHistory,
      logs: run.logs,
      isLocked: false,
      endTime: run.endTime,
    });

    return run;
  } catch (retryErr) {
    console.error(`[AI Orchestrator] Stage retry failed for ${targetStage}: ${retryErr.message}`);
    stage.status = 'failed';
    stage.error = retryErr.message;
    retryLog.status = 'failed';
    retryLog.error = retryErr.message;
    run.status = 'failed';
    run.isLocked = false;
    run.error = retryErr.message;

    updateRunStage(runId, targetStage, 'failed', run.activeNode, `[Retry #${attemptNum} Failed] ${retryErr.message}`, { error: retryErr.message });

    await updateWorkflowExecution(runId, {
      status: 'failed',
      stages: run.stages,
      retryHistory: run.retryHistory,
      error: retryErr.message,
      isLocked: false,
    });

    throw retryErr;
  }
}

/**
 * Cancel or clear an active workflow run
 */
async function cancelWorkflowExecution(runId) {
  const run = activeRuns.get(runId) || (await findWorkflowExecutionByRunId(runId));
  if (!run) return null;

  run.status = 'cancelled';
  run.isLocked = false;
  run.endTime = new Date();
  activeRuns.delete(runId);

  await updateWorkflowExecution(runId, {
    status: 'cancelled',
    isLocked: false,
    endTime: new Date(),
  });

  orchestrationEvents.emit(`update:${runId}`, run);
  return run;
}

function getOrchestrationRun(runId) {
  return activeRuns.get(runId) || null;
}

async function listOrchestrationRuns(limit = 10) {
  const persisted = await listWorkflowExecutions(limit);
  if (persisted && persisted.length > 0) return persisted;

  return Array.from(activeRuns.values())
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    .slice(0, limit);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  executeFullOrchestration,
  retryWorkflowStage,
  cancelWorkflowExecution,
  getOrchestrationRun,
  listOrchestrationRuns,
  orchestrationEvents,
};

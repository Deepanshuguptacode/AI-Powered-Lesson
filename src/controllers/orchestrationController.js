'use strict';

/**
 * Orchestration Controller
 *
 * Provides real-time visibility into the complete multi-stage AI orchestration layer,
 * stage retry / failure recovery, cancellation, and duplicate execution guard.
 */

const {
  executeFullOrchestration,
  retryWorkflowStage,
  cancelWorkflowExecution,
  getOrchestrationRun,
  listOrchestrationRuns,
  orchestrationEvents,
} = require('../services/orchestratorService');

/**
 * POST /api/orchestration/run
 * Start an asynchronous or synchronous end-to-end orchestration pipeline run
 */
async function startOrchestration(req, res, next) {
  try {
    const { title, learningObjective, async = false, force = false } = req.body;

    const titleClean = (title || '').trim();
    const objectiveClean = (learningObjective || '').trim();

    if (!titleClean || !objectiveClean) {
      return res.status(400).json({
        success: false,
        message: 'title and learningObjective are required and cannot be empty',
        errors: [
          ...(!titleClean ? ['title is required'] : []),
          ...(!objectiveClean ? ['learningObjective is required'] : []),
        ],
      });
    }

    if (titleClean.length < 3) {
      return res.status(400).json({ success: false, message: 'title must be at least 3 characters' });
    }
    if (objectiveClean.length < 10) {
      return res.status(400).json({ success: false, message: 'learningObjective must be at least 10 characters' });
    }

    if (async) {
      const runId = `orch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      res.status(202).json({
        success: true,
        message: 'AI Orchestration pipeline started in background',
        runId,
        statusUrl: `/api/orchestration/status/${runId}`,
        streamUrl: `/api/orchestration/stream/${runId}`,
      });

      executeFullOrchestration({ title: titleClean, learningObjective: objectiveClean, runId, force }).catch((err) => {
        console.error(`[Orchestration] Background run error: ${err.message}`);
      });
      return;
    }

    // Synchronous execution (awaits completion and returns full run)
    const result = await executeFullOrchestration({ title: titleClean, learningObjective: objectiveClean, force });

    return res.status(result.status === 'completed' ? 200 : 422).json({
      success: result.status === 'completed',
      message: result.status === 'completed'
        ? 'AI Orchestration pipeline executed successfully'
        : `Pipeline failed: ${result.error}`,
      data: result,
    });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: err.message,
        runId: err.runId,
        isDuplicate: true,
      });
    }
    next(err);
  }
}

/**
 * POST /api/orchestration/retry/:id/:stage
 * Retry a specific failed stage (e.g. parallel_research, lesson_generator, parallel_qc)
 */
async function retryStage(req, res, next) {
  try {
    const { id, stage } = req.params;
    const { autoContinue = true } = req.body || {};

    const updatedRun = await retryWorkflowStage(id, stage, { autoContinue });

    return res.json({
      success: true,
      message: `Stage "${stage}" retried successfully.`,
      data: updatedRun,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Stage retry failed: ${err.message}`,
    });
  }
}

/**
 * POST /api/orchestration/cancel/:id
 * Cancel an in-progress workflow run and release lock
 */
async function cancelRun(req, res, next) {
  try {
    const { id } = req.params;
    const cancelled = await cancelWorkflowExecution(id);
    if (!cancelled) {
      return res.status(404).json({ success: false, message: 'Workflow run not found' });
    }
    return res.json({
      success: true,
      message: `Workflow "${id}" cancelled successfully.`,
      data: cancelled,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orchestration/status/:id
 * Get live status of an orchestration run
 */
async function getRunStatus(req, res, next) {
  try {
    let run = getOrchestrationRun(req.params.id);
    if (!run) {
      const { findWorkflowExecutionByRunId } = require('../services/safeDb');
      run = await findWorkflowExecutionByRunId(req.params.id);
    }
    if (!run) {
      return res.status(404).json({ success: false, message: 'Orchestration run not found' });
    }
    return res.json({ success: true, data: run });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orchestration/runs
 * List recent orchestration runs
 */
async function getRunsList(req, res, next) {
  try {
    const runs = await listOrchestrationRuns();
    return res.json({ success: true, count: runs.length, data: runs });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orchestration/stream/:id
 * Server-Sent Events (SSE) stream for live stage updates
 */
async function streamRunUpdates(req, res) {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send current state immediately
  const initialRun = await getOrchestrationRun(id);
  if (initialRun) {
    res.write(`data: ${JSON.stringify(initialRun)}\n\n`);
  }

  const onUpdate = (run) => {
    res.write(`data: ${JSON.stringify(run)}\n\n`);
    if (run.status === 'completed' || run.status === 'failed') {
      res.write(`event: done\ndata: ${JSON.stringify({ status: run.status })}\n\n`);
      res.end();
    }
  };

  orchestrationEvents.on(`update:${id}`, onUpdate);

  req.on('close', () => {
    orchestrationEvents.off(`update:${id}`, onUpdate);
  });
}

module.exports = {
  startOrchestration,
  retryStage,
  cancelRun,
  getRunStatus,
  getRunsList,
  streamRunUpdates,
};

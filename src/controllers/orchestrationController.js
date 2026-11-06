'use strict';

/**
 * Orchestration Controller
 *
 * Provides real-time visibility into the complete multi-stage AI orchestration layer.
 */

const {
  executeFullOrchestration,
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
    const { title, learningObjective, async = false } = req.body;

    if (!title || !learningObjective) {
      return res.status(400).json({
        success: false,
        message: 'title and learningObjective are required',
      });
    }

    if (async) {
      // Return runId immediately and execute in background
      const runId = `orch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      res.status(202).json({
        success: true,
        message: 'AI Orchestration pipeline started in background',
        runId,
        statusUrl: `/api/orchestration/status/${runId}`,
        streamUrl: `/api/orchestration/stream/${runId}`,
      });

      executeFullOrchestration({ title, learningObjective, runId }).catch((err) => {
        console.error(`[Orchestration] Background run error: ${err.message}`);
      });
      return;
    }

    // Synchronous execution (awaits completion and returns full run)
    const result = await executeFullOrchestration({ title, learningObjective });

    return res.status(result.status === 'completed' ? 200 : 422).json({
      success: result.status === 'completed',
      message: result.status === 'completed'
        ? 'AI Orchestration pipeline executed successfully'
        : `Pipeline failed: ${result.error}`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orchestration/status/:id
 * Get live status of an orchestration run
 */
function getRunStatus(req, res) {
  const run = getOrchestrationRun(req.params.id);
  if (!run) {
    return res.status(404).json({ success: false, message: 'Orchestration run not found' });
  }
  return res.json({ success: true, data: run });
}

/**
 * GET /api/orchestration/runs
 * List recent orchestration runs
 */
function getRunsList(req, res) {
  const runs = listOrchestrationRuns();
  return res.json({ success: true, count: runs.length, data: runs });
}

/**
 * GET /api/orchestration/stream/:id
 * Server-Sent Events (SSE) stream for live stage updates
 */
function streamRunUpdates(req, res) {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send current state immediately
  const initialRun = getOrchestrationRun(id);
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
  getRunStatus,
  getRunsList,
  streamRunUpdates,
};


'use strict';

const { runResearchGraph } = require('../agents/researchGraph');
const {
  listExecutions,
  findExecutionById
} = require('../services/safeDb');

// ── POST /api/agent/research ──────────────────────────────────────────────────

/**
 * Kick off the multi-agent research graph.
 * Body: { lessonTitle, learningObjective, lessonId? }
 */
async function startAgentResearch(req, res, next) {
  try {
    const { lessonTitle, learningObjective, lessonId } = req.body;

    if (!lessonTitle || !learningObjective) {
      return res.status(400).json({
        success: false,
        message: 'lessonTitle and learningObjective are required',
      });
    }

    const result = await runResearchGraph({
      lessonTitle:       lessonTitle.trim(),
      learningObjective: learningObjective.trim(),
      lessonId,
    });

    return res.status(201).json({
      success: true,
      message: 'Multi-Agent research completed',
      data:    result,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/agent/executions ─────────────────────────────────────────────────

async function listAgentExecutions(req, res, next) {
  try {
    const executions = await listExecutions(25);
    return res.json({ success: true, count: executions.length, data: executions });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/agent/executions/:id ─────────────────────────────────────────────

async function getExecution(req, res, next) {
  try {
    const execution = await findExecutionById(req.params.id);
    if (!execution) {
      return res.status(404).json({ success: false, message: 'Execution not found' });
    }
    return res.json({ success: true, data: execution });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/agent/gateway/stats ──────────────────────────────────────────────

async function getGatewayStats(req, res, next) {
  try {
    const { getUsageStats, getKeyPoolSize } = require('../services/llmGateway');
    return res.json({
      success: true,
      data:    { ...getUsageStats(), keyPoolSize: getKeyPoolSize() },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  startAgentResearch,
  listExecutions: listAgentExecutions,
  getExecution,
  getGatewayStats
};

'use strict';

const express = require('express');
const router  = express.Router();

const {
  startAgentResearch,
  listExecutions,
  getExecution,
  getGatewayStats,
} = require('../controllers/agentController');

// POST  /api/agent/research             – run multi-agent research graph
router.post('/research', startAgentResearch);

// GET   /api/agent/executions           – list all agent executions
router.get('/executions', listExecutions);

// GET   /api/agent/executions/:id       – single execution with full step log
router.get('/executions/:id', getExecution);

// GET   /api/agent/gateway/stats        – LLM gateway token + error stats
router.get('/gateway/stats', getGatewayStats);

module.exports = router;


'use strict';

const express = require('express');
const router = express.Router();

const {
  startOrchestration,
  retryStage,
  cancelRun,
  getRunStatus,
  getRunsList,
  streamRunUpdates,
} = require('../controllers/orchestrationController');

// POST /api/orchestration/run              — run full pipeline (sync or async)
router.post('/run', startOrchestration);

// POST /api/orchestration/retry/:id/:stage — retry specific failed stage
router.post('/retry/:id/:stage', retryStage);

// POST /api/orchestration/cancel/:id       — cancel running execution
router.post('/cancel/:id', cancelRun);

// GET  /api/orchestration/runs             — list recent runs (MongoDB persisted)
router.get('/runs', getRunsList);

// GET  /api/orchestration/status/:id       — poll live run status
router.get('/status/:id', getRunStatus);

// GET  /api/orchestration/stream/:id       — live Server-Sent Events stream
router.get('/stream/:id', streamRunUpdates);

module.exports = router;

'use strict';

const express = require('express');
const router = express.Router();

const {
  startOrchestration,
  getRunStatus,
  getRunsList,
  streamRunUpdates,
} = require('../controllers/orchestrationController');

// POST /api/orchestration/run        — run full pipeline (sync or async)
router.post('/run', startOrchestration);

// GET  /api/orchestration/runs       — list recent runs
router.get('/runs', getRunsList);

// GET  /api/orchestration/status/:id — poll live run status
router.get('/status/:id', getRunStatus);

// GET  /api/orchestration/stream/:id — live Server-Sent Events stream
router.get('/stream/:id', streamRunUpdates);

module.exports = router;


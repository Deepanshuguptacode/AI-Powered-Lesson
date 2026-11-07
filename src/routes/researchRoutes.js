'use strict';

const express = require('express');
const router  = express.Router();

const {
  startResearch,
  listResearchSessions,
  getLatestResearchSession,
  getResearchSession,
  getResearchSources,
} = require('../controllers/researchController');
const { inputGuardrailMiddleware } = require('../middlewares/guardrailMiddleware');

// POST   /api/research           – start a research run
router.post('/', inputGuardrailMiddleware, startResearch);

// GET    /api/research           – list all research sessions
router.get('/', listResearchSessions);

// GET    /api/research/latest    – get most recent session with evidence & sources
router.get('/latest', getLatestResearchSession);

// GET    /api/research/:id       – get a single session with evidence & sources
router.get('/:id', getResearchSession);

// GET    /api/research/:id/sources – list raw sources (?type=web|book|youtube)
router.get('/:id/sources', getResearchSources);

module.exports = router;


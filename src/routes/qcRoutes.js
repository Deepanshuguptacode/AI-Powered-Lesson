'use strict';

const express = require('express');
const router  = express.Router();

const {
  runQc,
  listQcReportsController,
  getQcReportController,
  getQcReportsByLessonController,
} = require('../controllers/qcController');

// GET /api/qc/lesson/:lessonId — must come before /:id
router.get('/lesson/:lessonId', getQcReportsByLessonController);

// POST /api/qc  — run both QC agents in parallel
// GET  /api/qc  — list all QC reports
router.route('/')
  .post(runQc)
  .get(listQcReportsController);

// GET /api/qc/:id — get a single QC report
router.route('/:id')
  .get(getQcReportController);

module.exports = router;


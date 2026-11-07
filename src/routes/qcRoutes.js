'use strict';

const express = require('express');
const router  = express.Router();

const {
  runQc,
  rerunQcForLesson,
  loopImproveLessonWithQc,
  listQcReportsController,
  getQcReportController,
  getQcReportsByLessonController,
} = require('../controllers/qcController');

// GET /api/qc/lesson/:lessonId — must come before /:id
router.get('/lesson/:lessonId', getQcReportsByLessonController);

// POST /api/qc/rerun/:lessonId — re-run QC on a specific lesson version
router.post('/rerun/:lessonId', rerunQcForLesson);

// POST /api/qc/loop-improve/:lessonId — follow QC suggestions to loop & regenerate lesson
router.post('/loop-improve/:lessonId', loopImproveLessonWithQc);

// POST /api/qc  — run both QC agents in parallel
// GET  /api/qc  — list all QC reports
router.route('/')
  .post(runQc)
  .get(listQcReportsController);

// GET /api/qc/:id — get a single QC report
router.route('/:id')
  .get(getQcReportController);

module.exports = router;


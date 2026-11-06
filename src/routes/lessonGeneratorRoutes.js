'use strict';

const express = require('express');
const router  = express.Router();

const {
  generateLesson,
  listGeneratedLessonsController,
  getGeneratedLessonController,
  validateLessonController,
  editLessonVersion,
  getLessonVersionsController,
  approveLessonController,
  recordQcDecisionController,
} = require('../controllers/lessonGeneratorController');

// POST /api/generate/validate  — must come BEFORE /:id
router.post('/validate', validateLessonController);

// Versioning and Approval sub-routes — must come BEFORE /:id catch-all if matched
router.post('/:id/edit',        editLessonVersion);
router.get('/:id/versions',     getLessonVersionsController);
router.post('/:id/approve',     approveLessonController);
router.post('/:id/qc-decision', recordQcDecisionController);

// POST /api/generate           — kick off lesson generation
// GET  /api/generate           — list all generated lessons
router.route('/')
  .post(generateLesson)
  .get(listGeneratedLessonsController);

// GET /api/generate/:id        — get one generated lesson
router.route('/:id')
  .get(getGeneratedLessonController);

module.exports = router;


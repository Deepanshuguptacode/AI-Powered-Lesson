'use strict';

const express = require('express');
const router  = express.Router();

const {
  generateLesson,
  listGeneratedLessonsController,
  getGeneratedLessonController,
  validateLessonController,
} = require('../controllers/lessonGeneratorController');

// POST /api/generate/validate  — must come BEFORE /:id
router.post('/validate', validateLessonController);

// POST /api/generate           — kick off lesson generation
// GET  /api/generate           — list all generated lessons
router.route('/')
  .post(generateLesson)
  .get(listGeneratedLessonsController);

// GET /api/generate/:id        — get one generated lesson
router.route('/:id')
  .get(getGeneratedLessonController);

module.exports = router;


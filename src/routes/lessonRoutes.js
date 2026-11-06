const express = require('express');
const router = express.Router();

const {
  createLesson,
  getLessons,
  getLessonById
} = require('../controllers/lessonController');

const { validateLesson } = require('../middlewares/validateLesson');
const { inputGuardrailMiddleware } = require('../middlewares/guardrailMiddleware');

// Lesson Routes
router.route('/')
  .post(validateLesson, inputGuardrailMiddleware, createLesson)
  .get(getLessons);

router.route('/:id')
  .get(getLessonById);

module.exports = router;

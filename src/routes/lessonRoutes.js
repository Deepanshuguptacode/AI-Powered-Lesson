const express = require('express');
const router = express.Router();

const {
  createLesson,
  getLessons,
  getLessonById
} = require('../controllers/lessonController');

const { validateLesson } = require('../middlewares/validateLesson');

// Lesson Routes
router.route('/')
  .post(validateLesson, createLesson)
  .get(getLessons);

router.route('/:id')
  .get(getLessonById);

module.exports = router;

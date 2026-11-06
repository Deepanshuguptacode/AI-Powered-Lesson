const { createLessonDoc, listLessons, findLessonById } = require('../services/safeDb');

/**
 * Controller for Lesson operations with safe DB resilience
 */

/**
 * @desc    Create a new lesson
 * @route   POST /api/lessons
 * @access  Public
 */
const createLesson = async (req, res, next) => {
  try {
    const { title, learningObjective, metadata } = req.body;

    const savedLesson = await createLessonDoc({
      title,
      learningObjective,
      status: 'draft',
      metadata: metadata || {}
    });

    res.status(201).json({
      success: true,
      message: 'Lesson created successfully',
      data: savedLesson
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all saved lessons
 * @route   GET /api/lessons
 * @access  Public
 */
const getLessons = async (req, res, next) => {
  try {
    const lessons = await listLessons();

    res.status(200).json({
      success: true,
      count: lessons.length,
      data: lessons
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single lesson by ID
 * @route   GET /api/lessons/:id
 * @access  Public
 */
const getLessonById = async (req, res, next) => {
  try {
    const lesson = await findLessonById(req.params.id);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    res.status(200).json({
      success: true,
      data: lesson
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createLesson,
  getLessons,
  getLessonById
};

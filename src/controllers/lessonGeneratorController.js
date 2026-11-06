'use strict';

/**
 * Lesson Generator Controller
 *
 * Routes:
 *   POST /api/generate            — Run lesson generation from a research session
 *   GET  /api/generate            — List all generated lessons
 *   GET  /api/generate/:id        — Get a specific generated lesson
 *   POST /api/generate/validate   — Validate a lesson JSON without saving
 */

const { runLessonGraph } = require('../agents/lessonGraph');
const {
  listGeneratedLessons,
  findGeneratedLessonById,
  findSessionById,
} = require('../services/safeDb');
const { validateLesson } = require('../schemas/lessonSchema');

// ── POST /api/generate ────────────────────────────────────────────────────────

/**
 * Generate a complete lesson from a research session.
 *
 * Body: { researchSessionId, lessonTitle, learningObjective, lessonId? }
 */
async function generateLesson(req, res, next) {
  try {
    const { researchSessionId, lessonTitle, learningObjective, lessonId } = req.body;

    if (!lessonTitle || !learningObjective) {
      return res.status(400).json({
        success: false,
        message: 'lessonTitle and learningObjective are required',
      });
    }

    // Optionally verify the research session exists before running
    if (researchSessionId) {
      const session = await findSessionById(researchSessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: `Research session not found: ${researchSessionId}`,
        });
      }
    }

    console.log(`[LessonGeneratorController] Starting lesson generation for: "${lessonTitle}"`);

    const result = await runLessonGraph({
      lessonTitle:       lessonTitle.trim(),
      learningObjective: learningObjective.trim(),
      lessonId:          lessonId || null,
      researchSessionId: researchSessionId || null,
    });

    return res.status(201).json({
      success: true,
      message: result.isValid
        ? 'Lesson generated and validated successfully'
        : 'Lesson generated with validation warnings',
      data: {
        lessonId:         result.savedLessonId,
        isValid:          result.isValid,
        validationErrors: result.validationErrors,
        status:           result.status,
        durationMs:       result.durationMs,
        lesson:           result.lesson,
        stepLog:          result.stepLog,
        tokenUsage:       result.tokenUsage,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/generate ─────────────────────────────────────────────────────────

async function listGeneratedLessonsController(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const lessons = await listGeneratedLessons(limit);
    return res.json({
      success: true,
      count: lessons.length,
      data: lessons,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/generate/:id ─────────────────────────────────────────────────────

async function getGeneratedLessonController(req, res, next) {
  try {
    const lesson = await findGeneratedLessonById(req.params.id);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Generated lesson not found',
      });
    }
    return res.json({ success: true, data: lesson });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/generate/validate ───────────────────────────────────────────────

/**
 * Validate a lesson JSON structure without saving it.
 * Body: { lesson: <lesson object> }
 */
async function validateLessonController(req, res, next) {
  try {
    const { lesson } = req.body;

    if (!lesson || typeof lesson !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body must include a "lesson" object to validate',
      });
    }

    const result = validateLesson(lesson);

    return res.status(result.valid ? 200 : 422).json({
      success: result.valid,
      message: result.valid ? 'Lesson is valid' : 'Lesson validation failed',
      data: {
        valid:            result.valid,
        durationValid:    result.durationValid,
        structureValid:   result.structureValid,
        errors:           result.errors,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateLesson,
  listGeneratedLessonsController,
  getGeneratedLessonController,
  validateLessonController,
};


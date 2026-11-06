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
  saveGeneratedLessonVersion,
  findLessonVersions,
  approveGeneratedLesson,
  addQcDecision,
} = require('../services/safeDb');
const { validateLesson } = require('../schemas/lessonSchema');
const { evaluateInputGuardrails } = require('../services/inputGuardrails');

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

    // ── Input Guardrail Evaluation (openai/gpt-oss-20b) ───────────────────────
    const guardrail = await evaluateInputGuardrails({
      title: lessonTitle,
      learningObjective
    });

    if (!guardrail.passed) {
      return res.status(422).json({
        success: false,
        message: 'Input failed AI safety & quality guardrail checks.',
        guardrail
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

// ── POST /api/generate/:id/edit ───────────────────────────────────────────────

/**
 * Save an edited lesson as a NEW version in MongoDB.
 * Never overwrites previous versions.
 * Marks previous QC reports as outdated.
 */
async function editLessonVersion(req, res, next) {
  try {
    const { id } = req.params;
    const {
      title,
      learningObjective,
      sections,
      youtubeVideos,
      references,
      totalDurationMinutes,
      editSummary,
      editedBy,
      qcDecisions
    } = req.body;

    const previous = await findGeneratedLessonById(id);
    if (!previous) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    // Prepare updated content
    const updatedContent = {
      title: title || previous.title,
      learningObjective: learningObjective || previous.learningObjective,
      sections: sections || previous.sections,
      youtubeVideos: youtubeVideos || previous.youtubeVideos,
      references: references || previous.references,
      totalDurationMinutes: totalDurationMinutes || previous.totalDurationMinutes || 45,
      qcDecisions: qcDecisions || previous.qcDecisions || [],
    };

    // Validate 45-minute duration and schema
    const validation = validateLesson(updatedContent);

    // Save as new version in MongoDB
    const newVersion = await saveGeneratedLessonVersion(
      id,
      updatedContent,
      {
        editedBy: editedBy || 'instructor',
        editSummary: editSummary || 'Instructor edited lesson sections',
      }
    );

    return res.status(201).json({
      success: true,
      message: `Saved version ${newVersion.versionTag} successfully. Previous QC reports marked as outdated.`,
      data: {
        newLessonId: newVersion._id,
        version: newVersion.version,
        versionTag: newVersion.versionTag,
        validation: {
          valid: validation.valid,
          durationValid: validation.durationValid,
          errors: validation.errors
        },
        lesson: newVersion
      }
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/generate/:id/versions ────────────────────────────────────────────

/**
 * Retrieve version history for a lesson
 */
async function getLessonVersionsController(req, res, next) {
  try {
    const { id } = req.params;
    const versions = await findLessonVersions(id);
    return res.json({
      success: true,
      count: versions.length,
      data: versions
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/generate/:id/approve ────────────────────────────────────────────

/**
 * Approve the final lesson (Instructor Approval Gate)
 */
async function approveLessonController(req, res, next) {
  try {
    const { id } = req.params;
    const { instructorName, instructorNotes } = req.body || {};

    const lesson = await findGeneratedLessonById(id);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    const approved = await approveGeneratedLesson(
      id,
      instructorName || 'Instructor',
      instructorNotes || 'Final instructional approval granted.'
    );

    return res.json({
      success: true,
      message: `Lesson ${approved.versionTag || ''} approved successfully.`,
      data: approved
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/generate/:id/qc-decision ────────────────────────────────────────

/**
 * Record instructor decision on individual QC recommendation (Accept / Reject / Modify)
 */
async function recordQcDecisionController(req, res, next) {
  try {
    const { id } = req.params;
    const {
      reportId,
      issueNumber,
      action,
      originalRecommendation,
      modifiedRecommendation,
      affectedSection,
      notes
    } = req.body;

    if (!action || !['accepted', 'rejected', 'modified'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be one of: accepted, rejected, modified'
      });
    }

    const updated = await addQcDecision(id, {
      reportId,
      issueNumber,
      action,
      originalRecommendation,
      modifiedRecommendation: action === 'modified' ? modifiedRecommendation : originalRecommendation,
      affectedSection,
      notes: notes || `Recommendation ${action} by instructor.`
    });

    return res.json({
      success: true,
      message: `QC recommendation #${issueNumber} recorded as ${action}.`,
      data: updated
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
  editLessonVersion,
  getLessonVersionsController,
  approveLessonController,
  recordQcDecisionController,
};


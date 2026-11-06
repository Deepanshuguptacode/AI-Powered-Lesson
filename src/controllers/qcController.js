'use strict';

/**
 * QC Controller
 *
 * Routes:
 *   POST /api/qc                    — Run both QC agents in parallel on a generated lesson
 *   GET  /api/qc                    — List all QC reports
 *   GET  /api/qc/:id                — Get a specific QC report
 *   GET  /api/qc/lesson/:lessonId   — Get all QC reports for a generated lesson
 */

const { runQcGraphs } = require('../agents/qcGraph');
const {
  listQcReports,
  findQcReportById,
  findQcReportsByLesson,
  findGeneratedLessonById,
} = require('../services/safeDb');

// ── POST /api/qc ──────────────────────────────────────────────────────────────

/**
 * Run both QC agents in parallel on a generated lesson.
 * Body: { generatedLessonId, lessonId? }
 */
async function runQc(req, res, next) {
  try {
    const { generatedLessonId, lessonId } = req.body;

    if (!generatedLessonId) {
      return res.status(400).json({
        success: false,
        message: 'generatedLessonId is required',
      });
    }

    // Verify the generated lesson exists
    const lesson = await findGeneratedLessonById(generatedLessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: `Generated lesson not found: ${generatedLessonId}`,
      });
    }

    console.log(`[QcController] Running QC for lesson: ${generatedLessonId}`);

    const result = await runQcGraphs({
      generatedLessonId,
      lessonId: lessonId || lesson.lessonId || null,
    });

    return res.status(201).json({
      success: true,
      message: 'QC agents completed',
      data: {
        generatedLessonId,
        durationMs: result.durationMs,
        factual: {
          reportId:      result.factual.savedReportId,
          status:        result.factual.status,
          overallScore:  result.factual.scores?.overall,
          issueCount:    result.factual.issues?.length || 0,
          summary:       result.factual.summary,
          recommendation:result.factual.recommendation,
          error:         result.factual.error || null,
        },
        instructional: {
          reportId:      result.instructional.savedReportId,
          status:        result.instructional.status,
          overallScore:  result.instructional.scores?.overall,
          issueCount:    result.instructional.issues?.length || 0,
          summary:       result.instructional.summary,
          recommendation:result.instructional.recommendation,
          error:         result.instructional.error || null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/qc ───────────────────────────────────────────────────────────────

async function listQcReportsController(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const reports = await listQcReports(limit);
    return res.json({ success: true, count: reports.length, data: reports });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/qc/:id ───────────────────────────────────────────────────────────

async function getQcReportController(req, res, next) {
  try {
    const report = await findQcReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'QC report not found' });
    }
    return res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/qc/lesson/:lessonId ──────────────────────────────────────────────

async function getQcReportsByLessonController(req, res, next) {
  try {
    const reports = await findQcReportsByLesson(req.params.lessonId);
    return res.json({ success: true, count: reports.length, data: reports });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/qc/rerun/:lessonId ──────────────────────────────────────────────

async function rerunQcForLesson(req, res, next) {
  try {
    const { lessonId } = req.params;
    const lesson = await findGeneratedLessonById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    console.log(`[QcController] Re-running QC for lesson version: ${lesson._id} (${lesson.versionTag || 'v1'})`);

    const result = await runQcGraphs({
      generatedLessonId: lesson._id.toString(),
      lessonId: lesson.lessonId || null,
    });

    return res.status(201).json({
      success: true,
      message: `QC re-audit completed for ${lesson.versionTag || 'current version'}`,
      data: {
        generatedLessonId: lesson._id,
        durationMs: result.durationMs,
        factual: {
          reportId:      result.factual.savedReportId,
          status:        result.factual.status,
          overallScore:  result.factual.scores?.overall,
          issueCount:    result.factual.issues?.length || 0,
          summary:       result.factual.summary,
          recommendation:result.factual.recommendation,
        },
        instructional: {
          reportId:      result.instructional.savedReportId,
          status:        result.instructional.status,
          overallScore:  result.instructional.scores?.overall,
          issueCount:    result.instructional.issues?.length || 0,
          summary:       result.instructional.summary,
          recommendation:result.instructional.recommendation,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  runQc,
  rerunQcForLesson,
  listQcReportsController,
  getQcReportController,
  getQcReportsByLessonController,
};


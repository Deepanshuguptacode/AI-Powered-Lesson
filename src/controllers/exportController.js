'use strict';

/**
 * Export Controller
 *
 * Handles HTTP requests to export approved lessons to PDF and DOCX formats.
 * Strictly enforces that only instructor-approved lessons can be exported.
 */

const {
  getApprovedLessonForExport,
  generateLessonPdf,
  generateLessonDocx,
} = require('../services/exportService');

function sanitizeFilename(title) {
  return (title || 'lesson')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50);
}

/**
 * GET /api/export/:id/pdf
 * Export approved lesson + QC package as a styled PDF document
 */
async function exportPdfController(req, res, next) {
  try {
    const { id } = req.params;
    const { lesson, qcReports } = await getApprovedLessonForExport(id);

    const pdfBuffer = await generateLessonPdf(lesson, qcReports);
    const filename = `${sanitizeFilename(lesson.title)}_${lesson.versionTag || 'v1.0'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    if (err.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: err.message,
        isApproved: false,
        requiresApproval: true,
      });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
}

/**
 * GET /api/export/:id/docx
 * Export approved lesson + QC package as an editable Microsoft Word DOCX document
 */
async function exportDocxController(req, res, next) {
  try {
    const { id } = req.params;
    const { lesson, qcReports } = await getApprovedLessonForExport(id);

    const docxBuffer = await generateLessonDocx(lesson, qcReports);
    const filename = `${sanitizeFilename(lesson.title)}_${lesson.versionTag || 'v1.0'}.docx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', docxBuffer.length);

    return res.end(docxBuffer);
  } catch (err) {
    if (err.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: err.message,
        isApproved: false,
        requiresApproval: true,
      });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
}

/**
 * GET /api/export/:id/status
 * Check if a lesson version is eligible for export
 */
async function checkExportStatusController(req, res, next) {
  try {
    const { id } = req.params;
    try {
      const { lesson } = await getApprovedLessonForExport(id);
      return res.json({
        success: true,
        canExport: true,
        isApproved: true,
        approvedBy: lesson.approvedBy,
        approvedAt: lesson.approvedAt,
        versionTag: lesson.versionTag,
      });
    } catch (err) {
      if (err.statusCode === 403) {
        return res.json({
          success: true,
          canExport: false,
          isApproved: false,
          message: err.message,
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  exportPdfController,
  exportDocxController,
  checkExportStatusController,
};


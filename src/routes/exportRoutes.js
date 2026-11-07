'use strict';

const express = require('express');
const router = express.Router();

const {
  exportPdfController,
  exportDocxController,
  checkExportStatusController,
} = require('../controllers/exportController');

// GET /api/export/:id/status â€” check export eligibility (isApproved requirement)
router.get('/:id/status', checkExportStatusController);

// GET /api/export/:id/pdf    â€” download PDF export package
router.get('/:id/pdf', exportPdfController);

// GET /api/export/:id/docx   â€” download DOCX export package
router.get('/:id/docx', exportDocxController);

module.exports = router;


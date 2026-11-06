'use strict';

/**
 * QcReport — MongoDB model
 *
 * Stores audit reports from Quality Control agents.
 * Two types of reports per lesson version:
 *   - 'factual'       — QC Agent 1 (Factual Accuracy)
 *   - 'instructional' — QC Agent 2 (Instructional Quality)
 *
 * Reports are associated with an exact GeneratedLesson version via generatedLessonId.
 */

const mongoose = require('mongoose');

// ── Issue sub-document ────────────────────────────────────────────────────────

const qcIssueSchema = new mongoose.Schema(
  {
    issueNumber:          { type: Number },
    description:          { type: String, required: true },
    severity:             { type: String, enum: ['critical', 'major', 'minor', 'info'], default: 'minor' },
    affectedSection:      { type: String, default: '' }, // e.g. 'coreConcepts', 'examples'
    suggestedImprovement: { type: String, default: '' },
    evidenceRef:          { type: String, default: '' }, // source URL that contradicts/supports
  },
  { _id: false }
);

// ── Score sub-document ────────────────────────────────────────────────────────

const qcScoreSchema = new mongoose.Schema(
  {
    overall:            { type: Number, min: 0, max: 100, default: 0 },
    // Factual QC dimensions
    factualCorrectness: { type: Number, min: 0, max: 100, default: null },
    sourceCitation:     { type: Number, min: 0, max: 100, default: null },
    evidenceSupport:    { type: Number, min: 0, max: 100, default: null },
    // Instructional QC dimensions
    objectiveAlignment: { type: Number, min: 0, max: 100, default: null },
    explanationClarity: { type: Number, min: 0, max: 100, default: null },
    logicalStructure:   { type: Number, min: 0, max: 100, default: null },
    practicalRelevance: { type: Number, min: 0, max: 100, default: null },
    assessmentQuality:  { type: Number, min: 0, max: 100, default: null },
    durationCompliance: { type: Number, min: 0, max: 100, default: null },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────

const qcReportSchema = new mongoose.Schema(
  {
    // Links to the exact lesson version being checked
    generatedLessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GeneratedLesson',
      required: true,
      index: true,
    },

    // Links back to the base Lesson (for convenience)
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: false,
      index: true,
    },

    // Which QC agent produced this report
    agentType: {
      type: String,
      enum: ['factual', 'instructional'],
      required: true,
      index: true,
    },

    // Overall pass/fail decision
    status: {
      type: String,
      enum: ['running', 'passed', 'failed', 'error'],
      default: 'running',
    },

    // Outdated tracking (flagged when associated lesson version changes)
    isOutdated: {
      type: Boolean,
      default: false,
      index: true,
    },
    lessonVersion: {
      type: Number,
      default: 1,
      index: true,
    },
    outdatedReason: {
      type: String,
      default: null,
    },
    outdatedAt: {
      type: Date,
      default: null,
    },

    scores: { type: qcScoreSchema, default: () => ({}) },

    // Detailed issues found
    issues: { type: [qcIssueSchema], default: [] },

    // Human-readable summary
    summary:        { type: String, default: '' },
    recommendation: { type: String, default: '' },

    // Which lesson + objective was reviewed
    lessonTitle:       { type: String, default: '' },
    learningObjective: { type: String, default: '' },

    // Generation stats
    agentStats: {
      model:           { type: String, default: '' },
      promptTokens:    { type: Number, default: 0 },
      completionTokens:{ type: Number, default: 0 },
      durationMs:      { type: Number, default: 0 },
    },

    error: { type: String, default: null },
  },
  { timestamps: true }
);

qcReportSchema.index({ createdAt: -1 });
qcReportSchema.index({ generatedLessonId: 1, agentType: 1 });
qcReportSchema.index({ status: 1 });

const QcReport = mongoose.model('QcReport', qcReportSchema);
module.exports = QcReport;


'use strict';

/**
 * ResearchSession — MongoDB model
 *
 * Tracks a full research run for a given lesson (title + objective).
 * Stores references to the individual sources found and final aggregated evidence.
 */

const mongoose = require('mongoose');

// ── Evidence sub-document ─────────────────────────────────────────────────────

const evidenceSchema = new mongoose.Schema(
  {
    text:       { type: String, required: true },
    sourceType: { type: String, enum: ['web', 'book', 'youtube'], required: true },
    sourceUrl:  { type: String, default: '' },
    sourceTitle:{ type: String, default: '' },
    relevance:  { type: Number, min: 0, max: 1, default: 0.5 },
  },
  { _id: false }
);

// ── Provider result sub-document ─────────────────────────────────────────────

const providerResultSchema = new mongoose.Schema(
  {
    provider:  { type: String, enum: ['web', 'book', 'youtube'], required: true },
    status:    { type: String, enum: ['success', 'partial', 'failed'], default: 'success' },
    itemCount: { type: Number, default: 0 },
    error:     { type: String, default: null },
    durationMs:{ type: Number, default: 0 },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────

const researchSessionSchema = new mongoose.Schema(
  {
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: false, // may be run standalone before lesson is saved
      index: true,
    },
    lessonTitle: {
      type: String,
      required: true,
      trim: true,
    },
    learningObjective: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['running', 'completed', 'partial', 'failed'],
      default: 'running',
    },
    queries: {
      web:     { type: [String], default: [] },
      book:    { type: [String], default: [] },
      youtube: { type: [String], default: [] },
    },
    providerResults: {
      type: [providerResultSchema],
      default: [],
    },
    evidence: {
      type: [evidenceSchema],
      default: [],
    },
    totalSources: { type: Number, default: 0 },
    durationMs:   { type: Number, default: 0 },
    agentRunId:   { type: String, default: null }, // linked AgentExecution._id
  },
  { timestamps: true }
);

researchSessionSchema.index({ createdAt: -1 });
researchSessionSchema.index({ lessonId: 1, createdAt: -1 });

const ResearchSession = mongoose.model('ResearchSession', researchSessionSchema);
module.exports = ResearchSession;


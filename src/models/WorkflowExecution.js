'use strict';

/**
 * WorkflowExecution — MongoDB Model
 *
 * Tracks the complete multi-stage AI orchestration workflow:
 * - Live execution status, stage durations, active agent nodes
 * - Artifact links (Guardrail, ResearchSession, GeneratedLesson, QcReports)
 * - Stage-level retry tracking and failure recovery history
 * - Mutual exclusion locks to prevent duplicate workflow executions
 */

const mongoose = require('mongoose');

const logEntrySchema = new mongoose.Schema(
  {
    timestamp: { type: String, default: () => new Date().toISOString() },
    stage:     { type: String, required: true },
    node:      { type: String, default: '' },
    status:    { type: String, default: 'running' },
    message:   { type: String, required: true },
  },
  { _id: false }
);

const retryEntrySchema = new mongoose.Schema(
  {
    stage:     { type: String, required: true },
    attempt:   { type: Number, default: 1 },
    timestamp: { type: Date, default: Date.now },
    status:    { type: String, enum: ['attempted', 'recovered', 'failed'], default: 'attempted' },
    error:     { type: String, default: null },
  },
  { _id: false }
);

const workflowExecutionSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      required: true,
      unique: true,
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
      enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
      default: 'running',
      index: true,
    },
    currentStage: {
      type: String,
      default: 'input_guardrails',
    },
    currentStageLabel: {
      type: String,
      default: 'Stage 1: LLM Input Guardrails (openai/gpt-oss-20b)',
    },
    activeNode: {
      type: String,
      default: 'node_guardrails',
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    stages: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    artifacts: {
      guardrailResult:   { type: mongoose.Schema.Types.Mixed, default: null },
      researchSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResearchSession', default: null },
      generatedLessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedLesson', default: null },
      lesson:            { type: mongoose.Schema.Types.Mixed, default: null },
      qcReports:         { type: mongoose.Schema.Types.Mixed, default: null },
    },
    logs:         { type: [logEntrySchema], default: [] },
    retryHistory: { type: [retryEntrySchema], default: [] },
    error:        { type: String, default: null },
    isLocked:     { type: Boolean, default: false },
    lockedAt:     { type: Date, default: null },
  },
  { timestamps: true }
);

workflowExecutionSchema.index({ createdAt: -1 });
workflowExecutionSchema.index({ lessonTitle: 1, status: 1 });

const WorkflowExecution = mongoose.model('WorkflowExecution', workflowExecutionSchema);
module.exports = WorkflowExecution;


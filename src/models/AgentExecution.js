'use strict';

/**
 * AgentExecution — MongoDB model
 *
 * Tracks a full LangGraph multi-agent run: which agents ran, what tools they
 * called, token usage per step, and final combined research output.
 */

const mongoose = require('mongoose');

// ── Tool call sub-document ───────────────────────────────────────────────────

const toolCallSchema = new mongoose.Schema(
  {
    tool:       { type: String },
    input:      { type: mongoose.Schema.Types.Mixed },
    output:     { type: mongoose.Schema.Types.Mixed },
    durationMs: { type: Number, default: 0 },
    error:      { type: String, default: null },
  },
  { _id: false }
);

// ── Agent step sub-document ──────────────────────────────────────────────────

const agentStepSchema = new mongoose.Schema(
  {
    agent:        { type: String, required: true }, // supervisor | webAgent | bookAgent | youtubeAgent
    iteration:    { type: Number, default: 1 },
    action:       { type: String, default: '' },    // human-readable description
    reasoning:    { type: String, default: '' },    // agent's ReAct reasoning
    toolCalls:    { type: [toolCallSchema], default: [] },
    observation:  { type: String, default: '' },
    tokenUsage:   {
      promptTokens:     { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 },
    },
    durationMs:   { type: Number, default: 0 },
    status:       { type: String, enum: ['running', 'done', 'failed'], default: 'done' },
    error:        { type: String, default: null },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────

const agentExecutionSchema = new mongoose.Schema(
  {
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      default: null,
    },
    lessonTitle:        { type: String, required: true },
    learningObjective:  { type: String, required: true },

    status: {
      type: String,
      enum: ['running', 'completed', 'partial', 'failed'],
      default: 'running',
    },

    steps:          { type: [agentStepSchema], default: [] },
    researchSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ResearchSession',
      default: null,
    },

    // Aggregate token usage across all LLM calls
    totalTokenUsage: {
      promptTokens:     { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 },
      totalTokens:      { type: Number, default: 0 },
    },

    iterationCount: { type: Number, default: 0 },
    durationMs:     { type: Number, default: 0 },
    error:          { type: String, default: null },
  },
  { timestamps: true }
);

agentExecutionSchema.index({ createdAt: -1 });
agentExecutionSchema.index({ lessonId: 1 });

const AgentExecution = mongoose.model('AgentExecution', agentExecutionSchema);
module.exports = AgentExecution;


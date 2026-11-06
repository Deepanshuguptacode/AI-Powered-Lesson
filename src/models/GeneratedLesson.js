'use strict';

/**
 * GeneratedLesson — MongoDB model
 *
 * Stores the complete AI-generated lesson produced by the LessonGeneratorAgent.
 * Preserves the link to the originating ResearchSession for traceability.
 */

const mongoose = require('mongoose');

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const introductionSchema = new mongoose.Schema({
  durationMinutes:  { type: Number, default: 5 },
  overview:         { type: String, default: '' },
  whyItMatters:     { type: String, default: '' },
  whatYouWillLearn: { type: [String], default: [] },
}, { _id: false });

const conceptSchema = new mongoose.Schema({
  title:         { type: String, default: '' },
  explanation:   { type: String, default: '' },
  evidenceQuote: { type: String, default: '' },
  sourceRef:     { type: String, default: '' },
}, { _id: false });

const coreConceptsSchema = new mongoose.Schema({
  durationMinutes: { type: Number, default: 12 },
  concepts:        { type: [conceptSchema], default: [] },
}, { _id: false });

const exampleItemSchema = new mongoose.Schema({
  title:            { type: String, default: '' },
  description:      { type: String, default: '' },
  realWorldContext: { type: String, default: '' },
  sourceRef:        { type: String, default: '' },
}, { _id: false });

const examplesSchema = new mongoose.Schema({
  durationMinutes: { type: Number, default: 8 },
  items:           { type: [exampleItemSchema], default: [] },
}, { _id: false });

const demoStepSchema = new mongoose.Schema({
  stepNumber:  { type: Number },
  instruction: { type: String, default: '' },
  tip:         { type: String, default: '' },
}, { _id: false });

const practicalDemoSchema = new mongoose.Schema({
  durationMinutes: { type: Number, default: 8 },
  description:     { type: String, default: '' },
  steps:           { type: [demoStepSchema], default: [] },
}, { _id: false });

const handsOnActivitySchema = new mongoose.Schema({
  durationMinutes: { type: Number, default: 7 },
  title:           { type: String, default: '' },
  instructions:    { type: String, default: '' },
  materials:       { type: [String], default: [] },
  expectedOutcome: { type: String, default: '' },
}, { _id: false });

const questionSchema = new mongoose.Schema({
  questionNumber: { type: Number },
  question:       { type: String, default: '' },
  type:           { type: String, enum: ['multiple_choice', 'true_false', 'short_answer'], default: 'multiple_choice' },
  options:        { type: [String], default: [] },
  correctAnswer:  { type: String, default: '' },
  explanation:    { type: String, default: '' },
}, { _id: false });

const knowledgeCheckSchema = new mongoose.Schema({
  durationMinutes: { type: Number, default: 3 },
  questions:       { type: [questionSchema], default: [] },
}, { _id: false });

const summarySchema = new mongoose.Schema({
  durationMinutes: { type: Number, default: 2 },
  keyTakeaways:    { type: [String], default: [] },
  nextSteps:       { type: String, default: '' },
}, { _id: false });

const sectionsSchema = new mongoose.Schema({
  introduction:           { type: introductionSchema, default: () => ({}) },
  coreConcepts:           { type: coreConceptsSchema, default: () => ({}) },
  examples:               { type: examplesSchema, default: () => ({}) },
  practicalDemonstration: { type: practicalDemoSchema, default: () => ({}) },
  handsOnActivity:        { type: handsOnActivitySchema, default: () => ({}) },
  knowledgeCheck:         { type: knowledgeCheckSchema, default: () => ({}) },
  summary:                { type: summarySchema, default: () => ({}) },
}, { _id: false });

const youtubeVideoSchema = new mongoose.Schema({
  title:               { type: String, default: '' },
  url:                 { type: String, default: '' },
  channelName:         { type: String, default: '' },
  durationDescription: { type: String, default: '' },
  relevance:           { type: String, default: '' },
}, { _id: false });

const referenceSchema = new mongoose.Schema({
  title:       { type: String, default: '' },
  url:         { type: String, default: '' },
  sourceType:  { type: String, enum: ['web', 'book', 'youtube', 'other'], default: 'web' },
  description: { type: String, default: '' },
}, { _id: false });

// ── QC Decision sub-document ──────────────────────────────────────────────────

const qcDecisionSchema = new mongoose.Schema(
  {
    reportId:               { type: mongoose.Schema.Types.ObjectId, ref: 'QcReport' },
    issueNumber:            { type: Number },
    action:                 { type: String, enum: ['accepted', 'rejected', 'modified'], default: 'accepted' },
    originalRecommendation: { type: String, default: '' },
    modifiedRecommendation: { type: String, default: '' },
    affectedSection:        { type: String, default: '' },
    notes:                  { type: String, default: '' },
    appliedAt:              { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────

const generatedLessonSchema = new mongoose.Schema(
  {
    // Links back to the base Lesson document (title + objective)
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: false,
      index: true,
    },

    // Links back to the ResearchSession that supplied the evidence
    researchSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ResearchSession',
      required: false,
      index: true,
    },

    // Versioning Hierarchy (Preserves all history; never overwrites)
    version: {
      type: Number,
      default: 1,
      index: true,
    },
    rootLessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GeneratedLesson',
      default: null,
      index: true,
    },
    parentLessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GeneratedLesson',
      default: null,
      index: true,
    },
    versionTag: {
      type: String,
      default: 'v1.0 (AI Generated)',
    },
    isLatestVersion: {
      type: Boolean,
      default: true,
      index: true,
    },
    editedBy: {
      type: String,
      enum: ['ai', 'instructor'],
      default: 'ai',
    },
    editSummary: {
      type: String,
      default: 'Initial AI lesson generation',
    },

    // Approval Gate (Mandatory Instructor Approval)
    isApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: String,
      default: null,
    },
    instructorNotes: {
      type: String,
      default: '',
    },

    // Instructor decisions on QC recommendations
    qcDecisions: {
      type: [qcDecisionSchema],
      default: [],
    },

    // Core lesson metadata
    title:             { type: String, required: true, trim: true },
    learningObjective: { type: String, required: true, trim: true },
    totalDurationMinutes: { type: Number, default: 45 },

    // All lesson sections
    sections: { type: sectionsSchema, default: () => ({}) },

    // Supplementary media
    youtubeVideos: { type: [youtubeVideoSchema], default: [] },
    references:    { type: [referenceSchema], default: [] },

    // Generation metadata
    status: {
      type: String,
      enum: ['generating', 'completed', 'failed', 'pending_qc', 'under_review', 'approved'],
      default: 'generating',
    },

    validationErrors: { type: [String], default: [] },
    isValid:          { type: Boolean, default: false },

    // LLM generation stats
    generationStats: {
      model:               { type: String, default: '' },
      promptTokens:        { type: Number, default: 0 },
      completionTokens:    { type: Number, default: 0 },
      durationMs:          { type: Number, default: 0 },
      evidenceItemsUsed:   { type: Number, default: 0 },
    },

    // QC link (populated after Stage 5)
    qcReportIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'QcReport',
      default: [],
    },
  },
  { timestamps: true }
);

generatedLessonSchema.index({ createdAt: -1 });
generatedLessonSchema.index({ lessonId: 1, createdAt: -1 });
generatedLessonSchema.index({ status: 1 });
generatedLessonSchema.index({ rootLessonId: 1, version: 1 });

const GeneratedLesson = mongoose.model('GeneratedLesson', generatedLessonSchema);
module.exports = GeneratedLesson;


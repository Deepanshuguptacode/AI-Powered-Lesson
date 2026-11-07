'use strict';

/**
 * Safe DB Layer
 *
 * Provides resilient persistence that saves to MongoDB when connected,
 * or safely stores in-memory if MongoDB is offline or in testing.
 * Prevents unhandled timeouts or buffering locks.
 */

const mongoose = require('mongoose');
const ResearchSession  = require('../models/ResearchSession');
const ResearchSource   = require('../models/ResearchSource');
const AgentExecution   = require('../models/AgentExecution');
const GeneratedLesson  = require('../models/GeneratedLesson');
const QcReport         = require('../models/QcReport');
const WorkflowExecution = require('../models/WorkflowExecution');

const Lesson = require('../models/Lesson');

const memStore = {
  lessons: new Map(),
  sessions: new Map(),
  sources: [],
  executions: new Map(),
  generatedLessons: new Map(),
  qcReports: new Map(),
  workflows: new Map(),
};

function isDbConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

function generateId() {
  return new mongoose.Types.ObjectId().toString();
}

// ── Sessions ─────────────────────────────────────────────────────────────────

async function createSession(data) {
  if (isDbConnected()) {
    try {
      const doc = await ResearchSession.create(data);
      return doc.toObject();
    } catch (err) {
      console.warn('[SafeDB] MongoDB save failed, falling back to memory store:', err.message);
    }
  }

  const id = generateId();
  const session = {
    _id: id,
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memStore.sessions.set(id, session);
  return session;
}

async function updateSession(id, updateData) {
  if (isDbConnected()) {
    try {
      const doc = await ResearchSession.findByIdAndUpdate(id, updateData, { returnDocument: 'after' }).lean();
      if (doc) return doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB update failed:', err.message);
    }
  }

  const existing = memStore.sessions.get(id.toString()) || {};
  const updated = {
    ...existing,
    ...updateData,
    updatedAt: new Date(),
  };
  memStore.sessions.set(id.toString(), updated);
  return updated;
}

async function findSessionById(id) {
  if (isDbConnected()) {
    try {
      const doc = await ResearchSession.findById(id).lean();
      if (doc) return doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB findById failed:', err.message);
    }
  }

  return memStore.sessions.get(id.toString()) || null;
}

async function listSessions(limit = 20) {
  if (isDbConnected()) {
    try {
      return await ResearchSession.find().sort({ createdAt: -1 }).limit(limit).lean();
    } catch (err) {
      console.warn('[SafeDB] MongoDB list failed:', err.message);
    }
  }

  return Array.from(memStore.sessions.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

// ── Sources ──────────────────────────────────────────────────────────────────

async function saveSources(sourcesArray) {
  if (!sourcesArray || sourcesArray.length === 0) return [];

  if (isDbConnected()) {
    try {
      return await ResearchSource.insertMany(sourcesArray, { ordered: false });
    } catch (err) {
      console.warn('[SafeDB] MongoDB insertMany failed:', err.message);
    }
  }

  const saved = sourcesArray.map((s) => ({
    _id: generateId(),
    ...s,
    createdAt: new Date(),
  }));
  memStore.sources.push(...saved);
  return saved;
}

async function findSourcesBySession(sessionId, typeFilter) {
  if (isDbConnected()) {
    try {
      const query = { sessionId };
      if (typeFilter) query.sourceType = typeFilter;
      return await ResearchSource.find(query).sort({ sourceType: 1 }).lean();
    } catch (err) {
      console.warn('[SafeDB] MongoDB findSources failed:', err.message);
    }
  }

  return memStore.sources.filter((s) => {
    const matchSession = s.sessionId?.toString() === sessionId?.toString();
    const matchType = typeFilter ? s.sourceType === typeFilter : true;
    return matchSession && matchType;
  });
}

// ── Agent Executions ─────────────────────────────────────────────────────────

async function createExecution(data) {
  if (isDbConnected()) {
    try {
      const doc = await AgentExecution.create(data);
      return doc.toObject();
    } catch (err) {
      console.warn('[SafeDB] MongoDB create execution failed:', err.message);
    }
  }

  const id = generateId();
  const exec = {
    _id: id,
    ...data,
    steps: data.steps || [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memStore.executions.set(id, exec);
  return exec;
}

async function updateExecution(id, updateData) {
  if (isDbConnected()) {
    try {
      const doc = await AgentExecution.findByIdAndUpdate(id, updateData, { returnDocument: 'after' }).lean();
      if (doc) return doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB update execution failed:', err.message);
    }
  }

  const existing = memStore.executions.get(id.toString()) || {};
  const updated = {
    ...existing,
    ...updateData,
    updatedAt: new Date(),
  };
  memStore.executions.set(id.toString(), updated);
  return updated;
}

async function findExecutionById(id) {
  if (isDbConnected()) {
    try {
      const doc = await AgentExecution.findById(id).lean();
      if (doc) return doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB findExecutionById failed:', err.message);
    }
  }

  return memStore.executions.get(id.toString()) || null;
}

async function listExecutions(limit = 20) {
  if (isDbConnected()) {
    try {
      return await AgentExecution.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('-steps')
        .lean();
    } catch (err) {
      console.warn('[SafeDB] MongoDB listExecutions failed:', err.message);
    }
  }

  return Array.from(memStore.executions.values())
    .map((e) => {
      const { steps, ...rest } = e;
      return rest;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

// ── Lessons ──────────────────────────────────────────────────────────────────

async function createLessonDoc(data) {
  if (isDbConnected()) {
    try {
      const doc = await Lesson.create(data);
      return doc.toObject ? doc.toObject() : doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB create lesson failed:', err.message);
    }
  }

  const id = generateId();
  const lesson = {
    _id: id,
    status: 'draft',
    metadata: {},
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memStore.lessons.set(id, lesson);
  return lesson;
}

async function listLessons(limit = 50) {
  if (isDbConnected()) {
    try {
      return await Lesson.find().sort({ createdAt: -1 }).limit(limit).lean();
    } catch (err) {
      console.warn('[SafeDB] MongoDB list lessons failed:', err.message);
    }
  }

  return Array.from(memStore.lessons.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

async function findLessonById(id) {
  if (isDbConnected()) {
    try {
      const doc = await Lesson.findById(id).lean();
      if (doc) return doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB findLessonById failed:', err.message);
    }
  }

  return memStore.lessons.get(id.toString()) || null;
}

// ── Generated Lessons ─────────────────────────────────────────────────────────

async function saveGeneratedLesson(data) {
  if (isDbConnected()) {
    try {
      const doc = await GeneratedLesson.create(data);
      return doc.toObject ? doc.toObject() : doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB save GeneratedLesson failed:', err.message);
    }
  }

  const id = generateId();
  const lesson = { _id: id, ...data, createdAt: new Date(), updatedAt: new Date() };
  memStore.generatedLessons.set(id, lesson);
  return lesson;
}

async function findGeneratedLessonById(id) {
  if (isDbConnected()) {
    try {
      const doc = await GeneratedLesson.findById(id).lean();
      if (doc) return doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB findGeneratedLessonById failed:', err.message);
    }
  }
  return memStore.generatedLessons.get(id?.toString()) || null;
}

async function listGeneratedLessons(limit = 20) {
  if (isDbConnected()) {
    try {
      return await GeneratedLesson.find().sort({ createdAt: -1 }).limit(limit).lean();
    } catch (err) {
      console.warn('[SafeDB] MongoDB listGeneratedLessons failed:', err.message);
    }
  }
  return Array.from(memStore.generatedLessons.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

async function updateGeneratedLesson(id, updateData) {
  if (isDbConnected()) {
    try {
      const doc = await GeneratedLesson.findByIdAndUpdate(id, updateData, { returnDocument: 'after' }).lean();
      if (doc) return doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB updateGeneratedLesson failed:', err.message);
    }
  }
  const existing = memStore.generatedLessons.get(id?.toString()) || {};
  const updated = { ...existing, ...updateData, updatedAt: new Date() };
  memStore.generatedLessons.set(id?.toString(), updated);
  return updated;
}

// ── Lesson Versioning & Instructor Editing (Never overwrites) ──────────────

async function saveGeneratedLessonVersion(previousLessonId, updateData, editMetadata = {}) {
  const previous = await findGeneratedLessonById(previousLessonId);
  if (!previous) {
    throw new Error(`Previous lesson not found: ${previousLessonId}`);
  }

  const rootId = previous.rootLessonId || previous._id;
  const newVersionNumber = (previous.version || 1) + 1;
  const editorType = editMetadata.editedBy || updateData.editedBy || 'instructor';
  const newVersionTag = `v${newVersionNumber}.0 (${editorType === 'instructor' ? 'Instructor Edit' : 'AI Iteration'})`;

  // 1. Mark previous version as not latest
  await updateGeneratedLesson(previous._id, { isLatestVersion: false });

  // 2. Mark previous QC reports as outdated
  await markQcReportsOutdated(previous._id, `Lesson edited to version ${newVersionTag}`);

  // 3. Assemble new version payload (inherits unmodified sections, preserves previous intact)
  const newLessonData = {
    lessonId:          previous.lessonId,
    researchSessionId: previous.researchSessionId,
    title:             updateData.title || previous.title,
    learningObjective: updateData.learningObjective || previous.learningObjective,
    totalDurationMinutes: updateData.totalDurationMinutes || previous.totalDurationMinutes || 45,
    sections:          updateData.sections || previous.sections,
    youtubeVideos:     updateData.youtubeVideos || previous.youtubeVideos || [],
    references:        updateData.references || previous.references || [],
    version:           newVersionNumber,
    rootLessonId:      rootId,
    parentLessonId:    previous._id,
    versionTag:        newVersionTag,
    isLatestVersion:   true,
    editedBy:          editMetadata.editedBy || 'instructor',
    editSummary:       editMetadata.editSummary || `Instructor edited sections at ${new Date().toLocaleTimeString()}`,
    isApproved:        false, // requires fresh approval
    status:            'under_review',
    isValid:           true,
    validationErrors:  [],
    generationStats:   previous.generationStats,
    qcDecisions:       updateData.qcDecisions || previous.qcDecisions || [],
    qcReportIds:       [], // New version starts with fresh/unattached QC reports until audited
  };

  return await saveGeneratedLesson(newLessonData);
}

async function findLessonVersions(lessonId) {
  const target = await findGeneratedLessonById(lessonId);
  if (!target) return [];

  const rootId = target.rootLessonId || target._id;

  if (isDbConnected()) {
    try {
      const versions = await GeneratedLesson.find({
        $or: [
          { rootLessonId: rootId },
          { _id: rootId }
        ]
      }).sort({ version: -1 }).lean();
      if (versions && versions.length > 0) return versions;
    } catch (err) {
      console.warn('[SafeDB] MongoDB findLessonVersions failed:', err.message);
    }
  }

  // In-memory fallback
  return Array.from(memStore.generatedLessons.values())
    .filter(l => {
      const lRoot = l.rootLessonId?.toString() || l._id?.toString();
      const targetRoot = rootId.toString();
      return lRoot === targetRoot || l._id?.toString() === targetRoot;
    })
    .sort((a, b) => (b.version || 1) - (a.version || 1));
}

async function approveGeneratedLesson(lessonId, instructorName = 'Instructor', notes = '') {
  return await updateGeneratedLesson(lessonId, {
    isApproved: true,
    status: 'approved',
    approvedAt: new Date(),
    approvedBy: instructorName,
    instructorNotes: notes,
  });
}

async function markQcReportsOutdated(generatedLessonId, reason = 'Lesson updated') {
  if (isDbConnected()) {
    try {
      await QcReport.updateMany(
        { generatedLessonId },
        {
          $set: {
            isOutdated: true,
            outdatedReason: reason,
            outdatedAt: new Date()
          }
        }
      );
    } catch (err) {
      console.warn('[SafeDB] MongoDB markQcReportsOutdated failed:', err.message);
    }
  }

  // In-memory fallback
  for (const report of memStore.qcReports.values()) {
    if (report.generatedLessonId?.toString() === generatedLessonId?.toString()) {
      report.isOutdated = true;
      report.outdatedReason = reason;
      report.outdatedAt = new Date();
    }
  }
}

async function addQcDecision(generatedLessonId, decision) {
  const lesson = await findGeneratedLessonById(generatedLessonId);
  if (!lesson) throw new Error('Lesson not found');

  const decisions = lesson.qcDecisions || [];
  decisions.push({
    ...decision,
    appliedAt: new Date()
  });

  return await updateGeneratedLesson(generatedLessonId, { qcDecisions: decisions });
}

// ── QC Reports ────────────────────────────────────────────────────────────────

async function saveQcReport(data) {
  if (isDbConnected()) {
    try {
      const doc = await QcReport.create(data);
      return doc.toObject ? doc.toObject() : doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB save QcReport failed:', err.message);
    }
  }

  const id = generateId();
  const report = { _id: id, ...data, createdAt: new Date(), updatedAt: new Date() };
  memStore.qcReports.set(id, report);
  return report;
}

async function findQcReportById(id) {
  if (isDbConnected()) {
    try {
      const doc = await QcReport.findById(id).lean();
      if (doc) return doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB findQcReportById failed:', err.message);
    }
  }
  return memStore.qcReports.get(id?.toString()) || null;
}

async function findQcReportsByLesson(generatedLessonId) {
  if (isDbConnected()) {
    try {
      return await QcReport.find({ generatedLessonId }).sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.warn('[SafeDB] MongoDB findQcReportsByLesson failed:', err.message);
    }
  }
  return Array.from(memStore.qcReports.values())
    .filter(r => r.generatedLessonId?.toString() === generatedLessonId?.toString())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function listQcReports(limit = 20) {
  if (isDbConnected()) {
    try {
      return await QcReport.find().sort({ createdAt: -1 }).limit(limit).lean();
    } catch (err) {
      console.warn('[SafeDB] MongoDB listQcReports failed:', err.message);
    }
  }
  return Array.from(memStore.qcReports.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

// ── Workflow Executions (Multi-Agent Live Orchestration) ────────────────────

async function saveWorkflowExecution(data) {
  const runId = data.runId;
  if (!runId) throw new Error('runId is required for WorkflowExecution');

  if (isDbConnected()) {
    try {
      const doc = await WorkflowExecution.findOneAndUpdate(
        { runId },
        { $set: data },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      ).lean();
      return doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB saveWorkflowExecution failed:', err.message);
    }
  }

  const existing = memStore.workflows.get(runId) || {};
  const merged = {
    _id: existing._id || generateId(),
    ...existing,
    ...data,
    updatedAt: new Date(),
  };
  memStore.workflows.set(runId, merged);
  return merged;
}

async function findWorkflowExecutionByRunId(runId) {
  if (isDbConnected()) {
    try {
      const doc = await WorkflowExecution.findOne({ runId }).lean();
      if (doc) return doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB findWorkflowExecutionByRunId failed:', err.message);
    }
  }
  return memStore.workflows.get(runId) || null;
}

async function updateWorkflowExecution(runId, updateData) {
  if (isDbConnected()) {
    try {
      const doc = await WorkflowExecution.findOneAndUpdate(
        { runId },
        { $set: updateData },
        { returnDocument: 'after' }
      ).lean();
      if (doc) return doc;
    } catch (err) {
      console.warn('[SafeDB] MongoDB updateWorkflowExecution failed:', err.message);
    }
  }

  const existing = memStore.workflows.get(runId);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...updateData,
    updatedAt: new Date(),
  };
  memStore.workflows.set(runId, updated);
  return updated;
}

async function listWorkflowExecutions(limit = 20) {
  if (isDbConnected()) {
    try {
      return await WorkflowExecution.find().sort({ createdAt: -1 }).limit(limit).lean();
    } catch (err) {
      console.warn('[SafeDB] MongoDB listWorkflowExecutions failed:', err.message);
    }
  }

  return Array.from(memStore.workflows.values())
    .sort((a, b) => new Date(b.createdAt || b.startTime) - new Date(a.createdAt || a.startTime))
    .slice(0, limit);
}

/**
 * Checks if another execution for the given title or globally is already in 'running' state
 */
async function findActiveWorkflowExecution(title = null) {
  const query = { status: 'running' };
  if (title) {
    query.lessonTitle = { $regex: new RegExp(`^${title.trim()}$`, 'i') };
  }

  if (isDbConnected()) {
    try {
      const active = await WorkflowExecution.findOne(query).lean();
      if (active) return active;
    } catch (err) {
      console.warn('[SafeDB] MongoDB findActiveWorkflowExecution failed:', err.message);
    }
  }

  // In-memory check
  for (const wf of memStore.workflows.values()) {
    if (wf.status === 'running') {
      if (!title || (wf.lessonTitle && wf.lessonTitle.toLowerCase() === title.trim().toLowerCase())) {
        return wf;
      }
    }
  }

  return null;
}

module.exports = {
  isDbConnected,
  createLessonDoc,
  listLessons,
  findLessonById,
  createSession,
  updateSession,
  findSessionById,
  listSessions,
  saveSources,
  findSourcesBySession,
  createExecution,
  updateExecution,
  findExecutionById,
  listExecutions,
  // Generated Lessons & Versioning
  saveGeneratedLesson,
  findGeneratedLessonById,
  listGeneratedLessons,
  updateGeneratedLesson,
  saveGeneratedLessonVersion,
  findLessonVersions,
  approveGeneratedLesson,
  markQcReportsOutdated,
  addQcDecision,
  // QC Reports
  saveQcReport,
  findQcReportById,
  findQcReportsByLesson,
  listQcReports,
  // Workflow Executions
  saveWorkflowExecution,
  findWorkflowExecutionByRunId,
  updateWorkflowExecution,
  listWorkflowExecutions,
  findActiveWorkflowExecution,
};

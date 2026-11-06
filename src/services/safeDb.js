'use strict';

/**
 * Safe DB Layer
 *
 * Provides resilient persistence that saves to MongoDB when connected,
 * or safely stores in-memory if MongoDB is offline or in testing.
 * Prevents unhandled timeouts or buffering locks.
 */

const mongoose = require('mongoose');
const ResearchSession = require('../models/ResearchSession');
const ResearchSource  = require('../models/ResearchSource');
const AgentExecution  = require('../models/AgentExecution');

const Lesson = require('../models/Lesson');

const memStore = {
  lessons: new Map(),
  sessions: new Map(),
  sources: [],
  executions: new Map(),
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
      const doc = await ResearchSession.findByIdAndUpdate(id, updateData, { new: true }).lean();
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
      const doc = await AgentExecution.findByIdAndUpdate(id, updateData, { new: true }).lean();
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
};

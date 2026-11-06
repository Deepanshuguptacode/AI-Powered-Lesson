'use strict';

const { runResearch } = require('../research/researchOrchestrator');
const {
  listSessions,
  findSessionById,
  findSourcesBySession
} = require('../services/safeDb');

// ── POST /api/research ────────────────────────────────────────────────────────

/**
 * Kick off a full research run.
 * Body: { lessonTitle, learningObjective, lessonId? }
 */
async function startResearch(req, res, next) {
  try {
    const { lessonTitle, learningObjective, lessonId } = req.body;

    if (!lessonTitle || !learningObjective) {
      return res.status(400).json({
        success: false,
        message: 'lessonTitle and learningObjective are required',
      });
    }

    const { session, summary } = await runResearch({
      lessonTitle:       lessonTitle.trim(),
      learningObjective: learningObjective.trim(),
      lessonId,
    });

    return res.status(201).json({
      success: true,
      message: 'Research completed',
      data: {
        sessionId: session._id,
        status:    session.status,
        summary,
        session,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/research ─────────────────────────────────────────────────────────

async function listResearchSessions(req, res, next) {
  try {
    const sessions = await listSessions(30);
    return res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/research/:id ─────────────────────────────────────────────────────

async function getResearchSession(req, res, next) {
  try {
    const session = await findSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Research session not found' });
    }
    return res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/research/:id/sources ─────────────────────────────────────────────

async function getResearchSources(req, res, next) {
  try {
    const { type } = req.query; // optional filter: web | book | youtube
    const sources = await findSourcesBySession(req.params.id, type);
    return res.json({ success: true, count: sources.length, data: sources });
  } catch (err) {
    next(err);
  }
}

module.exports = { startResearch, listResearchSessions, getResearchSession, getResearchSources };

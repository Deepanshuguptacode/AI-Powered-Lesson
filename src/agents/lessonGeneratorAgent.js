'use strict';

/**
 * Lesson Generator Agent — LangGraph Nodes
 *
 * Four sequential nodes:
 *   1. loadResearchNode     — Loads evidence from MongoDB ResearchSession
 *   2. generateLessonNode   — Calls LLM to generate the full lesson
 *   3. validateLessonNode   — Validates structure and 45-min duration
 *   4. saveLessonNode       — Persists lesson to MongoDB
 */

const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { callLLMJson } = require('../services/llmGateway');
const { findSessionById, findSourcesBySession } = require('../services/safeDb');
const { validateLesson, SECTION_DURATIONS, LESSON_SCHEMA_TEMPLATE } = require('../schemas/lessonSchema');

// ── System prompt ──────────────────────────────────────────────────────────────

const LESSON_GENERATOR_SYSTEM = `You are an expert instructional designer and educator creating a complete 45-minute lesson.

Your lesson MUST:
1. Be grounded in the provided research evidence — quote and cite sources directly.
2. Follow the exact section structure with the specified durations that sum to exactly 45 minutes.
3. Be engaging, clear, and appropriate for the learning objective.
4. Include practical examples, real demonstrations, and hands-on activities.
5. Include 5 knowledge-check questions with correct answers and explanations.
6. Include 3-5 supplementary YouTube videos from the research.
7. Include all references from the research evidence.

Return ONLY valid JSON matching the schema exactly. No markdown fences, no prose outside the JSON.`;

// ── Node 1: Load Research ─────────────────────────────────────────────────────

/**
 * Load research evidence from the MongoDB ResearchSession.
 * @param {import('./lessonState').LessonGeneratorState} state
 */
async function loadResearchNode(state) {
  const startTime = Date.now();
  const { researchSessionId, lessonTitle } = state;

  console.log(`[LessonGenerator] Loading research for session: ${researchSessionId}`);

  let evidence = [];
  let youtubeResults = [];
  let webResults = [];

  try {
    if (researchSessionId) {
      // Load the session to get aggregated evidence
      const session = await findSessionById(researchSessionId);
      if (session && session.evidence && session.evidence.length > 0) {
        evidence = session.evidence;
        console.log(`[LessonGenerator] Loaded ${evidence.length} evidence items from session`);
      }

      // Also load individual sources for YouTube videos and references
      const allSources = await findSourcesBySession(researchSessionId);
      youtubeResults = allSources.filter(s => s.sourceType === 'youtube');
      webResults = allSources.filter(s => s.sourceType === 'web' || s.sourceType === 'book');

      console.log(`[LessonGenerator] Sources: ${youtubeResults.length} YouTube, ${webResults.length} web/book`);
    }
  } catch (err) {
    console.warn(`[LessonGenerator] Failed to load research: ${err.message}`);
  }

  // If no evidence from session, build synthetic placeholder
  if (evidence.length === 0) {
    console.warn(`[LessonGenerator] No evidence found — generating lesson from LLM knowledge only`);
  }

  const stepEntry = {
    agent:       'lessonGenerator',
    action:      'loadResearch',
    reasoning:   `Loaded research evidence for "${lessonTitle}"`,
    observation: `${evidence.length} evidence items, ${youtubeResults.length} YouTube sources`,
    durationMs:  Date.now() - startTime,
    status:      'done',
  };

  return {
    evidence,
    youtubeResults,
    webResults,
    stepLog: [stepEntry],
    status:  'research_loaded',
  };
}

// ── Node 2: Generate Lesson ───────────────────────────────────────────────────

/**
 * Call the LLM to generate the full structured lesson.
 * @param {import('./lessonState').LessonGeneratorState} state
 */
async function generateLessonNode(state) {
  const startTime = Date.now();
  const { lessonTitle, learningObjective, evidence, youtubeResults, webResults, lessonId, researchSessionId } = state;

  console.log(`[LessonGenerator] Generating lesson: "${lessonTitle}"`);

  // ── Build evidence context for the prompt ─────────────────────────────────
  const evidenceSummary = evidence
    .slice(0, 15) // cap to avoid token overflow
    .map((e, i) => `[${i + 1}] (${e.sourceType}) "${e.sourceTitle}": ${e.text.slice(0, 600)}`)
    .join('\n\n');

  const youtubeSummary = youtubeResults
    .slice(0, 5)
    .map(v => `- Title: "${v.title || 'Unknown'}" | URL: ${v.url || ''} | Channel: ${v.channelName || ''}`)
    .join('\n');

  const refSummary = webResults
    .slice(0, 10)
    .map(r => `- "${r.title || 'Unknown'}" (${r.sourceType}) — ${r.url || ''}`)
    .join('\n');

  // ── Build the generation prompt ───────────────────────────────────────────
  const prompt = `Create a complete 45-minute lesson using the research evidence below.

LESSON DETAILS:
- Title: ${lessonTitle}
- Learning Objective: ${learningObjective}
- Lesson ID: ${lessonId || 'new'}
- Research Session ID: ${researchSessionId || 'none'}

SECTION DURATIONS (must sum to exactly 45 minutes):
- introduction: 5 minutes
- coreConcepts: 12 minutes
- examples: 8 minutes
- practicalDemonstration: 8 minutes
- handsOnActivity: 7 minutes
- knowledgeCheck: 3 minutes
- summary: 2 minutes

RESEARCH EVIDENCE:
${evidenceSummary || 'No research evidence available. Use your knowledge.'}

YOUTUBE VIDEOS FOUND:
${youtubeSummary || 'No YouTube videos found.'}

REFERENCE SOURCES:
${refSummary || 'No references found.'}

Return ONLY this JSON structure (no markdown, no extra text):
{
  "lessonId": "${lessonId || ''}",
  "researchSessionId": "${researchSessionId || ''}",
  "title": "${lessonTitle}",
  "learningObjective": "${learningObjective}",
  "totalDurationMinutes": 45,
  "sections": {
    "introduction": {
      "durationMinutes": 5,
      "overview": "...",
      "whyItMatters": "...",
      "whatYouWillLearn": ["...", "...", "..."]
    },
    "coreConcepts": {
      "durationMinutes": 12,
      "concepts": [
        {
          "title": "...",
          "explanation": "...",
          "evidenceQuote": "Direct quote from research evidence",
          "sourceRef": "URL or title of source"
        }
      ]
    },
    "examples": {
      "durationMinutes": 8,
      "items": [
        {
          "title": "...",
          "description": "...",
          "realWorldContext": "...",
          "sourceRef": "..."
        }
      ]
    },
    "practicalDemonstration": {
      "durationMinutes": 8,
      "description": "...",
      "steps": [
        { "stepNumber": 1, "instruction": "...", "tip": "..." }
      ]
    },
    "handsOnActivity": {
      "durationMinutes": 7,
      "title": "...",
      "instructions": "...",
      "materials": ["...", "..."],
      "expectedOutcome": "..."
    },
    "knowledgeCheck": {
      "durationMinutes": 3,
      "questions": [
        {
          "questionNumber": 1,
          "question": "...",
          "type": "multiple_choice",
          "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
          "correctAnswer": "A) ...",
          "explanation": "..."
        }
      ]
    },
    "summary": {
      "durationMinutes": 2,
      "keyTakeaways": ["...", "...", "..."],
      "nextSteps": "..."
    }
  },
  "youtubeVideos": [
    {
      "title": "...",
      "url": "...",
      "channelName": "...",
      "durationDescription": "...",
      "relevance": "..."
    }
  ],
  "references": [
    {
      "title": "...",
      "url": "...",
      "sourceType": "web",
      "description": "..."
    }
  ],
  "generatedAt": "${new Date().toISOString()}"
}`;

  const result = await callLLMJson(
    [new SystemMessage(LESSON_GENERATOR_SYSTEM), new HumanMessage(prompt)],
    {
      callerLabel: 'LessonGenerator',
      maxTokens:   4096,
      temperature: 0.4,
    }
  );

  const rawLessonJson = result.data;

  if (!rawLessonJson) {
    console.error('[LessonGenerator] LLM returned null/unparseable JSON');
    return {
      rawLessonJson: null,
      errors: ['LLM failed to return valid JSON for lesson generation'],
      stepLog: [{
        agent:       'lessonGenerator',
        action:      'generateLesson',
        reasoning:   'LLM generation failed',
        observation: `Raw response: ${result.content?.slice(0, 200) || 'empty'}`,
        durationMs:  Date.now() - startTime,
        status:      'failed',
      }],
      tokenUsage: {
        promptTokens:     result.usage?.promptTokens || 0,
        completionTokens: result.usage?.completionTokens || 0,
      },
      status: 'generation_failed',
    };
  }

  console.log(`[LessonGenerator] Lesson generated successfully`);

  const stepEntry = {
    agent:       'lessonGenerator',
    action:      'generateLesson',
    reasoning:   `Generated 45-minute lesson for "${lessonTitle}" using ${evidence.length} evidence items`,
    observation: `Sections: ${Object.keys(rawLessonJson.sections || {}).join(', ')}`,
    durationMs:  Date.now() - startTime,
    status:      'done',
  };

  return {
    rawLessonJson,
    stepLog: [stepEntry],
    tokenUsage: {
      promptTokens:     result.usage?.promptTokens || 0,
      completionTokens: result.usage?.completionTokens || 0,
    },
    status: 'lesson_generated',
  };
}

// ── Node 3: Validate Lesson ───────────────────────────────────────────────────

/**
 * Validate the generated lesson structure and 45-minute duration.
 * @param {import('./lessonState').LessonGeneratorState} state
 */
async function validateLessonNode(state) {
  const startTime = Date.now();
  const { rawLessonJson } = state;

  console.log(`[LessonGenerator] Validating lesson structure...`);

  if (!rawLessonJson) {
    return {
      isValid: false,
      validationErrors: ['No lesson JSON to validate — generation may have failed'],
      stepLog: [{
        agent:       'lessonGenerator',
        action:      'validateLesson',
        reasoning:   'Skipping validation — no lesson JSON present',
        observation: 'Validation skipped',
        durationMs:  Date.now() - startTime,
        status:      'failed',
      }],
      status: 'validation_failed',
    };
  }

  const result = validateLesson(rawLessonJson);

  if (!result.valid) {
    console.warn(`[LessonGenerator] Validation failed: ${result.errors.join(', ')}`);
  } else {
    console.log(`[LessonGenerator] Validation passed — lesson is valid`);
  }

  // Compute actual section duration total for logging
  let durationTotal = 0;
  const sections = rawLessonJson.sections || {};
  for (const key of Object.keys(SECTION_DURATIONS)) {
    durationTotal += (sections[key]?.durationMinutes || 0);
  }

  const stepEntry = {
    agent:       'lessonGenerator',
    action:      'validateLesson',
    reasoning:   `Validating structure and 45-minute duration (actual: ${durationTotal} min)`,
    observation: result.valid
      ? `Valid lesson — ${durationTotal} minutes total`
      : `Invalid: ${result.errors.slice(0, 3).join('; ')}`,
    durationMs:  Date.now() - startTime,
    status:      result.valid ? 'done' : 'failed',
  };

  return {
    validatedLesson:  result.valid ? rawLessonJson : rawLessonJson, // keep even if invalid, save with errors
    isValid:          result.valid,
    validationErrors: result.errors,
    stepLog:          [stepEntry],
    status:           result.valid ? 'validated' : 'validation_failed',
  };
}

// ── Node 4: Save Lesson ───────────────────────────────────────────────────────

/**
 * Persist the generated lesson to MongoDB via safeDb.
 * @param {import('./lessonState').LessonGeneratorState} state
 */
async function saveLessonNode(state) {
  const startTime = Date.now();
  const {
    validatedLesson,
    lessonId,
    researchSessionId,
    isValid,
    validationErrors,
    tokenUsage,
    evidence,
    youtubeResults,
    webResults,
  } = state;

  console.log(`[LessonGenerator] Saving lesson to MongoDB...`);

  if (!validatedLesson) {
    return {
      savedLessonId: null,
      errors: ['Cannot save — no lesson data available'],
      stepLog: [{
        agent:       'lessonGenerator',
        action:      'saveLesson',
        reasoning:   'Save skipped — no lesson data',
        observation: 'Save failed',
        durationMs:  Date.now() - startTime,
        status:      'failed',
      }],
      status: 'save_failed',
    };
  }

  const { saveGeneratedLesson } = require('../services/safeDb');

  try {
    // Build the lesson document from the validated JSON
    const lessonDoc = {
      lessonId:          lessonId || null,
      researchSessionId: researchSessionId || null,
      title:             validatedLesson.title,
      learningObjective: validatedLesson.learningObjective,
      totalDurationMinutes: validatedLesson.totalDurationMinutes || 45,
      sections:          validatedLesson.sections || {},
      youtubeVideos:     validatedLesson.youtubeVideos || [],
      references:        validatedLesson.references || [],
      version:           1,
      versionTag:        'v1.0 (AI Generated)',
      isLatestVersion:   true,
      isApproved:        false,
      editedBy:          'ai',
      editSummary:       'Initial AI lesson generation',
      status:            isValid ? 'completed' : 'completed', // save regardless, flag errors
      isValid,
      validationErrors,
      generationStats: {
        promptTokens:      tokenUsage?.promptTokens || 0,
        completionTokens:  tokenUsage?.completionTokens || 0,
        durationMs:        Date.now() - startTime,
        evidenceItemsUsed: (evidence?.length || 0) + (youtubeResults?.length || 0) + (webResults?.length || 0),
      },
    };

    const savedDoc = await saveGeneratedLesson(lessonDoc);
    const savedId = savedDoc._id?.toString();

    console.log(`[LessonGenerator] Lesson saved: ${savedId}`);

    const stepEntry = {
      agent:       'lessonGenerator',
      action:      'saveLesson',
      reasoning:   `Persisting lesson to MongoDB`,
      observation: `Saved with ID: ${savedId}, valid: ${isValid}`,
      durationMs:  Date.now() - startTime,
      status:      'done',
    };

    return {
      savedLessonId: savedId,
      stepLog:       [stepEntry],
      status:        'saved',
    };
  } catch (err) {
    console.error(`[LessonGenerator] Save failed: ${err.message}`);
    return {
      savedLessonId: null,
      errors: [`Save failed: ${err.message}`],
      stepLog: [{
        agent:       'lessonGenerator',
        action:      'saveLesson',
        reasoning:   'Failed to save lesson',
        observation: err.message,
        durationMs:  Date.now() - startTime,
        status:      'failed',
      }],
      status: 'save_failed',
    };
  }
}

module.exports = {
  loadResearchNode,
  generateLessonNode,
  validateLessonNode,
  saveLessonNode,
};


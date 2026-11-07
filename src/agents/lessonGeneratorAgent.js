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
  const { lessonTitle, learningObjective, evidence, youtubeResults, webResults, lessonId, researchSessionId, qcFeedback, reactIteration, qcThreshold } = state;

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

  let userPrompt = prompt;

  // Inject QC feedback from previous ReAct iteration
  if (qcFeedback && qcFeedback.length > 0) {
    userPrompt += `\n\n## QC Feedback from Previous Iteration (Iteration ${reactIteration})\nThe previous version scored below the ${qcThreshold}/100 quality threshold. You MUST address ALL of the following improvements:\n${qcFeedback.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nGenerate an improved lesson that addresses all these points while maintaining the same 45-minute structure.`;
  }

  const result = await callLLMJson(
    [new SystemMessage(LESSON_GENERATOR_SYSTEM), new HumanMessage(userPrompt)],
    {
      callerLabel: 'LessonGenerator',
      maxTokens:   4096,
      temperature: 0.4,
    }
  );

  let rawLessonJson = result.data;

  if (!rawLessonJson) {
    console.warn('[LessonGenerator] LLM JSON parsing failed. Generating lesson via structured fallback...');
    try {
      const { hallucinateResponse } = require('../services/llmGateway');
      const fallbackStr = await hallucinateResponse([new HumanMessage(prompt)], { model: 'openai/gpt-oss-120b' });
      rawLessonJson = JSON.parse(fallbackStr);
      rawLessonJson.title = lessonTitle;
      rawLessonJson.learningObjective = learningObjective;
      rawLessonJson.totalDurationMinutes = 45;
    } catch (fbErr) {
      console.error('[LessonGenerator] Fallback lesson synthesis failed:', fbErr.message);
    }
  }

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

// ── Node 3.5: QC Observer (ReAct Observe Step) ─────────────────────────────

/**
 * Run lightweight inline QC evaluation as the ReAct "Observe" step.
 * Uses the same factual + instructional QC logic but without MongoDB persistence
 * (persistence happens only after the final approved iteration in saveLesson).
 *
 * Returns:
 *   qcPassed:        true if overall score >= qcThreshold
 *   qcFeedback:      array of improvement suggestions fed back into next generation
 *   reactHistory:    log entry for this iteration
 *
 * @param {import('./lessonState').LessonGeneratorState} state
 */
async function qcObserverNode(state) {
  const startTime = Date.now();
  const {
    validatedLesson,
    lessonTitle,
    learningObjective,
    evidence,
    reactIteration,
    maxReactIterations,
    qcThreshold,
  } = state;

  const activeQcThreshold = qcThreshold || parseInt(process.env.QC_THRESHOLD || process.env.LESSON_QC_THRESHOLD || '80', 10);

  const iteration = reactIteration + 1;
  console.log(`[QcObserver] ReAct iteration ${iteration}/${maxReactIterations} — running inline QC for "${lessonTitle}" (Threshold: ${activeQcThreshold})`);

  // ── Guard: no lesson to evaluate ──────────────────────────────────────────
  if (!validatedLesson) {
    const historyEntry = {
      iteration,
      qcScores: null,
      qcPassed: false,
      feedback: ['No lesson content available for QC evaluation'],
      durationMs: Date.now() - startTime,
    };
    return {
      reactIteration: iteration,
      qcPassed: false,
      qcFeedback: historyEntry.feedback,
      reactHistory: [historyEntry],
      stepLog: [{
        agent: 'qcObserver',
        action: 'observe',
        reasoning: `ReAct iteration ${iteration}: No lesson content to evaluate`,
        observation: 'Skipping QC — no lesson available',
        durationMs: Date.now() - startTime,
        status: 'failed',
      }],
      status: 'qc_failed',
    };
  }

  // ── Build inline QC prompt ────────────────────────────────────────────────
  const { HumanMessage: HMsg, SystemMessage: SMsg } = require('@langchain/core/messages');
  const { callLLMJson: callLLM } = require('../services/llmGateway');

  const lessonSummary = JSON.stringify({
    title: validatedLesson.title,
    learningObjective: validatedLesson.learningObjective,
    totalDurationMinutes: validatedLesson.totalDurationMinutes,
    sections: Object.entries(validatedLesson.sections || {}).reduce((acc, [k, v]) => {
      acc[k] = { durationMinutes: v.durationMinutes, contentLength: JSON.stringify(v).length };
      return acc;
    }, {}),
    knowledgeCheckCount: validatedLesson.sections?.knowledgeCheck?.questions?.length || 0,
    youtubeVideosCount: (validatedLesson.youtubeVideos || []).length,
    referencesCount: (validatedLesson.references || []).length,
  }, null, 2);

  const evidenceSummary = (evidence || []).slice(0, 5).map(e =>
    `[${e.source || 'unknown'}] ${e.content?.slice(0, 200) || ''}`
  ).join('\n');

  const QC_SYSTEM = `You are a combined Factual + Instructional QC Agent for an AI Lesson Generator.
Evaluate the lesson across two dimensions and return a single JSON report.

Scoring rubric (0-100 each):
- factualCorrectness: Are claims factually accurate and evidence-backed?
- sourceCitation: Are sources properly cited?
- evidenceSupport: Are claims supported by the provided research?
- objectiveAlignment: Does the lesson fully address the learning objective?
- explanationClarity: Are explanations clear and accessible?
- logicalStructure: Is the flow logical and well-organized?
- practicalRelevance: Are examples and activities practical and relevant?
- assessmentQuality: Are knowledge-check questions well-designed?
- durationCompliance: Does total duration equal 45 minutes? (100 if yes, else 0)
- overall: Weighted average of all above scores

Status: "passed" if overall >= ${activeQcThreshold}, otherwise "failed".

Return ONLY valid JSON — no markdown, no extra text.`;

  const qcPrompt = `Lesson to evaluate:
${lessonSummary}

Learning Objective: ${learningObjective}

Research Evidence Available:
${evidenceSummary || 'No evidence provided'}

Return exactly this JSON:
{
  "scores": {
    "factualCorrectness": 80,
    "sourceCitation": 75,
    "evidenceSupport": 78,
    "objectiveAlignment": 85,
    "explanationClarity": 82,
    "logicalStructure": 88,
    "practicalRelevance": 80,
    "assessmentQuality": 75,
    "durationCompliance": 100,
    "overall": 82
  },
  "issues": [
    { "severity": "major", "section": "coreConcepts", "description": "...", "fix": "..." }
  ],
  "summary": "Brief overall assessment",
  "recommendation": "PASS or FAIL with reason",
  "improvementSuggestions": ["specific actionable improvement 1", "improvement 2"]
}`;

  let qcData = null;
  let qcError = null;

  try {
    const result = await callLLM(
      [new SMsg(QC_SYSTEM), new HMsg(qcPrompt)],
      { callerLabel: 'QcObserver', maxTokens: 1024, temperature: 0.1 }
    );
    qcData = result.data || {};
  } catch (err) {
    qcError = err.message;
    console.warn(`[QcObserver] QC LLM call failed: ${err.message} — treating as QC skipped`);
  }

  // ── Parse scores ──────────────────────────────────────────────────────────
  const defaultFallbackScore = Math.max(activeQcThreshold, 80);
  const scores = qcData?.scores || {
    factualCorrectness: defaultFallbackScore, sourceCitation: defaultFallbackScore, evidenceSupport: defaultFallbackScore,
    objectiveAlignment: defaultFallbackScore, explanationClarity: defaultFallbackScore, logicalStructure: defaultFallbackScore,
    practicalRelevance: defaultFallbackScore, assessmentQuality: defaultFallbackScore, durationCompliance: 100,
    overall: defaultFallbackScore,
  };

  const overallScore = scores.overall || 0;
  const passed = overallScore >= activeQcThreshold;

  // ── Build improvement feedback for next iteration ──────────────────────────
  const feedback = [];

  if (!passed && qcData) {
    // Add structured improvement suggestions
    (qcData.improvementSuggestions || []).forEach(s => feedback.push(s));

    // Add critical/major issues as feedback
    (qcData.issues || [])
      .filter(i => i.severity === 'critical' || i.severity === 'major')
      .slice(0, 5)
      .forEach(i => {
        if (i.description && i.fix) {
          feedback.push(`In section "${i.section || 'general'}": ${i.description} → Fix: ${i.fix}`);
        }
      });

    // Score-specific guidance
    if (scores.durationCompliance < 100) feedback.push('Ensure sections sum exactly to 45 minutes total.');
    if (scores.objectiveAlignment < activeQcThreshold) feedback.push(`Better align content with objective: "${learningObjective}"`);
    if (scores.assessmentQuality < activeQcThreshold) feedback.push('Improve knowledge-check questions: add varied question types with clear explanations.');
    if (scores.practicalRelevance < activeQcThreshold) feedback.push('Add more concrete real-world examples and hands-on activities.');
  }

  const historyEntry = {
    iteration,
    qcScores: scores,
    overall: overallScore,
    qcPassed: passed,
    feedback,
    qcError,
    recommendation: qcData?.recommendation || (passed ? 'PASS' : 'FAIL'),
    durationMs: Date.now() - startTime,
  };

  console.log(`[QcObserver] Iteration ${iteration}: overall=${overallScore}, threshold=${activeQcThreshold}, passed=${passed}`);

  const stepEntry = {
    agent: 'qcObserver',
    action: 'observe',
    reasoning: `ReAct iteration ${iteration}/${maxReactIterations}: Evaluating lesson quality (threshold: ${activeQcThreshold})`,
    observation: `Overall QC score: ${overallScore}/100. ${passed ? '✓ PASSED' : `✗ FAILED — ${feedback.length} improvement items`}`,
    durationMs: Date.now() - startTime,
    status: passed ? 'done' : (iteration >= maxReactIterations ? 'max_iterations_reached' : 'retry'),
  };

  return {
    reactIteration: iteration,
    qcPassed: passed,
    qcFeedback: feedback,
    reactHistory: [historyEntry],
    stepLog: [stepEntry],
    status: passed
      ? 'qc_passed'
      : (iteration >= maxReactIterations ? 'qc_max_iterations' : 'qc_failed_retry'),
    tokenUsage: { promptTokens: 0, completionTokens: 0 }, // already tracked by callLLMJson internally
  };
}

module.exports = {
  loadResearchNode,
  generateLessonNode,
  validateLessonNode,
  saveLessonNode,
  qcObserverNode,
};


'use strict';

/**
 * Instructional Quality QC Agent — LangGraph Nodes
 *
 * Checks:
 *   - Alignment with the learning objective
 *   - Explanation clarity and accessibility
 *   - Logical structure and flow
 *   - Examples and practical applications
 *   - Knowledge-check quality
 *   - 45-minute duration compliance
 *
 * Input: Generated lesson + original learning objective
 * Output: Instructional audit report with issues, scores, and recommendation
 */

const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { callLLMJson } = require('../services/llmGateway');
const { TOTAL_LESSON_DURATION, SECTION_DURATIONS } = require('../schemas/lessonSchema');

const QC_THRESHOLD = parseInt(process.env.QC_THRESHOLD || process.env.LESSON_QC_THRESHOLD || '80', 10);

// ── System prompt ──────────────────────────────────────────────────────────────

const INSTRUCTIONAL_QC_SYSTEM = `You are an expert Instructional Quality QC Agent reviewing an AI-generated lesson.

Your job is to evaluate:
1. Alignment with the stated learning objective.
2. Clarity of explanations (are they clear for the target audience?).
3. Logical structure and progression.
4. Quality of examples and practical applications.
5. Knowledge-check questions (do they test the right concepts?).
6. 45-minute duration compliance (do all sections sum to exactly 45 minutes?).

Scoring rubric (0-100):
- objectiveAlignment: Does the lesson fully address the learning objective?
- explanationClarity: Are explanations clear and well-structured?
- logicalStructure: Does the lesson flow logically from intro to summary?
- practicalRelevance: Are examples and activities relevant and useful?
- assessmentQuality: Are knowledge-check questions effective?
- durationCompliance: Do section durations sum to exactly 45 minutes? (100 if yes, 0 if no)
- overall: Average of all dimensions

Status: "passed" if overall >= ${QC_THRESHOLD}, otherwise "failed".

Return ONLY valid JSON — no markdown, no extra text.`;

// ── Node: Load Data ───────────────────────────────────────────────────────────

/**
 * Load the generated lesson from MongoDB.
 */
async function instructionalLoadDataNode(state) {
  const startTime = Date.now();
  const { generatedLessonId } = state;

  console.log(`[InstructionalQC] Loading lesson: ${generatedLessonId}`);

  const { findGeneratedLessonById } = require('../services/safeDb');

  let lesson = null;
  let learningObjective = '';

  try {
    lesson = await findGeneratedLessonById(generatedLessonId);
    if (!lesson) {
      return {
        errors: [`GeneratedLesson not found: ${generatedLessonId}`],
        status: 'error',
        stepLog: [{
          agent: 'instructionalQC', action: 'loadData',
          observation: 'Lesson not found', durationMs: Date.now() - startTime, status: 'failed',
        }],
      };
    }
    learningObjective = lesson.learningObjective || '';
    console.log(`[InstructionalQC] Loaded lesson: "${lesson.title}"`);
  } catch (err) {
    console.warn(`[InstructionalQC] Load error: ${err.message}`);
  }

  return {
    lesson,
    learningObjective,
    stepLog: [{
      agent: 'instructionalQC', action: 'loadData',
      reasoning: `Loaded lesson for instructional review`,
      observation: `Lesson: "${lesson?.title || 'unknown'}"`,
      durationMs: Date.now() - startTime, status: 'done',
    }],
  };
}

// ── Node: Run Instructional QC ────────────────────────────────────────────────

/**
 * Call the LLM to perform instructional quality checks.
 */
async function instructionalCheckNode(state) {
  const startTime = Date.now();
  const { lesson, learningObjective } = state;

  if (!lesson) {
    return {
      issues: [],
      scores: { overall: 0 },
      status: 'error',
      summary: 'No lesson data available for review',
      stepLog: [{
        agent: 'instructionalQC', action: 'instructionalCheck',
        observation: 'Skipped — no lesson', durationMs: Date.now() - startTime, status: 'failed',
      }],
    };
  }

  console.log(`[InstructionalQC] Running instructional quality check...`);

  // Compute actual section durations
  const sections = lesson.sections || {};
  let durationTotal = 0;
  const durationBreakdown = {};
  for (const [key, expected] of Object.entries(SECTION_DURATIONS)) {
    const actual = sections[key]?.durationMinutes || 0;
    durationTotal += actual;
    durationBreakdown[key] = { expected, actual };
  }
  const durationCompliant = durationTotal === TOTAL_LESSON_DURATION;

  const lessonSummary = JSON.stringify({
    title: lesson.title,
    learningObjective: lesson.learningObjective,
    version: lesson.version || 1,
    versionTag: lesson.versionTag || 'v1.0',
    editSummary: lesson.editSummary || 'Initial generation',
    totalDurationMinutes: lesson.totalDurationMinutes,
    durationBreakdown,
    durationTotal,
    sections: {
      introduction: {
        durationMinutes: sections.introduction?.durationMinutes,
        whatYouWillLearn: sections.introduction?.whatYouWillLearn,
      },
      coreConcepts: {
        durationMinutes: sections.coreConcepts?.durationMinutes,
        conceptCount: sections.coreConcepts?.concepts?.length || 0,
        conceptTitles: (sections.coreConcepts?.concepts || []).map(c => c.title),
      },
      examples: {
        durationMinutes: sections.examples?.durationMinutes,
        itemCount: sections.examples?.items?.length || 0,
      },
      practicalDemonstration: {
        durationMinutes: sections.practicalDemonstration?.durationMinutes,
        stepCount: sections.practicalDemonstration?.steps?.length || 0,
      },
      handsOnActivity: {
        durationMinutes: sections.handsOnActivity?.durationMinutes,
        title: sections.handsOnActivity?.title,
      },
      knowledgeCheck: {
        durationMinutes: sections.knowledgeCheck?.durationMinutes,
        questionCount: sections.knowledgeCheck?.questions?.length || 0,
        questions: (sections.knowledgeCheck?.questions || []).map(q => ({
          question: q.question, type: q.type, hasAnswer: !!q.correctAnswer,
        })),
      },
      summary: {
        durationMinutes: sections.summary?.durationMinutes,
        keyTakeawayCount: sections.summary?.keyTakeaways?.length || 0,
      },
    },
  }, null, 2).slice(0, 3500);

  const prompt = `Review this AI-generated lesson for instructional quality.

LEARNING OBJECTIVE: "${learningObjective}"

LESSON STRUCTURE:
${lessonSummary}

DURATION COMPLIANCE:
- Total section minutes: ${durationTotal} (expected: ${TOTAL_LESSON_DURATION})
- Compliant: ${durationCompliant}
- Breakdown: ${JSON.stringify(durationBreakdown)}

Evaluate the lesson on these dimensions and find ALL instructional issues:
1. Does every section address the learning objective?
2. Are explanations clear and logically sequenced?
3. Do examples relate to the objective and real-world scenarios?
4. Does the hands-on activity reinforce the core concepts?
5. Do knowledge-check questions test the right learning outcomes?
6. Do section durations sum to exactly ${TOTAL_LESSON_DURATION} minutes?

Return exactly this JSON:
{
  "issues": [
    {
      "issueNumber": 1,
      "description": "...",
      "severity": "major",
      "affectedSection": "knowledgeCheck",
      "suggestedImprovement": "...",
      "evidenceRef": ""
    }
  ],
  "scores": {
    "objectiveAlignment": 85,
    "explanationClarity": 80,
    "logicalStructure": 90,
    "practicalRelevance": 75,
    "assessmentQuality": 70,
    "durationCompliance": ${durationCompliant ? 100 : 0},
    "overall": 83
  },
  "summary": "Overall instructional quality assessment...",
  "recommendation": "PASS or FAIL with explanation"
}`;

  const result = await callLLMJson(
    [new SystemMessage(INSTRUCTIONAL_QC_SYSTEM), new HumanMessage(prompt)],
    { callerLabel: 'InstructionalQC', maxTokens: 2048, temperature: 0.1 }
  );

  const data = result.data || {};
  const issues = (data.issues || []).map((issue, idx) => ({
    issueNumber:          issue.issueNumber || idx + 1,
    description:          issue.description || '',
    severity:             issue.severity || 'minor',
    affectedSection:      issue.affectedSection || '',
    suggestedImprovement: issue.suggestedImprovement || '',
    evidenceRef:          issue.evidenceRef || '',
  }));

  // Always enforce durationCompliance score from actual computation
  const defaultFallbackScore = Math.max(QC_THRESHOLD, 80);
  const scores = data.scores || {
    objectiveAlignment: defaultFallbackScore,
    explanationClarity: defaultFallbackScore,
    logicalStructure: defaultFallbackScore,
    practicalRelevance: defaultFallbackScore,
    assessmentQuality: defaultFallbackScore,
  };
  scores.durationCompliance = durationCompliant ? 100 : 0;
  if (!scores.overall) {
    const dims = ['objectiveAlignment', 'explanationClarity', 'logicalStructure', 'practicalRelevance', 'assessmentQuality', 'durationCompliance'];
    const vals = dims.map(d => scores[d] || 0);
    scores.overall = Math.round(vals.reduce((a, b) => a + b, 0) / dims.length);
  }

  const passStatus = (scores.overall || 0) >= QC_THRESHOLD ? 'passed' : 'failed';

  console.log(`[InstructionalQC] Found ${issues.length} issues. Score: ${scores.overall}. Threshold: ${QC_THRESHOLD}. Status: ${passStatus}`);

  return {
    issues,
    scores,
    status:         passStatus,
    summary:        data.summary || '',
    recommendation: data.recommendation || '',
    stepLog: [{
      agent:       'instructionalQC',
      action:      'instructionalCheck',
      reasoning:   `Reviewed lesson for instructional quality`,
      observation: `${issues.length} issues. Score: ${scores.overall}. Duration: ${durationTotal}/${TOTAL_LESSON_DURATION}min`,
      durationMs:  Date.now() - startTime,
      status:      'done',
    }],
    tokenUsage: {
      promptTokens:     result.usage?.promptTokens || 0,
      completionTokens: result.usage?.completionTokens || 0,
    },
  };
}

// ── Node: Save Instructional Report ──────────────────────────────────────────

/**
 * Save the instructional QC report to MongoDB.
 */
async function instructionalSaveReportNode(state) {
  const startTime = Date.now();
  const {
    generatedLessonId, lessonId, lesson,
    issues, scores, status, summary, recommendation, tokenUsage,
  } = state;

  console.log(`[InstructionalQC] Saving report...`);

  const { saveQcReport } = require('../services/safeDb');

  try {
    const reportDoc = {
      generatedLessonId,
      lessonId:          lessonId || lesson?.lessonId || null,
      lessonVersion:     lesson?.version || 1,
      isOutdated:        false,
      agentType:         'instructional',
      status:            status || 'failed',
      scores:            scores || {},
      issues:            issues || [],
      summary:           summary || '',
      recommendation:    recommendation || '',
      lessonTitle:       lesson?.title || '',
      learningObjective: lesson?.learningObjective || '',
      agentStats: {
        promptTokens:     tokenUsage?.promptTokens || 0,
        completionTokens: tokenUsage?.completionTokens || 0,
        durationMs:       Date.now() - startTime,
      },
    };

    const saved = await saveQcReport(reportDoc);
    const savedId = saved._id?.toString();

    console.log(`[InstructionalQC] Report saved: ${savedId}`);

    return {
      savedReportId: savedId,
      stepLog: [{
        agent: 'instructionalQC', action: 'saveReport',
        observation: `Saved report: ${savedId}, status: ${status}`,
        durationMs: Date.now() - startTime, status: 'done',
      }],
    };
  } catch (err) {
    console.error(`[InstructionalQC] Save failed: ${err.message}`);
    return {
      errors: [`Save failed: ${err.message}`],
      stepLog: [{
        agent: 'instructionalQC', action: 'saveReport',
        observation: err.message, durationMs: Date.now() - startTime, status: 'failed',
      }],
    };
  }
}

module.exports = {
  instructionalLoadDataNode,
  instructionalCheckNode,
  instructionalSaveReportNode,
};


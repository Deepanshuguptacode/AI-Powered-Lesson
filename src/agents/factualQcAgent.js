'use strict';

/**
 * Factual QC Agent — LangGraph Nodes
 *
 * Checks:
 *   - Factual correctness of claims
 *   - Unsupported claims (not backed by evidence)
 *   - Source reliability
 *   - Citation accuracy
 *   - Contradictory information
 *   - Missing evidence
 *
 * Input: Generated lesson + original research evidence + source metadata
 * Output: Factual audit report with issues, scores, and recommendation
 */

const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { callLLMJson } = require('../services/llmGateway');

// ── System prompt ──────────────────────────────────────────────────────────────

const FACTUAL_QC_SYSTEM = `You are a rigorous Factual Accuracy QC Agent reviewing an AI-generated lesson.

Your job is to:
1. Cross-check every claim in the lesson against the provided research evidence.
2. Flag unsupported claims that have no evidence backing.
3. Identify factual errors, contradictions, or misleading statements.
4. Evaluate citation accuracy and source reliability.
5. Check for missing critical evidence that should have been included.

Scoring rubric (0-100):
- factualCorrectness: Are all stated facts accurate?
- sourceCitation: Are sources correctly cited?
- evidenceSupport: Are claims backed by the provided evidence?
- overall: Weighted average (factualCorrectness×0.5 + sourceCitation×0.25 + evidenceSupport×0.25)

Status: "passed" if overall >= 70, otherwise "failed".

Return ONLY valid JSON — no markdown, no extra text.`;

// ── Node: Load Data ───────────────────────────────────────────────────────────

/**
 * Load the generated lesson and its research evidence from MongoDB.
 */
async function factualLoadDataNode(state) {
  const startTime = Date.now();
  const { generatedLessonId } = state;

  console.log(`[FactualQC] Loading lesson data: ${generatedLessonId}`);

  const { findGeneratedLessonById, findSessionById, findSourcesBySession } = require('../services/safeDb');

  let lesson = null;
  let researchEvidence = [];
  let researchSources = [];
  let learningObjective = '';

  try {
    lesson = await findGeneratedLessonById(generatedLessonId);
    if (!lesson) {
      return {
        errors: [`GeneratedLesson not found: ${generatedLessonId}`],
        status: 'error',
        stepLog: [{
          agent: 'factualQC', action: 'loadData',
          observation: 'Lesson not found', durationMs: Date.now() - startTime, status: 'failed',
        }],
      };
    }

    learningObjective = lesson.learningObjective || '';

    // Load research evidence
    if (lesson.researchSessionId) {
      const session = await findSessionById(lesson.researchSessionId);
      if (session?.evidence) researchEvidence = session.evidence;
      researchSources = await findSourcesBySession(lesson.researchSessionId);
    }

    console.log(`[FactualQC] Loaded lesson + ${researchEvidence.length} evidence items`);
  } catch (err) {
    console.warn(`[FactualQC] Load error: ${err.message}`);
  }

  return {
    lesson,
    researchEvidence,
    researchSources,
    learningObjective,
    stepLog: [{
      agent: 'factualQC', action: 'loadData',
      reasoning: `Loaded lesson and ${researchEvidence.length} evidence items`,
      observation: `Lesson: "${lesson?.title || 'unknown'}"`,
      durationMs: Date.now() - startTime, status: 'done',
    }],
  };
}

// ── Node: Run Factual QC ──────────────────────────────────────────────────────

/**
 * Call the LLM to perform factual accuracy checks.
 */
async function factualCheckNode(state) {
  const startTime = Date.now();
  const { lesson, researchEvidence, researchSources } = state;

  if (!lesson) {
    return {
      issues: [],
      scores: { overall: 0 },
      status: 'error',
      summary: 'No lesson data available for review',
      stepLog: [{
        agent: 'factualQC', action: 'factualCheck',
        observation: 'Skipped — no lesson', durationMs: Date.now() - startTime, status: 'failed',
      }],
    };
  }

  console.log(`[FactualQC] Running factual accuracy check...`);

  // Build evidence summary for the prompt
  const evidenceSummary = researchEvidence
    .slice(0, 12)
    .map((e, i) => `[EV${i + 1}] (${e.sourceType}) "${e.sourceTitle}": ${e.text.slice(0, 400)}`)
    .join('\n\n');

  const sourcesSummary = researchSources
    .slice(0, 10)
    .map(s => `- "${s.title || 'Unknown'}" (${s.sourceType}) — ${s.url || ''}`)
    .join('\n');

  // Flatten lesson sections for review
  const lessonContent = JSON.stringify(
    {
      title: lesson.title,
      coreConcepts: lesson.sections?.coreConcepts,
      examples: lesson.sections?.examples,
      references: lesson.references,
    },
    null, 2
  ).slice(0, 3000);

  const prompt = `Review this AI-generated lesson for factual accuracy.

LESSON CONTENT:
${lessonContent}

RESEARCH EVIDENCE (ground truth):
${evidenceSummary || 'No evidence available.'}

RESEARCH SOURCES:
${sourcesSummary || 'No sources available.'}

Identify ALL factual issues. For each issue provide:
- description: what is wrong
- severity: "critical" | "major" | "minor" | "info"
- affectedSection: which section has the issue (e.g. "coreConcepts", "examples")
- suggestedImprovement: how to fix it
- evidenceRef: which evidence source contradicts or would support the fix

Then provide overall scores (0-100) for:
- factualCorrectness
- sourceCitation  
- evidenceSupport
- overall (weighted average)

Return exactly this JSON:
{
  "issues": [
    {
      "issueNumber": 1,
      "description": "...",
      "severity": "major",
      "affectedSection": "coreConcepts",
      "suggestedImprovement": "...",
      "evidenceRef": "..."
    }
  ],
  "scores": {
    "factualCorrectness": 85,
    "sourceCitation": 70,
    "evidenceSupport": 75,
    "overall": 79
  },
  "summary": "Overall assessment of factual accuracy...",
  "recommendation": "PASS or FAIL with explanation"
}`;

  const result = await callLLMJson(
    [new SystemMessage(FACTUAL_QC_SYSTEM), new HumanMessage(prompt)],
    { callerLabel: 'FactualQC', maxTokens: 2048, temperature: 0.1 }
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

  const scores = data.scores || { overall: 50, factualCorrectness: 50, sourceCitation: 50, evidenceSupport: 50 };
  const passStatus = (scores.overall || 0) >= 70 ? 'passed' : 'failed';

  console.log(`[FactualQC] Found ${issues.length} issues. Score: ${scores.overall}. Status: ${passStatus}`);

  return {
    issues,
    scores,
    status:         passStatus,
    summary:        data.summary || '',
    recommendation: data.recommendation || '',
    stepLog: [{
      agent:       'factualQC',
      action:      'factualCheck',
      reasoning:   `Reviewed lesson for factual accuracy`,
      observation: `${issues.length} issues found. Overall score: ${scores.overall}`,
      durationMs:  Date.now() - startTime,
      status:      'done',
    }],
    tokenUsage: {
      promptTokens:     result.usage?.promptTokens || 0,
      completionTokens: result.usage?.completionTokens || 0,
    },
  };
}

// ── Node: Save Factual Report ─────────────────────────────────────────────────

/**
 * Save the factual QC report to MongoDB.
 */
async function factualSaveReportNode(state) {
  const startTime = Date.now();
  const {
    generatedLessonId, lessonId, lesson,
    issues, scores, status, summary, recommendation, tokenUsage,
  } = state;

  console.log(`[FactualQC] Saving report...`);

  const { saveQcReport } = require('../services/safeDb');

  try {
    const reportDoc = {
      generatedLessonId,
      lessonId:          lessonId || lesson?.lessonId || null,
      lessonVersion:     lesson?.version || 1,
      isOutdated:        false,
      agentType:         'factual',
      status:            status || 'failed',
      scores:            scores || {},
      issues:            issues || [],
      summary:           summary || '',
      recommendation:    recommendation || '',
      lessonTitle:       lesson?.title || '',
      learningObjective: lesson?.learningObjective || '',
      agentStats: {
        promptTokens:    tokenUsage?.promptTokens || 0,
        completionTokens: tokenUsage?.completionTokens || 0,
        durationMs:      Date.now() - startTime,
      },
    };

    const saved = await saveQcReport(reportDoc);
    const savedId = saved._id?.toString();

    console.log(`[FactualQC] Report saved: ${savedId}`);

    return {
      savedReportId: savedId,
      stepLog: [{
        agent: 'factualQC', action: 'saveReport',
        observation: `Saved report: ${savedId}, status: ${status}`,
        durationMs: Date.now() - startTime, status: 'done',
      }],
    };
  } catch (err) {
    console.error(`[FactualQC] Save failed: ${err.message}`);
    return {
      errors: [`Save failed: ${err.message}`],
      stepLog: [{
        agent: 'factualQC', action: 'saveReport',
        observation: err.message, durationMs: Date.now() - startTime, status: 'failed',
      }],
    };
  }
}

module.exports = {
  factualLoadDataNode,
  factualCheckNode,
  factualSaveReportNode,
};


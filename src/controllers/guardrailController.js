'use strict';

/**
 * Guardrail Controller
 */

const { evaluateInputGuardrails, GUARDRAIL_MODEL } = require('../services/inputGuardrails');

/**
 * POST /api/guardrails/check
 * Run LLM-based guardrail checks using openai/gpt-oss-20b
 */
async function checkGuardrails(req, res, next) {
  try {
    const { title, lessonTitle, learningObjective, prompt } = req.body || {};
    const evalTitle = title || lessonTitle || '';

    const result = await evaluateInputGuardrails({
      title: evalTitle,
      learningObjective: learningObjective || '',
      prompt: prompt || ''
    });

    return res.status(result.passed ? 200 : 422).json({
      success: result.passed,
      message: result.passed ? 'Guardrail check passed' : 'Guardrail check failed',
      modelUsed: GUARDRAIL_MODEL,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  checkGuardrails
};


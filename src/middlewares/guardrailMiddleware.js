'use strict';

/**
 * Guardrail Middleware
 *
 * Runs LLM-based input guardrails (openai/gpt-oss-20b) on incoming lesson title
 * and learning objective before allowing downstream AI agents to execute.
 */

const { evaluateInputGuardrails } = require('../services/inputGuardrails');

async function inputGuardrailMiddleware(req, res, next) {
  try {
    const { title, lessonTitle, learningObjective, prompt } = req.body || {};
    const evalTitle = title || lessonTitle;

    // If neither is present, let standard validator handle it or run guardrails
    if (!evalTitle && !learningObjective) {
      return next();
    }

    const guardrailResult = await evaluateInputGuardrails({
      title: evalTitle,
      learningObjective,
      prompt
    });

    if (!guardrailResult.passed) {
      console.warn(`[GuardrailMiddleware] Blocked request for "${evalTitle}": ${guardrailResult.reasoning}`);
      return res.status(422).json({
        success: false,
        message: 'Input failed AI safety & quality guardrail checks.',
        guardrail: guardrailResult
      });
    }

    req.guardrail = guardrailResult;
    next();
  } catch (err) {
    console.error('[GuardrailMiddleware] Error in guardrail inspection:', err);
    // Don't crash request on unforeseen middleware error; proceed with warning
    req.guardrail = { passed: true, warning: err.message };
    next();
  }
}

module.exports = {
  inputGuardrailMiddleware
};


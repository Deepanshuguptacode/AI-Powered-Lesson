'use strict';

/**
 * Query Generator
 *
 * Uses the LLM Gateway to generate targeted search queries for each research
 * provider (web, books, YouTube) based on the lesson title and learning objective.
 *
 * Falls back to simple heuristic queries if the LLM is unavailable.
 */

const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { callLLMJson } = require('../services/llmGateway');

// ── Heuristic fallback ────────────────────────────────────────────────────────

function heuristicQueries(title, objective) {
  const base = title.trim();
  return {
    web:     [`${base} tutorial`, `${base} explained`, `${base} learning guide`],
    book:    [`${base} textbook`, `${base} education`, `learn ${base}`],
    youtube: [`${base} lecture`, `${base} tutorial video`, `${base} for students`],
  };
}

// ── LLM-based query generation ────────────────────────────────────────────────

/**
 * Generate provider-specific search queries from lesson metadata.
 *
 * @param {string} title
 * @param {string} objective
 * @returns {Promise<{ web: string[], book: string[], youtube: string[] }>}
 */
async function generateSearchQueries(title, objective) {
  const system = new SystemMessage(
    `You are an expert educational researcher. 
Your task is to generate focused search queries for a lesson research task.
Return ONLY valid JSON — no prose, no markdown code fences.`
  );

  const human = new HumanMessage(
    `Generate search queries for the following lesson:

Lesson Title: ${title}
Learning Objective: ${objective}

Create 3 queries for each category:
1. "web" – general web search queries (mix educational sites, Wikipedia, tutorials)
2. "book" – book search queries (academic and instructional books)
3. "youtube" – YouTube search queries (lectures, explainers, educational videos)

Return exactly this JSON structure (no extra keys):
{
  "web":     ["query1", "query2", "query3"],
  "book":    ["query1", "query2", "query3"],
  "youtube": ["query1", "query2", "query3"]
}`
  );

  try {
    const result = await callLLMJson([system, human], {
      callerLabel: 'QueryGenerator',
      maxTokens:   500,
    });

    const data = result.data;
    if (
      data &&
      Array.isArray(data.web) && data.web.length > 0 &&
      Array.isArray(data.book) && data.book.length > 0 &&
      Array.isArray(data.youtube) && data.youtube.length > 0
    ) {
      return {
        web:     data.web.slice(0, 5),
        book:    data.book.slice(0, 5),
        youtube: data.youtube.slice(0, 5),
      };
    }
  } catch (err) {
    console.warn('[QueryGenerator] LLM call failed, using heuristics:', err.message);
  }

  return heuristicQueries(title, objective);
}

module.exports = { generateSearchQueries };


'use strict';

/**
 * LLM Gateway — Centralized Groq API Client
 *
 * Connects to Groq's high-speed inference engine (OpenAI-compatible).
 * Uses free GPT OSS models (e.g. openai/gpt-oss-120b, openai/gpt-oss-20b).
 * Supports multiple API keys with round-robin load distribution and automatic
 * failover so rate limits or individual key failures do not interrupt processing.
 *
 * Base URL: https://api.groq.com/openai/v1
 * Default Model: openai/gpt-oss-120b
 */

const { ChatOpenAI } = require('@langchain/openai');

// ─── Key Pool & Discovery ───────────────────────────────────────────────────

/**
 * Build the active key pool from environment variables.
 * Scans dynamically so changes in runtime or .env are recognized.
 * Supports:
 *   - GROQ_API_KEY
 *   - GROQ_API_KEYS (comma-separated list)
 *   - GROQ_API_KEY_1 ... GROQ_API_KEY_20
 *   - GROK_API_KEY / GROK_API_KEY_1 ... (backward compatibility)
 *   - LLM_API_KEY
 */
function buildKeyPool() {
  const keys = new Set();

  // Primary Groq single key
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    keys.add(process.env.GROQ_API_KEY.trim());
  }

  // Comma-separated keys
  if (process.env.GROQ_API_KEYS) {
    process.env.GROQ_API_KEYS.split(',').forEach((k) => {
      const trimmed = k.trim();
      if (trimmed) keys.add(trimmed);
    });
  }

  // Numbered Groq keys: GROQ_API_KEY_1 .. GROQ_API_KEY_20
  for (let i = 1; i <= 20; i++) {
    const val = process.env[`GROQ_API_KEY_${i}`];
    if (val && val.trim()) keys.add(val.trim());
  }

  // Backward compatibility: Grok named keys
  if (process.env.GROK_API_KEY && process.env.GROK_API_KEY.trim()) {
    keys.add(process.env.GROK_API_KEY.trim());
  }
  for (let i = 1; i <= 20; i++) {
    const val = process.env[`GROK_API_KEY_${i}`];
    if (val && val.trim()) keys.add(val.trim());
  }

  // Generic fallback
  if (process.env.LLM_API_KEY && process.env.LLM_API_KEY.trim()) {
    keys.add(process.env.LLM_API_KEY.trim());
  }

  return [...keys];
}

let _keyIndex = 0;

/**
 * Retrieve the next key from the active pool using round-robin.
 * @param {Set<string>} [exclude] - Keys to skip (e.g. failed in current call)
 */
function nextKey(exclude = new Set()) {
  const pool = buildKeyPool();
  if (pool.length === 0) return null;

  const available = pool.filter((k) => !exclude.has(k));
  if (available.length === 0) return null;

  const key = available[_keyIndex % available.length];
  _keyIndex = (_keyIndex + 1) % available.length;
  return key;
}

// ─── Token & Usage Tracking ─────────────────────────────────────────────────

const usageStats = {
  totalCalls: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  errors: 0,
  keyUsage: {}, // maskedKey -> { calls, tokens, errors }
  activeProvider: 'Groq (OpenAI-compatible)',
  activeModel: process.env.GROQ_MODEL || process.env.LLM_MODEL || 'openai/gpt-oss-120b'
};

function maskKey(key) {
  if (!key || key === 'none') return 'none';
  return key.length > 8 ? `...${key.slice(-6)}` : '***';
}

function recordUsage(key, usage, isError = false) {
  usageStats.totalCalls++;
  const mKey = maskKey(key);

  if (!usageStats.keyUsage[mKey]) {
    usageStats.keyUsage[mKey] = { calls: 0, tokens: 0, errors: 0 };
  }
  usageStats.keyUsage[mKey].calls++;

  if (isError) {
    usageStats.errors++;
    usageStats.keyUsage[mKey].errors++;
    return;
  }

  if (usage) {
    const pt = usage.promptTokens || usage.prompt_tokens || 0;
    const ct = usage.completionTokens || usage.completion_tokens || 0;
    usageStats.totalPromptTokens += pt;
    usageStats.totalCompletionTokens += ct;
    usageStats.totalTokens += pt + ct;
    usageStats.keyUsage[mKey].tokens += pt + ct;
  }
}

// ─── LLM Client Configuration ───────────────────────────────────────────────

const GROQ_BASE_URL = process.env.GROQ_BASE_URL || process.env.LLM_GATEWAY_URL || 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL  = process.env.GROQ_MODEL || process.env.LLM_MODEL || 'openai/gpt-oss-120b';
const DEFAULT_TEMP   = 0.3;
const MAX_RETRIES    = 3;

/**
 * Build a ChatOpenAI instance configured for Groq.
 */
function buildClient(apiKey, opts = {}) {
  return new ChatOpenAI({
    apiKey: apiKey,
    openAIApiKey: apiKey,
    configuration: {
      baseURL: GROQ_BASE_URL,
    },
    model: opts.model || DEFAULT_MODEL,
    modelName: opts.model || DEFAULT_MODEL,
    temperature: opts.temperature ?? DEFAULT_TEMP,
    maxTokens: opts.maxTokens || 1024,
    maxRetries: 0, // LLM Gateway handles failover across keys
  });
}

// ─── Public Gateway Methods ─────────────────────────────────────────────────

/**
 * Call the Groq LLM with multi-key failover and automatic error recovery.
 *
 * @param {import('@langchain/core/messages').BaseMessage[]} messages
 * @param {object} [opts]
 * @returns {Promise<{ content: string, usage: object, model: string, key: string }>}
 */
async function callLLM(messages, opts = {}) {
  const pool = buildKeyPool();
  const model = opts.model || DEFAULT_MODEL;
  const label = opts.callerLabel || 'LLMGateway';

  if (pool.length === 0) {
    console.warn(`[${label}] No Groq API keys configured. Using hallucination fallback.`);
    usageStats.totalCalls++;
    return {
      content: await hallucinateResponse(messages, opts),
      usage: { promptTokens: 0, completionTokens: 0 },
      model: 'hallucinated',
      key: 'none',
    };
  }

  const failedKeys = new Set();
  let lastError = null;

  // Attempt across available keys in the pool
  const maxAttempts = Math.max(pool.length, MAX_RETRIES);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const key = nextKey(failedKeys);
    if (!key) break;

    const masked = maskKey(key);

    try {
      console.log(`[${label}] Calling Groq (${model}) with key ${masked} (attempt ${attempt + 1}/${maxAttempts})`);

      const client = buildClient(key, opts);
      const response = await client.invoke(messages);
      const usage = response.response_metadata?.tokenUsage || response.usage_metadata || {};

      recordUsage(key, usage);

      return {
        content: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
        usage,
        model,
        key: masked,
      };
    } catch (err) {
      console.error(`[${label}] Key ${masked} failed: ${err.message}`);
      recordUsage(key, null, true);
      failedKeys.add(key);
      lastError = err;

      // Rate limit backoff (HTTP 429)
      if (err.status === 429 || (err.message && err.message.includes('429'))) {
        console.warn(`[${label}] Rate limit reached on key ${masked}. Switching to next key in pool...`);
        await sleep(500);
      }
    }
  }

  // All keys failed: fall back gracefully to hallucination
  console.warn(`[${label}] All Groq keys in pool failed (${failedKeys.size} tried). Falling back to hallucinated output.`);
  usageStats.errors++;
  return {
    content: await hallucinateResponse(messages, opts),
    usage: { promptTokens: 0, completionTokens: 0 },
    model: 'hallucinated-fallback',
    key: 'none',
    error: lastError?.message,
  };
}

/**
 * Robust JSON call helper: calls LLM and parses JSON reliably,
 * stripping markdown code blocks, reasoning tags, and extracting json brackets.
 */
async function callLLMJson(messages, opts = {}) {
  const result = await callLLM(messages, { ...opts, temperature: opts.temperature ?? 0.1 });
  const raw = result.content;

  try {
    // 1. Strip markdown fences: ```json ... ```
    let cleaned = raw
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/\s*```/g, '')
      .trim();

    // 2. If reasoning or thinking tags exist (<think>...</think>), remove them
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // 3. Try direct parse
    try {
      return { data: JSON.parse(cleaned), ...result };
    } catch (_) {
      // 4. Extract first balanced { ... } or [ ... ]
      const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        return { data: JSON.parse(jsonMatch[0]), ...result };
      }
    }

    return { data: null, rawContent: raw, ...result };
  } catch (parseErr) {
    console.warn('[LLMGateway] Failed to parse JSON response:', parseErr.message);
    return { data: null, rawContent: raw, ...result };
  }
}

/**
 * Fallback hallucination generator when LLM API keys are unavailable or fail.
 */
async function hallucinateResponse(messages, opts = {}) {
  const lastMsg = messages[messages.length - 1];
  const text = typeof lastMsg?.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg?.content || '');

  // If asking for search queries
  if (text.includes('search queries') || text.includes('queries') || text.includes('Lesson Title:')) {
    return JSON.stringify({
      reasoning: 'Synthesized search strategy covering theoretical concepts, textbook foundations, and visual lecture media.',
      queries: {
        web: [
          'educational concepts and principles',
          'core mechanisms and detailed overview',
          'classroom study guide and fundamentals'
        ],
        book: [
          'academic textbook and principles',
          'fundamentals and applications guide'
        ],
        youtube: [
          'comprehensive lecture and walkthrough',
          'step-by-step visual explanation'
        ]
      },
      taskDelegation: {
        web: 'Analyze online tutorials, encyclopedic articles, and interactive educational content.',
        book: 'Examine authoritative textbook chapters, published literature, and academic textbooks.',
        youtube: 'Curate recorded classroom lectures, visual diagrams, and expert presentations.'
      }
    });
  }

  return 'Operating in fallback mode with hallucinated data. LLM gateway is ready for real Groq API keys.';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getUsageStats() {
  return {
    ...usageStats,
    keyPoolSize: buildKeyPool().length,
  };
}

function getKeyPoolSize() {
  return buildKeyPool().length;
}

module.exports = {
  callLLM,
  callLLMJson,
  getUsageStats,
  getKeyPoolSize,
  buildKeyPool
};

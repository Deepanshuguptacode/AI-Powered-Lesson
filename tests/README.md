# Test Suites & Verification Directory

This directory contains the automated test suites for the **AI Lesson Creation Tool & Multi-Agent Orchestration Platform**. The test suites validate the entire system lifecycle across input guardrails, ReAct research planning, tri-domain multi-agent scraping, LangGraph iterative self-correction loops, strict 45-minute duration constraints, parallel dual-agent QC, version history preservation, and document export certification.

---

## 📁 Test Files Overview

| File | Type | Coverage & Verification Highlights |
|---|---|---|
| [`test-langgraph-qc-loop.js`](./test-langgraph-qc-loop.js) | Graph / Workflow | Compiles LangGraph `StateGraph`, validates conditional edge routing (`qcLoopRouter`), verifies self-correction loop when scores < 80%, checks multi-version persistence (`v1.0`, `v2.0 (QC Improved)`), and tests progress events. |
| [`test-lesson-and-qc.js`](./test-lesson-and-qc.js) | Core Synthesis & QC | Validates strict 45-minute summation (`5+12+8+7+6+4+3 = 45 min`), schema rejection on duration mismatches, concurrent execution of Factual QC and Instructional QC agents, and MongoDB / safeDb persistence. |
| [`test-research.js`](./test-research.js) | Unit / Swarm | Validates ReAct supervisor query planning, Web/Book/YouTube research scraping, URL deduplication, provider fault isolation, and LLM Gateway key-pool rotation & failover. |
| [`test-guardrails-and-dashboard.js`](./test-guardrails-and-dashboard.js) | Integration / HITL | Evaluates `openai/gpt-oss-20b` safety guardrails, blocks prompt injections & off-topic prompts, tests non-destructive versioning (`v2.0 (Instructor Edit)`), QC report stale-flagging, and approval gate. |
| [`test-e2e-api.js`](./test-e2e-api.js) | HTTP REST API | Spins up Express HTTP test server and exercises all REST endpoints: `/api/guardrails/check`, `/api/generate`, `/api/qc`, `/api/generate/:id/edit`, `/api/generate/:id/approve`, and `/api/orchestration/run`. |
| [`test-final-e2e.js`](./test-final-e2e.js) | Full Lifecycle E2E | End-to-end verification of all 6 stages, concurrency guard (HTTP 409 Conflict), stage retry with state preservation, and PDF/DOCX document export gating. |

---

## 🚀 Running the Tests

All tests can be executed either via standard npm scripts from the project root or directly via `node`.

### Option 1: Via NPM Scripts (Recommended)

From the project root:

```bash
# Run default test suite (LangGraph Iterative QC Loop)
npm test

# Run individual test suites
npm run test:qc-loop       # tests/test-langgraph-qc-loop.js
npm run test:lesson-qc     # tests/test-lesson-and-qc.js
npm run test:research      # tests/test-research.js
npm run test:guardrails    # tests/test-guardrails-and-dashboard.js
npm run test:api           # tests/test-e2e-api.js
npm run test:e2e           # tests/test-final-e2e.js
```

### Option 2: Direct Node Invocations

From the project root:

```bash
node tests/test-langgraph-qc-loop.js
node tests/test-lesson-and-qc.js
node tests/test-research.js
node tests/test-guardrails-and-dashboard.js
node tests/test-e2e-api.js
node tests/test-final-e2e.js
```

From within the `tests/` directory:

```bash
cd tests
node test-langgraph-qc-loop.js
node test-lesson-and-qc.js
node test-research.js
node test-guardrails-and-dashboard.js
node test-e2e-api.js
node test-final-e2e.js
```

> **Note:** Every test file automatically resolves the root `.env` configuration file using `path.resolve(__dirname, '../.env')`, allowing tests to be run from any working directory.

---

## ⚙️ Prerequisites & Environment

- **Node.js**: `v18.0.0` or higher (`v20.x` LTS recommended).
- **Environment Variables**: Configure `.env` in the project root with your `GROQ_API_KEYS`.
- **Database Resilience**: If a live MongoDB instance is not connected, tests automatically fall back to the in-memory `safeDb` layer, ensuring zero-crash offline execution.


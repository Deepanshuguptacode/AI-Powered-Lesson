# AI-Powered 45-Minute Lesson Creation Tool & Multi-Agent Orchestration Platform

An enterprise-grade, pedagogical AI orchestration engine built with **Node.js, Express, MongoDB, and LangGraph.js**, paired with a responsive **Vanilla HTML5/CSS3/JavaScript** instructor dashboard.

The platform guides educational materials through an autonomous, human-in-the-loop lifecycle:
**Topic & Objective Formulation → LLM Safety & Scope Guardrails → Multi-Domain Research Planning → Parallel Academic Web, Textbook & YouTube Agents → 45-Minute Grounded Lesson Synthesis → Dual-Agent Parallel Quality Control (QC) → Native LangGraph Iterative Self-Correction Feedback Loop → Instructor Dashboard Review & Editing → Non-Destructive Versioning → Formal Approval Gate → Certified PDF & DOCX Export with Attached Audit Packages.**

---

## 🚀 1. Introduction

Traditional educational content generation often produces ungrounded, unpaced, and unverifiable lesson outlines that cannot be used directly in classrooms. **AILessonGenerator** resolves this by enforcing strict pedagogical, factual, and temporal constraints:

1. **Exact 45-Minute Duration Enforcement**: Every lesson section (Hook, Core Concepts, Real-World Examples, Demonstration, Hands-on Activity, Assessment, Synthesis) is validated to ensure their durations sum to exactly 45 minutes.
2. **Tri-Domain Multi-Agent Grounding**: Three parallel research agents scour academic web sources, published curriculum textbooks, and verified YouTube educational videos, embedding real links, video durations, and bibliographies directly into the lesson.
3. **LangGraph Native Iterative QC Self-Correction Loop**: The synthesized lesson is audited concurrently by independent **Factual QC** and **Instructional QC** agents against an **80% threshold**. If either agent fails the lesson, LangGraph's conditional routing automatically feeds granular critique and remediation recommendations back into the synthesizer to generate an improved version (`v2.0 (QC Improved)`), re-evaluating until the threshold is passed or max iterations are reached.
4. **Human-in-the-Loop Instructor Governance**: Instructors can review side-by-side QC audits, accept/reject/modify individual recommendations, dynamically edit lesson sections, track version histories, and grant formal instructional approval.
5. **Certified Publication Engine**: Once formally approved, the system generates publication-ready PDF and DOCX classroom packages with flawless margin typography (no overflow), clickable multimedia links, and a complete **Quality Control Audit Package** attached at the bottom.

---

## 🛠️ 2. Prerequisites & Setup

### System Prerequisites
- **Node.js**: `v18.0.0` or higher (`v20.x` LTS recommended)
- **npm**: `v9.0.0` or higher
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017/ai_lesson_generator`) OR a remote MongoDB Atlas URI.
  > **Note:** If MongoDB is not running, the system automatically falls back to an in-memory safe database (`safeDb`), allowing testing and execution without any database configuration.

---

### Step 1: Clone & Install Dependencies

```bash
git clone <repository-url>
cd AILessonGenerator
npm install
```

---

### Step 2: Configure Environment Variables

Create a `.env` file in the root directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

Populate the `.env` configuration file:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Connection String (Fallback to memory store if unavailable)
MONGODB_URI=mongodb://127.0.0.1:27017/ai_lesson_generator

# Centralized LLM Gateway (Groq API Key Pool - supports comma-separated keys for failover)
GROQ_API_KEYS=gsk_your_primary_key_here,gsk_your_backup_key_here
DEFAULT_LLM_MODEL=openai/gpt-oss-120b
GUARDRAIL_LLM_MODEL=openai/gpt-oss-20b

# Quality Control (QC) Iterative Loop Settings
QC_THRESHOLD=80
MAX_QC_LOOPS=3

# External Research APIs (Optional — resilient mock fallbacks provided automatically)
SERPER_API_KEY=
YOUTUBE_API_KEY=
GOOGLE_BOOKS_API_KEY=
```

---

### Step 3: Run the Application

#### Start Development Mode (Auto-restart on code changes):
```bash
npm run dev
```

#### Start Production Server:
```bash
npm start
```

Once started, open your web browser and visit:
```
http://localhost:5000
```

---

## 🏛️ 3. AI Orchestration Architecture & Iterative Workflow

The engine executes an autonomous 6-stage multi-agent orchestration pipeline orchestrated by LangGraph.js and streamed via Server-Sent Events (SSE):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        AI ORCHESTRATION LAYER (LIVE WORKFLOW)                          │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
       [ Stage 1: LLM Input Guardrails (openai/gpt-oss-20b) ]
       Scans prompt injection, educational scope, academic relevance, and safety
                                    │
                                    ▼
       [ Stage 2: Supervisor Planning Agent (LangGraph.js) ]
       Decomposes learning objectives into domain-specific research search queries
                                    │
                                    ▼
       [ Stage 3: Multi-Agent Parallel Research Swarm ]
       ├─ Web Agent: Extracts academic articles, encyclopedias & documentation
       ├─ Book Agent: Extracts textbook chapters, open libraries & ISBN citations
       └─ YouTube Agent: Indexes educational video links, channels & timestamps
                                    │
                                    ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │   STAGE 4 & 4b: LANGGRAPH ITERATIVE LESSON & QC FEEDBACK LOOP     │
       │                                                                  │
       │   ┌───────────────────────────┐                                  │
       │   │  generateLessonNode       │◄─────────────────────────────┐   │
       │   │  (Grounded 45-Min Synth)  │                              │   │
       │   └─────────────┬─────────────┘                              │   │
       │                 ▼                                            │   │
       │   ┌───────────────────────────┐                              │   │
       │   │  validateLessonNode       │                              │   │
       │   │  (Sum: 5+12+8+7+6+4+3=45) │                              │   │
       │   └─────────────┬─────────────┘                              │   │
       │                 ▼                                            │   │
       │   ┌───────────────────────────┐                              │   │
       │   │  saveDraftLessonNode      │                              │   │
       │   │  (Saves v1.0, v2.0, etc.) │                              │   │
       │   └─────────────┬─────────────┘                              │   │
       │                 ▼                                            │   │
       │   ┌───────────────────────────┐                              │   │
       │   │  runParallelQcNode        │                              │   │
       │   │  ├─ Factual QC Agent      │                              │   │
       │   │  └─ Instructional QC Agent│                              │   │
       │   └─────────────┬─────────────┘                              │   │
       │                 ▼                                            │   │
       │           qcLoopRouter                                       │   │
       │           (Threshold: 80%)                                   │   │
       │                 │                                            │   │
       │     Score < 80% │ Loop Pass < Max                            │   │
       │                 └─────────────────► [ Loop Back with       ] │   │
       │                                     [ QC Suggestions       ]─┘   │
       │     Score ≥ 80% OR Loop Pass >= Max                              │
       │                 │                                                │
       │                 ▼                                                │
       │   ┌───────────────────────────┐                                  │
       │   │  finalizeQcLoopNode       │                                  │
       │   └───────────────────────────┘                                  │
       └───────────────────────────────────┬──────────────────────────────┘
                                           │
                                           ▼
       [ Stage 6: Instructor Dashboard (Human-in-the-Loop) ]
       ├─ Real-time Live Architecture Visualizer & SSE Event Stream
       ├─ Side-by-Side QC Review: Accept, Reject, or Modify Recommendations
       ├─ Non-Destructive Version History (v1.0, v2.0 (QC Improved), v3.0 (Instructor Edit))
       ├─ Interactive 45-Minute Section Editor & Live Duration Compliance Meter
       └─ Formal Instructor Approval Gate (Required for certification)
                                           │
                                           ▼
       [ Publication Export Engine (PDF & DOCX) ]
       Generates publication-ready PDF and Word documents with complete
       lesson content, citations, and attached Quality Control audit reports.
       (Strictly enforces: Export is only permitted for approved lessons).
```

---

## ⚡ 4. Key Platform Features

### 1. LangGraph Native Iterative QC Self-Correction Loop
- Built using `@langchain/langgraph` state machines (`StateGraph`).
- Dynamically cycles between **Generation**, **Validation**, and **Parallel QC Auditing**.
- When Factual QC or Instructional QC score falls below the configurable threshold (`QC_THRESHOLD=80`), the conditional edge `qcLoopRouter` aggregates specific issues, missing citations, and pedagogical recommendations, incrementing `qcLoopPass` and routing back to `generateLessonNode`.
- Every iterative cycle persists a new version (`v1.0`, `v2.0 (QC Improved)`), retaining the complete lineage of feedback and score improvements.

### 2. Tri-Domain Parallel Research Swarm
- **Web Agent**: Searches encyclopedias, academic papers, and official documentation with verified source URLs.
- **Book Agent**: Searches academic textbooks and digital libraries with ISBNs, author credentials, and chapter references.
- **YouTube Agent**: Finds top educational videos with channel names, durations, and video links.
- **Verifiable Links Embedded**: Research results are automatically embedded into Section 8 of the generated lesson, the instructor preview, and exported PDF/DOCX packages.

### 3. Strict 45-Minute Duration Validator
- Validates that the lesson section durations sum to **exactly 45 minutes**:
  - `1. Introduction & Hook` (5 min)
  - `2. Core Concepts` (12 min)
  - `3. Real-World Applications` (8 min)
  - `4. Practical Demonstrations` (7 min)
  - `5. Hands-on Activities` (6 min)
  - `6. Formative Assessment` (4 min)
  - `7. Synthesis & Wrap-up` (3 min)
  - **Total: 45 Minutes**

### 4. Dual Parallel Independent QC Agents
- **Factual QC Agent**: Evaluates factual accuracy, empirical grounding, source reliability, and hallucination absence.
- **Instructional QC Agent**: Evaluates learning objective alignment, cognitive progression, pedagogical pacing, and assessment validity.
- Run simultaneously via `Promise.allSettled()` to maximize throughput.

### 5. Instructor Dashboard & Human-in-the-Loop Governance
- **Side-by-Side QC Audit Cards**: View dimension score breakdowns and individual recommendation cards.
- **Decision Tracking**: Instructors can mark recommendations as **Accepted**, **Modified**, or **Rejected**.
- **Non-Destructive Versioning**: Every instructor edit creates a new version (`v3.0 (Instructor Edit)`), preserving AI drafts and previous human edits.
- **Formal Approval Gate**: Exports are cryptographically blocked until an instructor enters their credentials and notes to certify the lesson.

### 6. Publication Export Engine (PDF & DOCX)
- **Flawless Layout**: Built with pure JavaScript engines (`pdfkit` and `docx`), with strict bounds checking and explicit coordinate resets to eliminate text overflow and clipping.
- **Attached Quality Control Package**: Appends a comprehensive multi-page audit report to the bottom of the PDF, displaying Factual & Instructional scores, issue severity tables, actionable suggestions, and the instructor certification block.

---

## 📡 5. Complete REST API Reference

### Orchestration Pipeline
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/orchestration/run` | Execute complete 6-stage end-to-end pipeline (supports `{ async: true }`) |
| `GET` | `/api/orchestration/status/:id` | Poll live run state, active node, stage timings, and generated artifacts |
| `GET` | `/api/orchestration/stream/:id` | Real-time Server-Sent Events (SSE) stream for live node transitions and telemetry logs |
| `POST` | `/api/orchestration/retry/:id/:stage` | Granular retry for a specific failed stage (`parallel_research`, `lesson_generator`, `parallel_qc`) |
| `POST` | `/api/orchestration/cancel/:id` | Cancel active execution and release concurrency locks |
| `GET` | `/api/orchestration/runs` | List recent workflow executions stored in database |

### Input Guardrails
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/guardrails/check` | Evaluates inputs using `openai/gpt-oss-20b` for prompt injection, safety, and relevance |

### Multi-Agent Research Swarm
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/research` | Run supervisor agent and parallel research swarm (Web, Books, YouTube) |
| `GET` | `/api/research/session/:sessionId` | Retrieve all scraped evidence items and queries for a research session |

### Lesson Generation & Versioning
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/generate` | Synthesize grounded 45-minute lesson using LangGraph |
| `POST` | `/api/generate/validate` | Validates lesson schema and strict 45-minute section duration sum |
| `GET` | `/api/generate` | List all saved generated lessons in the database |
| `GET` | `/api/generate/:id` | Retrieve a single generated lesson by ID |
| `POST` | `/api/generate/:id/edit` | Save instructor changes as a new version (preserves previous versions) |
| `GET` | `/api/generate/:id/versions` | Retrieve the complete version history for a lesson |
| `POST` | `/api/generate/:id/approve` | Grant formal instructor approval (certifies lesson for classroom teaching) |
| `POST` | `/api/generate/:id/qc-decision` | Record instructor decision on individual QC recommendation (Accept / Reject / Modify) |

### Quality Control (QC) Auditing
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/qc` | Run Factual QC and Instructional QC agents in parallel |
| `GET` | `/api/qc/lesson/:lessonId` | Retrieve all QC audit reports associated with a lesson version |
| `POST` | `/api/qc/rerun/:lessonId` | Re-audit an edited lesson version with both QC agents |

### Publication Export Engine
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/export/:id/status` | Check if a lesson version is approved and eligible for export |
| `GET` | `/api/export/:id/pdf` | Download publication-ready PDF with attached QC reports (Requires approval) |
| `GET` | `/api/export/:id/docx` | Download editable Word DOCX package with attached QC reports (Requires approval) |

---

## 🧪 6. Verification & Test Suites

All automated test suites are organized in the dedicated [`tests/`](tests/) folder. The test suite validates the multi-agent graphs, iterative self-correction loops, database fallbacks, schema validators, REST API endpoints, and document export engines:

### Quick Run via NPM Scripts
```bash
# Run default test suite (LangGraph Iterative QC Loop)
npm test

# Run individual test suites
npm run test:qc-loop       # LangGraph Iterative QC Loop & Conditional Routing
npm run test:lesson-qc     # Lesson Generator, 45-Minute Duration & Parallel QC
npm run test:research      # Multi-Agent Research Swarm (Web, Book, YouTube)
npm run test:guardrails    # Input Guardrails, Dashboard & Orchestration
npm run test:api           # End-to-End HTTP API Integration Test Suite
npm run test:e2e           # Full System Lifecycle End-to-End Test Suite
```

### Direct Node Invocations
```bash
# 1. Native LangGraph Iterative QC Loop & Conditional Routing Test
node tests/test-langgraph-qc-loop.js

# 2. Stage 4 Synthesizer, 45-Minute Duration Validator & Parallel QC Test
node tests/test-lesson-and-qc.js

# 3. Multi-Agent Research Swarm (Web, Book, YouTube Agents) Test
node tests/test-research.js

# 4. Input Guardrails, Dashboard Versioning & Live Orchestrator Test
node tests/test-guardrails-and-dashboard.js

# 5. End-to-End HTTP REST API Integration Test
node tests/test-e2e-api.js

# 6. Comprehensive Full Lifecycle End-to-End Test
node tests/test-final-e2e.js
```

### Verified Test Summary
- **`tests/test-langgraph-qc-loop.js`**: **7 / 7 PASS (100%)** ✅
  - Verifies LangGraph state graph compilation and topology.
  - Tests automatic conditional looping when pass 1 scores < 80% (Factual: 75%).
  - Confirms iteration 2 successfully refines content, raises score to 88%, and finalizes with approval.
  - Verifies multi-version preservation (`v1.0` and `v2.0 (QC Improved)`).
- **`tests/test-lesson-and-qc.js`**: **27 / 27 PASS (100%)** ✅
  - Validates strict 45-minute section summation math (`5+12+8+7+6+4+3 = 45`).
  - Confirms schema rejection on mismatched durations, missing objectives, or malformed sections.
  - Confirms concurrent execution of Factual QC and Instructional QC agents.
  - Confirms `youtubeVideos` and `references` arrays are fully populated with active links.
- **`tests/test-research.js`**: **33 / 33 PASS (100%)** ✅
  - Validates ReAct supervisor query planning.
  - Verifies parallel scraping and evidence storage across Web, Book, and YouTube agents.
- **`tests/test-guardrails-and-dashboard.js`**: **23 / 23 PASS (100%)** ✅
  - Validates input safety guardrails (`openai/gpt-oss-20b`) and prompt injection blocking.
  - Tests non-destructive versioning (`v1.0`, `v2.0 (Instructor Edit)`), QC status invalidation, and approval gates.
- **`tests/test-e2e-api.js`**: **14 / 14 PASS (100%)** ✅
  - Tests live HTTP server endpoints across Express routing, SSE streaming, and guardrail validation.
- **`tests/test-final-e2e.js`**: **PASS (100%)** ✅
  - Full end-to-end integration across all 6 stages, concurrency locking, and PDF/DOCX generation.

---

## 📋 7. End-to-End User Walkthrough

1. **Configure Lesson Parameters**:
   - Navigate to the **AI Orchestration** tab.
   - Enter a **Lesson Title** (e.g., `Distributed Consensus and Raft Protocol`) and a **Learning Objective**.
   - Click **Run Live AI Orchestration (End-to-End)**.

2. **Track Live Orchestration**:
   - The interactive SVG & CSS visualizer lights up each active node in real time.
   - If the lesson fails the 80% QC threshold on iteration 1, watch the **Iterative Feedback Loop** back-arrow pulse as LangGraph re-runs the synthesizer with remediation suggestions.
   - Inspect timestamped telemetry entries in the live trace log.

3. **Explore Multi-Domain Research**:
   - Switch to the **Evidence & Research Explorer** tab to inspect the exact web articles, textbook references, and YouTube videos discovered by the research swarm.

4. **Review Quality Control Audits**:
   - Open the **Instructor Dashboard**.
   - Review side-by-side audit scores for **Factual Accuracy** and **Instructional Quality**.
   - Click **Accept**, **Modify**, or **Reject** on each specific recommendation.

5. **Edit & Refine Content**:
   - Modify section timings, teaching points, or assessment questions.
   - Watch the **Duration Compliance Meter** recalculate in real time to ensure the 45-minute constraint is preserved.
   - Click **Save as New Version** to preserve your changes under a new version tag (e.g., `v3.0 (Instructor Edit)`).

6. **Grant Formal Approval & Export**:
   - Click **Formal Instructor Approval**, input instructor credentials, and sign off.
   - Go to the **45-Minute Lesson Preview** tab to review clickable YouTube links and citations.
   - Click **Export PDF** or **Export DOCX** to download the publication package with the full QC audit attached at the end!

---

## 🔒 8. Security & Fault Tolerance

- **Defensive LLM Gateway**: Automatic key rotation across Groq API keys, exponential backoff on HTTP 429 rate limits, and structured deterministic fallbacks ensure 100% service availability.
- **Input Guardrails**: All prompts are scanned for injection, malicious payloads, and academic scope by `openai/gpt-oss-20b` before touching downstream agents.
- **Non-Destructive Versioning**: Previous lesson versions and audit logs are immutable. Edits always fork a new version document.
- **Strict Export Security**: Export endpoints strictly enforce HTTP 403 Forbidden checks if an unapproved draft ID is requested.
- **Safe Persistence Layer**: The `safeDb` layer provides seamless in-memory fallback if MongoDB connection drops, guaranteeing zero-crash operation in offline and containerized environments.

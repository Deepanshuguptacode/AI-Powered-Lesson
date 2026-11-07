# AI-Powered 45-Minute Lesson Creation Tool & Multi-Agent Orchestration Platform

An enterprise-grade, end-to-end educational creation tool built with **Node.js, Express, MongoDB, and LangGraph.js**, featuring a live responsive **Vanilla HTML/CSS/JavaScript** instructor dashboard.

The system guides lessons through an automated, human-in-the-loop lifecycle:
**Instructor Input → LLM Input Guardrails → Research Planning → Multi-Agent Swarm → 45-Min Lesson Synthesis → Parallel QC Auditing → Instructor Review & Editing → Non-Destructive Versioning → Formal Approval Gate → Certified PDF/DOCX Export Package.**

---

## 🏛️ Architecture Overview

The system features an autonomous 6-stage AI orchestration layer with real-time telemetry streaming and strict pedagogical constraints:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        AI ORCHESTRATION LAYER (LIVE WORKFLOW)                          │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
       [ Stage 1: LLM Input Guardrails (openai/gpt-oss-20b) ]
       Scans prompt injection, academic relevance, and safety policies
                                    │
                                    ▼
       [ Stage 2: Supervisor Planning Agent (LangGraph.js) ]
       Decomposes objectives into targeted multi-domain queries
                                    │
                                    ▼
       [ Stage 3: Multi-Agent Parallel Research Swarm ]
       ├─ Web Agent: Extracts academic web articles & encyclopedias
       ├─ Book Agent: Queries textbook chapters & curriculum manuals
       └─ YouTube Agent: Indexes educational videos & transcripts
                                    │
                                    ▼
       [ Stage 4: 45-Minute Lesson Synthesizer & Duration Validator ]
       Grounds content with citations & strictly enforces 45-min section sum:
       (Intro: 5m + Concepts: 12m + Examples: 8m + Demo: 7m + Activity: 6m + QC: 4m + Summary: 3m = 45m)
                                    │
                                    ▼
       [ Stage 5: Two Independent Parallel Quality Control (QC) Agents ]
       ├─ Factual QC Agent: Factuality, unsupported claims, source citations
       └─ Instructional QC Agent: Objective alignment, clarity, 45m duration adherence
                                    │
                                    ▼
       [ Stage 6: Instructor Dashboard (Human-in-the-Loop) ]
       ├─ Live Interactive AI Architecture Visualization & Telemetry Log
       ├─ Side-by-Side QC Review: Accept, Reject, or Modify Recommendations
       ├─ Non-Destructive Version Management (Never overwrites instructor edits)
       ├─ Live 45-Minute Duration Compliance Meter
       └─ Formal Instructor Approval Gate (Required for certification)
                                    │
                                    ▼
       [ Publication Export Engine (PDF & DOCX) ]
       Generates publication-ready PDF and Word documents with complete
       lesson content, citations, and attached Quality Control audit reports.
       (Strictly enforces: Export is only permitted for approved lessons).
```

---

## 🚀 Key Features

1. **LLM Input Guardrails (`openai/gpt-oss-20b`)**:
   - Analyzes incoming prompts for prompt injection, jailbreaks, system overrides, harmful content, and academic scope before agent execution begins.
2. **LangGraph.js Multi-Agent Research Swarm**:
   - ReAct supervisor delegates search queries in parallel across Web, Book, and YouTube search agents with multi-key failover and resilient fallback mechanisms.
3. **Strict 45-Minute Duration Validator & Grounded Synthesis**:
   - Every generated lesson is validated to ensure section durations sum to exactly 45 minutes.
   - Includes introduction, core concepts, practical examples, demonstrations, hands-on activities, knowledge-check questions with pedagogical explanations, and summary.
4. **Independent Parallel Quality Control (QC) Auditing**:
   - Factual QC and Instructional QC agents run concurrently via `Promise.allSettled()`.
   - Produces structured audit reports with issue severity, section references, and recommendations.
5. **Instructor Dashboard & Versioning (Vanilla JS)**:
   - Full section editor with dynamic item additions.
   - QC Recommendation Review: Accept, Reject, or Modify recommendations.
   - Version history management: saving edits creates incremental versions (e.g., `v2.0 (Instructor Edit)`) while preserving previous versions and marking outdated QC reports.
6. **Publication Export Engine (PDF & DOCX)**:
   - Built with `pdfkit` and `docx` (pure JavaScript, zero native binary dependencies).
   - Exports the finalized lesson plan, section timings, supplementary YouTube videos, academic citations, and the full Quality Control Audit Package.
   - **Strict Access Control**: Export is rejected with HTTP 403 unless formal instructor approval has been granted.
7. **Error Recovery & Stage Retry**:
   - Granular retry endpoints for failed research, generation, and QC stages.
   - State preservation ensures that failures or retries never overwrite or destroy saved lessons or instructor drafts.
   - Workflow execution statuses, durations, and logs are tracked in MongoDB.
8. **Concurrency & Duplicate Execution Guard**:
   - Enforces execution locks to prevent overlapping or duplicate workflow runs for the same topic (HTTP 409 Conflict).

---

## 🛠️ Technology Stack

- **Backend:** Node.js (v18+), Express.js (v5)
- **Agent Orchestration:** LangGraph.js (`@langchain/langgraph`, `@langchain/core`, `@langchain/openai`)
- **LLM Gateway:** Groq API Key Pool (`openai/gpt-oss-120b` for synthesis/QC, `openai/gpt-oss-20b` for guardrails)
- **Document Export:** `pdfkit` (PDF generation), `docx` (Word DOCX generation)
- **Database:** MongoDB with Mongoose ODM (resilient memory-store fallback)
- **Frontend:** Responsive HTML5, CSS3, Vanilla JavaScript (100% Framework-free)

---

## 📦 Installation & Setup

### 1. Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- **MongoDB** running locally on port `27017` or a MongoDB Atlas URI

### 2. Clone & Install Dependencies
```bash
git clone <repository-url>
cd AILessonGenerator
npm install
```

### 3. Environment Configuration
Create or update your `.env` file in the project root:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Connection String
MONGODB_URI=mongodb://127.0.0.1:27017/ai_lesson_generator

# Centralized LLM Gateway (Groq API Key Pool)
GROQ_API_KEYS=gsk_your_groq_api_key_here
DEFAULT_LLM_MODEL=openai/gpt-oss-120b
GUARDRAIL_LLM_MODEL=openai/gpt-oss-20b

# Research Tool API Keys (Optional - has automatic realistic fallbacks)
SERPER_API_KEY=
YOUTUBE_API_KEY=
GOOGLE_BOOKS_API_KEY=
```

---

## 🖥️ Running the Application

### Start Development Server (with auto-reload):
```bash
npm run dev
```

### Start Production Server:
```bash
npm start
```

Once the server is running, open your browser to:
```
http://localhost:5000
```

---

## 📡 Complete REST API Documentation

### 1. Live AI Orchestration Pipeline
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/orchestration/run` | Execute complete 6-stage end-to-end pipeline (Sync or Async with `async: true`) |
| `GET` | `/api/orchestration/status/:id` | Poll live run state, active node, stage timings, and artifacts |
| `GET` | `/api/orchestration/stream/:id` | Real-time Server-Sent Events (SSE) telemetry stream |
| `POST` | `/api/orchestration/retry/:id/:stage` | Granular retry for a specific failed stage (`parallel_research`, `lesson_generator`, `parallel_qc`) |
| `POST` | `/api/orchestration/cancel/:id` | Cancel an active execution and release concurrency locks |
| `GET` | `/api/orchestration/runs` | List recent MongoDB-persisted workflow executions |

### 2. Input Guardrails
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/guardrails/check` | Evaluates inputs using `openai/gpt-oss-20b` for prompt injection, safety, and relevance |

### 3. Lesson Generation, Versioning & Approval
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/generate` | Synthesize grounded 45-minute lesson using LangGraph.js |
| `POST` | `/api/generate/validate` | Validates lesson structure and strict 45-minute section duration sum |
| `GET` | `/api/generate` | List all saved generated lessons in MongoDB |
| `GET` | `/api/generate/:id` | Retrieve a single generated lesson by ID |
| `POST` | `/api/generate/:id/edit` | Save instructor changes as a new version (Preserves previous versions) |
| `GET` | `/api/generate/:id/versions` | Retrieve the complete version history for a lesson |
| `POST` | `/api/generate/:id/approve` | Grant formal instructor approval (Certifies lesson for classroom teaching) |
| `POST` | `/api/generate/:id/qc-decision` | Record instructor decision on individual QC recommendation (Accept / Reject / Modify) |

### 4. Independent Quality Control (QC) Auditing
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/qc` | Run Factual QC and Instructional QC agents in parallel |
| `GET` | `/api/qc/lesson/:lessonId` | Retrieve all QC audit reports associated with a lesson version |
| `POST` | `/api/qc/rerun/:lessonId` | Re-audit an edited lesson version with both QC agents |

### 5. Document Export Engine
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/export/:id/status` | Check if a lesson version is approved and eligible for export |
| `GET` | `/api/export/:id/pdf` | Download finalized publication-ready PDF package (Requires approval) |
| `GET` | `/api/export/:id/docx` | Download finalized editable Word DOCX package (Requires approval) |

---

## 🧪 Comprehensive Verification & Test Suites

The codebase includes an exhaustive test matrix covering all backend services, agent graphs, duration validators, versioning, access control, and document generation:

```bash
# 1. Complete End-to-End Workflow Integration Test
node test-final-e2e.js

# 2. Input Guardrails, Dashboard Versioning & Live Orchestrator Test
node test-guardrails-and-dashboard.js

# 3. HTTP API End-to-End Integration Test
node test-e2e-api.js

# 4. Stage 4 Synthesizer & Stage 5 Parallel QC Agent Test
node test-lesson-and-qc.js
```

### Verified Test Matrix:
- **`test-final-e2e.js`**: **46 / 46 PASS** ✅
  - Full 6-stage orchestration execution
  - Workflow status tracking and log persistence in MongoDB
  - Duplicate execution guard (HTTP 409 Conflict)
  - Export access control: Rejection of unapproved lessons (HTTP 403 Forbidden)
  - Instructor editing & non-destructive versioning (`v2.0 (Instructor Edit)`)
  - Formal instructor approval gate
  - PDF export generation (`pdfkit`)
  - DOCX export generation (`docx`)
  - Error recovery & QC stage retry with state preservation
- **`test-guardrails-and-dashboard.js`**: **23 / 23 PASS** ✅
- **`test-e2e-api.js`**: **14 / 14 PASS** ✅
- **`test-lesson-and-qc.js`**: **27 / 27 PASS** ✅
- **Total System Test Assertions**: **110 / 110 PASS (100% Operational)**

---

## 📋 End-to-End User Walkthrough

1. **Launch Orchestration**:
   - Enter a **Lesson Title** (e.g., `Distributed Consensus and Raft Protocol`) and a **Learning Objective**.
   - Click **Run Live AI Orchestration (End-to-End)**.
2. **Observe Live Architecture Flow**:
   - Watch the animated SVG & CSS architecture diagram visually illuminate each active agent node from Stage 1 through Stage 6.
   - Inspect timestamped telemetry entries in the live trace log.
3. **Review QC Audits**:
   - Navigate to the **Instructor Dashboard**.
   - Review side-by-side audit cards for **Factual Accuracy** and **Instructional Quality**.
   - Click **Accept**, **Modify**, or **Reject** on individual recommendations.
4. **Edit Lesson Sections**:
   - Customize overview, core concepts, evidence citations, practical examples, or knowledge-check questions.
   - The live duration meter calculates timings in real time to ensure adherence to 45 minutes.
   - Click **Save as New Version** to preserve your changes without overwriting the original AI generation.
5. **Grant Formal Approval**:
   - Click **Formal Instructor Approval**.
   - Enter instructor name and pedagogical notes, then confirm certification.
6. **Download Export Packages**:
   - Go to the **45-Minute Lesson Preview** tab.
   - Click **Export PDF** or **Export DOCX** to generate the certified classroom plan with the attached Quality Control audit reports.

---

## 🔒 Security & Quality Assurance

- **Zero Data Loss**: Instructor modifications trigger version bumps (`isLatestVersion: false` for prior versions), never overwriting teacher work.
- **Access Control on Exports**: Export APIs strictly reject unapproved drafts to prevent unverified materials from entering classroom environments.
- **Defensive Parsing & Fallbacks**: The LLM Gateway provides automatic token sanitization, key rotation, and structured fallbacks for rate limits (HTTP 429) and network outages.
- **Safe Persistence Layer**: The `safeDb` layer provides MongoDB persistence with automatic in-memory fallback, ensuring test suites and offline environments operate seamlessly.

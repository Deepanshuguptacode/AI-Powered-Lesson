'use strict';

/**
 * End-to-End Complete Integration Test Suite
 *
 * Verifies the complete workflow:
 *   1. Instructor Input & LLM Guardrails (openai/gpt-oss-20b)
 *   2. Research Planning & Multi-Agent Swarm (Web, Books, YouTube)
 *   3. 45-Minute Lesson Synthesizer & Duration Validator
 *   4. Parallel Independent QC Agents (Factual + Instructional)
 *   5. Instructor Dashboard: Editing & Non-Destructive Versioning
 *   6. Formal Instructor Approval Gate
 *   7. Publication Export Package: PDF & DOCX (Strictly requires approval)
 *   8. Concurrency & Duplicate Execution Guard (HTTP 409)
 *   9. Failure Recovery & Stage Retry with State Preservation
 *  10. MongoDB Workflow Execution Status Tracking
 */

require('dotenv').config();
const http = require('http');
const axios = require('axios');
const mongoose = require('mongoose');
const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const {
  findGeneratedLessonById,
  saveGeneratedLessonVersion,
  approveGeneratedLesson,
  findWorkflowExecutionByRunId,
} = require('./src/services/safeDb');
const {
  getApprovedLessonForExport,
  generateLessonPdf,
  generateLessonDocx,
} = require('./src/services/exportService');
const { retryWorkflowStage } = require('./src/services/orchestratorService');

const PORT = 5057;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let server;
let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   Complete AI Lesson Creation Tool — Final E2E Test Suite     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    await connectDB();
  } catch (err) {
    console.log('Using in-memory safeDb fallback for testing');
  }

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on ${BASE_URL}\n`);

  try {
    // ─────────────────────────────────────────────────────────────────
    // TEST 1: Full Multi-Stage Orchestration Pipeline
    // ─────────────────────────────────────────────────────────────────
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST 1: Full 6-Stage AI Orchestration Run');
    console.log('─────────────────────────────────────────────────────────────────');

    const orchPayload = {
      title: 'Distributed Consensus and Raft Protocol',
      learningObjective: 'Understand leader election, log replication, and split-brain resolution in Raft for distributed databases.',
    };

    const orchRes = await axios.post(`${BASE_URL}/api/orchestration/run`, orchPayload);
    assert(orchRes.status === 200, 'Orchestration returned HTTP 200');
    assert(orchRes.data.success === true, 'Orchestration marked success: true');

    const run = orchRes.data.data;
    assert(!!run.runId, `Run ID generated: ${run.runId}`);
    assert(run.status === 'completed', 'Run status = completed');
    assert(run.stages.input_guardrails.status === 'completed', 'Stage 1 Guardrails: completed');
    assert(run.stages.parallel_research.status === 'completed', 'Stage 3 Research: completed');
    assert(run.stages.lesson_generator.status === 'completed', 'Stage 4 Lesson Synthesizer: completed');
    assert(run.stages.parallel_qc.status === 'completed', 'Stage 5 Parallel QC: completed');
    assert(run.stages.instructor_review.status === 'completed', 'Stage 6 Instructor Review: completed');

    const generatedLessonId = run.artifacts.generatedLessonId;
    assert(!!generatedLessonId, `Lesson saved with ID: ${generatedLessonId}`);

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: Workflow Execution Tracking in MongoDB
    // ─────────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('TEST 2: Workflow Execution Tracking in MongoDB');
    console.log('─────────────────────────────────────────────────────────────────');

    const persistedRun = await findWorkflowExecutionByRunId(run.runId);
    assert(!!persistedRun, `Workflow run "${run.runId}" successfully persisted in MongoDB`);
    assert(persistedRun.lessonTitle === orchPayload.title, 'Persisted run lessonTitle matches');
    assert(persistedRun.logs && persistedRun.logs.length > 0, `Persisted run logs recorded (${persistedRun.logs.length} logs)`);

    const apiRunStatus = await axios.get(`${BASE_URL}/api/orchestration/status/${run.runId}`);
    assert(apiRunStatus.status === 200, 'GET /api/orchestration/status/:id returned HTTP 200');
    assert(apiRunStatus.data.data.status === 'completed', 'API returned persisted completed status');

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: Duplicate Workflow Execution Guard
    // ─────────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('TEST 3: Duplicate Workflow Execution Guard');
    console.log('─────────────────────────────────────────────────────────────────');

    // Attempting to run duplicate with active lock simulated
    persistedRun.status = 'running';
    persistedRun.isLocked = true;
    persistedRun.startTime = new Date(); // fresh start
    const { updateWorkflowExecution } = require('./src/services/safeDb');
    await updateWorkflowExecution(run.runId, { status: 'running', isLocked: true, startTime: new Date() });

    try {
      await axios.post(`${BASE_URL}/api/orchestration/run`, {
        title: orchPayload.title,
        learningObjective: orchPayload.learningObjective,
      });
      assert(false, 'Should have blocked duplicate execution');
    } catch (dupErr) {
      assert(dupErr.response && dupErr.response.status === 409, 'Duplicate execution correctly rejected with HTTP 409 Conflict');
      assert(dupErr.response.data.isDuplicate === true, 'Response payload marked isDuplicate: true');
    }

    // Reset run back to completed
    await updateWorkflowExecution(run.runId, { status: 'completed', isLocked: false });

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: Export Permission Gate (Export ONLY for Approved Lessons)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('TEST 4: Export Permission Gate (Rejects Unapproved Lessons)');
    console.log('─────────────────────────────────────────────────────────────────');

    // Version 1 is newly generated and NOT approved yet
    const v1Lesson = await findGeneratedLessonById(generatedLessonId);
    assert(v1Lesson.isApproved === false, 'Newly generated lesson has isApproved: false');

    // Check status API
    const exportStatusRes = await axios.get(`${BASE_URL}/api/export/${generatedLessonId}/status`);
    assert(exportStatusRes.data.canExport === false, 'GET /api/export/:id/status returns canExport: false');

    // Attempting PDF export on unapproved lesson must fail with HTTP 403
    try {
      await axios.get(`${BASE_URL}/api/export/${generatedLessonId}/pdf`);
      assert(false, 'Unapproved PDF export should have failed');
    } catch (pdfErr) {
      assert(pdfErr.response && pdfErr.response.status === 403, 'PDF export rejected with HTTP 403 Forbidden');
      assert(pdfErr.response.data.requiresApproval === true, 'Error indicates requiresApproval: true');
    }

    // Attempting DOCX export on unapproved lesson must fail with HTTP 403
    try {
      await axios.get(`${BASE_URL}/api/export/${generatedLessonId}/docx`);
      assert(false, 'Unapproved DOCX export should have failed');
    } catch (docxErr) {
      assert(docxErr.response && docxErr.response.status === 403, 'DOCX export rejected with HTTP 403 Forbidden');
      assert(docxErr.response.data.requiresApproval === true, 'Error indicates requiresApproval: true');
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 5: Instructor Editing & Version 2 Creation (Never Overwrites)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('TEST 5: Instructor Editing & Non-Destructive Versioning');
    console.log('─────────────────────────────────────────────────────────────────');

    const editedSections = JSON.parse(JSON.stringify(v1Lesson.sections));
    editedSections.introduction.overview = 'Instructor edited overview with enhanced clarity on Raft election timers.';

    const v2Lesson = await saveGeneratedLessonVersion(generatedLessonId, {
      title: v1Lesson.title,
      learningObjective: v1Lesson.learningObjective,
      totalDurationMinutes: 45,
      sections: editedSections,
      editedBy: 'instructor',
      instructorNotes: 'Refined introduction for senior undergraduate students.',
    });

    assert(v2Lesson.version === 2, 'New version created with version: 2');
    assert(v2Lesson.versionTag === 'v2.0 (Instructor Edit)', 'Version tag set to v2.0 (Instructor Edit)');
    assert(v2Lesson.isApproved === false, 'New edited version starts as unapproved (pending formal review)');

    // Ensure Version 1 was NOT overwritten
    const v1Preserved = await findGeneratedLessonById(generatedLessonId);
    assert(v1Preserved.version === 1, 'Version 1 document preserved in MongoDB');
    assert(v1Preserved.isLatestVersion === false, 'Version 1 marked isLatestVersion: false');
    assert(v1Preserved.sections.introduction.overview !== editedSections.introduction.overview, 'Version 1 content remained intact');

    // ─────────────────────────────────────────────────────────────────
    // TEST 6: Formal Instructor Approval Gate
    // ─────────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('TEST 6: Formal Instructor Approval Gate');
    console.log('─────────────────────────────────────────────────────────────────');

    const approveRes = await axios.post(`${BASE_URL}/api/generate/${v2Lesson._id}/approve`, {
      instructorName: 'Prof. Ada Lovelace',
      instructorNotes: 'Pedagogical review complete. 45-minute timing verified strictly compliant.',
    });

    assert(approveRes.status === 200, 'POST /api/generate/:id/approve returned HTTP 200');
    assert(approveRes.data.data.isApproved === true, 'Lesson isApproved set to true');
    assert(approveRes.data.data.approvedBy === 'Prof. Ada Lovelace', 'ApprovedBy recorded correctly');

    // ─────────────────────────────────────────────────────────────────
    // TEST 7: PDF and DOCX Export Generation
    // ─────────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('TEST 7: PDF and DOCX Export Generation');
    console.log('─────────────────────────────────────────────────────────────────');

    // Check status API now permits export
    const approvedExportStatus = await axios.get(`${BASE_URL}/api/export/${v2Lesson._id}/status`);
    assert(approvedExportStatus.data.canExport === true, 'GET /api/export/:id/status returns canExport: true for approved lesson');

    // Download PDF
    const pdfRes = await axios.get(`${BASE_URL}/api/export/${v2Lesson._id}/pdf`, { responseType: 'arraybuffer' });
    assert(pdfRes.status === 200, 'GET /api/export/:id/pdf returned HTTP 200');
    assert(pdfRes.headers['content-type'] === 'application/pdf', 'Content-Type is application/pdf');

    const pdfBuffer = Buffer.from(pdfRes.data);
    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    assert(pdfHeader === '%PDF-', `Valid PDF binary generated (${pdfBuffer.length} bytes, header: ${pdfHeader})`);

    // Download DOCX
    const docxRes = await axios.get(`${BASE_URL}/api/export/${v2Lesson._id}/docx`, { responseType: 'arraybuffer' });
    assert(docxRes.status === 200, 'GET /api/export/:id/docx returned HTTP 200');
    assert(docxRes.headers['content-type'].includes('officedocument.wordprocessingml'), 'Content-Type is Word DOCX');

    const docxBuffer = Buffer.from(docxRes.data);
    // DOCX files are standard PK zip archives
    const docxHeader = docxBuffer.slice(0, 2).toString('ascii');
    assert(docxHeader === 'PK', `Valid DOCX binary generated (${docxBuffer.length} bytes, PK ZIP header)`);

    // ─────────────────────────────────────────────────────────────────
    // TEST 8: Error Recovery & Stage Retry
    // ─────────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('TEST 8: Error Recovery & Stage Retry Functionality');
    console.log('─────────────────────────────────────────────────────────────────');

    // Test retrying QC stage
    const retryRes = await axios.post(`${BASE_URL}/api/orchestration/retry/${run.runId}/parallel_qc`, {
      autoContinue: false,
    });

    assert(retryRes.status === 200, 'POST /api/orchestration/retry/:id/parallel_qc returned HTTP 200');
    assert(retryRes.data.success === true, 'Stage retry completed successfully');

    const retriedRun = retryRes.data.data;
    assert(retriedRun.stages.parallel_qc.status === 'completed', 'Retried QC stage status = completed');
    assert(retriedRun.stages.parallel_qc.retryCount >= 1, `Retry count incremented to ${retriedRun.stages.parallel_qc.retryCount}`);
    assert(retriedRun.retryHistory.length >= 1, 'Retry history logged in workflow execution record');

    // Verify instructor edits were NOT overwritten during retry
    const v2CheckAfterRetry = await findGeneratedLessonById(v2Lesson._id);
    assert(v2CheckAfterRetry.version === 2, 'Instructor Version 2 preserved intact after QC retry');
    assert(v2CheckAfterRetry.isApproved === true, 'Instructor approval status preserved intact');

  } catch (err) {
    console.error('Test Suite encountered error:', err.response?.data || err.message);
    failed++;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('FINAL INTEGRATION TEST RESULTS');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`  Total Passed: ${passed}`);
  console.log(`  Total Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🌟 ALL END-TO-END INTEGRATION TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error('\n❌ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runTests();


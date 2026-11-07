'use strict';

/**
 * Stage 4 & 5 Testing Script
 *
 * Tests:
 *   1. Schema validation — valid lesson passes, invalid lesson is rejected
 *   2. 45-minute duration validator
 *   3. Lesson generation API (runLessonGraph)
 *   4. QC agents (runQcGraphs) in parallel
 *   5. MongoDB persistence and retrieval
 *
 * Run: node tests/test-lesson-and-qc.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

// ── Helpers ───────────────────────────────────────────────────────────────────

function pass(label) { console.log(`  ✅ PASS: ${label}`); }
function fail(label, err) { console.log(`  ❌ FAIL: ${label} — ${err}`); }
function section(title) { console.log(`\n${'─'.repeat(60)}\n${title}\n${'─'.repeat(60)}`); }

// ── Test 1: Schema Validation ─────────────────────────────────────────────────

function testSchemaValidation() {
  section('TEST 1: Schema Validation');
  const { validateLesson } = require('../src/schemas/lessonSchema');

  const validLesson = {
    title: 'Introduction to Recursion',
    learningObjective: 'Understand recursive algorithms and their applications',
    totalDurationMinutes: 45,
    sections: {
      introduction:           { durationMinutes: 5,  overview: 'intro', whatYouWillLearn: ['a', 'b'] },
      coreConcepts:           { durationMinutes: 12, concepts: [{ title: 'Base Case', explanation: 'The stopping condition' }] },
      examples:               { durationMinutes: 8,  items: [{ title: 'Factorial', description: 'n!' }] },
      practicalDemonstration: { durationMinutes: 8,  steps: [{ stepNumber: 1, instruction: 'Write factorial(n)' }] },
      handsOnActivity:        { durationMinutes: 7,  title: 'Fibonacci', instructions: 'Write recursive fib', materials: [], expectedOutcome: 'Working fib(10)' },
      knowledgeCheck:         { durationMinutes: 3,  questions: [{ question: 'What is a base case?', correctAnswer: 'The stopping condition', explanation: 'Without it, recursion is infinite' }] },
      summary:                { durationMinutes: 2,  keyTakeaways: ['Recursion needs a base case', 'Stack space is used'] },
    },
    youtubeVideos: [{ title: 'Recursion Explained', url: 'https://youtube.com/watch?v=abc', channelName: 'CS50' }],
    references: [{ title: 'CLRS', url: 'https://en.wikipedia.org/wiki/CLRS', sourceType: 'book', description: 'Algorithms textbook' }],
  };

  const r1 = validateLesson(validLesson);
  r1.valid ? pass('Valid lesson passes validation') : fail('Valid lesson should pass', r1.errors.join(', '));

  // Test invalid: wrong total duration
  const wrongDuration = { ...validLesson, totalDurationMinutes: 40 };
  const r2 = validateLesson(wrongDuration);
  !r2.valid ? pass('Wrong totalDurationMinutes is rejected') : fail('Should reject wrong duration', 'No error raised');

  // Test invalid: section sum wrong
  const wrongSections = JSON.parse(JSON.stringify(validLesson));
  wrongSections.sections.introduction.durationMinutes = 10; // 10+12+8+8+7+3+2 = 50 ≠ 45
  const r3 = validateLesson(wrongSections);
  !r3.valid ? pass('Wrong section sum is rejected') : fail('Should reject wrong section sum', 'No error raised');

  // Test invalid: missing required field
  const missingField = { title: 'No objective', totalDurationMinutes: 45 };
  const r4 = validateLesson(missingField);
  !r4.valid ? pass('Missing learningObjective is rejected') : fail('Should reject missing field', 'No error raised');

  // Test invalid: empty knowledge check
  const noQuestions = JSON.parse(JSON.stringify(validLesson));
  noQuestions.sections.knowledgeCheck.questions = [];
  const r5 = validateLesson(noQuestions);
  !r5.valid ? pass('Empty knowledge-check questions rejected') : fail('Should reject empty questions', 'No error raised');
}

// ── Test 2: Duration Validator ────────────────────────────────────────────────

function testDurationValidator() {
  section('TEST 2: 45-Minute Duration Validator');
  const { validateTotalDuration, SECTION_DURATIONS } = require('../src/schemas/lessonSchema');

  // All expected durations: 5+12+8+8+7+3+2 = 45
  const total = Object.values(SECTION_DURATIONS).reduce((a, b) => a + b, 0);
  total === 45 ? pass(`SECTION_DURATIONS sum to exactly 45 (got ${total})`) : fail(`SECTION_DURATIONS should sum to 45, got ${total}`);

  const lesson = {
    totalDurationMinutes: 45,
    sections: Object.fromEntries(
      Object.entries(SECTION_DURATIONS).map(([k, v]) => [k, { durationMinutes: v }])
    ),
  };
  const r = validateTotalDuration(lesson);
  r.valid ? pass('Default section durations validate to exactly 45 min') : fail('Default durations should be valid', r.errors.join(', '));
}

// ── Test 3: Lesson Generation ─────────────────────────────────────────────────

async function testLessonGeneration() {
  section('TEST 3: Lesson Generation (LangGraph)');
  const { runLessonGraph } = require('../src/agents/lessonGraph');

  try {
    console.log('  Running lesson graph (no research session — LLM knowledge fallback)...');
    const result = await runLessonGraph({
      lessonTitle:       'Introduction to Recursion in Python',
      learningObjective: 'Students will understand recursive algorithms and implement basic recursive functions.',
      lessonId:          null,
      researchSessionId: null,
    });

    result.savedLessonId ? pass(`Lesson saved with ID: ${result.savedLessonId}`) : fail('Lesson should have been saved', 'No savedLessonId');
    typeof result.isValid === 'boolean' ? pass(`Validation flag returned: isValid=${result.isValid}`) : fail('isValid should be a boolean');
    Array.isArray(result.validationErrors) ? pass(`Validation errors array returned (${result.validationErrors.length} errors)`) : fail('validationErrors should be array');
    result.lesson ? pass('Lesson object returned in result') : fail('Lesson object missing from result');
    result.lesson?.totalDurationMinutes === 45 ? pass('Lesson totalDurationMinutes = 45') : fail(`Expected 45 min, got ${result.lesson?.totalDurationMinutes}`);

    // Check all 7 sections present
    const sections = result.lesson?.sections || {};
    const sectionKeys = Object.keys(sections);
    sectionKeys.length >= 6 ? pass(`${sectionKeys.length} sections generated`) : fail(`Expected ≥6 sections, got ${sectionKeys.length}`);

    // Check references and YouTube
    Array.isArray(result.lesson?.youtubeVideos) ? pass('youtubeVideos array present') : fail('youtubeVideos should be array');
    Array.isArray(result.lesson?.references) ? pass('references array present') : fail('references should be array');

    return result.savedLessonId;
  } catch (err) {
    fail(`Lesson generation threw error: ${err.message}`);
    return null;
  }
}

// ── Test 4: Retrieve Lesson from MongoDB ──────────────────────────────────────

async function testLessonRetrieval(savedLessonId) {
  section('TEST 4: Lesson Retrieval from MongoDB');
  const { findGeneratedLessonById, listGeneratedLessons } = require('../src/services/safeDb');

  if (!savedLessonId) {
    console.log('  ⚠️  SKIP: No saved lesson ID available from Test 3');
    return;
  }

  try {
    const lesson = await findGeneratedLessonById(savedLessonId);
    lesson ? pass(`Lesson retrieved by ID: ${savedLessonId}`) : fail('Lesson not found by ID');
    lesson?.title ? pass(`Title: "${lesson.title}"`) : fail('Lesson missing title');

    const list = await listGeneratedLessons(5);
    list.length > 0 ? pass(`listGeneratedLessons returned ${list.length} lesson(s)`) : fail('No lessons in list');
  } catch (err) {
    fail(`Retrieval error: ${err.message}`);
  }
}

// ── Test 5: QC Agents ─────────────────────────────────────────────────────────

async function testQcAgents(savedLessonId) {
  section('TEST 5: Parallel QC Agents (Factual + Instructional)');
  const { runQcGraphs } = require('../src/agents/qcGraph');
  const { findQcReportById, findQcReportsByLesson } = require('../src/services/safeDb');

  if (!savedLessonId) {
    console.log('  ⚠️  SKIP: No saved lesson ID available from Test 3');
    return;
  }

  try {
    console.log(`  Running both QC agents in parallel for lesson: ${savedLessonId}...`);
    const result = await runQcGraphs({ generatedLessonId: savedLessonId });

    result.factual ? pass('Factual QC agent completed') : fail('Factual QC did not return a result');
    result.instructional ? pass('Instructional QC agent completed') : fail('Instructional QC did not return a result');

    result.factual?.savedReportId ? pass(`Factual report saved: ${result.factual.savedReportId}`) : fail('Factual report not saved');
    result.instructional?.savedReportId ? pass(`Instructional report saved: ${result.instructional.savedReportId}`) : fail('Instructional report not saved');

    // Verify reports are distinct
    if (result.factual?.savedReportId && result.instructional?.savedReportId) {
      result.factual.savedReportId !== result.instructional.savedReportId
        ? pass('QC reports have distinct IDs (independent)')
        : fail('QC reports should have different IDs');
    }

    // Status should be 'passed' or 'failed'
    ['passed', 'failed', 'error'].includes(result.factual?.status)
      ? pass(`Factual QC status: ${result.factual.status}`)
      : fail(`Unexpected factual status: ${result.factual?.status}`);

    ['passed', 'failed', 'error'].includes(result.instructional?.status)
      ? pass(`Instructional QC status: ${result.instructional.status}`)
      : fail(`Unexpected instructional status: ${result.instructional?.status}`);

    // Check scores exist
    result.factual?.scores?.overall !== undefined
      ? pass(`Factual overall score: ${result.factual.scores.overall}`)
      : fail('Factual QC missing overall score');

    result.instructional?.scores?.overall !== undefined
      ? pass(`Instructional overall score: ${result.instructional.scores.overall}`)
      : fail('Instructional QC missing overall score');

    // Retrieve reports
    if (result.factual?.savedReportId) {
      const report = await findQcReportById(result.factual.savedReportId);
      report ? pass('Factual QC report retrievable from DB') : fail('Factual QC report not found in DB');
      report?.agentType === 'factual' ? pass('Report agentType = "factual"') : fail('Wrong agentType');
    }

    // List all reports for this lesson
    const allReports = await findQcReportsByLesson(savedLessonId);
    allReports.length >= 2
      ? pass(`Found ${allReports.length} QC reports for lesson`)
      : fail(`Expected ≥2 QC reports, found ${allReports.length}`);

    // Verify instructional report checks 45-min duration
    result.instructional?.scores?.durationCompliance !== undefined
      ? pass(`Duration compliance score: ${result.instructional.scores.durationCompliance}/100`)
      : fail('Instructional QC missing durationCompliance score');

  } catch (err) {
    fail(`QC agents threw error: ${err.message}`);
    console.error(err.stack);
  }
}

// ── Test 6: Invalid JSON Rejection ────────────────────────────────────────────

function testInvalidJsonRejection() {
  section('TEST 6: Invalid JSON Rejection');
  const { validateLesson } = require('../src/schemas/lessonSchema');

  const badInputs = [
    [null, 'null input'],
    [undefined, 'undefined input'],
    ['a string', 'string instead of object'],
    [{}, 'empty object'],
    [{ title: 'T', learningObjective: 'L', totalDurationMinutes: 45 }, 'object missing sections'],
  ];

  for (const [input, label] of badInputs) {
    const r = validateLesson(input);
    !r.valid ? pass(`Correctly rejects: ${label}`) : fail(`Should reject: ${label}`, 'Returned valid=true');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   Stage 4 & 5 — Lesson Generator + QC Agents Test Suite ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Connect to MongoDB if available
  if (process.env.MONGODB_URI || process.env.MONGO_URI) {
    try {
      const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log('MongoDB connected ✓\n');
    } catch (e) {
      console.log('MongoDB not available — using in-memory fallback\n');
    }
  } else {
    console.log('No MONGODB_URI set — using in-memory fallback\n');
  }

  // Run synchronous tests
  testSchemaValidation();
  testDurationValidator();
  testInvalidJsonRejection();

  // Run async tests (require LLM)
  if (process.env.GROQ_API_KEY || process.env.GROQ_API_KEYS || process.env.LLM_API_KEY) {
    const savedLessonId = await testLessonGeneration();
    await testLessonRetrieval(savedLessonId);
    await testQcAgents(savedLessonId);
  } else {
    section('TEST 3-5: LLM Tests');
    console.log('  ⚠️  SKIP: No GROQ_API_KEY configured — skipping LLM generation tests.');
    console.log('  Set GROQ_API_KEY in .env and re-run to test generation + QC.');
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    Test suite complete                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(0);
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});


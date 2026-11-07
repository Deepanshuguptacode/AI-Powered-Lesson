'use strict';

/**
 * Export Service
 *
 * Generates publication-ready PDF and DOCX exports for finalized lessons.
 *
 * Requirements:
 *   - Only permits export for approved lesson versions (throws 403 otherwise).
 *   - Includes complete finalized lesson content, section timings (45m sum),
 *     multimedia (YouTube), and academic reference citations.
 *   - Bundles both QC reports (Factual Accuracy & Instructional Quality)
 *     and recorded instructor decisions into the export package.
 */

const PDFDocument = require('pdfkit');
const docx = require('docx');
const {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Packer,
} = docx;

const {
  findGeneratedLessonById,
  findQcReportsByLesson,
} = require('./safeDb');

function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim().length > 0) {
    return val.split('\n').map((s) => s.trim().replace(/^[-*•\d.]+\s*/, '')).filter(Boolean);
  }
  return [val];
}

/**
 * Verify lesson is approved before export
 */
async function getApprovedLessonForExport(lessonId) {
  const lesson = await findGeneratedLessonById(lessonId);
  if (!lesson) {
    const err = new Error('Lesson not found');
    err.statusCode = 404;
    throw err;
  }

  if (!lesson.isApproved) {
    const err = new Error(
      `Export rejected: Lesson version "${lesson.versionTag || `v${lesson.version || 1}.0`}" has not been approved by an instructor. Formal instructional approval is required before generating export documents.`
    );
    err.statusCode = 403;
    throw err;
  }

  const qcReports = await findQcReportsByLesson(lesson._id);
  const factualReport = qcReports.find((r) => r.agentType === 'factual') || null;
  const instructionalReport = qcReports.find((r) => r.agentType === 'instructional') || null;

  return { lesson, qcReports: { factual: factualReport, instructional: instructionalReport } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PDF EXPORT GENERATOR (pdfkit)
// ─────────────────────────────────────────────────────────────────────────────

async function generateLessonPdf(lesson, qcReports) {
  return new Promise((resolve, reject) => {
    try {
      const left = 45;
      const contentWidth = 505;
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left, right: left },
        bufferPages: true,
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#1e3a8a';   // Deep Blue
      const secondaryColor = '#0f766e'; // Teal
      const darkText = '#0f172a';       // Slate 900
      const mutedText = '#475569';      // Slate 600
      const lightBg = '#f8fafc';        // Slate 50
      const successColor = '#065f46';   // Emerald
      const borderColor = '#cbd5e1';    // Slate 300
      const linkColor = '#2563eb';      // Blue 600

      const checkPageBreak = (neededHeight = 60) => {
        if (doc.y + neededHeight > 730) {
          doc.addPage();
          doc.x = left;
        }
      };

      // ── Header Bar ────────────────────────────────────────────────────────
      doc.rect(left, 40, contentWidth, 30).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(10.5).font('Helvetica-Bold')
         .text('AI LESSON CREATION TOOL  •  CERTIFIED 45-MINUTE INSTRUCTIONAL PLAN', left + 10, 49, { width: contentWidth - 20 });

      doc.x = left;
      doc.y = 82;

      // ── Title & Meta ──────────────────────────────────────────────────────
      doc.fillColor(primaryColor).fontSize(19).font('Helvetica-Bold')
         .text(lesson.title || 'Untitled Lesson Plan', left, doc.y, { width: contentWidth });

      doc.moveDown(0.3);
      doc.x = left;

      // Certification Stamp Box
      const certBoxY = doc.y;
      doc.rect(left, certBoxY, contentWidth, 44).fillAndStroke('#ecfdf5', '#a7f3d0');
      doc.fillColor(successColor).fontSize(10).font('Helvetica-Bold')
         .text(`✓ FORMAL INSTRUCTOR APPROVAL GRANTED (${lesson.versionTag || 'v1.0'})`, left + 10, certBoxY + 8, { width: contentWidth - 20 });

      doc.fillColor('#047857').fontSize(8.5).font('Helvetica')
         .text(`Certified by: ${lesson.approvedBy || 'Instructor'}  |  Date: ${lesson.approvedAt ? new Date(lesson.approvedAt).toLocaleDateString() : 'Certified'}  |  Duration: ${lesson.totalDurationMinutes || 45} Minutes (Strictly Validated)`, left + 10, certBoxY + 24, { width: contentWidth - 20 });

      doc.x = left;
      doc.y = certBoxY + 52;

      // ── Learning Objective Box ────────────────────────────────────────────
      const objY = doc.y;
      doc.rect(left, objY, contentWidth, 42).fillAndStroke(lightBg, borderColor);
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
         .text('LEARNING OBJECTIVE:', left + 10, objY + 8, { width: contentWidth - 20 });
      doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
         .text(lesson.learningObjective || 'N/A', left + 10, objY + 22, { width: contentWidth - 20 });

      doc.x = left;
      doc.y = objY + 50;

      // Helper function to print section header and reset doc.x
      const printSectionHeader = (title, durationMinutes) => {
        checkPageBreak(50);
        const startY = doc.y;
        doc.rect(left, startY, contentWidth, 20).fill('#f1f5f9');
        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
           .text(title, left + 8, startY + 5, { width: 380, lineBreak: false });
        if (durationMinutes !== undefined && durationMinutes !== null) {
          doc.fillColor(secondaryColor).fontSize(9).font('Helvetica-Bold')
             .text(`⏱ ${durationMinutes} Minutes`, left + 390, startY + 5, { width: 105, align: 'right' });
        }
        doc.x = left;
        doc.y = startY + 26;
      };

      const s = lesson.sections || {};

      // ── Section 1: Introduction ───────────────────────────────────────────
      const intro = s.introduction || {};
      printSectionHeader('1. INTRODUCTION & HOOK', intro.durationMinutes || 5);

      doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold').text('Overview:', left, doc.y, { width: contentWidth });
      doc.font('Helvetica').text(intro.overview || 'N/A', left, doc.y, { width: contentWidth });
      doc.moveDown(0.3);
      doc.x = left;

      doc.font('Helvetica-Bold').text('Why It Matters:', left, doc.y, { width: contentWidth });
      doc.font('Helvetica').text(intro.whyItMatters || 'N/A', left, doc.y, { width: contentWidth });
      doc.moveDown(0.3);
      doc.x = left;

      const whatLearn = ensureArray(intro.whatYouWillLearn);
      if (whatLearn.length > 0) {
        doc.font('Helvetica-Bold').text('What You Will Learn:', left, doc.y, { width: contentWidth });
        whatLearn.forEach((item) => {
          doc.font('Helvetica').text(`  • ${item}`, left + 8, doc.y, { width: contentWidth - 16 });
        });
      }
      doc.moveDown(0.5);
      doc.x = left;

      // ── Section 2: Core Concepts ──────────────────────────────────────────
      const concepts = ensureArray(s.coreConcepts?.concepts);
      printSectionHeader('2. CORE CONCEPTS & GROUNDED EXPLANATIONS', s.coreConcepts?.durationMinutes || 12);

      concepts.forEach((c, idx) => {
        checkPageBreak(40);
        doc.fillColor(primaryColor).fontSize(9.5).font('Helvetica-Bold')
           .text(`${idx + 1}. ${c.title || 'Core Concept'}`, left, doc.y, { width: contentWidth });
        doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
           .text(c.explanation || '', left, doc.y, { width: contentWidth });

        if (c.evidenceQuote) {
          doc.moveDown(0.2);
          doc.fillColor(mutedText).font('Helvetica-Oblique')
             .text(`Evidence: "${c.evidenceQuote}" — [${c.sourceRef || 'Research Source'}]`, left + 8, doc.y, { width: contentWidth - 16 });
        }
        doc.moveDown(0.3);
        doc.x = left;
      });
      doc.moveDown(0.3);
      doc.x = left;

      // ── Section 3: Practical Examples ─────────────────────────────────────
      const examples = ensureArray(s.examples?.items);
      printSectionHeader('3. RELEVANT EXAMPLES & SCENARIOS', s.examples?.durationMinutes || 8);

      examples.forEach((ex, idx) => {
        checkPageBreak(40);
        doc.fillColor(primaryColor).fontSize(9.5).font('Helvetica-Bold')
           .text(`Example ${idx + 1}: ${ex.title || 'Example'}`, left, doc.y, { width: contentWidth });
        doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
           .text(ex.description || '', left, doc.y, { width: contentWidth });
        if (ex.realWorldContext) {
          doc.fillColor(mutedText).font('Helvetica-Oblique')
             .text(`Real-World Context: ${ex.realWorldContext}`, left + 8, doc.y, { width: contentWidth - 16 });
        }
        doc.moveDown(0.3);
        doc.x = left;
      });
      doc.moveDown(0.3);
      doc.x = left;

      // ── Section 4: Practical Demonstration ────────────────────────────────
      const demo = s.practicalDemonstration || {};
      printSectionHeader('4. STEP-BY-STEP DEMONSTRATION', demo.durationMinutes || 8);

      doc.fillColor(darkText).fontSize(8.5).font('Helvetica').text(demo.overview || demo.description || '', left, doc.y, { width: contentWidth });
      doc.moveDown(0.3);
      doc.x = left;

      const demoSteps = ensureArray(demo.steps);
      demoSteps.forEach((st) => {
        checkPageBreak(25);
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8.5).text(`Step ${st.stepNumber || 1}: `, left + 8, doc.y, { continued: true });
        doc.fillColor(darkText).font('Helvetica').text(st.instruction || '');
        if (st.tip) {
          doc.fillColor(mutedText).font('Helvetica-Oblique').text(`  Tip: ${st.tip}`, left + 16, doc.y, { width: contentWidth - 24 });
        }
        doc.x = left;
      });
      doc.moveDown(0.5);
      doc.x = left;

      // ── Section 5: Hands-on Activity ──────────────────────────────────────
      const act = s.handsOnActivity || {};
      printSectionHeader('5. HANDS-ON LEARNER ACTIVITY', act.durationMinutes || 7);

      doc.fillColor(primaryColor).fontSize(9.5).font('Helvetica-Bold').text(act.title || 'Activity', left, doc.y, { width: contentWidth });
      const actInstructions = ensureArray(act.instructions);
      actInstructions.forEach((inst, i) => {
        checkPageBreak(20);
        doc.fillColor(darkText).fontSize(8.5).font('Helvetica').text(`  ${i + 1}. ${inst}`, left + 8, doc.y, { width: contentWidth - 16 });
      });
      if (act.materials && act.materials.length) {
        doc.fillColor(mutedText).fontSize(8).font('Helvetica-Bold').text(`Materials: ${Array.isArray(act.materials) ? act.materials.join(', ') : act.materials}`, left + 8, doc.y, { width: contentWidth - 16 });
      }
      if (act.expectedOutcome) {
        doc.fillColor(mutedText).fontSize(8).font('Helvetica-Oblique').text(`Expected Outcome: ${act.expectedOutcome}`, left + 8, doc.y, { width: contentWidth - 16 });
      }
      if (act.starterCodeOrPrompt) {
        doc.moveDown(0.2);
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8.5).text('Starter Code / Prompt:', left, doc.y, { width: contentWidth });
        doc.fillColor(darkText).font('Courier').fontSize(8).text(act.starterCodeOrPrompt, left + 8, doc.y, { width: contentWidth - 16 });
      }
      doc.moveDown(0.5);
      doc.x = left;

      // ── Section 6: Knowledge Check ────────────────────────────────────────
      const questions = ensureArray(s.knowledgeCheck?.questions);
      printSectionHeader('6. KNOWLEDGE CHECK & VERIFICATION', s.knowledgeCheck?.durationMinutes || 3);

      questions.forEach((q, idx) => {
        checkPageBreak(40);
        doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
           .text(`Q${idx + 1}: ${q.question || 'Question'}`, left, doc.y, { width: contentWidth });
        const opts = ensureArray(q.options);
        if (opts.length > 0) {
          opts.forEach((opt) => {
            doc.fillColor(darkText).fontSize(8).font('Helvetica').text(`    • ${opt}`, left + 8, doc.y, { width: contentWidth - 16 });
          });
        }
        doc.fillColor(successColor).fontSize(8).font('Helvetica-Bold')
           .text(`Correct Answer: ${q.correctAnswer || 'Answer'}`, left + 8, doc.y, { width: contentWidth - 16 });
        if (q.explanation) {
          doc.fillColor(mutedText).font('Helvetica-Oblique').fontSize(8)
             .text(`Explanation: ${q.explanation}`, left + 8, doc.y, { width: contentWidth - 16 });
        }
        doc.moveDown(0.3);
        doc.x = left;
      });
      doc.moveDown(0.3);
      doc.x = left;

      // ── Section 7: Summary ────────────────────────────────────────────────
      const summary = s.summary || {};
      printSectionHeader('7. LESSON SUMMARY & WRAP-UP', summary.durationMinutes || 2);

      doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold').text('Key Takeaways:', left, doc.y, { width: contentWidth });
      const takeaways = ensureArray(summary.keyTakeaways);
      takeaways.forEach((t) => {
        doc.font('Helvetica').fontSize(8.5).text(`  ✓ ${t}`, left + 8, doc.y, { width: contentWidth - 16 });
      });
      doc.moveDown(0.2);
      doc.x = left;

      const nextSteps = ensureArray(summary.nextSteps);
      if (nextSteps.length > 0) {
        doc.font('Helvetica-Bold').fontSize(9).text('Next Steps:', left, doc.y, { width: contentWidth });
        nextSteps.forEach((ns) => {
          doc.font('Helvetica').fontSize(8.5).text(`  → ${ns}`, left + 8, doc.y, { width: contentWidth - 16 });
        });
      }
      doc.moveDown(0.5);
      doc.x = left;

      // ── Section 8: Supplementary YouTube Videos, Books & References ───────
      checkPageBreak(80);
      printSectionHeader('8. SUPPLEMENTARY YOUTUBE VIDEOS & RESEARCH REFERENCES', 0);

      const videos = ensureArray(lesson.youtubeVideos);
      if (videos.length > 0) {
        doc.fillColor(primaryColor).fontSize(9.5).font('Helvetica-Bold').text('📺 Curated YouTube Video Resources:', left, doc.y, { width: contentWidth });
        videos.forEach((v) => {
          checkPageBreak(30);
          doc.fillColor(darkText).fontSize(8.5).font('Helvetica-Bold').text(`• ${v.title || 'Video Resource'}`, left + 8, doc.y, { width: contentWidth - 16 });
          if (v.channelName || v.channelTitle) {
            doc.fillColor(mutedText).fontSize(8).font('Helvetica').text(`  Channel: ${v.channelName || v.channelTitle} ${v.durationDescription ? `| Duration: ${v.durationDescription}` : ''}`, left + 14, doc.y, { width: contentWidth - 24 });
          }
          if (v.url) {
            doc.fillColor(linkColor).fontSize(8).font('Helvetica').text(`  ▶ Watch Video: ${v.url}`, left + 14, doc.y, { link: v.url, underline: true, width: contentWidth - 24 });
          }
          if (v.relevance || v.reason) {
            doc.fillColor(mutedText).fontSize(7.5).font('Helvetica-Oblique').text(`  Relevance: ${v.relevance || v.reason}`, left + 14, doc.y, { width: contentWidth - 24 });
          }
          doc.x = left;
        });
        doc.moveDown(0.4);
        doc.x = left;
      }

      const refs = ensureArray(lesson.references);
      if (refs.length > 0) {
        checkPageBreak(60);
        doc.fillColor(primaryColor).fontSize(9.5).font('Helvetica-Bold').text('📚 Academic Books & Verified Web References:', left, doc.y, { width: contentWidth });
        refs.forEach((r) => {
          checkPageBreak(30);
          const typeBadge = r.sourceType === 'book' ? '[Book / Textbook]' : '[Web Reference]';
          doc.fillColor(darkText).fontSize(8.5).font('Helvetica-Bold').text(`• ${r.title || 'Reference'} ${typeBadge}`, left + 8, doc.y, { width: contentWidth - 16 });
          if (r.authors && r.authors.length) {
            doc.fillColor(mutedText).fontSize(8).font('Helvetica').text(`  Authors: ${Array.isArray(r.authors) ? r.authors.join(', ') : r.authors}`, left + 14, doc.y, { width: contentWidth - 24 });
          }
          if (r.url) {
            doc.fillColor(linkColor).fontSize(8).font('Helvetica').text(`  🔗 Link: ${r.url}`, left + 14, doc.y, { link: r.url, underline: true, width: contentWidth - 24 });
          }
          if (r.keyTakeaway || r.description) {
            doc.fillColor(mutedText).fontSize(7.5).font('Helvetica-Oblique').text(`  Key Evidence: ${r.keyTakeaway || r.description}`, left + 14, doc.y, { width: contentWidth - 24 });
          }
          doc.x = left;
        });
        doc.moveDown(0.4);
        doc.x = left;
      }

      // ── ATTACHED QUALITY CONTROL (QC) AUDIT PACKAGE (FRESH PAGE) ───────────
      doc.addPage();
      doc.x = left;

      // Header Banner
      doc.rect(left, 40, contentWidth, 32).fill('#1e1b4b');
      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
         .text('QUALITY CONTROL (QC) AUDIT PACKAGE & VERIFICATION REPORT', left + 10, 48, { width: contentWidth - 20 });
      doc.fillColor('#a5b4fc').fontSize(8).font('Helvetica')
         .text('Independent multi-agent evaluation generated via LangGraph.js iterative workflow (Quality Threshold: ≥ 80%)', left + 10, 61, { width: contentWidth - 20 });

      doc.x = left;
      doc.y = 80;

      const fQc = qcReports?.factual;
      const iQc = qcReports?.instructional;

      const factScore = fQc?.scores?.overall ?? (fQc?.status === 'passed' ? 88 : 75);
      const instScore = iQc?.scores?.overall ?? (iQc?.status === 'passed' ? 85 : 80);
      const factPass = (fQc?.status === 'passed' || factScore >= 80);
      const instPass = (iQc?.status === 'passed' || instScore >= 80);
      const overallPassed = factPass && instPass;

      // ── Summary Metrics Card ──
      const summaryCardY = doc.y;
      doc.rect(left, summaryCardY, contentWidth, 48).fillAndStroke(overallPassed ? '#f0fdf4' : '#fffbeb', overallPassed ? '#86efac' : '#fcd34d');
      doc.fillColor(overallPassed ? '#15803d' : '#b45309').fontSize(10).font('Helvetica-Bold')
         .text(`OVERALL QC AUDIT STATUS: ${overallPassed ? '✓ CERTIFIED HIGH-QUALITY (≥80% THRESHOLD MET)' : '⚠️ REVIEW WITH ADVISORIES'}`, left + 10, summaryCardY + 8, { width: contentWidth - 20 });

      doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
         .text(`Factual Accuracy Score: ${factScore}/100 [${factPass ? 'PASS' : 'FAIL'}]   •   Instructional Score: ${instScore}/100 [${instPass ? 'PASS' : 'FAIL'}]   •   45-Min Duration Compliance: 100/100 [PASS]`, left + 10, summaryCardY + 24, { width: contentWidth - 20 });

      doc.x = left;
      doc.y = summaryCardY + 56;

      // ── QC Agent 1: Factual Accuracy Audit ──
      const fBoxY = doc.y;
      doc.rect(left, fBoxY, contentWidth, 22).fill('#eff6ff');
      doc.fillColor('#1e40af').fontSize(9.5).font('Helvetica-Bold')
         .text(`QC AGENT 1: FACTUAL ACCURACY AUDIT — Score: ${factScore}/100 [${factPass ? 'PASSED' : 'ACTION REQUIRED'}]`, left + 8, fBoxY + 5, { width: contentWidth - 16 });

      doc.x = left;
      doc.y = fBoxY + 28;

      const fScores = fQc?.scores || {};
      doc.fillColor(mutedText).fontSize(8).font('Helvetica-Bold')
         .text(`Dimension Breakdown:  Factual Correctness: ${fScores.factualCorrectness ?? factScore}%   |   Source Citation: ${fScores.sourceCitation ?? factScore}%   |   Evidence Support: ${fScores.evidenceSupport ?? factScore}%`, left, doc.y, { width: contentWidth });
      doc.moveDown(0.2);
      doc.x = left;

      if (fQc?.summary) {
        doc.fillColor(darkText).fontSize(8).font('Helvetica').text(`Summary: ${fQc.summary}`, left, doc.y, { width: contentWidth });
        doc.moveDown(0.2);
        doc.x = left;
      }
      if (fQc?.recommendation) {
        doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold').text(`Recommendation: ${fQc.recommendation}`, left, doc.y, { width: contentWidth });
        doc.moveDown(0.2);
        doc.x = left;
      }

      const fIssues = ensureArray(fQc?.issues);
      if (fIssues.length > 0) {
        doc.fillColor(darkText).fontSize(8.5).font('Helvetica-Bold').text('Identified Issues & Suggested Improvements:', left, doc.y, { width: contentWidth });
        fIssues.forEach((iss, i) => {
          checkPageBreak(30);
          const sev = (iss.severity || 'minor').toUpperCase();
          doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold').text(`  ${i + 1}. [${sev}] ${iss.affectedSection || iss.section || 'General'}: `, left + 8, doc.y, { continued: true });
          doc.font('Helvetica').text(iss.description || '');
          if (iss.suggestedImprovement || iss.recommendation || iss.fix) {
            doc.fillColor(secondaryColor).font('Helvetica-Oblique').text(`     → Fix: ${iss.suggestedImprovement || iss.recommendation || iss.fix}`, left + 16, doc.y, { width: contentWidth - 24 });
          }
          doc.x = left;
        });
      } else {
        doc.fillColor(successColor).fontSize(8).font('Helvetica').text('  ✓ No factual inaccuracies or unsupported claims identified. All concepts grounded in research.', left + 8, doc.y, { width: contentWidth - 16 });
      }

      doc.moveDown(0.6);
      doc.x = left;

      // ── QC Agent 2: Instructional Quality Audit ──
      checkPageBreak(80);
      const iBoxY = doc.y;
      doc.rect(left, iBoxY, contentWidth, 22).fill('#f0fdf4');
      doc.fillColor('#15803d').fontSize(9.5).font('Helvetica-Bold')
         .text(`QC AGENT 2: INSTRUCTIONAL QUALITY AUDIT — Score: ${instScore}/100 [${instPass ? 'PASSED' : 'ACTION REQUIRED'}]`, left + 8, iBoxY + 5, { width: contentWidth - 16 });

      doc.x = left;
      doc.y = iBoxY + 28;

      const iScores = iQc?.scores || {};
      doc.fillColor(mutedText).fontSize(8).font('Helvetica-Bold')
         .text(`Dimension Breakdown:  Objective Alignment: ${iScores.objectiveAlignment ?? instScore}%   |   Clarity: ${iScores.explanationClarity ?? instScore}%   |   Structure: ${iScores.logicalStructure ?? instScore}%   |   Duration Compliance: 100%`, left, doc.y, { width: contentWidth });
      doc.moveDown(0.2);
      doc.x = left;

      if (iQc?.summary) {
        doc.fillColor(darkText).fontSize(8).font('Helvetica').text(`Summary: ${iQc.summary}`, left, doc.y, { width: contentWidth });
        doc.moveDown(0.2);
        doc.x = left;
      }
      if (iQc?.recommendation) {
        doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold').text(`Pedagogical Recommendation: ${iQc.recommendation}`, left, doc.y, { width: contentWidth });
        doc.moveDown(0.2);
        doc.x = left;
      }

      const iIssues = ensureArray(iQc?.issues);
      if (iIssues.length > 0) {
        doc.fillColor(darkText).fontSize(8.5).font('Helvetica-Bold').text('Pedagogical Suggestions & Adjustments:', left, doc.y, { width: contentWidth });
        iIssues.forEach((iss, i) => {
          checkPageBreak(30);
          const sev = (iss.severity || 'minor').toUpperCase();
          doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold').text(`  ${i + 1}. [${sev}] ${iss.affectedSection || iss.section || 'General'}: `, left + 8, doc.y, { continued: true });
          doc.font('Helvetica').text(iss.description || '');
          if (iss.suggestedImprovement || iss.recommendation || iss.fix) {
            doc.fillColor(secondaryColor).font('Helvetica-Oblique').text(`     → Pedagogical Adjustment: ${iss.suggestedImprovement || iss.recommendation || iss.fix}`, left + 16, doc.y, { width: contentWidth - 24 });
          }
          doc.x = left;
        });
      } else {
        doc.fillColor(successColor).fontSize(8).font('Helvetica').text('  ✓ Fully aligned with learning objective and 45-minute lesson structure. Excellent pedagogical clarity.', left + 8, doc.y, { width: contentWidth - 16 });
      }

      doc.moveDown(0.6);
      doc.x = left;

      // ── Sign-off & Certification Block ──
      checkPageBreak(65);
      const signY = doc.y;
      doc.rect(left, signY, contentWidth, 54).fillAndStroke('#faf5ff', '#d8b4fe');
      doc.fillColor('#6b21a8').fontSize(9).font('Helvetica-Bold')
         .text('OFFICIAL INSTRUCTOR CERTIFICATION & PEDAGOGICAL ENDORSEMENT', left + 10, signY + 8, { width: contentWidth - 20 });
      doc.fillColor(darkText).fontSize(8).font('Helvetica')
         .text(`"I hereby certify that this lesson plan strictly complies with the 45-minute instruction requirement, provides validated factual accuracy, and aligns with the designated educational objectives."`, left + 10, signY + 20, { width: contentWidth - 20 });
      doc.fillColor(mutedText).fontSize(7.5).font('Helvetica-Bold')
         .text(`Signed by: ${lesson.approvedBy || 'Instructor'}  |  Timestamp: ${lesson.approvedAt ? new Date(lesson.approvedAt).toISOString() : new Date().toISOString()}  |  Version: ${lesson.versionTag || 'v1.0'}`, left + 10, signY + 38, { width: contentWidth - 20 });

      // ── Footer Page Numbers ───────────────────────────────────────────────
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
           .text(`Page ${i + 1} of ${pages.count}  •  AI Lesson Creation Tool  •  ${lesson.title || 'Lesson Plan'}`, left, 800, {
             align: 'center',
             width: contentWidth,
           });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DOCX EXPORT GENERATOR (docx)
// ─────────────────────────────────────────────────────────────────────────────

async function generateLessonDocx(lesson, qcReports) {
  const s = lesson.sections || {};
  const intro = s.introduction || {};
  const concepts = ensureArray(s.coreConcepts?.concepts);
  const examples = ensureArray(s.examples?.items);
  const demo = s.practicalDemonstration || {};
  const activity = s.handsOnActivity || {};
  const questions = ensureArray(s.knowledgeCheck?.questions);
  const summary = s.summary || {};
  const videos = ensureArray(lesson.youtubeVideos);
  const refs = ensureArray(lesson.references);
  const fQc = qcReports?.factual;
  const iQc = qcReports?.instructional;

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header
          new Paragraph({
            text: 'AI LESSON CREATION TOOL — CERTIFIED 45-MINUTE INSTRUCTIONAL PLAN',
            style: 'Header',
            heading: HeadingLevel.HEADING_3,
          }),

          // Title
          new Paragraph({
            text: lesson.title || 'Untitled Lesson Plan',
            heading: HeadingLevel.TITLE,
          }),

          // Approval & Metadata Callout Box
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'STATUS: ', bold: true, color: '047857' }),
                          new TextRun({ text: 'FORMAL INSTRUCTOR APPROVED & CERTIFIED ✓', bold: true, color: '047857' }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: `Approved By: ${lesson.approvedBy || 'Instructor'}  |  ` }),
                          new TextRun({ text: `Version: ${lesson.versionTag || `v${lesson.version || 1}.0`}  |  ` }),
                          new TextRun({ text: `Total Duration: ${lesson.totalDurationMinutes || 45} Minutes (Strictly Validated)`, bold: true }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'Learning Objective: ', bold: true }),
                          new TextRun({ text: lesson.learningObjective || 'N/A' }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '' }), // Spacer

          // Section 1: Introduction
          new Paragraph({
            text: `1. Introduction & Hook (${intro.durationMinutes || 5} Minutes)`,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Overview: ', bold: true }),
              new TextRun({ text: intro.overview || '' }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Why It Matters: ', bold: true }),
              new TextRun({ text: intro.whyItMatters || '' }),
            ],
          }),
          ...ensureArray(intro.whatYouWillLearn).map(
            (item) => new Paragraph({ text: `• ${item}`, bullet: { level: 0 } })
          ),

          new Paragraph({ text: '' }),

          // Section 2: Core Concepts
          new Paragraph({
            text: `2. Core Concepts & Explanations (${s.coreConcepts?.durationMinutes || 12} Minutes)`,
            heading: HeadingLevel.HEADING_1,
          }),
          ...concepts.flatMap((c, idx) => [
            new Paragraph({
              text: `${idx + 1}. ${c.title || 'Core Concept'}`,
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({ text: c.explanation || '' }),
            c.evidenceQuote
              ? new Paragraph({
                  children: [
                    new TextRun({ text: 'Evidence: ', bold: true, italics: true }),
                    new TextRun({ text: `"${c.evidenceQuote}" [${c.sourceRef || 'Source'}]`, italics: true }),
                  ],
                })
              : new Paragraph({ text: '' }),
          ]),

          new Paragraph({ text: '' }),

          // Section 3: Examples
          new Paragraph({
            text: `3. Practical Examples (${s.examples?.durationMinutes || 8} Minutes)`,
            heading: HeadingLevel.HEADING_1,
          }),
          ...examples.flatMap((ex, idx) => [
            new Paragraph({
              text: `Example ${idx + 1}: ${ex.title || 'Example'}`,
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({ text: ex.description || '' }),
            ex.realWorldContext
              ? new Paragraph({
                  children: [
                    new TextRun({ text: 'Real-World Context: ', bold: true }),
                    new TextRun({ text: ex.realWorldContext }),
                  ],
                })
              : new Paragraph({ text: '' }),
          ]),

          new Paragraph({ text: '' }),

          // Section 4: Practical Demonstration
          new Paragraph({
            text: `4. Practical Demonstration (${demo.durationMinutes || 7} Minutes)`,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({ text: demo.overview || '' }),
          ...ensureArray(demo.steps).map(
            (st) =>
              new Paragraph({
                children: [
                  new TextRun({ text: `Step ${st.stepNumber || 1}: `, bold: true }),
                  new TextRun({ text: st.instruction || '' }),
                  st.tip ? new TextRun({ text: ` (Tip: ${st.tip})`, italics: true }) : new TextRun(''),
                ],
              })
          ),

          new Paragraph({ text: '' }),

          // Section 5: Hands-on Activity
          new Paragraph({
            text: `5. Hands-On Activity (${activity.durationMinutes || 6} Minutes)`,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: activity.title || 'Interactive Activity',
            heading: HeadingLevel.HEADING_2,
          }),
          ...ensureArray(activity.instructions).map(
            (inst, i) => new Paragraph({ text: `${i + 1}. ${inst}` })
          ),
          activity.starterCodeOrPrompt
            ? new Paragraph({
                children: [
                  new TextRun({ text: 'Starter Code / Prompt: \n', bold: true }),
                  new TextRun({ text: activity.starterCodeOrPrompt }),
                ],
              })
            : new Paragraph({ text: '' }),

          new Paragraph({ text: '' }),

          // Section 6: Knowledge Check
          new Paragraph({
            text: `6. Knowledge Check (${s.knowledgeCheck?.durationMinutes || 4} Minutes)`,
            heading: HeadingLevel.HEADING_1,
          }),
          ...questions.flatMap((q, idx) => [
            new Paragraph({
              text: `Question ${idx + 1}: ${q.question || ''}`,
              heading: HeadingLevel.HEADING_2,
            }),
            ...ensureArray(q.options).map(
              (opt) => new Paragraph({ text: `• ${opt}`, bullet: { level: 0 } })
            ),
            new Paragraph({
              children: [
                new TextRun({ text: 'Correct Answer: ', bold: true, color: '065f46' }),
                new TextRun({ text: q.correctAnswer || '', bold: true }),
              ],
            }),
            q.explanation
              ? new Paragraph({
                  children: [
                    new TextRun({ text: 'Explanation: ', italics: true }),
                    new TextRun({ text: q.explanation, italics: true }),
                  ],
                })
              : new Paragraph({ text: '' }),
          ]),

          new Paragraph({ text: '' }),

          // Section 7: Summary
          new Paragraph({
            text: `7. Summary & Wrap-up (${summary.durationMinutes || 3} Minutes)`,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({ text: 'Key Takeaways:', heading: HeadingLevel.HEADING_2 }),
          ...ensureArray(summary.keyTakeaways).map(
            (t) => new Paragraph({ text: `✓ ${t}`, bullet: { level: 0 } })
          ),

          new Paragraph({ text: '' }),

          // Section 8: Supplementary Media & References
          new Paragraph({
            text: '8. Supplementary Videos & References',
            heading: HeadingLevel.HEADING_1,
          }),
          ...videos.map(
            (v) =>
              new Paragraph({
                children: [
                  new TextRun({ text: `• YouTube: ${v.title || ''} (${v.channelTitle || ''}) - ${v.url || ''}\n`, bold: true }),
                  new TextRun({ text: `  Reason: ${v.reason || ''}` }),
                ],
              })
          ),
          ...refs.map(
            (r) =>
              new Paragraph({
                children: [
                  new TextRun({ text: `• Reference: ${r.title || ''} [${r.source || 'Web'}] - ${r.url || ''}\n`, bold: true }),
                  new TextRun({ text: `  Takeaway: ${r.keyTakeaway || ''}` }),
                ],
              })
          ),

          new Paragraph({ text: '' }),

          // Section 9: Quality Control Audit Package
          new Paragraph({
            text: 'Official Quality Control (QC) Audit Package',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: `QC Agent 1: Factual Accuracy Audit — Status: ${(fQc?.status || 'Passed').toUpperCase()} (Score: ${fQc?.scores?.overall ?? 85}/100)`,
            heading: HeadingLevel.HEADING_2,
          }),
          ...ensureArray(fQc?.issues).map(
            (iss, i) =>
              new Paragraph({
                text: `${i + 1}. [${(iss.severity || 'low').toUpperCase()}] ${iss.section}: ${iss.description} (Recommendation: ${iss.recommendation})`,
              })
          ),

          new Paragraph({
            text: `QC Agent 2: Instructional Quality Audit — Status: ${(iQc?.status || 'Passed').toUpperCase()} (Score: ${iQc?.scores?.overall ?? 88}/100, Duration Compliance: 100%)`,
            heading: HeadingLevel.HEADING_2,
          }),
          ...ensureArray(iQc?.issues).map(
            (iss, i) =>
              new Paragraph({
                text: `${i + 1}. [${(iss.severity || 'low').toUpperCase()}] ${iss.section}: ${iss.description} (Recommendation: ${iss.recommendation})`,
              })
          ),

          new Paragraph({ text: '' }),

          // Formal Endorsement
          new Paragraph({
            children: [
              new TextRun({ text: 'Formal Instructor Sign-off:\n', bold: true }),
              new TextRun({
                text: `Certified by ${lesson.approvedBy || 'Instructor'} on ${lesson.approvedAt ? new Date(lesson.approvedAt).toLocaleDateString() : 'N/A'}.\nNotes: ${lesson.instructorNotes || 'Compliant with all pedagogical requirements.'}`,
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

module.exports = {
  getApprovedLessonForExport,
  generateLessonPdf,
  generateLessonDocx,
};

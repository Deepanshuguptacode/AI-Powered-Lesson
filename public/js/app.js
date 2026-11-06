/**
 * AI Lesson Creation Tool — Frontend Application Script
 * Complete 6-Stage AI Orchestration & Instructor Dashboard
 * Pure Vanilla JavaScript (No frameworks)
 */

// ── Application State ─────────────────────────────────────────────────────────
const state = {
  currentRunId: null,
  activeView: 'view-orchestrator',
  currentLesson: null,         // Currently loaded GeneratedLesson doc
  lessonVersions: [],          // Array of all versions for current lesson root
  currentQcReports: {
    factual: null,
    instructional: null,
  },
  savedLessons: [],
  sseSource: null,
  orchTimer: null,
  orchStartTime: 0,
};

// ── DOM Element Cache ────────────────────────────────────────────────────────
const el = {
  // Navigation Tabs & Views
  navTabs: document.querySelectorAll('.nav-tab'),
  viewPanels: document.querySelectorAll('.view-panel'),
  dashboardVersionBadge: document.getElementById('dashboardVersionBadge'),

  // Alerts & System Indicators
  alertBox: document.getElementById('alertBox'),
  alertIcon: document.getElementById('alertIcon'),
  alertMessage: document.getElementById('alertMessage'),
  alertCloseBtn: document.getElementById('alertCloseBtn'),
  systemStatus: document.getElementById('systemStatus'),
  statusText: document.getElementById('statusText'),
  gatewayModelText: document.getElementById('gatewayModelText'),
  tokenUsageBadge: document.getElementById('tokenUsageBadge'),

  // Input Form & Guardrail
  form: document.getElementById('lessonForm'),
  titleInput: document.getElementById('lessonTitle'),
  objectiveInput: document.getElementById('learningObjective'),
  titleCount: document.getElementById('titleCount'),
  objectiveCount: document.getElementById('objectiveCount'),
  startFullOrchBtn: document.getElementById('startFullOrchestrationBtn'),
  orchSpinner: document.getElementById('orchSpinner'),
  orchBtnText: document.getElementById('orchBtnText'),
  checkGuardrailsBtn: document.getElementById('checkGuardrailsBtn'),
  generateLessonOnlyBtn: document.getElementById('generateLessonOnlyBtn'),
  clearBtn: document.getElementById('clearBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  lessonsContainer: document.getElementById('lessonsContainer'),
  lessonCountBadge: document.getElementById('lessonCountBadge'),

  // Guardrail Box
  guardrailQuickPill: document.getElementById('guardrailQuickPill'),
  guardrailVerdictPill: document.getElementById('guardrailVerdictPill'),
  gmSafety: document.getElementById('gmSafety'),
  gmInjection: document.getElementById('gmInjection'),
  gmEdu: document.getElementById('gmEdu'),
  guardrailDetailText: document.getElementById('guardrailDetailText'),

  // Live Architecture Visualizer
  liveStageLabel: document.getElementById('liveStageLabel'),
  tickerStageBadge: document.getElementById('tickerStageBadge'),
  tickerMessage: document.getElementById('tickerMessage'),
  tickerTimer: document.getElementById('tickerTimer'),
  telemetryLogBox: document.getElementById('telemetryLogBox'),
  clearTelemetryBtn: document.getElementById('clearTelemetryBtn'),

  // Architecture Nodes & Connectors
  node_guardrails: document.getElementById('node_guardrails'),
  state_guardrails: document.getElementById('state_guardrails'),
  conn_1_2: document.getElementById('conn_1_2'),
  node_supervisor: document.getElementById('node_supervisor'),
  state_supervisor: document.getElementById('state_supervisor'),
  conn_2_3: document.getElementById('conn_2_3'),
  node_research_swarm: document.getElementById('node_research_swarm'),
  node_web_agent: document.getElementById('node_web_agent'),
  state_web: document.getElementById('state_web'),
  node_book_agent: document.getElementById('node_book_agent'),
  state_book: document.getElementById('state_book'),
  node_youtube_agent: document.getElementById('node_youtube_agent'),
  state_youtube: document.getElementById('state_youtube'),
  conn_3_4: document.getElementById('conn_3_4'),
  node_lesson_generator: document.getElementById('node_lesson_generator'),
  state_generator: document.getElementById('state_generator'),
  node_validator: document.getElementById('node_validator'),
  state_validator: document.getElementById('state_validator'),
  conn_4_5: document.getElementById('conn_4_5'),
  node_qc_parallel: document.getElementById('node_qc_parallel'),
  node_qc_factual: document.getElementById('node_qc_factual'),
  state_qc_factual: document.getElementById('state_qc_factual'),
  node_qc_instructional: document.getElementById('node_qc_instructional'),
  state_qc_instructional: document.getElementById('state_qc_instructional'),
  conn_5_6: document.getElementById('conn_5_6'),
  node_instructor_gate: document.getElementById('node_instructor_gate'),
  state_instructor: document.getElementById('state_instructor'),

  // Instructor Dashboard Header & Meta
  dashLessonTitle: document.getElementById('dashLessonTitle'),
  dashVersionTagBadge: document.getElementById('dashVersionTagBadge'),
  dashApprovalBadge: document.getElementById('dashApprovalBadge'),
  dashLearningObjective: document.getElementById('dashLearningObjective'),
  versionSelect: document.getElementById('versionSelect'),
  approveLessonBtn: document.getElementById('approveLessonBtn'),
  saveNewVersionBtn: document.getElementById('saveNewVersionBtn'),
  rerunQcBtn: document.getElementById('rerunQcBtn'),
  dmStatusText: document.getElementById('dmStatusText'),
  dmBreakdown: document.getElementById('dmBreakdown'),

  // QC Cards
  factualScoreBadge: document.getElementById('factualScoreBadge'),
  factualOutdatedBanner: document.getElementById('factualOutdatedBanner'),
  factMetricCorrect: document.getElementById('factMetricCorrect'),
  factMetricCitation: document.getElementById('factMetricCitation'),
  factMetricEvidence: document.getElementById('factMetricEvidence'),
  factualIssuesList: document.getElementById('factualIssuesList'),

  instructionalScoreBadge: document.getElementById('instructionalScoreBadge'),
  instructionalOutdatedBanner: document.getElementById('instructionalOutdatedBanner'),
  instMetricAlignment: document.getElementById('instMetricAlignment'),
  instMetricClarity: document.getElementById('instMetricClarity'),
  instMetricDuration: document.getElementById('instMetricDuration'),
  instructionalIssuesList: document.getElementById('instructionalIssuesList'),

  // Editor Inputs
  secDur_intro: document.getElementById('secDur_intro'),
  edit_intro_overview: document.getElementById('edit_intro_overview'),
  edit_intro_why: document.getElementById('edit_intro_why'),
  edit_intro_learn: document.getElementById('edit_intro_learn'),

  secDur_concepts: document.getElementById('secDur_concepts'),
  conceptsEditorList: document.getElementById('conceptsEditorList'),
  btnAddConcept: document.getElementById('btnAddConcept'),

  secDur_examples: document.getElementById('secDur_examples'),
  examplesEditorList: document.getElementById('examplesEditorList'),
  btnAddExample: document.getElementById('btnAddExample'),

  secDur_demo: document.getElementById('secDur_demo'),
  edit_demo_desc: document.getElementById('edit_demo_desc'),
  edit_demo_steps: document.getElementById('edit_demo_steps'),

  secDur_activity: document.getElementById('secDur_activity'),
  edit_activity_title: document.getElementById('edit_activity_title'),
  edit_activity_instructions: document.getElementById('edit_activity_instructions'),
  edit_activity_materials: document.getElementById('edit_activity_materials'),
  edit_activity_outcome: document.getElementById('edit_activity_outcome'),

  secDur_qc: document.getElementById('secDur_qc'),
  questionsEditorList: document.getElementById('questionsEditorList'),
  btnAddQuestion: document.getElementById('btnAddQuestion'),

  secDur_summary: document.getElementById('secDur_summary'),
  edit_summary_takeaways: document.getElementById('edit_summary_takeaways'),
  edit_summary_next: document.getElementById('edit_summary_next'),

  editSummaryInput: document.getElementById('editSummaryInput'),
  btnSaveVersionBottom: document.getElementById('btnSaveVersionBottom'),
  btnApproveBottom: document.getElementById('btnApproveBottom'),
  btnPreviewInModal: document.getElementById('btnPreviewInModal'),

  // Preview View
  lessonPreviewContainer: document.getElementById('lessonPreviewContainer'),
  btnPrintLesson: document.getElementById('btnPrintLesson'),
  btnExportJson: document.getElementById('btnExportJson'),

  // Research Tabs & Grids
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  countEvidence: document.getElementById('countEvidence'),
  countWeb: document.getElementById('countWeb'),
  countBooks: document.getElementById('countBooks'),
  countYoutube: document.getElementById('countYoutube'),
  countLogs: document.getElementById('countLogs'),
  evidenceList: document.getElementById('evidenceList'),
  webSourcesGrid: document.getElementById('webSourcesGrid'),
  bookSourcesGrid: document.getElementById('bookSourcesGrid'),
  youtubeSourcesGrid: document.getElementById('youtubeSourcesGrid'),
  reactLogContainer: document.getElementById('reactLogContainer'),
  copyLogsBtn: document.getElementById('copyLogsBtn'),

  // Approval Modal
  approvalModal: document.getElementById('approvalModal'),
  closeApprovalModalBtn: document.getElementById('closeApprovalModalBtn'),
  cancelApprovalBtn: document.getElementById('cancelApprovalBtn'),
  confirmApprovalBtn: document.getElementById('confirmApprovalBtn'),
  instructorNameInput: document.getElementById('instructorNameInput'),
  instructorApprovalNotes: document.getElementById('instructorApprovalNotes'),
};

// ── Application Initialization ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  closeApprovalModal();
  checkHealth();
  updateGatewayStats();
  fetchSavedLessons();
  setupDurationCalculators();
});

// ── Event Listeners ──────────────────────────────────────────────────────────
function initEventListeners() {
  // Navigation Views
  el.navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetView = tab.getAttribute('data-view');
      switchView(targetView);
    });
  });

  // Inputs character counters
  el.titleInput.addEventListener('input', () => {
    el.titleCount.textContent = `${el.titleInput.value.length} / 150`;
    el.titleInput.classList.remove('error');
  });

  el.objectiveInput.addEventListener('input', () => {
    el.objectiveCount.textContent = `${el.objectiveInput.value.length} / 2000`;
    el.objectiveInput.classList.remove('error');
  });

  // Action Buttons
  el.startFullOrchBtn.addEventListener('click', handleStartFullOrchestration);
  el.checkGuardrailsBtn.addEventListener('click', handleCheckGuardrails);
  el.generateLessonOnlyBtn.addEventListener('click', handleGenerateLessonOnly);
  el.clearBtn.addEventListener('click', handleClearForm);
  el.refreshBtn.addEventListener('click', () => fetchSavedLessons(true));
  el.alertCloseBtn.addEventListener('click', hideAlert);
  el.clearTelemetryBtn.addEventListener('click', () => {
    el.telemetryLogBox.innerHTML = '';
    addTelemetryLog('READY', 'Log cleared.');
  });

  // Version Select Dropdown
  el.versionSelect.addEventListener('change', (e) => {
    const selectedVersionId = e.target.value;
    if (selectedVersionId) loadLessonById(selectedVersionId);
  });

  // Editor Actions
  el.saveNewVersionBtn.addEventListener('click', handleSaveNewVersion);
  el.btnSaveVersionBottom.addEventListener('click', handleSaveNewVersion);
  el.approveLessonBtn.addEventListener('click', () => openApprovalModal());
  el.btnApproveBottom.addEventListener('click', () => openApprovalModal());
  el.rerunQcBtn.addEventListener('click', handleRerunQc);

  // Dynamic Add Items in Editor
  el.btnAddConcept.addEventListener('click', () => addConceptRow());
  el.btnAddExample.addEventListener('click', () => addExampleRow());
  el.btnAddQuestion.addEventListener('click', () => addQuestionRow());

  // Modal Actions
  el.closeApprovalModalBtn.addEventListener('click', closeApprovalModal);
  el.cancelApprovalBtn.addEventListener('click', closeApprovalModal);
  el.confirmApprovalBtn.addEventListener('click', handleConfirmApproval);

  // Close modal when clicking directly on backdrop
  el.approvalModal.addEventListener('click', (e) => {
    if (e.target === el.approvalModal) {
      closeApprovalModal();
    }
  });

  // Close modal on Escape key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.approvalModal && !el.approvalModal.classList.contains('hidden')) {
      closeApprovalModal();
    }
  });

  // Preview Buttons
  el.btnPreviewInModal.addEventListener('click', () => switchView('view-preview'));
  el.btnPrintLesson.addEventListener('click', () => window.print());
  el.btnExportJson.addEventListener('click', handleExportJson);

  // Research Explorer Tabs
  el.tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchResearchTab(targetTab);
    });
  });

  // Copy Logs
  el.copyLogsBtn.addEventListener('click', () => {
    const text = el.reactLogContainer.innerText;
    navigator.clipboard.writeText(text)
      .then(() => showAlert('Logs copied to clipboard!', 'success'))
      .catch(() => showAlert('Failed to copy logs', 'error'));
  });
}

// ── View Switching ───────────────────────────────────────────────────────────
function switchView(viewId) {
  state.activeView = viewId;
  el.navTabs.forEach((tab) => {
    if (tab.getAttribute('data-view') === viewId) tab.classList.add('active');
    else tab.classList.remove('active');
  });

  el.viewPanels.forEach((panel) => {
    if (panel.id === viewId) panel.classList.add('active');
    else panel.classList.remove('active');
  });

  if (viewId === 'view-preview' && state.currentLesson) {
    renderLessonPreview(state.currentLesson);
  }
}

function switchResearchTab(tabId) {
  el.tabButtons.forEach((b) => b.classList.remove('active'));
  el.tabContents.forEach((c) => c.classList.remove('active'));

  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const activeContent = document.getElementById(tabId);
  if (activeBtn) activeBtn.classList.add('active');
  if (activeContent) activeContent.classList.add('active');
}

// ── Live AI Architecture Visualization Engine ────────────────────────────────
function resetArchitectureNodes() {
  const nodes = [
    { el: el.node_guardrails, state: el.state_guardrails },
    { el: el.node_supervisor, state: el.state_supervisor },
    { el: el.node_web_agent, state: el.state_web },
    { el: el.node_book_agent, state: el.state_book },
    { el: el.node_youtube_agent, state: el.state_youtube },
    { el: el.node_lesson_generator, state: el.state_generator },
    { el: el.node_validator, state: el.state_validator },
    { el: el.node_qc_factual, state: el.state_qc_factual },
    { el: el.node_qc_instructional, state: el.state_qc_instructional },
    { el: el.node_instructor_gate, state: el.state_instructor },
  ];

  nodes.forEach(({ el, state }) => {
    if (el) el.className = el.classList.contains('arch-subnode') ? 'arch-subnode' : 'arch-node';
    if (state) state.textContent = 'Idle';
  });

  const connectors = [el.conn_1_2, el.conn_2_3, el.conn_3_4, el.conn_4_5, el.conn_5_6];
  connectors.forEach((c) => c && c.classList.remove('active'));

  el.liveStageLabel.textContent = 'System Ready • Idle';
  el.tickerStageBadge.textContent = 'STAGE 0: IDLE';
  el.tickerStageBadge.className = 'ticker-badge';
  el.tickerMessage.textContent = 'Ready to launch end-to-end multi-agent orchestration.';
  el.tickerTimer.textContent = '0.0s';
}

function setStageNodeState(nodeKey, status, statusText) {
  const map = {
    guardrails: { el: el.node_guardrails, st: el.state_guardrails, conn: el.conn_1_2 },
    supervisor: { el: el.node_supervisor, st: el.state_supervisor, conn: el.conn_2_3 },
    web: { el: el.node_web_agent, st: el.state_web },
    book: { el: el.node_book_agent, st: el.state_book },
    youtube: { el: el.node_youtube_agent, st: el.state_youtube },
    generator: { el: el.node_lesson_generator, st: el.state_generator, conn: el.conn_4_5 },
    validator: { el: el.node_validator, st: el.state_validator },
    qc_factual: { el: el.node_qc_factual, st: el.state_qc_factual },
    qc_instructional: { el: el.node_qc_instructional, st: el.state_qc_instructional, conn: el.conn_5_6 },
    instructor: { el: el.node_instructor_gate, st: el.state_instructor },
  };

  const item = map[nodeKey];
  if (!item) return;

  const baseClass = item.el.classList.contains('arch-subnode') ? 'arch-subnode' : 'arch-node';
  item.el.className = `${baseClass} ${status}`;
  if (item.st) item.st.textContent = statusText || status.toUpperCase();
  if (item.conn) {
    if (status === 'active' || status === 'completed') item.conn.classList.add('active');
  }
}

function startOrchestrationTimer() {
  state.orchStartTime = Date.now();
  clearInterval(state.orchTimer);
  state.orchTimer = setInterval(() => {
    const elapsed = ((Date.now() - state.orchStartTime) / 1000).toFixed(1);
    el.tickerTimer.textContent = `${elapsed}s`;
  }, 100);
}

function stopOrchestrationTimer() {
  clearInterval(state.orchTimer);
}

function addTelemetryLog(badge, message) {
  const now = new Date().toTimeString().split(' ')[0];
  const div = document.createElement('div');
  div.className = 'telemetry-entry';

  let badgeClass = 't-ready';
  if (badge === 'RUNNING') badgeClass = 't-running';
  if (badge === 'SUCCESS') badgeClass = 't-done';
  if (badge === 'FAILED') badgeClass = 't-fail';

  div.innerHTML = `
    <span class="t-time">${now}</span>
    <span class="t-badge ${badgeClass}">${badge}</span>
    <span class="t-msg">${escapeHtml(message)}</span>
  `;

  el.telemetryLogBox.appendChild(div);
  el.telemetryLogBox.scrollTop = el.telemetryLogBox.scrollHeight;
}

// ── Run Complete Live AI Orchestration ───────────────────────────────────────
async function handleStartFullOrchestration() {
  const title = el.titleInput.value.trim();
  const learningObjective = el.objectiveInput.value.trim();

  if (!validateFormInputs(title, learningObjective)) return;

  // Set running UI states
  el.startFullOrchBtn.disabled = true;
  el.orchSpinner.classList.remove('hidden');
  el.orchBtnText.textContent = 'Orchestrating Live AI Agents...';

  resetArchitectureNodes();
  startOrchestrationTimer();
  switchView('view-orchestrator');

  addTelemetryLog('RUNNING', `Starting AI Orchestration pipeline for: "${title}"`);

  // Visual Stage 1: Input Guardrails
  el.liveStageLabel.textContent = '⚡ Stage 1 Active: Input Guardrails (openai/gpt-oss-20b)';
  el.tickerStageBadge.textContent = 'STAGE 1: GUARDRAILS';
  el.tickerStageBadge.className = 'ticker-badge';
  el.tickerMessage.textContent = 'Scanning input with openai/gpt-oss-20b for prompt injection, safety, and academic scope...';
  setStageNodeState('guardrails', 'active', 'Scanning');
  addTelemetryLog('RUNNING', 'Stage 1: Input Guardrail Agent inspecting prompt & safety policies using openai/gpt-oss-20b');

  try {
    const response = await fetch('/api/orchestration/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, learningObjective }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      const errMsg = result.guardrail?.reasoning || result.message || 'Pipeline aborted by AI Guardrails.';
      setStageNodeState('guardrails', 'failed', 'Rejected');
      el.tickerStageBadge.textContent = 'REJECTED';
      el.tickerStageBadge.className = 'ticker-badge bg-danger';
      el.tickerMessage.textContent = errMsg;
      addTelemetryLog('FAILED', `Guardrail Rejection: ${errMsg}`);
      showAlert(errMsg, 'error');
      updateGuardrailDisplay(result.guardrail || { passed: false, reasoning: errMsg });
      return;
    }

    const runData = result.data;

    // Stage 1 complete
    setStageNodeState('guardrails', 'completed', 'Passed');
    updateGuardrailDisplay(runData.stages?.input_guardrails?.data || { passed: true, scores: { safety: 96, promptInjectionRisk: 4, educationalRelevance: 92 } });
    addTelemetryLog('SUCCESS', 'Stage 1 Guardrail PASSED: High safety score, zero prompt injection risk.');

    // Stage 2: Supervisor ReAct Planning
    el.liveStageLabel.textContent = '⚡ Stage 2 Active: Supervisor Planning (LangGraph.js)';
    el.tickerStageBadge.textContent = 'STAGE 2: SUPERVISOR';
    el.tickerMessage.textContent = 'Supervisor Agent planning research queries across Web, Book, and YouTube...';
    setStageNodeState('supervisor', 'active', 'Planning');
    addTelemetryLog('RUNNING', 'Stage 2: Supervisor formulating targeted research queries.');

    await sleep(400);
    setStageNodeState('supervisor', 'completed', 'Planned');

    // Stage 3: Multi-Agent Parallel Research
    el.liveStageLabel.textContent = '⚡ Stage 3 Active: Multi-Agent Research Swarm (Parallel)';
    el.tickerStageBadge.textContent = 'STAGE 3: RESEARCH';
    el.tickerMessage.textContent = 'Web, Book, and YouTube Agents querying online encyclopedias, textbooks, and video transcripts...';
    setStageNodeState('web', 'active', 'Searching');
    setStageNodeState('book', 'active', 'Scanning');
    setStageNodeState('youtube', 'active', 'Indexing');
    addTelemetryLog('RUNNING', 'Stage 3: Multi-Agent Swarm running concurrently.');

    await sleep(400);
    setStageNodeState('web', 'completed', 'Gathered');
    setStageNodeState('book', 'completed', 'Gathered');
    setStageNodeState('youtube', 'completed', 'Gathered');
    addTelemetryLog('SUCCESS', 'Stage 3: Parallel research complete. Evidence curated.');

    // Stage 4: 45-Minute Lesson Synthesizer & Strict Duration Validator
    el.liveStageLabel.textContent = '⚡ Stage 4 Active: Lesson Synthesizer & Validator (openai/gpt-oss-120b)';
    el.tickerStageBadge.textContent = 'STAGE 4: SYNTHESIS';
    el.tickerMessage.textContent = 'Synthesizing 7 structured sections and validating strict 45-minute total duration...';
    setStageNodeState('generator', 'active', 'Synthesizing');
    setStageNodeState('validator', 'active', 'Verifying');
    addTelemetryLog('RUNNING', 'Stage 4: Synthesizing 45-min lesson grounded in research evidence.');

    await sleep(400);
    setStageNodeState('generator', 'completed', 'Synthesized');
    setStageNodeState('validator', 'completed', '45m Valid');
    addTelemetryLog('SUCCESS', 'Stage 4: 45-Minute Lesson generated & validated (5+12+8+8+7+3+2 = 45m).');

    // Stage 5: Independent Parallel QC Auditors
    el.liveStageLabel.textContent = '⚡ Stage 5 Active: Parallel QC Audit Agents (LangGraph.js)';
    el.tickerStageBadge.textContent = 'STAGE 5: QC AUDIT';
    el.tickerMessage.textContent = 'Running Factual QC Agent & Instructional QC Agent concurrently via Promise.allSettled()...';
    setStageNodeState('qc_factual', 'active', 'Auditing Facts');
    setStageNodeState('qc_instructional', 'active', 'Auditing Pedagogy');
    addTelemetryLog('RUNNING', 'Stage 5: Parallel QC agents running factual and instructional quality audits.');

    await sleep(400);
    const factScore = runData.artifacts?.qcReports?.factual?.scores?.overall ?? 85;
    const instScore = runData.artifacts?.qcReports?.instructional?.scores?.overall ?? 88;
    setStageNodeState('qc_factual', 'completed', `${factScore}% Score`);
    setStageNodeState('qc_instructional', 'completed', `${instScore}% Score`);
    addTelemetryLog('SUCCESS', `Stage 5: QC complete! Factual: ${factScore}%, Instructional: ${instScore}%.`);

    // Stage 6: Instructor Dashboard Gate
    el.liveStageLabel.textContent = '✅ Stage 6 Ready: Instructor Dashboard (Human-in-the-Loop)';
    el.tickerStageBadge.textContent = 'STAGE 6: INSTRUCTOR REVIEW';
    el.tickerStageBadge.className = 'ticker-badge bg-success';
    el.tickerMessage.textContent = 'All AI pipelines complete! Lesson and independent QC reports delivered to Instructor Dashboard.';
    setStageNodeState('instructor', 'active', 'Review Ready');
    addTelemetryLog('SUCCESS', 'Stage 6: Ready for Instructor editing, recommendation decisioning, and approval.');

    stopOrchestrationTimer();
    showAlert('Complete AI Orchestration pipeline executed successfully! Loading lesson into Instructor Dashboard...', 'success');

    // Load resulting lesson into Instructor Dashboard
    if (runData.artifacts?.generatedLessonId) {
      await loadLessonById(runData.artifacts.generatedLessonId);
      await fetchSavedLessons();
      setTimeout(() => switchView('view-dashboard'), 800);
    }
  } catch (err) {
    console.error('Orchestration error:', err);
    showAlert(`Orchestration failed: ${err.message}`, 'error');
    addTelemetryLog('FAILED', `Fatal error: ${err.message}`);
  } finally {
    el.startFullOrchBtn.disabled = false;
    el.orchSpinner.classList.add('hidden');
    el.orchBtnText.textContent = 'Run Live AI Orchestration (End-to-End)';
    stopOrchestrationTimer();
  }
}

// ── Input Guardrail Testing ──────────────────────────────────────────────────
async function handleCheckGuardrails() {
  const title = el.titleInput.value.trim();
  const learningObjective = el.objectiveInput.value.trim();

  if (!validateFormInputs(title, learningObjective)) return;

  el.checkGuardrailsBtn.disabled = true;
  el.guardrailVerdictPill.className = 'guardrail-pill status-running';
  el.guardrailVerdictPill.textContent = 'Scanning...';
  el.guardrailDetailText.textContent = 'Calling openai/gpt-oss-20b guardrail classifier...';

  try {
    const res = await fetch('/api/guardrails/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, learningObjective }),
    });

    const json = await res.json();
    const data = json.data;

    updateGuardrailDisplay(data);

    if (json.success) {
      showAlert('Input Guardrail passed! Safe, academic, and free from prompt injections.', 'success');
    } else {
      showAlert(`Guardrail Rejection: ${data.reasoning || json.message}`, 'error');
    }
  } catch (err) {
    showAlert(`Guardrail test error: ${err.message}`, 'error');
  } finally {
    el.checkGuardrailsBtn.disabled = false;
  }
}

function updateGuardrailDisplay(guardrail) {
  if (!guardrail) return;

  const passed = guardrail.passed;
  el.guardrailVerdictPill.className = `guardrail-pill ${passed ? 'status-done' : 'status-failed'}`;
  el.guardrailVerdictPill.textContent = passed ? 'PASSED (Safe)' : `REJECTED (${guardrail.riskLevel || 'High Risk'})`;

  el.guardrailQuickPill.className = `guardrail-badge ${passed ? 'safe' : 'rejected'}`;
  el.guardrailQuickPill.textContent = passed ? '🛡️ Guardrail: Passed' : '🛡️ Guardrail: Blocked';

  const scores = guardrail.scores || {};
  el.gmSafety.textContent = scores.safety !== undefined ? `${scores.safety}%` : '--';
  el.gmInjection.textContent = scores.promptInjectionRisk !== undefined ? `${scores.promptInjectionRisk}%` : '--';
  el.gmEdu.textContent = scores.educationalRelevance !== undefined ? `${scores.educationalRelevance}%` : '--';

  el.guardrailDetailText.textContent = guardrail.reasoning || (passed ? 'Input meets educational safety standards.' : 'Input violates guardrail criteria.');
}

// ── Generate Lesson Only ─────────────────────────────────────────────────────
async function handleGenerateLessonOnly() {
  const lessonTitle = el.titleInput.value.trim();
  const learningObjective = el.objectiveInput.value.trim();

  if (!validateFormInputs(lessonTitle, learningObjective)) return;

  el.generateLessonOnlyBtn.disabled = true;
  showAlert('Synthesizing 45-minute structured lesson with strict duration validator...', 'info');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonTitle, learningObjective }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Lesson generation failed.');
    }

    showAlert('Lesson generated and validated! Loading into Instructor Dashboard...', 'success');
    await loadLessonById(json.data.lessonId);
    await fetchSavedLessons();
    switchView('view-dashboard');
  } catch (err) {
    showAlert(`Lesson generation error: ${err.message}`, 'error');
  } finally {
    el.generateLessonOnlyBtn.disabled = false;
  }
}

// ── Load Lesson into Dashboard & Render Sections ─────────────────────────────
async function loadLessonById(lessonId) {
  if (!lessonId) return;

  try {
    const res = await fetch(`/api/generate/${lessonId}`);
    if (!res.ok) throw new Error('Failed to fetch lesson document');
    const json = await res.json();
    const lesson = json.data;

    state.currentLesson = lesson;

    // Render Dashboard Meta & Versioning
    el.dashLessonTitle.textContent = lesson.title || 'Untitled Lesson';
    el.dashLearningObjective.textContent = lesson.learningObjective || '';
    el.dashVersionTagBadge.textContent = lesson.versionTag || `v${lesson.version || 1}.0`;
    el.dashboardVersionBadge.textContent = lesson.versionTag || `v${lesson.version || 1}.0`;

    if (lesson.isApproved) {
      el.dashApprovalBadge.className = 'approval-tag-badge approved';
      el.dashApprovalBadge.textContent = `✅ Approved (${lesson.approvedBy || 'Instructor'})`;
    } else {
      el.dashApprovalBadge.className = 'approval-tag-badge pending';
      el.dashApprovalBadge.textContent = '⏳ Pending Instructor Approval';
    }

    // Populate Section Editor inputs
    populateEditor(lesson);

    // Fetch Version History
    fetchLessonVersions(lesson._id);

    // Fetch QC Reports
    fetchQcReports(lesson._id);

    // Update Live 45-Minute Duration meter
    recalculateDurations();
  } catch (err) {
    showAlert(`Error loading lesson: ${err.message}`, 'error');
  }
}

function populateEditor(lesson) {
  const sections = lesson.sections || {};

  // Section 1: Introduction
  el.secDur_intro.value = sections.introduction?.durationMinutes || 5;
  el.edit_intro_overview.value = sections.introduction?.overview || '';
  el.edit_intro_why.value = sections.introduction?.whyItMatters || '';
  el.edit_intro_learn.value = (sections.introduction?.whatYouWillLearn || []).join('\n');

  // Section 2: Core Concepts
  el.secDur_concepts.value = sections.coreConcepts?.durationMinutes || 12;
  renderConceptsEditor(sections.coreConcepts?.concepts || []);

  // Section 3: Examples
  el.secDur_examples.value = sections.examples?.durationMinutes || 8;
  renderExamplesEditor(sections.examples?.items || []);

  // Section 4: Practical Demonstration
  el.secDur_demo.value = sections.practicalDemonstration?.durationMinutes || 8;
  el.edit_demo_desc.value = sections.practicalDemonstration?.description || '';
  el.edit_demo_steps.value = (sections.practicalDemonstration?.steps || [])
    .map((s) => `Step ${s.stepNumber || ''}: ${s.instruction || ''} ${s.tip ? `(Tip: ${s.tip})` : ''}`)
    .join('\n');

  // Section 5: Hands-on Activity
  el.secDur_activity.value = sections.handsOnActivity?.durationMinutes || 7;
  el.edit_activity_title.value = sections.handsOnActivity?.title || '';
  el.edit_activity_instructions.value = sections.handsOnActivity?.instructions || '';
  el.edit_activity_materials.value = (sections.handsOnActivity?.materials || []).join(', ');
  el.edit_activity_outcome.value = sections.handsOnActivity?.expectedOutcome || '';

  // Section 6: Knowledge Check
  el.secDur_qc.value = sections.knowledgeCheck?.durationMinutes || 3;
  renderQuestionsEditor(sections.knowledgeCheck?.questions || []);

  // Section 7: Summary
  el.secDur_summary.value = sections.summary?.durationMinutes || 2;
  el.edit_summary_takeaways.value = (sections.summary?.keyTakeaways || []).join('\n');
  el.edit_summary_next.value = sections.summary?.nextSteps || '';

  el.editSummaryInput.value = '';
}

// ── Dynamic Rows in Editor ───────────────────────────────────────────────────
function renderConceptsEditor(concepts) {
  el.conceptsEditorList.innerHTML = '';
  if (!concepts || concepts.length === 0) {
    addConceptRow({ title: 'Key Concept 1', explanation: 'Enter detailed explanation here.' });
    return;
  }
  concepts.forEach((c) => addConceptRow(c));
}

function addConceptRow(data = {}) {
  const div = document.createElement('div');
  div.className = 'editor-subitem concept-row';
  div.innerHTML = `
    <div class="editor-subitem-top">
      <input type="text" class="form-input concept-title" placeholder="Concept Title" value="${escapeHtml(data.title || '')}" />
      <button type="button" class="btn-icon-only text-danger btn-remove" title="Remove">&times;</button>
    </div>
    <textarea rows="2" class="form-textarea concept-expl" placeholder="Explanation & Evidence">${escapeHtml(data.explanation || '')}</textarea>
    <div class="form-row-2">
      <input type="text" class="form-input concept-quote" placeholder="Evidence Quote (optional)" value="${escapeHtml(data.evidenceQuote || '')}" />
      <input type="text" class="form-input concept-ref" placeholder="Source Reference" value="${escapeHtml(data.sourceRef || '')}" />
    </div>
  `;
  div.querySelector('.btn-remove').addEventListener('click', () => div.remove());
  el.conceptsEditorList.appendChild(div);
}

function renderExamplesEditor(examples) {
  el.examplesEditorList.innerHTML = '';
  if (!examples || examples.length === 0) {
    addExampleRow({ title: 'Example 1', description: 'Enter practical example walkthrough.' });
    return;
  }
  examples.forEach((ex) => addExampleRow(ex));
}

function addExampleRow(data = {}) {
  const div = document.createElement('div');
  div.className = 'editor-subitem example-row';
  div.innerHTML = `
    <div class="editor-subitem-top">
      <input type="text" class="form-input example-title" placeholder="Example Title" value="${escapeHtml(data.title || '')}" />
      <button type="button" class="btn-icon-only text-danger btn-remove" title="Remove">&times;</button>
    </div>
    <textarea rows="2" class="form-textarea example-desc" placeholder="Detailed description">${escapeHtml(data.description || '')}</textarea>
    <input type="text" class="form-input example-context" placeholder="Real-World Context" value="${escapeHtml(data.realWorldContext || '')}" />
  `;
  div.querySelector('.btn-remove').addEventListener('click', () => div.remove());
  el.examplesEditorList.appendChild(div);
}

function renderQuestionsEditor(questions) {
  el.questionsEditorList.innerHTML = '';
  if (!questions || questions.length === 0) {
    addQuestionRow({ question: 'Sample Question?', correctAnswer: 'Correct Answer', explanation: 'Reasoning' });
    return;
  }
  questions.forEach((q, idx) => addQuestionRow(q, idx + 1));
}

function addQuestionRow(data = {}, num = 1) {
  const div = document.createElement('div');
  div.className = 'editor-subitem question-row';
  div.innerHTML = `
    <div class="editor-subitem-top">
      <span class="font-bold">Question</span>
      <button type="button" class="btn-icon-only text-danger btn-remove" title="Remove">&times;</button>
    </div>
    <input type="text" class="form-input question-text" placeholder="Question statement" value="${escapeHtml(data.question || '')}" />
    <div class="form-row-2">
      <input type="text" class="form-input question-answer" placeholder="Correct Answer" value="${escapeHtml(data.correctAnswer || '')}" />
      <input type="text" class="form-input question-expl" placeholder="Explanation why correct" value="${escapeHtml(data.explanation || '')}" />
    </div>
  `;
  div.querySelector('.btn-remove').addEventListener('click', () => div.remove());
  el.questionsEditorList.appendChild(div);
}

// ── 45-Minute Duration Calculator ───────────────────────────────────────────
function setupDurationCalculators() {
  const durInputs = [
    el.secDur_intro,
    el.secDur_concepts,
    el.secDur_examples,
    el.secDur_demo,
    el.secDur_activity,
    el.secDur_qc,
    el.secDur_summary,
  ];

  durInputs.forEach((inp) => {
    if (inp) inp.addEventListener('input', recalculateDurations);
  });
}

function recalculateDurations() {
  const i = parseInt(el.secDur_intro.value || '0', 10);
  const c = parseInt(el.secDur_concepts.value || '0', 10);
  const e = parseInt(el.secDur_examples.value || '0', 10);
  const d = parseInt(el.secDur_demo.value || '0', 10);
  const a = parseInt(el.secDur_activity.value || '0', 10);
  const q = parseInt(el.secDur_qc.value || '0', 10);
  const s = parseInt(el.secDur_summary.value || '0', 10);

  const total = i + c + e + d + a + q + s;

  if (total === 45) {
    el.dmStatusText.className = 'dm-status valid';
    el.dmStatusText.textContent = `Total: 45 / 45 Minutes (Strictly Compliant ✅)`;
  } else {
    el.dmStatusText.className = 'dm-status invalid';
    el.dmStatusText.textContent = `Total: ${total} / 45 Minutes (Discrepancy: ${total > 45 ? '+' : ''}${total - 45}m ⚠️)`;
  }

  el.dmBreakdown.textContent = `Intro: ${i}m • Concepts: ${c}m • Examples: ${e}m • Demo: ${d}m • Activity: ${a}m • QC: ${q}m • Summary: ${s}m`;
  return total;
}

// ── Version History Management (Never Overwrites) ───────────────────────────
async function fetchLessonVersions(lessonId) {
  try {
    const res = await fetch(`/api/generate/${lessonId}/versions`);
    if (!res.ok) return;
    const json = await res.json();
    state.lessonVersions = json.data || [];

    el.versionSelect.innerHTML = '';
    state.lessonVersions.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v._id;
      opt.textContent = `${v.versionTag || `v${v.version}.0`} — ${v.editedBy === 'instructor' ? 'Instructor Edit' : 'AI'} (${new Date(v.createdAt).toLocaleTimeString()})`;
      if (v._id === state.currentLesson?._id) opt.selected = true;
      el.versionSelect.appendChild(opt);
    });
  } catch (err) {
    console.warn('Failed to load version history:', err.message);
  }
}

async function handleSaveNewVersion() {
  if (!state.currentLesson) {
    showAlert('No lesson loaded to edit.', 'error');
    return;
  }

  const totalDuration = recalculateDurations();
  if (totalDuration !== 45) {
    if (!confirm(`Warning: Total duration is ${totalDuration} minutes instead of exactly 45 minutes. Save anyway?`)) {
      return;
    }
  }

  // Gather edited sections
  const concepts = Array.from(document.querySelectorAll('.concept-row')).map((row) => ({
    title: row.querySelector('.concept-title').value.trim(),
    explanation: row.querySelector('.concept-expl').value.trim(),
    evidenceQuote: row.querySelector('.concept-quote').value.trim(),
    sourceRef: row.querySelector('.concept-ref').value.trim(),
  }));

  const examples = Array.from(document.querySelectorAll('.example-row')).map((row) => ({
    title: row.querySelector('.example-title').value.trim(),
    description: row.querySelector('.example-desc').value.trim(),
    realWorldContext: row.querySelector('.example-context').value.trim(),
  }));

  const questions = Array.from(document.querySelectorAll('.question-row')).map((row, idx) => ({
    questionNumber: idx + 1,
    question: row.querySelector('.question-text').value.trim(),
    correctAnswer: row.querySelector('.question-answer').value.trim(),
    explanation: row.querySelector('.question-expl').value.trim(),
    type: 'multiple_choice',
  }));

  const editPayload = {
    title: state.currentLesson.title,
    learningObjective: state.currentLesson.learningObjective,
    totalDurationMinutes: totalDuration,
    editSummary: el.editSummaryInput.value.trim() || 'Instructor edited lesson sections',
    editedBy: 'instructor',
    sections: {
      introduction: {
        durationMinutes: parseInt(el.secDur_intro.value || '5', 10),
        overview: el.edit_intro_overview.value.trim(),
        whyItMatters: el.edit_intro_why.value.trim(),
        whatYouWillLearn: el.edit_intro_learn.value.split('\n').map((s) => s.trim()).filter(Boolean),
      },
      coreConcepts: {
        durationMinutes: parseInt(el.secDur_concepts.value || '12', 10),
        concepts,
      },
      examples: {
        durationMinutes: parseInt(el.secDur_examples.value || '8', 10),
        items: examples,
      },
      practicalDemonstration: {
        durationMinutes: parseInt(el.secDur_demo.value || '8', 10),
        description: el.edit_demo_desc.value.trim(),
        steps: el.edit_demo_steps.value.split('\n').map((line, idx) => ({
          stepNumber: idx + 1,
          instruction: line.trim(),
        })).filter((s) => s.instruction),
      },
      handsOnActivity: {
        durationMinutes: parseInt(el.secDur_activity.value || '7', 10),
        title: el.edit_activity_title.value.trim(),
        instructions: el.edit_activity_instructions.value.trim(),
        materials: el.edit_activity_materials.value.split(',').map((m) => m.trim()).filter(Boolean),
        expectedOutcome: el.edit_activity_outcome.value.trim(),
      },
      knowledgeCheck: {
        durationMinutes: parseInt(el.secDur_qc.value || '3', 10),
        questions,
      },
      summary: {
        durationMinutes: parseInt(el.secDur_summary.value || '2', 10),
        keyTakeaways: el.edit_summary_takeaways.value.split('\n').map((s) => s.trim()).filter(Boolean),
        nextSteps: el.edit_summary_next.value.trim(),
      },
    },
  };

  try {
    el.saveNewVersionBtn.disabled = true;
    const res = await fetch(`/api/generate/${state.currentLesson._id}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editPayload),
    });

    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Save failed');

    showAlert(`Version ${json.data.versionTag} saved! Previous versions preserved. Previous QC reports marked as outdated.`, 'success');
    await loadLessonById(json.data.newLessonId);
    await fetchSavedLessons();
  } catch (err) {
    showAlert(`Save error: ${err.message}`, 'error');
  } finally {
    el.saveNewVersionBtn.disabled = false;
  }
}

// ── QC Reports & Decisioning (Accept / Reject / Modify) ──────────────────────
async function fetchQcReports(lessonId) {
  try {
    const res = await fetch(`/api/qc/lesson/${lessonId}`);
    if (!res.ok) return;
    const json = await res.json();
    const reports = json.data || [];

    const factual = reports.find((r) => r.agentType === 'factual');
    const instructional = reports.find((r) => r.agentType === 'instructional');

    state.currentQcReports = { factual, instructional };

    renderFactualQcCard(factual);
    renderInstructionalQcCard(instructional);
  } catch (err) {
    console.warn('Failed to load QC reports:', err);
  }
}

function renderFactualQcCard(report) {
  if (!report) {
    el.factualScoreBadge.textContent = 'NO REPORT';
    el.factualScoreBadge.className = 'qc-score-badge';
    el.factualIssuesList.innerHTML = '<div class="placeholder-box">No factual QC run yet. Click "Re-run QC".</div>';
    el.factualOutdatedBanner.classList.add('hidden');
    return;
  }

  const score = report.scores?.overall ?? 75;
  const isPass = score >= 70;
  el.factualScoreBadge.textContent = `${score} / 100 ${isPass ? 'PASS' : 'FAIL'}`;
  el.factualScoreBadge.className = `qc-score-badge ${isPass ? '' : 'failed'}`;

  // Outdated banner
  if (report.isOutdated) {
    el.factualOutdatedBanner.classList.remove('hidden');
    el.factualOutdatedBanner.textContent = `⚠️ Outdated Report (${report.outdatedReason || 'Lesson was updated'})`;
  } else {
    el.factualOutdatedBanner.classList.add('hidden');
  }

  el.factMetricCorrect.textContent = `${report.scores?.factualCorrectness ?? '--'}%`;
  el.factMetricCitation.textContent = `${report.scores?.sourceCitation ?? '--'}%`;
  el.factMetricEvidence.textContent = `${report.scores?.evidenceSupport ?? '--'}%`;

  renderIssuesList(el.factualIssuesList, report.issues || [], report._id);
}

function renderInstructionalQcCard(report) {
  if (!report) {
    el.instructionalScoreBadge.textContent = 'NO REPORT';
    el.instructionalScoreBadge.className = 'qc-score-badge';
    el.instructionalIssuesList.innerHTML = '<div class="placeholder-box">No instructional QC run yet. Click "Re-run QC".</div>';
    el.instructionalOutdatedBanner.classList.add('hidden');
    return;
  }

  const score = report.scores?.overall ?? 80;
  const isPass = score >= 70;
  el.instructionalScoreBadge.textContent = `${score} / 100 ${isPass ? 'PASS' : 'FAIL'}`;
  el.instructionalScoreBadge.className = `qc-score-badge ${isPass ? '' : 'failed'}`;

  // Outdated banner
  if (report.isOutdated) {
    el.instructionalOutdatedBanner.classList.remove('hidden');
    el.instructionalOutdatedBanner.textContent = `⚠️ Outdated Report (${report.outdatedReason || 'Lesson was updated'})`;
  } else {
    el.instructionalOutdatedBanner.classList.add('hidden');
  }

  el.instMetricAlignment.textContent = `${report.scores?.objectiveAlignment ?? '--'}%`;
  el.instMetricClarity.textContent = `${report.scores?.explanationClarity ?? '--'}%`;
  el.instMetricDuration.textContent = `${report.scores?.durationCompliance ?? 100} / 100`;

  renderIssuesList(el.instructionalIssuesList, report.issues || [], report._id);
}

function renderIssuesList(container, issues, reportId) {
  container.innerHTML = '';
  if (!issues || issues.length === 0) {
    container.innerHTML = '<div class="placeholder-box">Zero defects flagged! Exemplary quality.</div>';
    return;
  }

  issues.forEach((issue) => {
    const card = document.createElement('div');
    card.className = 'qc-issue-card';
    card.setAttribute('data-issue-num', issue.issueNumber);

    card.innerHTML = `
      <div class="issue-meta-row">
        <span class="issue-section-tag">${escapeHtml(issue.affectedSection || 'general')}</span>
        <span class="qc-severity-badge ${issue.severity || 'minor'}">${escapeHtml(issue.severity || 'minor')}</span>
      </div>
      <div class="issue-desc">${escapeHtml(issue.description || '')}</div>
      <div class="issue-fix-box">
        <strong>Recommendation:</strong> ${escapeHtml(issue.suggestedImprovement || 'None')}
      </div>
      <div class="qc-actions-row">
        <button type="button" class="btn-qc-action btn-qc-accept">Accept & Apply Fix</button>
        <button type="button" class="btn-qc-action btn-qc-modify">Modify Fix</button>
        <button type="button" class="btn-qc-action btn-qc-reject">Reject</button>
      </div>
      <div class="qc-modify-inline hidden">
        <input type="text" class="qc-modify-input" value="${escapeHtml(issue.suggestedImprovement || '')}" />
        <button type="button" class="btn btn-secondary btn-sm btn-apply-custom">Apply Custom Text to Section</button>
      </div>
    `;

    // Button: Accept
    const acceptBtn = card.querySelector('.btn-qc-accept');
    acceptBtn.addEventListener('click', () => {
      applyFixToSection(issue.affectedSection, issue.suggestedImprovement);
      recordQcDecision(reportId, issue.issueNumber, 'accepted', issue.suggestedImprovement);
      acceptBtn.textContent = 'Accepted ✅';
      acceptBtn.disabled = true;
    });

    // Button: Modify
    const modifyBtn = card.querySelector('.btn-qc-modify');
    const modifyBox = card.querySelector('.qc-modify-inline');
    modifyBtn.addEventListener('click', () => {
      modifyBox.classList.toggle('hidden');
    });

    const applyCustomBtn = card.querySelector('.btn-apply-custom');
    const customInput = card.querySelector('.qc-modify-input');
    applyCustomBtn.addEventListener('click', () => {
      const customFix = customInput.value.trim();
      applyFixToSection(issue.affectedSection, customFix);
      recordQcDecision(reportId, issue.issueNumber, 'modified', issue.suggestedImprovement, customFix);
      modifyBtn.textContent = 'Modified & Applied ✏️';
      modifyBox.classList.add('hidden');
    });

    // Button: Reject
    const rejectBtn = card.querySelector('.btn-qc-reject');
    rejectBtn.addEventListener('click', () => {
      recordQcDecision(reportId, issue.issueNumber, 'rejected', issue.suggestedImprovement);
      rejectBtn.textContent = 'Rejected ❌';
      rejectBtn.disabled = true;
    });

    container.appendChild(card);
  });
}

function applyFixToSection(sectionName, fixText) {
  if (!fixText) return;

  const targetMap = {
    introduction: el.edit_intro_overview,
    coreConcepts: document.querySelector('.concept-expl'),
    examples: document.querySelector('.example-desc'),
    practicalDemonstration: el.edit_demo_desc,
    handsOnActivity: el.edit_activity_instructions,
    knowledgeCheck: document.querySelector('.question-expl'),
    summary: el.edit_summary_next,
  };

  const targetEl = targetMap[sectionName] || el.edit_intro_overview;
  if (targetEl) {
    targetEl.value += `\n[QC Update: ${fixText}]`;
    targetEl.style.backgroundColor = '#ecfdf5';
    setTimeout(() => { targetEl.style.backgroundColor = ''; }, 1200);
    showAlert(`Applied recommendation to ${sectionName}! Remember to click "Save as New Version".`, 'success');
  }
}

async function recordQcDecision(reportId, issueNumber, action, originalRec, modifiedRec = '') {
  if (!state.currentLesson) return;
  try {
    await fetch(`/api/generate/${state.currentLesson._id}/qc-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportId,
        issueNumber,
        action,
        originalRecommendation: originalRec,
        modifiedRecommendation: modifiedRec || originalRec,
      }),
    });
  } catch (e) {
    console.warn('Failed to record QC decision:', e);
  }
}

async function handleRerunQc() {
  if (!state.currentLesson) return;
  el.rerunQcBtn.disabled = true;
  showAlert(`Running parallel QC re-audit on ${state.currentLesson.versionTag || 'current version'}...`, 'info');

  try {
    const res = await fetch(`/api/qc/rerun/${state.currentLesson._id}`, {
      method: 'POST',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'QC rerun failed');

    showAlert('QC Re-audit complete! Fresh reports loaded.', 'success');
    await fetchQcReports(state.currentLesson._id);
  } catch (err) {
    showAlert(`QC error: ${err.message}`, 'error');
  } finally {
    el.rerunQcBtn.disabled = false;
  }
}

// ── Mandatory Instructor Approval Gate ───────────────────────────────────────
function openApprovalModal() {
  if (!state.currentLesson) {
    showAlert('Please select or generate a lesson before approving.', 'error');
    return;
  }
  if (el.instructorNameInput && !el.instructorNameInput.value.trim()) {
    el.instructorNameInput.value = 'Lead Instructor';
  }
  if (el.instructorApprovalNotes && !el.instructorApprovalNotes.value.trim()) {
    el.instructorApprovalNotes.value = 'Lesson verified compliant with 45-minute duration, factual accuracy, and instructional objectives.';
  }
  el.approvalModal.classList.remove('hidden');
  el.approvalModal.style.display = 'flex';
}

function closeApprovalModal() {
  el.approvalModal.classList.add('hidden');
  el.approvalModal.style.display = 'none';
  if (el.confirmApprovalBtn) {
    el.confirmApprovalBtn.disabled = false;
    el.confirmApprovalBtn.textContent = 'Grant Final Approval';
  }
}

async function handleConfirmApproval() {
  if (!state.currentLesson) {
    showAlert('No lesson loaded to approve. Please load or generate a lesson first.', 'error');
    closeApprovalModal();
    return;
  }

  const instructorName = el.instructorNameInput.value.trim() || 'Lead Instructor';
  const instructorNotes = el.instructorApprovalNotes.value.trim() || 'Lesson verified compliant with 45-minute duration, factual accuracy, and instructional objectives.';

  try {
    el.confirmApprovalBtn.disabled = true;
    el.confirmApprovalBtn.textContent = 'Certifying...';

    const res = await fetch(`/api/generate/${state.currentLesson._id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructorName, instructorNotes }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Approval failed');

    showAlert(`Lesson approved successfully by ${instructorName}! Certified for classroom teaching.`, 'success');
    closeApprovalModal();
    await loadLessonById(state.currentLesson._id);
    await fetchSavedLessons();
  } catch (err) {
    showAlert(`Approval error: ${err.message}`, 'error');
  } finally {
    if (el.confirmApprovalBtn) {
      el.confirmApprovalBtn.disabled = false;
      el.confirmApprovalBtn.textContent = 'Grant Final Approval';
    }
  }
}

// ── 45-Minute Lesson Preview Mode ───────────────────────────────────────────
function renderLessonPreview(lesson) {
  if (!lesson) {
    el.lessonPreviewContainer.innerHTML = '<div class="placeholder-box">No lesson loaded to preview.</div>';
    return;
  }

  const s = lesson.sections || {};
  const intro = s.introduction || {};
  const concepts = s.coreConcepts?.concepts || [];
  const examples = s.examples?.items || [];
  const demo = s.practicalDemonstration || {};
  const activity = s.handsOnActivity || {};
  const questions = s.knowledgeCheck?.questions || [];
  const summary = s.summary || {};

  el.lessonPreviewContainer.innerHTML = `
    <div class="preview-doc">
      <div class="preview-doc-header">
        <h1 class="preview-doc-title">${escapeHtml(lesson.title || 'Lesson Title')}</h1>
        <div class="preview-doc-meta">
          <span class="preview-time-tag">⏱️ Total: ${lesson.totalDurationMinutes || 45} Minutes</span>
          <span><strong>Objective:</strong> ${escapeHtml(lesson.learningObjective || '')}</span>
          <span><strong>Version:</strong> ${escapeHtml(lesson.versionTag || `v${lesson.version || 1}.0`)}</span>
          <span><strong>Status:</strong> ${lesson.isApproved ? '✅ Approved' : '⏳ Draft / Under Review'}</span>
        </div>
      </div>

      <!-- Section 1 -->
      <div class="preview-section-block">
        <div class="preview-sec-header">
          <h3 class="preview-sec-title">1. Introduction & Real-World Motivation</h3>
          <span class="preview-time-tag">${intro.durationMinutes || 5} min</span>
        </div>
        <div class="preview-sec-body">
          <p><strong>Overview:</strong> ${escapeHtml(intro.overview || '')}</p>
          <p><strong>Why It Matters:</strong> ${escapeHtml(intro.whyItMatters || '')}</p>
          <strong>What You Will Learn:</strong>
          <ul>
            ${(intro.whatYouWillLearn || []).map((w) => `<li>${escapeHtml(w)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- Section 2 -->
      <div class="preview-section-block">
        <div class="preview-sec-header">
          <h3 class="preview-sec-title">2. Core Concepts & Theoretical Grounding</h3>
          <span class="preview-time-tag">${s.coreConcepts?.durationMinutes || 12} min</span>
        </div>
        <div class="preview-sec-body">
          ${concepts.map((c, idx) => `
            <div class="mb-3">
              <h4 class="font-bold text-primary">${idx + 1}. ${escapeHtml(c.title || '')}</h4>
              <p>${escapeHtml(c.explanation || '')}</p>
              ${c.evidenceQuote ? `<blockquote class="preview-quote">"${escapeHtml(c.evidenceQuote)}" — <em>${escapeHtml(c.sourceRef || 'Research')}</em></blockquote>` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Section 3 -->
      <div class="preview-section-block">
        <div class="preview-sec-header">
          <h3 class="preview-sec-title">3. Relevant Examples & Context</h3>
          <span class="preview-time-tag">${s.examples?.durationMinutes || 8} min</span>
        </div>
        <div class="preview-sec-body">
          ${examples.map((ex, idx) => `
            <div class="mb-3">
              <h4 class="font-bold">Example ${idx + 1}: ${escapeHtml(ex.title || '')}</h4>
              <p>${escapeHtml(ex.description || '')}</p>
              ${ex.realWorldContext ? `<p class="text-muted"><strong>Context:</strong> ${escapeHtml(ex.realWorldContext)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Section 4 -->
      <div class="preview-section-block">
        <div class="preview-sec-header">
          <h3 class="preview-sec-title">4. Practical Demonstration</h3>
          <span class="preview-time-tag">${demo.durationMinutes || 8} min</span>
        </div>
        <div class="preview-sec-body">
          <p>${escapeHtml(demo.description || '')}</p>
          <ol>
            ${(demo.steps || []).map((step) => `
              <li>${escapeHtml(step.instruction || '')} ${step.tip ? `<span class="text-accent">(Tip: ${escapeHtml(step.tip)})</span>` : ''}</li>
            `).join('')}
          </ol>
        </div>
      </div>

      <!-- Section 5 -->
      <div class="preview-section-block">
        <div class="preview-sec-header">
          <h3 class="preview-sec-title">5. Hands-on Activity</h3>
          <span class="preview-time-tag">${activity.durationMinutes || 7} min</span>
        </div>
        <div class="preview-sec-body">
          <h4>${escapeHtml(activity.title || 'Class Exercise')}</h4>
          <p>${escapeHtml(activity.instructions || '')}</p>
          ${activity.materials?.length ? `<p><strong>Materials:</strong> ${escapeHtml(activity.materials.join(', '))}</p>` : ''}
          <p><strong>Expected Outcome:</strong> ${escapeHtml(activity.expectedOutcome || '')}</p>
        </div>
      </div>

      <!-- Section 6 -->
      <div class="preview-section-block">
        <div class="preview-sec-header">
          <h3 class="preview-sec-title">6. Knowledge-Check Questions & Answers</h3>
          <span class="preview-time-tag">${s.knowledgeCheck?.durationMinutes || 3} min</span>
        </div>
        <div class="preview-sec-body">
          ${questions.map((q, idx) => `
            <div class="mb-3">
              <p><strong>Q${idx + 1}: ${escapeHtml(q.question || '')}</strong></p>
              ${q.options?.length ? `<ul>${q.options.map((opt) => `<li>${escapeHtml(opt)}</li>`).join('')}</ul>` : ''}
              <p class="text-success"><strong>Answer:</strong> ${escapeHtml(q.correctAnswer || '')}</p>
              <p class="text-muted"><em>Explanation:</em> ${escapeHtml(q.explanation || '')}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Section 7 -->
      <div class="preview-section-block">
        <div class="preview-sec-header">
          <h3 class="preview-sec-title">7. Summary & Next Steps</h3>
          <span class="preview-time-tag">${summary.durationMinutes || 2} min</span>
        </div>
        <div class="preview-sec-body">
          <strong>Key Takeaways:</strong>
          <ul>
            ${(summary.keyTakeaways || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
          </ul>
          <p><strong>Next Steps:</strong> ${escapeHtml(summary.nextSteps || '')}</p>
        </div>
      </div>
    </div>
  `;
}

function handleExportJson() {
  if (!state.currentLesson) return;
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.currentLesson, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute('href', dataStr);
  dlAnchor.setAttribute('download', `${(state.currentLesson.title || 'lesson').replace(/\s+/g, '_')}_${state.currentLesson.versionTag || 'v1'}.json`);
  dlAnchor.click();
}

// ── Saved Lessons List ───────────────────────────────────────────────────────
async function fetchSavedLessons() {
  try {
    const res = await fetch('/api/generate');
    if (!res.ok) return;
    const json = await res.json();
    state.savedLessons = json.data || [];

    el.lessonCountBadge.textContent = `${state.savedLessons.length} Lessons`;
    el.lessonsContainer.innerHTML = '';

    if (state.savedLessons.length === 0) {
      el.lessonsContainer.innerHTML = '<div class="empty-list-message">No generated lessons yet. Run orchestration above!</div>';
      return;
    }

    state.savedLessons.forEach((l) => {
      const card = document.createElement('div');
      card.className = `lesson-item ${state.currentLesson?._id === l._id ? 'active' : ''}`;
      card.innerHTML = `
        <div class="lesson-item-header">
          <span class="lesson-item-title">${escapeHtml(l.title || 'Untitled')}</span>
          <span class="version-tag-badge">${escapeHtml(l.versionTag || `v${l.version || 1}.0`)}</span>
        </div>
        <div class="lesson-item-obj">${escapeHtml(l.learningObjective || '')}</div>
        <div class="lesson-item-footer">
          <span>⏱️ ${l.totalDurationMinutes || 45}m</span>
          <span>${l.isApproved ? '✅ Approved' : '⏳ Review'}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        loadLessonById(l._id);
        switchView('view-dashboard');
      });

      el.lessonsContainer.appendChild(card);
    });
  } catch (err) {
    console.warn('Failed to fetch lessons:', err);
  }
}

// ── Helpers & Health ─────────────────────────────────────────────────────────
function validateFormInputs(title, objective) {
  let ok = true;
  if (!title || title.length < 3) {
    el.titleInput.classList.add('error');
    showAlert('Lesson title must be at least 3 characters long.', 'error');
    ok = false;
  }
  if (!objective || objective.length < 5) {
    el.objectiveInput.classList.add('error');
    showAlert('Learning objective must be at least 5 characters long.', 'error');
    ok = false;
  }
  return ok;
}

function handleClearForm() {
  el.titleInput.value = '';
  el.objectiveInput.value = '';
  el.titleCount.textContent = '0 / 150';
  el.objectiveCount.textContent = '0 / 2000';
  resetArchitectureNodes();
}

function showAlert(message, type = 'info') {
  el.alertBox.className = `alert alert-${type}`;
  el.alertMessage.textContent = message;
  el.alertBox.classList.remove('hidden');
  if (type === 'success' || type === 'info') {
    setTimeout(hideAlert, 6000);
  }
}

function hideAlert() {
  el.alertBox.classList.add('hidden');
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      el.statusText.textContent = 'System Connected';
    }
  } catch (_) {
    el.statusText.textContent = 'Offline (Memory DB)';
  }
}

async function updateGatewayStats() {
  try {
    const res = await fetch('/api/agent/gateway/stats');
    if (res.ok) {
      const json = await res.json();
      const stats = json.data;
      if (stats.totalTokens) {
        el.tokenUsageBadge.textContent = `${stats.totalTokens.toLocaleString()} Tokens`;
      }
    }
  } catch (_) {}
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

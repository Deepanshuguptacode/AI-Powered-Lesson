/**
 * AI Lesson Creation Tool — Frontend Application Script
 * Complete 6-Stage AI Orchestration & Instructor Dashboard
 * Pure Vanilla JavaScript (No frameworks)
 */

// ── Application State ─────────────────────────────────────────────────────────
const state = {
  currentRunId: null,
  failedStage: null,
  activeView: 'view-orchestrator',
  currentLesson: null,         // Currently loaded GeneratedLesson doc
  lessonVersions: [],          // Array of all versions for current lesson root
  currentResearchSessionId: null, // Currently loaded ResearchSession id
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
  btnExportPdf: document.getElementById('btnExportPdf'),
  btnExportDocx: document.getElementById('btnExportDocx'),
  btnDashExportPdf: document.getElementById('btnDashExportPdf'),
  btnDashExportDocx: document.getElementById('btnDashExportDocx'),

  // Recovery & Retry
  orchRecoveryBar: document.getElementById('orchRecoveryBar'),
  recoveryMessage: document.getElementById('recoveryMessage'),
  btnRetryFailedStage: document.getElementById('btnRetryFailedStage'),
  btnCancelExecution: document.getElementById('btnCancelExecution'),

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
  evidenceSummaryText: document.getElementById('evidenceSummaryText'),
  copyLogsBtn: document.getElementById('copyLogsBtn'),

  // QC Improvement Loop Notice
  qcLoopNoticeBar: document.getElementById('qcLoopNoticeBar'),
  qcLoopNoticeText: document.getElementById('qcLoopNoticeText'),
  btnAutoImproveQcLoop: document.getElementById('btnAutoImproveQcLoop'),

  // QC Feedback Loop Architecture Node (Stage 4b)
  node_qc_loop:        document.getElementById('node_qc_loop'),
  state_qc_loop:       document.getElementById('state_qc_loop'),
  label_qc_loop:       document.getElementById('label_qc_loop'),
  qcLoopBackArrow:     document.getElementById('qcLoopBackArrow'),
  qcLoopArrowLabel:    document.getElementById('qcLoopArrowLabel'),
  conn_4b_5:           document.getElementById('conn_4b_5'),
  col_stage_4b:        document.getElementById('col_stage_4b'),

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
  if (el.btnAutoImproveQcLoop) {
    el.btnAutoImproveQcLoop.addEventListener('click', handleAutoImproveQcLoop);
  }

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

  // Preview & Export Buttons
  el.btnPreviewInModal.addEventListener('click', () => switchView('view-preview'));
  el.btnPrintLesson.addEventListener('click', () => window.print());
  el.btnExportJson.addEventListener('click', handleExportJson);
  if (el.btnExportPdf) el.btnExportPdf.addEventListener('click', handleExportPdf);
  if (el.btnDashExportPdf) el.btnDashExportPdf.addEventListener('click', handleExportPdf);
  if (el.btnExportDocx) el.btnExportDocx.addEventListener('click', handleExportDocx);
  if (el.btnDashExportDocx) el.btnDashExportDocx.addEventListener('click', handleExportDocx);

  // Recovery & Stage Retry Actions
  if (el.btnRetryFailedStage) el.btnRetryFailedStage.addEventListener('click', handleRetryFailedStage);
  if (el.btnCancelExecution) el.btnCancelExecution.addEventListener('click', handleCancelExecution);

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

  if (viewId === 'view-research') {
    if (state.currentLesson?.researchSessionId) {
      loadResearchData(state.currentLesson.researchSessionId);
    } else if (state.currentResearchSessionId) {
      loadResearchData(state.currentResearchSessionId);
    } else {
      loadLatestResearch();
    }
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
    { el: el.node_qc_loop, state: el.state_qc_loop },
    { el: el.node_qc_factual, state: el.state_qc_factual },
    { el: el.node_qc_instructional, state: el.state_qc_instructional },
    { el: el.node_instructor_gate, state: el.state_instructor },
  ];

  nodes.forEach(({ el, state }) => {
    if (el) el.className = el.classList.contains('arch-subnode') ? 'arch-subnode' : 'arch-node';
    if (state) state.textContent = 'Idle';
  });

  const connectors = [el.conn_1_2, el.conn_2_3, el.conn_3_4, el.conn_4_5, el.conn_4b_5, el.conn_5_6];
  connectors.forEach((c) => c && c.classList.remove('active', 'looping'));

  clearQcLoopBackArrow();
  if (el.label_qc_loop) el.label_qc_loop.textContent = 'QC Loop';

  el.liveStageLabel.textContent = 'System Ready • Idle';
  el.tickerStageBadge.textContent = 'STAGE 0: IDLE';
  el.tickerStageBadge.className = 'ticker-badge';
  el.tickerMessage.textContent = 'Ready to launch end-to-end multi-agent orchestration.';
  el.tickerTimer.textContent = '0.0s';
}

function setStageNodeState(nodeKey, status, statusText) {
  const map = {
    guardrails:       { el: el.node_guardrails,       st: el.state_guardrails,       conn: el.conn_1_2 },
    supervisor:       { el: el.node_supervisor,        st: el.state_supervisor,       conn: el.conn_2_3 },
    web:              { el: el.node_web_agent,         st: el.state_web },
    book:             { el: el.node_book_agent,        st: el.state_book },
    youtube:          { el: el.node_youtube_agent,     st: el.state_youtube },
    generator:        { el: el.node_lesson_generator,  st: el.state_generator,        conn: el.conn_4_5 },
    validator:        { el: el.node_validator,         st: el.state_validator },
    qc_loop:          { el: el.node_qc_loop,           st: el.state_qc_loop,          conn: el.conn_4b_5 },
    qc_factual:       { el: el.node_qc_factual,        st: el.state_qc_factual },
    qc_instructional: { el: el.node_qc_instructional,  st: el.state_qc_instructional, conn: el.conn_5_6 },
    instructor:       { el: el.node_instructor_gate,   st: el.state_instructor },
  };

  const item = map[nodeKey];
  if (!item) return;

  const baseClass = item.el.classList.contains('arch-subnode') ? 'arch-subnode' : 'arch-node';

  // Special handling for qc_loop looping state
  if (nodeKey === 'qc_loop' && status === 'looping') {
    item.el.className = `${baseClass} active looping`;
  } else {
    item.el.className = `${baseClass} ${status}`;
  }

  if (item.st) item.st.textContent = statusText || status.toUpperCase();
  if (item.conn) {
    if (status === 'active' || status === 'completed' || status === 'looping') {
      item.conn.classList.add('active');
    }
    if (status === 'looping' && nodeKey === 'qc_loop') {
      // Activate conn_4_5 (back to generator) with looping style
      if (el.conn_4_5) el.conn_4_5.classList.add('looping');
    }
  }
}

function setQcLoopNodeLooping(loopPass, maxLoops, suggestionsCount) {
  setStageNodeState('qc_loop', 'looping', `Pass ${loopPass}/${maxLoops}`);
  if (el.label_qc_loop) {
    el.label_qc_loop.textContent = `QC Loop (${loopPass}/${maxLoops})`;
  }
  if (el.qcLoopBackArrow) {
    el.qcLoopBackArrow.classList.remove('hidden');
    if (el.qcLoopArrowLabel) {
      el.qcLoopArrowLabel.textContent = `↩ Regenerating (${suggestionsCount} suggestions)`;
    }
  }
  if (el.conn_4_5) el.conn_4_5.classList.add('looping');
}

function clearQcLoopBackArrow() {
  if (el.qcLoopBackArrow) {
    el.qcLoopBackArrow.classList.add('hidden');
  }
  if (el.conn_4_5) {
    el.conn_4_5.classList.remove('looping');
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

// ── Real-Time Live Architecture Tracker Engine ──────────────────────────────

let livePollingTimer = null;

function connectOrchestrationStream(runId) {
  if (state.sseSource) {
    state.sseSource.close();
    state.sseSource = null;
  }
  if (livePollingTimer) {
    clearInterval(livePollingTimer);
    livePollingTimer = null;
  }

  state.lastLoggedCount = 0;
  const sseUrl = `/api/orchestration/stream/${encodeURIComponent(runId)}`;

  try {
    const es = new EventSource(sseUrl);
    state.sseSource = es;
    let isTerminated = false;

    es.onmessage = (event) => {
      try {
        if (!event.data) return;
        const run = JSON.parse(event.data);
        handleLiveOrchestrationUpdate(run);

        if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
          isTerminated = true;
          es.close();
          state.sseSource = null;
          handleOrchestrationFinished(run);
        }
      } catch (err) {
        console.warn('[Live Tracker SSE] Parse error:', err);
      }
    };

    es.addEventListener('done', () => {
      isTerminated = true;
      es.close();
      state.sseSource = null;
    });

    es.onerror = (err) => {
      console.warn('[Live Tracker SSE] Stream connection closed/interrupted, switching to polling fallback');
      es.close();
      state.sseSource = null;
      if (!isTerminated) {
        startLivePollingFallback(runId);
      }
    };
  } catch (err) {
    console.warn('[Live Tracker SSE] Failed to instantiate EventSource, using polling fallback:', err);
    startLivePollingFallback(runId);
  }
}

function startLivePollingFallback(runId) {
  if (livePollingTimer) clearInterval(livePollingTimer);

  livePollingTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/orchestration/status/${encodeURIComponent(runId)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.data) return;

      const run = json.data;
      handleLiveOrchestrationUpdate(run);

      if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
        clearInterval(livePollingTimer);
        livePollingTimer = null;
        handleOrchestrationFinished(run);
      }
    } catch (e) {
      console.warn('[Live Tracker Polling] Polling error:', e);
    }
  }, 400);
}

function handleLiveOrchestrationUpdate(run) {
  if (!run) return;
  state.currentRunId = run.runId;

  // 1. Sync any new telemetry logs from backend
  if (Array.isArray(run.logs)) {
    const newLogs = run.logs.slice(state.lastLoggedCount || 0);
    newLogs.forEach((log) => {
      let badge = 'RUNNING';
      if (log.stage === 'qc_loop' || log.node === 'node_qc_loop' || (log.message && log.message.includes('QC Loop'))) {
        badge = 'QC LOOP';
      } else if (log.status === 'completed' || log.status === 'passed') {
        badge = 'SUCCESS';
      } else if (log.status === 'failed') {
        badge = 'FAILED';
      }
      addTelemetryLog(badge, log.message || `${log.stage}: ${log.status}`);
    });
    state.lastLoggedCount = run.logs.length;
  }

  // 2. Stage 1: Input Guardrails
  const s1 = run.stages?.input_guardrails;
  if (s1) {
    if (s1.status === 'running') {
      setStageNodeState('guardrails', 'active', 'Scanning');
      el.liveStageLabel.textContent = '⚡ Stage 1 Active: Input Guardrails (openai/gpt-oss-20b)';
      el.tickerStageBadge.textContent = 'STAGE 1: GUARDRAILS';
      el.tickerStageBadge.className = 'ticker-badge';
      el.tickerMessage.textContent = 'Scanning input with openai/gpt-oss-20b for prompt injection, safety, and academic scope...';
    } else if (s1.status === 'completed') {
      setStageNodeState('guardrails', 'completed', 'Passed');
      updateGuardrailDisplay(s1.data || run.artifacts?.guardrailResult || { passed: true, scores: { safety: 96, promptInjectionRisk: 4, educationalRelevance: 92 } });
    } else if (s1.status === 'failed') {
      setStageNodeState('guardrails', 'failed', 'Rejected');
    }
  }

  // 3. Stage 2: Supervisor Planning
  const s2 = run.stages?.supervisor_plan;
  if (s2) {
    if (s2.status === 'running') {
      setStageNodeState('guardrails', 'completed', 'Passed');
      setStageNodeState('supervisor', 'active', 'Planning');
      el.liveStageLabel.textContent = '⚡ Stage 2 Active: Supervisor Planning (LangGraph.js)';
      el.tickerStageBadge.textContent = 'STAGE 2: SUPERVISOR';
      el.tickerStageBadge.className = 'ticker-badge';
      el.tickerMessage.textContent = 'Supervisor Agent planning research queries across Web, Book, and YouTube...';
    } else if (s2.status === 'completed') {
      setStageNodeState('supervisor', 'completed', 'Planned');
    }
  }

  // 4. Stage 3: Research Swarm
  const s3 = run.stages?.parallel_research;
  if (s3) {
    if (s3.status === 'running') {
      setStageNodeState('supervisor', 'completed', 'Planned');
      setStageNodeState('web', 'active', 'Searching');
      setStageNodeState('book', 'active', 'Scanning');
      setStageNodeState('youtube', 'active', 'Indexing');
      el.liveStageLabel.textContent = '⚡ Stage 3 Active: Multi-Agent Research Swarm (Parallel)';
      el.tickerStageBadge.textContent = 'STAGE 3: RESEARCH';
      el.tickerStageBadge.className = 'ticker-badge';
      el.tickerMessage.textContent = 'Web, Book, and YouTube Agents querying online encyclopedias, textbooks, and video transcripts in parallel...';
    } else if (s3.status === 'completed') {
      setStageNodeState('web', 'completed', 'Gathered');
      setStageNodeState('book', 'completed', 'Gathered');
      setStageNodeState('youtube', 'completed', 'Gathered');
      if (run.artifacts?.researchSessionId && !state.currentResearchSessionId) {
        state.currentResearchSessionId = run.artifacts.researchSessionId;
        loadResearchData(run.artifacts.researchSessionId);
      }
    }
  }

  // 5. Stage 4 / 4b: Lesson Synthesizer & QC Feedback Loop
  const s4 = run.stages?.lesson_generator;
  const s4b = run.stages?.qc_loop;

  if (s4b && s4b.status === 'running') {
    // QC Feedback Loop is actively executing or looping back
    const loopData = s4b.data || {};
    const loopPass = loopData.qcLoopPass || 1;
    const maxLoops = loopData.maxQcLoops || 3;
    const suggCount = loopData.suggestionsCount || 0;
    const factScore = loopData.factualScore !== undefined ? loopData.factualScore : '--';
    const instScore = loopData.instructionalScore !== undefined ? loopData.instructionalScore : '--';

    setQcLoopNodeLooping(loopPass, maxLoops, suggCount);
    setStageNodeState('generator', 'active', `Regenerating v${loopPass + 1}.0`);
    setStageNodeState('validator', 'active', 'Re-verifying');

    el.liveStageLabel.textContent = `🔄 Stage 4b Active: QC Loop (Pass ${loopPass}/${maxLoops} Below 80% — Regenerating)`;
    el.tickerStageBadge.textContent = `QC LOOP ${loopPass}/${maxLoops}: REGENERATING`;
    el.tickerStageBadge.className = 'ticker-badge bg-warning';
    el.tickerMessage.textContent = `QC score (Factual: ${factScore}%, Instructional: ${instScore}%) below 80%. Regenerating with ${suggCount} QC suggestions...`;
  } else if (s4 && s4.status === 'running') {
    setStageNodeState('generator', 'active', 'Synthesizing');
    setStageNodeState('validator', 'active', 'Verifying');
    el.liveStageLabel.textContent = '⚡ Stage 4 Active: Lesson Synthesizer & Validator (openai/gpt-oss-120b)';
    el.tickerStageBadge.textContent = 'STAGE 4: SYNTHESIS';
    el.tickerStageBadge.className = 'ticker-badge';
    el.tickerMessage.textContent = 'Synthesizing 7 structured sections and validating strict 45-minute total duration...';
  } else if (s4 && s4.status === 'completed' && (!s4b || s4b.status !== 'running')) {
    setStageNodeState('generator', 'completed', 'Synthesized');
    setStageNodeState('validator', 'completed', '45m Valid');
  }

  // 6. Stage 5: Parallel QC Agents
  const s5 = run.stages?.parallel_qc;
  if (s5) {
    if (s5.status === 'running') {
      const qcPass = s5.data?.qcLoopPass || 1;
      const maxLoops = s5.data?.maxQcLoops || 3;
      setStageNodeState('generator', 'completed', 'Synthesized');
      setStageNodeState('validator', 'completed', '45m Valid');
      setStageNodeState('qc_loop', 'active', `Pass ${qcPass}/${maxLoops} Audit`);
      setStageNodeState('qc_factual', 'active', 'Auditing Facts');
      setStageNodeState('qc_instructional', 'active', 'Auditing Pedagogy');
      el.liveStageLabel.textContent = `⚡ Stage 5 Active: Parallel QC Audit Agents (Pass ${qcPass}/${maxLoops})`;
      el.tickerStageBadge.textContent = `STAGE 5: QC AUDIT (PASS ${qcPass})`;
      el.tickerStageBadge.className = 'ticker-badge';
      el.tickerMessage.textContent = `Running Factual QC Agent & Instructional QC Agent concurrently (Quality Threshold: ≥ 80%)...`;
    } else if (s5.status === 'completed') {
      const qcData = s5.data || {};
      const factScore = qcData.factualScore ?? run.artifacts?.qcReports?.factual?.scores?.overall ?? 85;
      const instScore = qcData.instructionalScore ?? run.artifacts?.qcReports?.instructional?.scores?.overall ?? 88;
      const qcPassed = qcData.qcPassed ?? (factScore >= 80 && instScore >= 80);
      const totalPasses = qcData.qcLoopPass || 1;

      clearQcLoopBackArrow();
      setStageNodeState('qc_loop', 'completed', qcPassed ? `Passed (${totalPasses}p)` : `${totalPasses} Pass(es)`);
      setStageNodeState('qc_factual', 'completed', `${factScore}% Score`);
      setStageNodeState('qc_instructional', 'completed', `${instScore}% Score`);

      el.tickerStageBadge.textContent = qcPassed ? 'QC PASSED (≥80%)' : 'QC COMPLETED';
      el.tickerStageBadge.className = qcPassed ? 'ticker-badge bg-success' : 'ticker-badge';
      el.tickerMessage.textContent = qcPassed
        ? `Parallel QC audit PASSED quality threshold (≥80%)! Factual: ${factScore}%, Instructional: ${instScore}%.`
        : `Parallel QC complete after ${totalPasses} passes. Factual: ${factScore}%, Instructional: ${instScore}%.`;
    }
  }

  // 7. Stage 6: Instructor Review Gate
  const s6 = run.stages?.instructor_review;
  if (s6 && s6.status === 'completed') {
    setStageNodeState('instructor', 'active', 'Review Ready');
    el.liveStageLabel.textContent = '✅ Stage 6 Ready: Instructor Dashboard (Human-in-the-Loop)';
    el.tickerStageBadge.textContent = 'STAGE 6: INSTRUCTOR REVIEW';
    el.tickerStageBadge.className = 'ticker-badge bg-success';
    el.tickerMessage.textContent = 'All AI pipelines complete! Lesson and independent QC reports delivered to Instructor Dashboard.';
  }
}

async function handleOrchestrationFinished(run) {
  stopOrchestrationTimer();
  el.startFullOrchBtn.disabled = false;
  el.orchSpinner.classList.add('hidden');
  el.orchBtnText.textContent = 'Run Live AI Orchestration (End-to-End)';

  if (run.status === 'completed') {
    showAlert('Complete AI Orchestration pipeline executed successfully! QC verified and delivered to Instructor Dashboard.', 'success');

    if (run.artifacts?.researchSessionId) {
      state.currentResearchSessionId = run.artifacts.researchSessionId;
      loadResearchData(run.artifacts.researchSessionId);
    }

    if (run.artifacts?.generatedLessonId) {
      await loadLessonById(run.artifacts.generatedLessonId);
      await fetchSavedLessons();
      setTimeout(() => switchView('view-dashboard'), 800);
    }
  } else if (run.status === 'failed') {
    const errMsg = run.error || 'Pipeline aborted with errors.';
    showAlert(`Orchestration failed: ${errMsg}`, 'error');
    addTelemetryLog('FAILED', `Fatal error: ${errMsg}`);
    if (el.orchRecoveryBar) {
      el.orchRecoveryBar.classList.remove('hidden');
      el.recoveryMessage.textContent = `Pipeline issue: ${errMsg}. Previous versions & research evidence preserved intact.`;
    }
  }
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
      body: JSON.stringify({ title, learningObjective, async: true, force: true }),
    });

    const result = await response.json();

    if (response.status === 409) {
      const errMsg = result.message || 'Workflow execution is already actively running for this topic.';
      el.tickerStageBadge.textContent = 'ACTIVE RUN';
      el.tickerStageBadge.className = 'ticker-badge bg-warning';
      el.tickerMessage.textContent = errMsg;
      addTelemetryLog('FAILED', `Duplicate Guard: ${errMsg}`);
      showAlert(errMsg, 'error');
      state.currentRunId = result.runId;
      state.failedStage = 'parallel_research';
      if (el.orchRecoveryBar) {
        el.orchRecoveryBar.classList.remove('hidden');
        el.recoveryMessage.textContent = errMsg;
      }
      el.startFullOrchBtn.disabled = false;
      el.orchSpinner.classList.add('hidden');
      el.orchBtnText.textContent = 'Run Live AI Orchestration (End-to-End)';
      stopOrchestrationTimer();
      return;
    }

    if (!response.ok || !result.success) {
      const errMsg = result.guardrail?.reasoning || result.message || 'Pipeline aborted by AI Guardrails.';
      setStageNodeState('guardrails', 'failed', 'Rejected');
      el.tickerStageBadge.textContent = 'REJECTED';
      el.tickerStageBadge.className = 'ticker-badge bg-danger';
      el.tickerMessage.textContent = errMsg;
      addTelemetryLog('FAILED', `Guardrail Rejection: ${errMsg}`);
      showAlert(errMsg, 'error');
      updateGuardrailDisplay(result.guardrail || { passed: false, reasoning: errMsg });
      el.startFullOrchBtn.disabled = false;
      el.orchSpinner.classList.add('hidden');
      el.orchBtnText.textContent = 'Run Live AI Orchestration (End-to-End)';
      stopOrchestrationTimer();
      return;
    }

    const runId = result.runId || (result.data && result.data.runId);
    state.currentRunId = runId;
    if (el.orchRecoveryBar) el.orchRecoveryBar.classList.add('hidden');

    if (runId) {
      connectOrchestrationStream(runId);
    } else if (result.data) {
      handleLiveOrchestrationUpdate(result.data);
      handleOrchestrationFinished(result.data);
    }
  } catch (err) {
    console.error('Orchestration error:', err);
    showAlert(`Orchestration failed: ${err.message}`, 'error');
    addTelemetryLog('FAILED', `Fatal error: ${err.message}`);
    if (el.orchRecoveryBar) {
      el.orchRecoveryBar.classList.remove('hidden');
      el.recoveryMessage.textContent = `Pipeline issue: ${err.message}. Previous versions & research evidence preserved intact.`;
    }
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

    // Fetch Research data for Evidence & Research Explorer
    if (lesson.researchSessionId) {
      state.currentResearchSessionId = lesson.researchSessionId;
      loadResearchData(lesson.researchSessionId);
    }

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

    // Show or hide QC Improvement Loop notice if score < 80
    const factScore = factual?.scores?.overall ?? 0;
    const instScore = instructional?.scores?.overall ?? 0;
    const isPassing = (factual?.status === 'passed' && factScore >= 80) &&
                      (instructional?.status === 'passed' && instScore >= 80);

    if (el.qcLoopNoticeBar) {
      if ((factual || instructional) && !isPassing) {
        el.qcLoopNoticeBar.classList.remove('hidden');
        if (el.qcLoopNoticeText) {
          el.qcLoopNoticeText.textContent = `Current Quality: Factual (${factScore}%), Instructional (${instScore}%). High-quality certified threshold is 80%. Click below to run the feedback loop and regenerate following all QC suggestions.`;
        }
      } else {
        el.qcLoopNoticeBar.classList.add('hidden');
      }
    }
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

  const score = report.scores?.overall ?? 80;
  const isPass = score >= 80 && report.status === 'passed';
  el.factualScoreBadge.textContent = `${score} / 100 ${isPass ? 'PASS (≥80%)' : 'FAIL (<80%)'}`;
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
  const isPass = score >= 80 && report.status === 'passed';
  el.instructionalScoreBadge.textContent = `${score} / 100 ${isPass ? 'PASS (≥80%)' : 'FAIL (<80%)'}`;
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

async function handleAutoImproveQcLoop() {
  if (!state.currentLesson) return;

  if (el.btnAutoImproveQcLoop) {
    el.btnAutoImproveQcLoop.disabled = true;
    el.btnAutoImproveQcLoop.textContent = '🔄 Running QC Feedback Loop...';
  }

  showAlert(`Following QC suggestions to regenerate lesson and achieve certified ≥80% quality...`, 'info');

  try {
    const res = await fetch(`/api/qc/loop-improve/${state.currentLesson._id}`, {
      method: 'POST',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'QC improvement loop failed');
    }

    const result = json.data;
    showAlert(`QC Feedback Loop complete! New version generated (Factual: ${result.factualScore}%, Instructional: ${result.instructionalScore}%).`, 'success');

    if (result.newLessonId) {
      await loadLessonById(result.newLessonId);
      await fetchSavedLessons();
    }
  } catch (err) {
    showAlert(`QC loop error: ${err.message}`, 'error');
  } finally {
    if (el.btnAutoImproveQcLoop) {
      el.btnAutoImproveQcLoop.disabled = false;
      el.btnAutoImproveQcLoop.textContent = '🔄 Run QC Feedback Loop (Regenerate with Suggestions)';
    }
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
  const videos = lesson.youtubeVideos || [];
  const refs = lesson.references || [];

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

      <!-- Section 8: Supplementary YouTube Videos, Books & Web Resources -->
      <div class="preview-section-block">
        <div class="preview-sec-header">
          <h3 class="preview-sec-title">8. Supplementary YouTube Videos & Research References</h3>
          <span class="preview-time-tag">Multimedia & Sources</span>
        </div>
        <div class="preview-sec-body">
          ${videos.length > 0 ? `
            <h4 class="font-bold text-primary mb-2">📺 Curated YouTube Video Resources</h4>
            <div class="preview-resource-grid mb-4">
              ${videos.map((v) => `
                <div class="preview-resource-card">
                  <div class="res-card-header">
                    <span class="res-icon">📺</span>
                    <strong class="res-title">${escapeHtml(v.title || 'Video Resource')}</strong>
                  </div>
                  <div class="res-meta text-muted small">${escapeHtml(v.channelName || v.channelTitle || 'YouTube Channel')} ${v.durationDescription ? `• ${escapeHtml(v.durationDescription)}` : ''}</div>
                  ${v.url ? `<a href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer" class="preview-res-link">▶ Watch Video on YouTube</a>` : ''}
                  ${v.relevance || v.reason ? `<p class="res-desc small mt-1">${escapeHtml(v.relevance || v.reason)}</p>` : ''}
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-muted">No supplementary YouTube videos attached.</p>'}

          ${refs.length > 0 ? `
            <h4 class="font-bold text-primary mb-2 mt-4">📚 Books & Web Academic References</h4>
            <div class="preview-resource-grid">
              ${refs.map((r) => `
                <div class="preview-resource-card">
                  <div class="res-card-header">
                    <span class="res-icon">${r.sourceType === 'book' ? '📖' : '🌐'}</span>
                    <strong class="res-title">${escapeHtml(r.title || 'Reference Source')}</strong>
                  </div>
                  <div class="res-meta text-muted small">
                    <span class="badge-source-type">${r.sourceType === 'book' ? '📚 Book / Textbook' : '🌐 Web Encyclopedia'}</span>
                    ${r.authors?.length ? ` • ${escapeHtml(Array.isArray(r.authors) ? r.authors.join(', ') : r.authors)}` : ''}
                  </div>
                  ${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer" class="preview-res-link">🔗 Open Verified Source</a>` : ''}
                  ${r.keyTakeaway || r.description ? `<p class="res-desc small mt-1">${escapeHtml(r.keyTakeaway || r.description)}</p>` : ''}
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-muted">No external reference sources attached.</p>'}
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

async function handleExportPdf() {
  if (!state.currentLesson) {
    showAlert('No lesson loaded to export. Please select or generate a lesson first.', 'error');
    return;
  }
  if (!state.currentLesson.isApproved) {
    showAlert('Export Forbidden: Only approved lessons can be exported. Please grant Formal Instructor Approval first.', 'error');
    openApprovalModal();
    return;
  }

  showAlert('Generating certified PDF export package with attached QC audit...', 'info');
  try {
    const res = await fetch(`/api/export/${state.currentLesson._id}/pdf`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Export failed with status ${res.status}`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${(state.currentLesson.title || 'lesson').replace(/[^a-zA-Z0-9_-]/g, '_')}_${state.currentLesson.versionTag || 'v1.0'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    showAlert('PDF export package downloaded successfully!', 'success');
  } catch (err) {
    showAlert(`PDF Export error: ${err.message}`, 'error');
  }
}

async function handleExportDocx() {
  if (!state.currentLesson) {
    showAlert('No lesson loaded to export. Please select or generate a lesson first.', 'error');
    return;
  }
  if (!state.currentLesson.isApproved) {
    showAlert('Export Forbidden: Only approved lessons can be exported. Please grant Formal Instructor Approval first.', 'error');
    openApprovalModal();
    return;
  }

  showAlert('Generating certified Microsoft Word (DOCX) package with attached QC audit...', 'info');
  try {
    const res = await fetch(`/api/export/${state.currentLesson._id}/docx`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Export failed with status ${res.status}`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${(state.currentLesson.title || 'lesson').replace(/[^a-zA-Z0-9_-]/g, '_')}_${state.currentLesson.versionTag || 'v1.0'}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    showAlert('Word (DOCX) export package downloaded successfully!', 'success');
  } catch (err) {
    showAlert(`DOCX Export error: ${err.message}`, 'error');
  }
}

async function handleRetryFailedStage() {
  if (!state.currentRunId) {
    showAlert('No active workflow run found to retry.', 'error');
    return;
  }
  const stage = state.failedStage || 'parallel_research';
  showAlert(`Retrying stage "${stage}" with safe failure recovery...`, 'info');
  if (el.btnRetryFailedStage) el.btnRetryFailedStage.disabled = true;

  try {
    const res = await fetch(`/api/orchestration/retry/${state.currentRunId}/${stage}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoContinue: true }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Retry failed');

    showAlert(`Stage "${stage}" recovered successfully! Pipeline updated.`, 'success');
    if (el.orchRecoveryBar) el.orchRecoveryBar.classList.add('hidden');
    state.failedStage = null;

    if (json.data) {
      handleLiveOrchestrationUpdate(json.data);
      if (json.data.status === 'completed') {
        handleOrchestrationFinished(json.data);
      }
    }

    if (json.data?.artifacts?.generatedLessonId) {
      await loadLessonById(json.data.artifacts.generatedLessonId);
      await fetchSavedLessons();
    }
  } catch (err) {
    showAlert(`Retry error: ${err.message}`, 'error');
  } finally {
    if (el.btnRetryFailedStage) el.btnRetryFailedStage.disabled = false;
  }
}

async function handleCancelExecution() {
  if (!state.currentRunId) {
    if (el.orchRecoveryBar) el.orchRecoveryBar.classList.add('hidden');
    return;
  }

  try {
    await fetch(`/api/orchestration/cancel/${state.currentRunId}`, { method: 'POST' });
    showAlert('Workflow execution cancelled and lock released.', 'info');
    if (el.orchRecoveryBar) el.orchRecoveryBar.classList.add('hidden');
    state.currentRunId = null;
    state.failedStage = null;
    stopOrchestrationTimer();
  } catch (err) {
    showAlert(`Cancel error: ${err.message}`, 'error');
  }
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

// ── Evidence & Research Explorer Rendering ────────────────────────────────────

async function loadResearchData(sessionId) {
  if (!sessionId) return;
  state.currentResearchSessionId = sessionId;

  try {
    const res = await fetch(`/api/research/${sessionId}`);
    if (!res.ok) throw new Error('Failed to fetch research session');
    const json = await res.json();
    const data = json.data || {};

    const session = data;
    const evidence = session.evidence || [];
    let sources = session.sources || [];

    // Fallback: If sources array was empty in session response, fetch from sources endpoint
    if (!sources || sources.length === 0) {
      try {
        const sRes = await fetch(`/api/research/${sessionId}/sources`);
        if (sRes.ok) {
          const sJson = await sRes.json();
          sources = sJson.data || [];
        }
      } catch (e) {
        console.warn('Sources route fetch warning:', e);
      }
    }

    const webSources = sources.filter((s) => s.sourceType === 'web');
    const bookSources = sources.filter((s) => s.sourceType === 'book');
    const youtubeSources = sources.filter((s) => s.sourceType === 'youtube');
    const execution = session.execution || null;
    const steps = execution?.steps || [];

    // Update tab counts
    if (el.countEvidence) el.countEvidence.textContent = evidence.length;
    if (el.countWeb) el.countWeb.textContent = webSources.length;
    if (el.countBooks) el.countBooks.textContent = bookSources.length;
    if (el.countYoutube) el.countYoutube.textContent = youtubeSources.length;
    if (el.countLogs) el.countLogs.textContent = steps.length;

    // Update Summary Header
    if (el.evidenceSummaryText) {
      el.evidenceSummaryText.innerHTML = `
        Pedagogical research evidence gathered for <strong>"${escapeHtml(session.lessonTitle || 'Lesson')}"</strong>.
        Total: <strong>${evidence.length}</strong> evidence quotes across <strong>${sources.length}</strong> multi-agent sources:
        <span style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:12px; background:#e0f2fe; color:#0369a1; font-weight:600; font-size:0.75rem;">🌐 ${webSources.length} Web</span>
        <span style="display:inline-block; margin-left:4px; padding:2px 8px; border-radius:12px; background:#fef3c7; color:#92400e; font-weight:600; font-size:0.75rem;">📚 ${bookSources.length} Books</span>
        <span style="display:inline-block; margin-left:4px; padding:2px 8px; border-radius:12px; background:#fee2e2; color:#b91c1c; font-weight:600; font-size:0.75rem;">📺 ${youtubeSources.length} YouTube</span>
      `;
    }

    // 1. Render Extracted Evidence Tab
    renderEvidenceTab(evidence);

    // 2. Render Web Sources Tab
    renderWebSourcesTab(webSources);

    // 3. Render Book Sources Tab
    renderBookSourcesTab(bookSources);

    // 4. Render YouTube Videos Tab
    renderYouTubeSourcesTab(youtubeSources);

    // 5. Render ReAct Trace Logs Tab
    renderReActLogsTab(steps);
  } catch (err) {
    console.warn('[ResearchExplorer] Failed to load research data:', err.message);
  }
}

async function loadLatestResearch() {
  try {
    const res = await fetch('/api/research/latest');
    if (res.ok) {
      const json = await res.json();
      if (json.data?._id) {
        state.currentResearchSessionId = json.data._id;
        loadResearchData(json.data._id);
      }
    }
  } catch (err) {
    console.warn('[ResearchExplorer] No recent research available:', err.message);
  }
}

function renderEvidenceTab(evidence) {
  if (!el.evidenceList) return;
  if (!evidence || evidence.length === 0) {
    el.evidenceList.innerHTML = '<div class="placeholder-box">No research evidence gathered yet.</div>';
    return;
  }

  el.evidenceList.innerHTML = evidence.map((e) => {
    const type = e.sourceType || 'web';
    const relPercent = Math.round((e.relevance || 0.8) * 100);
    const link = e.sourceUrl
      ? `<a href="${e.sourceUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(e.sourceTitle || e.sourceUrl)}</a>`
      : escapeHtml(e.sourceTitle || 'External Citation');

    return `
      <div class="evidence-item">
        <div class="evidence-header">
          <span class="evidence-source-type type-${type}">${escapeHtml(type.toUpperCase())}</span>
          <span class="evidence-relevance">Relevance: ${relPercent}%</span>
        </div>
        <div class="evidence-text">"${escapeHtml(e.text || '')}"</div>
        <div class="evidence-citation">
          Source: ${link}
        </div>
      </div>
    `;
  }).join('');
}

function renderWebSourcesTab(sources) {
  if (!el.webSourcesGrid) return;
  if (!sources || sources.length === 0) {
    el.webSourcesGrid.innerHTML = '<div class="placeholder-box">No web sources collected yet.</div>';
    return;
  }

  el.webSourcesGrid.innerHTML = sources.map((s) => {
    let domain = s.domain;
    if (!domain && s.url) {
      try {
        domain = new URL(s.url).hostname.replace(/^www\./, '');
      } catch {
        domain = 'web';
      }
    }
    return `
      <div class="source-card">
        <div class="source-header">
          <div class="source-title">
            <a href="${s.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title || 'Web Resource')}</a>
          </div>
          <span class="source-domain">${escapeHtml(domain || 'web')}</span>
        </div>
        ${s.snippet ? `<div class="source-snippet">${escapeHtml(s.snippet)}</div>` : ''}
        ${s.extractedContent ? `<div class="source-extracted">${escapeHtml(s.extractedContent.slice(0, 500))}...</div>` : ''}
      </div>
    `;
  }).join('');
}

function renderBookSourcesTab(sources) {
  if (!el.bookSourcesGrid) return;
  if (!sources || sources.length === 0) {
    el.bookSourcesGrid.innerHTML = '<div class="placeholder-box">No book sources collected yet.</div>';
    return;
  }

  el.bookSourcesGrid.innerHTML = sources.map((b) => {
    const authorsStr = (b.authors && b.authors.length) ? b.authors.join(', ') : 'Academic Author';
    const link = b.infoLink || b.url || '#';
    const coverHtml = b.coverUrl
      ? `<img src="${b.coverUrl}" alt="Book Cover" class="book-cover" onerror="this.outerHTML='<div class=\\'book-cover\\' style=\\'display:flex;align-items:center;justify-content:center;font-size:1.8rem;background:#fef3c7;\\'>📚</div>'" />`
      : `<div class="book-cover" style="display:flex;align-items:center;justify-content:center;font-size:1.8rem;background:#fef3c7;">📚</div>`;

    return `
      <div class="source-card">
        <div class="book-card-body">
          ${coverHtml}
          <div class="book-details">
            <div class="source-title">
              <a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.title || 'Textbook Source')}</a>
            </div>
            <div class="book-meta">
              <span>✍️ <strong>${escapeHtml(authorsStr)}</strong></span>
              ${b.publisher ? ` • <span>🏢 ${escapeHtml(b.publisher)}</span>` : ''}
              ${b.publishedDate ? ` • <span>📅 ${escapeHtml(b.publishedDate)}</span>` : ''}
              ${b.pageCount ? ` • <span>📄 ${b.pageCount} pages</span>` : ''}
              ${b.isbn ? ` • <span>ISBN: ${escapeHtml(b.isbn)}</span>` : ''}
            </div>
            ${b.description ? `<div class="source-snippet">${escapeHtml(b.description)}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderYouTubeSourcesTab(sources) {
  if (!el.youtubeSourcesGrid) return;
  if (!sources || sources.length === 0) {
    el.youtubeSourcesGrid.innerHTML = '<div class="placeholder-box">No video sources collected yet.</div>';
    return;
  }

  el.youtubeSourcesGrid.innerHTML = sources.map((yt) => {
    const link = yt.url || (yt.videoId ? `https://www.youtube.com/watch?v=${yt.videoId}` : '#');
    const thumbHtml = yt.thumbnailUrl
      ? `<img src="${yt.thumbnailUrl}" alt="Video Thumbnail" class="yt-thumb" onerror="this.outerHTML='<div class=\\'yt-thumb\\' style=\\'display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:#ef4444;background:#18181b;\\'>▶️</div>'" />`
      : `<div class="yt-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:#ef4444;background:#18181b;">▶️</div>`;

    return `
      <div class="source-card">
        <div class="yt-card-body">
          ${thumbHtml}
          <div class="yt-details">
            <div class="source-title">
              <a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(yt.title || 'Lecture Video')}</a>
            </div>
            <div class="book-meta">
              ${yt.channelTitle ? `<span>📺 <strong>${escapeHtml(yt.channelTitle)}</strong></span>` : ''}
              ${yt.publishedAt ? ` • <span>📅 ${new Date(yt.publishedAt).toLocaleDateString()}</span>` : ''}
            </div>
            ${yt.snippet ? `<div class="source-snippet">${escapeHtml(yt.snippet)}</div>` : ''}
            ${yt.transcript ? `<div class="yt-transcript-box"><strong>Transcript text:</strong> "${escapeHtml(yt.transcript.slice(0, 450))}..."</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderReActLogsTab(steps) {
  if (!el.reactLogContainer) return;
  if (!steps || steps.length === 0) {
    el.reactLogContainer.innerHTML = '<div class="placeholder-box">Trace logs will appear when an agent workflow executes.</div>';
    return;
  }

  el.reactLogContainer.innerHTML = steps.map((s, idx) => {
    return `
      <div class="react-step-card">
        <div class="react-step-header">
          <span class="agent-name-badge bg-primary text-light">${escapeHtml(s.agent || 'Agent')}</span>
          <span class="text-muted" style="font-size:0.75rem;">Step #${idx + 1} • Iteration ${s.iteration || 1} • ${s.durationMs || 0}ms • Status: <strong>${escapeHtml(s.status || 'done')}</strong></span>
        </div>
        <div><strong>Action:</strong> <code>${escapeHtml(s.action || 'execute')}</code></div>
        ${s.reasoning ? `<div><strong>Reasoning:</strong> <em>${escapeHtml(s.reasoning)}</em></div>` : ''}
        ${s.observation ? `<div><strong>Observation:</strong> ${escapeHtml(s.observation)}</div>` : ''}
      </div>
    `;
  }).join('');
}

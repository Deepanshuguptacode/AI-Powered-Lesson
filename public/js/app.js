/**
 * AI Lesson Creation Tool - Frontend Application Script
 * Stage 2 & 3: Research Engine & LangGraph Multi-Agent Workspace
 */

// ── State ────────────────────────────────────────────────────────────────────
let currentExecution = null;
let currentSession = null;
let currentSources = [];
let executionTimer = null;
let executionStartTime = 0;

// ── DOM Elements ─────────────────────────────────────────────────────────────
const elements = {
  form: document.getElementById('lessonForm'),
  titleInput: document.getElementById('lessonTitle'),
  objectiveInput: document.getElementById('learningObjective'),
  titleCount: document.getElementById('titleCount'),
  objectiveCount: document.getElementById('objectiveCount'),

  startAgentBtn: document.getElementById('startAgentResearchBtn'),
  agentSpinner: document.getElementById('agentSpinner'),
  agentIcon: document.getElementById('agentIcon'),
  agentBtnText: document.getElementById('agentBtnText'),

  startDirectBtn: document.getElementById('startDirectResearchBtn'),
  directSpinner: document.getElementById('directSpinner'),
  saveLessonBtn: document.getElementById('saveLessonBtn'),
  clearBtn: document.getElementById('clearBtn'),
  refreshBtn: document.getElementById('refreshBtn'),

  lessonsContainer: document.getElementById('lessonsContainer'),
  lessonCountBadge: document.getElementById('lessonCountBadge'),

  // Alerts & System Status
  alertBox: document.getElementById('alertBox'),
  alertIcon: document.getElementById('alertIcon'),
  alertMessage: document.getElementById('alertMessage'),
  alertCloseBtn: document.getElementById('alertCloseBtn'),
  systemStatus: document.getElementById('systemStatus'),
  statusText: document.getElementById('statusText'),
  gatewayModelText: document.getElementById('gatewayModelText'),
  tokenUsageBadge: document.getElementById('tokenUsageBadge'),
  gwModelDetail: document.getElementById('gwModelDetail'),
  gwKeyPoolDetail: document.getElementById('gwKeyPoolDetail'),

  // Tracker & Nodes
  executionStatusPill: document.getElementById('executionStatusPill'),
  durationMetric: document.getElementById('durationMetric'),
  sourcesMetric: document.getElementById('sourcesMetric'),
  tokenMetric: document.getElementById('tokenMetric'),
  nodeSupervisor: document.getElementById('nodeSupervisor'),
  statusSupervisor: document.getElementById('statusSupervisor'),
  nodeWeb: document.getElementById('nodeWeb'),
  statusWeb: document.getElementById('statusWeb'),
  nodeBook: document.getElementById('nodeBook'),
  statusBook: document.getElementById('statusBook'),
  nodeYoutube: document.getElementById('nodeYoutube'),
  statusYoutube: document.getElementById('statusYoutube'),

  // Tabs & Counts
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  countEvidence: document.getElementById('countEvidence'),
  countWeb: document.getElementById('countWeb'),
  countBooks: document.getElementById('countBooks'),
  countYoutube: document.getElementById('countYoutube'),
  countLogs: document.getElementById('countLogs'),

  // Containers
  evidenceSummaryText: document.getElementById('evidenceSummaryText'),
  evidenceList: document.getElementById('evidenceList'),
  webSourcesGrid: document.getElementById('webSourcesGrid'),
  bookSourcesGrid: document.getElementById('bookSourcesGrid'),
  youtubeSourcesGrid: document.getElementById('youtubeSourcesGrid'),
  reactLogContainer: document.getElementById('reactLogContainer'),
  copyLogsBtn: document.getElementById('copyLogsBtn')
};

// ── API Endpoints ────────────────────────────────────────────────────────────
const API = {
  HEALTH: '/api/health',
  LESSONS: '/api/lessons',
  DIRECT_RESEARCH: '/api/research',
  RESEARCH_SESSIONS: '/api/research',
  AGENT_RESEARCH: '/api/agent/research',
  AGENT_EXECUTIONS: '/api/agent/executions',
  GATEWAY_STATS: '/api/agent/gateway/stats'
};

// ── Initialization ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  checkSystemHealth();
  updateGatewayStats();
  fetchLessons();
});

// ── Event Listeners ──────────────────────────────────────────────────────────
function initEventListeners() {
  // Input live counters
  elements.titleInput.addEventListener('input', () => {
    updateCharCount(elements.titleInput, elements.titleCount, 150);
    elements.titleInput.classList.remove('error');
  });

  elements.objectiveInput.addEventListener('input', () => {
    updateCharCount(elements.objectiveInput, elements.objectiveCount, 2000);
    elements.objectiveInput.classList.remove('error');
  });

  // Action buttons
  elements.startAgentBtn.addEventListener('click', handleStartAgentResearch);
  elements.startDirectBtn.addEventListener('click', handleStartDirectResearch);
  elements.saveLessonBtn.addEventListener('click', handleSaveLesson);
  elements.clearBtn.addEventListener('click', handleClearForm);
  elements.refreshBtn.addEventListener('click', () => fetchLessons(true));
  elements.alertCloseBtn.addEventListener('click', hideAlert);

  // Tab switching
  elements.tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');
      switchTab(targetTabId);
    });
  });

  // Copy logs button
  elements.copyLogsBtn.addEventListener('click', () => {
    if (!currentExecution || !currentExecution.stepLog) {
      showAlert('No logs available to copy.', 'error');
      return;
    }
    navigator.clipboard.writeText(JSON.stringify(currentExecution.stepLog, null, 2))
      .then(() => showAlert('Execution logs copied to clipboard!', 'success'))
      .catch(() => showAlert('Failed to copy logs to clipboard.', 'error'));
  });
}

// ── Char Counter & Form Validation ───────────────────────────────────────────
function updateCharCount(inputElement, counterElement, max) {
  counterElement.textContent = `${inputElement.value.length} / ${max}`;
}

function validateInputs(title, objective) {
  let isValid = true;
  const errors = [];

  if (!title || title.trim().length < 3) {
    elements.titleInput.classList.add('error');
    errors.push('Lesson title must be at least 3 characters.');
    isValid = false;
  }
  if (!objective || objective.trim().length < 5) {
    elements.objectiveInput.classList.add('error');
    errors.push('Learning objective must be at least 5 characters.');
    isValid = false;
  }

  if (!isValid) showAlert(errors.join(' '), 'error');
  return isValid;
}

// ── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(tabId) {
  elements.tabButtons.forEach((b) => b.classList.remove('active'));
  elements.tabContents.forEach((c) => c.classList.remove('active'));

  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const activeContent = document.getElementById(tabId);

  if (activeBtn) activeBtn.classList.add('active');
  if (activeContent) activeContent.classList.add('active');
}

// ── Node Pipeline Visualizer ─────────────────────────────────────────────────
function resetAgentNodes() {
  const nodes = [
    { node: elements.nodeSupervisor, status: elements.statusSupervisor, text: 'Idle' },
    { node: elements.nodeWeb, status: elements.statusWeb, text: 'Idle' },
    { node: elements.nodeBook, status: elements.statusBook, text: 'Idle' },
    { node: elements.nodeYoutube, status: elements.statusYoutube, text: 'Idle' }
  ];

  nodes.forEach((n) => {
    n.node.className = 'agent-node';
    n.status.textContent = n.text;
  });

  elements.executionStatusPill.className = 'status-pill status-ready';
  elements.executionStatusPill.textContent = 'Ready';
}

function setAgentNodeState(nodeKey, state, text) {
  const map = {
    supervisor: { el: elements.nodeSupervisor, st: elements.statusSupervisor },
    web: { el: elements.nodeWeb, st: elements.statusWeb },
    book: { el: elements.nodeBook, st: elements.statusBook },
    youtube: { el: elements.nodeYoutube, st: elements.statusYoutube }
  };

  const target = map[nodeKey];
  if (!target) return;

  target.el.className = `agent-node ${state}`;
  target.st.textContent = text || state.toUpperCase();
}

function startTimer() {
  executionStartTime = Date.now();
  elements.durationMetric.textContent = '⏱️ 0s';
  clearInterval(executionTimer);
  executionTimer = setInterval(() => {
    const elapsed = ((Date.now() - executionStartTime) / 1000).toFixed(1);
    elements.durationMetric.textContent = `⏱️ ${elapsed}s`;
  }, 100);
}

function stopTimer(finalDurationMs) {
  clearInterval(executionTimer);
  if (finalDurationMs) {
    elements.durationMetric.textContent = `⏱️ ${(finalDurationMs / 1000).toFixed(2)}s`;
  }
}

// ── LangGraph Multi-Agent Research Action ─────────────────────────────────────
async function handleStartAgentResearch() {
  const title = elements.titleInput.value.trim();
  const learningObjective = elements.objectiveInput.value.trim();

  if (!validateInputs(title, learningObjective)) return;

  // Set running UI states
  elements.startAgentBtn.disabled = true;
  elements.startDirectBtn.disabled = true;
  elements.agentSpinner.classList.remove('hidden');
  elements.agentIcon.classList.add('hidden');
  elements.agentBtnText.textContent = 'Orchestrating Agents...';
  elements.executionStatusPill.className = 'status-pill status-running';
  elements.executionStatusPill.textContent = 'Running';

  resetAgentNodes();
  startTimer();
  hideAlert();

  // Animate supervisor planning
  setAgentNodeState('supervisor', 'active', 'Planning');
  
  // Stagger parallel agent activation
  setTimeout(() => {
    setAgentNodeState('web', 'active', 'Searching');
    setAgentNodeState('book', 'active', 'Scanning Books');
    setAgentNodeState('youtube', 'active', 'Transcribing');
  }, 600);

  try {
    const response = await fetch(API.AGENT_RESEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonTitle: title, learningObjective })
    });

    const resJson = await response.json();
    if (!response.ok) {
      throw new Error(resJson.message || 'Agent research failed');
    }

    const data = resJson.data;
    currentExecution = data;

    // Update node statuses from results
    const pStatus = data.providerStatus || {};
    setAgentNodeState('supervisor', 'done', 'Finalized');
    setAgentNodeState('web', pStatus.web === 'failed' ? 'failed' : 'done', pStatus.web || 'Done');
    setAgentNodeState('book', pStatus.book === 'failed' ? 'failed' : 'done', pStatus.book || 'Done');
    setAgentNodeState('youtube', pStatus.youtube === 'failed' ? 'failed' : 'done', pStatus.youtube || 'Done');

    elements.executionStatusPill.className = 'status-pill status-completed';
    elements.executionStatusPill.textContent = 'Completed';

    stopTimer(data.durationMs);

    // Fetch full session details & sources
    if (data.sessionId) {
      await loadSessionData(data.sessionId);
    }

    // Render agent logs
    renderReactLogs(data.stepLog || []);

    // Update Metrics
    elements.sourcesMetric.textContent = `📦 ${data.totalSources || 0} Sources`;
    const totalTok = (data.tokenUsage?.promptTokens || 0) + (data.tokenUsage?.completionTokens || 0);
    elements.tokenMetric.textContent = `⚡ ${totalTok} Tokens`;

    showAlert(`Multi-Agent research completed! Discovered ${data.totalSources || 0} sources.`, 'success');
    await updateGatewayStats();
  } catch (err) {
    console.error('Agent research error:', err);
    elements.executionStatusPill.className = 'status-pill status-failed';
    elements.executionStatusPill.textContent = 'Failed';
    stopTimer();
    showAlert(err.message || 'Error occurred while running agent research.', 'error');
  } finally {
    elements.startAgentBtn.disabled = false;
    elements.startDirectBtn.disabled = false;
    elements.agentSpinner.classList.add('hidden');
    elements.agentIcon.classList.remove('hidden');
    elements.agentBtnText.textContent = 'Run LangGraph Multi-Agent Research';
  }
}

// ── Direct Stage 2 Research Action ───────────────────────────────────────────
async function handleStartDirectResearch() {
  const title = elements.titleInput.value.trim();
  const learningObjective = elements.objectiveInput.value.trim();

  if (!validateInputs(title, learningObjective)) return;

  elements.startDirectBtn.disabled = true;
  elements.startAgentBtn.disabled = true;
  elements.directSpinner.classList.remove('hidden');
  resetAgentNodes();
  startTimer();
  hideAlert();

  setAgentNodeState('supervisor', 'active', 'Direct Query');
  setAgentNodeState('web', 'active', 'Querying');
  setAgentNodeState('book', 'active', 'Querying');
  setAgentNodeState('youtube', 'active', 'Querying');

  try {
    const response = await fetch(API.DIRECT_RESEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonTitle: title, learningObjective })
    });

    const resJson = await response.json();
    if (!response.ok) throw new Error(resJson.message || 'Direct research failed');

    const data = resJson.data;
    stopTimer(data.summary?.durationMs);

    setAgentNodeState('supervisor', 'done', 'Done');
    setAgentNodeState('web', 'done', 'Done');
    setAgentNodeState('book', 'done', 'Done');
    setAgentNodeState('youtube', 'done', 'Done');

    elements.executionStatusPill.className = 'status-pill status-completed';
    elements.executionStatusPill.textContent = 'Completed';

    if (data.sessionId) {
      await loadSessionData(data.sessionId);
    }

    elements.sourcesMetric.textContent = `📦 ${data.summary?.totalSources || 0} Sources`;
    showAlert(`Direct research completed! Collected ${data.summary?.totalSources || 0} sources.`, 'success');
    await updateGatewayStats();
  } catch (err) {
    stopTimer();
    showAlert(err.message || 'Direct research failed', 'error');
  } finally {
    elements.startDirectBtn.disabled = false;
    elements.startAgentBtn.disabled = false;
    elements.directSpinner.classList.add('hidden');
  }
}

// ── Load Session and Sources Data ────────────────────────────────────────────
async function loadSessionData(sessionId) {
  try {
    // 1. Fetch session with evidence
    const sessRes = await fetch(`${API.RESEARCH_SESSIONS}/${sessionId}`);
    const sessJson = await sessRes.json();
    if (sessRes.ok && sessJson.data) {
      currentSession = sessJson.data;
      renderEvidence(currentSession.evidence || [], currentSession.lessonTitle);
    }

    // 2. Fetch raw sources
    const srcRes = await fetch(`${API.RESEARCH_SESSIONS}/${sessionId}/sources`);
    const srcJson = await srcRes.json();
    if (srcRes.ok && srcJson.data) {
      currentSources = srcJson.data;
      renderSources(currentSources);
    }
  } catch (err) {
    console.warn('Failed to load full session data:', err);
  }
}

// ── Render Evidence ──────────────────────────────────────────────────────────
function renderEvidence(evidenceList, lessonTitle) {
  elements.countEvidence.textContent = evidenceList.length;

  if (evidenceList.length === 0) {
    elements.evidenceList.innerHTML = `
      <div class="placeholder-box">
        <p>No evidence extracted for this session.</p>
      </div>`;
    return;
  }

  elements.evidenceSummaryText.innerHTML = `
    Extracted <strong>${evidenceList.length} evidence excerpts</strong> for <em>"${escapeHtml(lessonTitle)}"</em> across Web, Books, and Video media.`;

  elements.evidenceList.innerHTML = evidenceList.map((item, idx) => {
    const typeClass = `type-${item.sourceType}`;
    const icon = item.sourceType === 'web' ? '🌐' : item.sourceType === 'book' ? '📚' : '📺';
    const relPercent = Math.round((item.relevance || 0.5) * 100);

    return `
      <div class="evidence-item">
        <div class="evidence-header">
          <span class="evidence-source-type ${typeClass}">${icon} ${item.sourceType}</span>
          <span class="evidence-relevance">Relevance: ${relPercent}%</span>
        </div>
        <p class="evidence-text">"${escapeHtml(item.text)}"</p>
        <div class="evidence-citation">
          Source: ${item.sourceUrl ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.sourceTitle || item.sourceUrl)}</a>` : escapeHtml(item.sourceTitle || 'Reference item')}
        </div>
      </div>
    `;
  }).join('');
}

// ── Render Sources (Web, Books, YouTube) ──────────────────────────────────────
function renderSources(sources) {
  const web = sources.filter((s) => s.sourceType === 'web');
  const books = sources.filter((s) => s.sourceType === 'book');
  const youtube = sources.filter((s) => s.sourceType === 'youtube');

  elements.countWeb.textContent = web.length;
  elements.countBooks.textContent = books.length;
  elements.countYoutube.textContent = youtube.length;

  // Web Sources
  if (web.length === 0) {
    elements.webSourcesGrid.innerHTML = `<div class="placeholder-box"><p>No web sources collected.</p></div>`;
  } else {
    elements.webSourcesGrid.innerHTML = web.map((item) => `
      <div class="source-card">
        <div class="source-header">
          <h4 class="source-title">
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title || item.url)}</a>
          </h4>
          <span class="source-domain">${escapeHtml(item.domain || 'web')}</span>
        </div>
        <p class="source-snippet">${escapeHtml(item.snippet || '')}</p>
        ${item.extractedContent ? `<div class="source-extracted">${escapeHtml(item.extractedContent.slice(0, 300))}...</div>` : ''}
      </div>
    `).join('');
  }

  // Book Sources
  if (books.length === 0) {
    elements.bookSourcesGrid.innerHTML = `<div class="placeholder-box"><p>No book sources collected.</p></div>`;
  } else {
    elements.bookSourcesGrid.innerHTML = books.map((item) => {
      const authors = Array.isArray(item.authors) ? item.authors.join(', ') : item.authors || 'Unknown author';
      return `
        <div class="source-card">
          <div class="book-card-body">
            ${item.coverUrl ? `<img class="book-cover" src="${escapeHtml(item.coverUrl)}" alt="Cover" onerror="this.style.display='none'">` : '<div class="book-cover" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem">📖</div>'}
            <div class="book-details">
              <h4 class="source-title">
                <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
              </h4>
              <span class="book-meta">By ${escapeHtml(authors)} ${item.publishedDate ? `(${escapeHtml(item.publishedDate)})` : ''}</span>
              ${item.publisher ? `<span class="book-meta">Publisher: ${escapeHtml(item.publisher)}</span>` : ''}
              ${item.isbn ? `<span class="book-meta">ISBN: ${escapeHtml(item.isbn)}</span>` : ''}
              <p class="source-snippet">${escapeHtml(item.description || '')}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // YouTube Sources
  if (youtube.length === 0) {
    elements.youtubeSourcesGrid.innerHTML = `<div class="placeholder-box"><p>No YouTube videos collected.</p></div>`;
  } else {
    elements.youtubeSourcesGrid.innerHTML = youtube.map((item) => `
      <div class="source-card">
        <div class="yt-card-body">
          ${item.thumbnailUrl ? `<img class="yt-thumb" src="${escapeHtml(item.thumbnailUrl)}" alt="Thumbnail">` : ''}
          <div class="yt-details">
            <h4 class="source-title">
              <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
            </h4>
            <span class="book-meta">Channel: ${escapeHtml(item.channelTitle || 'YouTube')}</span>
            <p class="source-snippet">${escapeHtml(item.snippet || '')}</p>
            ${item.transcript ? `
              <div class="yt-transcript-box">
                <strong>Transcript Excerpt:</strong> ${escapeHtml(item.transcript.slice(0, 250))}...
              </div>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }
}

// ── Render ReAct Execution Logs ──────────────────────────────────────────────
function renderReactLogs(stepLog) {
  elements.countLogs.textContent = stepLog.length;

  if (stepLog.length === 0) {
    elements.reactLogContainer.innerHTML = `
      <div class="placeholder-box">
        <p>No execution logs available.</p>
      </div>`;
    return;
  }

  elements.reactLogContainer.innerHTML = stepLog.map((step, idx) => {
    return `
      <div class="react-step-card">
        <div class="react-step-header">
          <span class="agent-name-badge">Agent: ${escapeHtml(step.agent)}</span>
          <span class="metric-item">Step #${idx + 1} &bull; ${step.durationMs || 0}ms</span>
        </div>
        ${step.reasoning ? `
          <div class="react-phase">
            <span class="phase-label">🧠 Reason:</span>
            <div class="phase-text">${escapeHtml(step.reasoning)}</div>
          </div>` : ''}
        <div class="react-phase">
          <span class="phase-label">⚡ Action:</span>
          <div class="phase-tool-call">${escapeHtml(step.action || 'Execute')}</div>
        </div>
        ${step.observation ? `
          <div class="react-phase">
            <span class="phase-label">👁️ Observe:</span>
            <div class="phase-text">${escapeHtml(step.observation)}</div>
          </div>` : ''}
      </div>
    `;
  }).join('');
}

// ── Save Draft Lesson ────────────────────────────────────────────────────────
async function handleSaveLesson() {
  const title = elements.titleInput.value.trim();
  const learningObjective = elements.objectiveInput.value.trim();

  if (!validateInputs(title, learningObjective)) return;

  try {
    const res = await fetch(API.LESSONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, learningObjective })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Failed to save lesson');

    showAlert(`Lesson "${result.data.title}" saved to database!`, 'success');
    await fetchLessons();
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

// ── Fetch & Render Saved Lessons ─────────────────────────────────────────────
async function fetchLessons(showNotice = false) {
  try {
    const res = await fetch(API.LESSONS);
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Could not load lessons');

    const lessons = result.data || [];
    renderLessons(lessons);
    if (showNotice) showAlert(`Refreshed ${lessons.length} saved lessons.`, 'success');
  } catch (err) {
    console.warn('Could not retrieve lessons list:', err);
  }
}

function renderLessons(lessons) {
  elements.lessonCountBadge.textContent = `${lessons.length} Lesson${lessons.length === 1 ? '' : 's'}`;

  if (!lessons || lessons.length === 0) {
    elements.lessonsContainer.innerHTML = `
      <div class="placeholder-box" style="padding:20px;">
        <p>No saved lessons yet. Save one using the form above.</p>
      </div>`;
    return;
  }

  elements.lessonsContainer.innerHTML = lessons.map((l) => {
    return `
      <article class="lesson-card" style="cursor:pointer;" onclick="selectLesson('${escapeHtml(l.title)}', '${escapeHtml(l.learningObjective)}')">
        <div class="lesson-card-header">
          <h4 class="lesson-card-title">${escapeHtml(l.title)}</h4>
          <span class="badge badge-draft">${escapeHtml(l.status || 'draft')}</span>
        </div>
        <p class="lesson-card-objective">${escapeHtml(l.learningObjective)}</p>
        <div class="lesson-card-footer">
          <span>Click to load into editor</span>
        </div>
      </article>
    `;
  }).join('');
}

window.selectLesson = function(title, objective) {
  elements.titleInput.value = title;
  elements.objectiveInput.value = objective;
  updateCharCount(elements.titleInput, elements.titleCount, 150);
  updateCharCount(elements.objectiveInput, elements.objectiveCount, 2000);
  showAlert(`Loaded lesson: "${title}"`, 'success');
};

function handleClearForm() {
  elements.form.reset();
  updateCharCount(elements.titleInput, elements.titleCount, 150);
  updateCharCount(elements.objectiveInput, elements.objectiveCount, 2000);
}

// ── Health & Gateway Polling ─────────────────────────────────────────────────
async function checkSystemHealth() {
  try {
    const res = await fetch(API.HEALTH);
    const dot = elements.systemStatus.querySelector('.status-dot');
    if (res.ok) {
      dot.className = 'status-dot connected';
      elements.statusText.textContent = 'Backend Online';
    } else {
      dot.className = 'status-dot disconnected';
      elements.statusText.textContent = 'Server Degraded';
    }
  } catch {
    const dot = elements.systemStatus.querySelector('.status-dot');
    dot.className = 'status-dot disconnected';
    elements.statusText.textContent = 'Backend Offline';
  }
}

async function updateGatewayStats() {
  try {
    const res = await fetch(API.GATEWAY_STATS);
    const json = await res.json();
    if (res.ok && json.data) {
      const stats = json.data;
      elements.gatewayModelText.textContent = stats.activeModel || 'openai/gpt-oss-120b';
      elements.tokenUsageBadge.textContent = `${stats.totalTokens || 0} Tokens`;
      elements.gwModelDetail.textContent = stats.activeModel || 'openai/gpt-oss-120b';
      elements.gwKeyPoolDetail.textContent = `${stats.keyPoolSize || 1} Key(s) in Pool (Auto-Failover)`;
    }
  } catch (err) {
    console.warn('Could not fetch gateway stats:', err);
  }
}

// ── Alert Helpers ────────────────────────────────────────────────────────────
function showAlert(message, type = 'success') {
  elements.alertBox.className = `alert alert-${type}`;
  elements.alertIcon.textContent = type === 'success' ? '✓' : '⚠';
  elements.alertMessage.textContent = message;
  elements.alertBox.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(hideAlert, 6000);
  }
}

function hideAlert() {
  elements.alertBox.classList.add('hidden');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

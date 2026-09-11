/**
 * Automation Control Desk — client UI (full feature set).
 *
 * Run log modes:
 * - Client: only `[CLIENT]` step lines (plain language for demos)
 * - Full: every npm / Appium / WDIO line
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const LS_THEME = 'automation-dashboard-theme';
  const LS_PROJECT = 'automation-dashboard-last-project';
  const LS_LOG_MODE = 'automation-dashboard-log-mode';

  const els = {
    appiumDot: $('appiumDot'),
    appiumDetail: $('appiumDetail'),
    btnAppiumStart: $('btnAppiumStart'),
    btnAppiumStop: $('btnAppiumStop'),
    btnAppiumRefresh: $('btnAppiumRefresh'),
    btnTheme: $('btnTheme'),
    deviceSummary: $('deviceSummary'),
    deviceSub: $('deviceSub'),
    btnDevicesRefresh: $('btnDevicesRefresh'),
    summaryValue: $('summaryValue'),
    summarySub: $('summarySub'),
    btnSummaryReport: $('btnSummaryReport'),
    queueValue: $('queueValue'),
    queueSub: $('queueSub'),
    projectGrid: $('projectGrid'),
    scriptsPanel: $('scriptsPanel'),
    projectEyebrow: $('projectEyebrow'),
    projectTitle: $('projectTitle'),
    projectMeta: $('projectMeta'),
    envBanner: $('envBanner'),
    suiteBlock: $('suiteBlock'),
    suiteList: $('suiteList'),
    chkSelectAll: $('chkSelectAll'),
    btnRunSelected: $('btnRunSelected'),
    btnOpenShots: $('btnOpenShots'),
    scriptGroups: $('scriptGroups'),
    listIos: $('listIos'),
    listAndroid: $('listAndroid'),
    listOther: $('listOther'),
    colOther: $('colOther'),
    reportsEmpty: $('reportsEmpty'),
    reportList: $('reportList'),
    btnBack: $('btnBack'),
    logView: $('logView'),
    logHint: $('logHint'),
    btnLogClient: $('btnLogClient'),
    btnLogFull: $('btnLogFull'),
    runMeta: $('runMeta'),
    runSummary: $('runSummary'),
    btnViewReport: $('btnViewReport'),
    btnStopRun: $('btnStopRun'),
    btnClearLog: $('btnClearLog'),
    historyList: $('historyList'),
    footHint: $('footHint'),
  };

  let selectedProjectId = null;
  let runPoll = null;
  let lastLineCount = 0;
  /** @type {string[]} */
  let lastProjects = [];
  /** @type {string[]} cached raw run lines for Client/Full toggle */
  let cachedLogLines = [];
  /** @type {'client' | 'full'} */
  let logMode = localStorage.getItem(LS_LOG_MODE) === 'full' ? 'full' : 'client';

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Keep only client-facing progress lines (and a few run bookends).
   * Scripts emit: console.log('[CLIENT] Email has been entered')
   */
  function filterClientLines(lines) {
    const out = [];
    for (const raw of lines || []) {
      const line = String(raw);
      const m = line.match(/\[CLIENT\]\s*(.+)$/);
      if (m) {
        out.push(`• ${m[1].trim()}`);
        continue;
      }
      // Keep short run markers so clients still see start/end
      if (/^\$ npm run /.test(line)) out.push(`▶ Starting: ${line.replace(/^\$\s*/, '')}`);
      else if (/^— finished with exit code/.test(line)) {
        const code = line.match(/exit code (\d+)/);
        out.push(
          Number(code?.[1]) === 0
            ? '✓ Finished successfully'
            : `✗ Finished with errors (code ${code?.[1] ?? '?'})`
        );
      } else if (/^Report: /.test(line)) out.push(line);
      else if (/^Spawn error:/.test(line)) out.push(`✗ ${line}`);
      else if (/stopped by user/i.test(line)) out.push('■ Stopped by user');
    }
    return out;
  }

  /** Apply Client vs Full filter to the cached raw lines. */
  function renderLogView() {
    const empty =
      'Click a script to run it here.\n\nTip: Client mode shows plain steps (email entered, keyboard hidden…). Full mode shows every technical line.';
    if (!cachedLogLines.length) {
      els.logView.textContent =
        logMode === 'client'
          ? 'Waiting for automation steps…\n(Switch to Full if you need debug output.)'
          : empty;
      return;
    }
    if (logMode === 'client') {
      const steps = filterClientLines(cachedLogLines);
      els.logView.textContent = steps.length
        ? steps.join('\n')
        : 'No client steps yet…\n(Technical noise is hidden — steps appear as the script runs.)';
    } else {
      els.logView.textContent = cachedLogLines.join('\n');
    }
    els.logView.scrollTop = els.logView.scrollHeight;
  }

  function setLogMode(mode) {
    logMode = mode === 'full' ? 'full' : 'client';
    localStorage.setItem(LS_LOG_MODE, logMode);
    els.btnLogClient?.classList.toggle('active', logMode === 'client');
    els.btnLogFull?.classList.toggle('active', logMode === 'full');
    els.logView.classList.toggle('log--client', logMode === 'client');
    if (els.logHint) {
      els.logHint.textContent =
        logMode === 'client'
          ? 'Client view: plain steps only (Email entered, keyboard hidden…). Switch to Full for debug.'
          : 'Full view: all npm, Appium, and WebdriverIO output.';
    }
    renderLogView();
  }

  function applyTheme(theme) {
    document.body.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem(LS_THEME, theme);
    els.btnTheme.textContent = theme === 'dark' ? 'Light' : 'Dark';
  }

  function toggleTheme() {
    const next = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
    applyTheme(next);
  }

  function setAppiumUi(status) {
    const on = Boolean(status.running);
    els.appiumDot.dataset.state = on ? 'on' : 'off';
    els.appiumDetail.textContent = on
      ? status.detail || `Online · ${status.url}`
      : status.hint || `Offline · ${status.url}`;
    els.btnAppiumStart.disabled = on;
    els.btnAppiumStart.textContent = on ? 'Appium is on' : 'Start Appium';
    els.footHint.textContent = on
      ? 'Appium ready — pick a project and run'
      : 'Start Appium before running test scripts';
  }

  async function refreshAppium() {
    els.appiumDot.dataset.state = 'busy';
    try {
      setAppiumUi(await api('/api/appium'));
    } catch (err) {
      els.appiumDot.dataset.state = 'off';
      els.appiumDetail.textContent = String(err.message || err);
    }
  }

  async function startAppium() {
    els.appiumDot.dataset.state = 'busy';
    els.appiumDetail.textContent = 'Starting Appium…';
    els.btnAppiumStart.disabled = true;
    try {
      const result = await api('/api/appium/start', { method: 'POST', body: '{}' });
      if (!result.ok && result.error) alert(result.error);
    } catch (err) {
      alert(String(err.message || err));
    }
    await refreshAppium();
  }

  async function stopAppium() {
    els.appiumDot.dataset.state = 'busy';
    try {
      await api('/api/appium/stop', { method: 'POST', body: '{}' });
    } catch (err) {
      alert(String(err.message || err));
    }
    await refreshAppium();
  }

  async function refreshDevices(projectId) {
    try {
      const q = projectId
        ? `?projectId=${encodeURIComponent(projectId)}`
        : '';
      const d = await api(`/api/devices${q}`);
      els.deviceSummary.textContent = d.summary || '—';
      const bits = [];
      if (d.ios?.devices?.length) {
        bits.push(
          d.ios.devices
            .slice(0, 2)
            .map((x) => x.name)
            .join(', ')
        );
      }
      if (d.android?.devices?.length) {
        bits.push(`${d.android.devices.length} Android`);
      }
      if (d.ios?.configuredUdid && !d.ios.configuredOk) {
        bits.push('UDID not found');
      }
      els.deviceSub.textContent = bits.filter(Boolean).join(' · ') || 'Connect a phone / emulator';
    } catch (err) {
      els.deviceSummary.textContent = 'Error';
      els.deviceSub.textContent = String(err.message || err);
    }
  }

  function formatDuration(ms) {
    if (ms == null) return '';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  function updateSummaryFromRun(run) {
    if (!run || run.status === 'running') return;
    const label =
      run.status === 'passed'
        ? 'Passed'
        : run.status === 'failed'
          ? 'Failed'
          : run.status;
    els.summaryValue.innerHTML = `<span class="${
      run.status === 'passed' ? 'badge-pass' : 'badge-fail'
    }">${escapeHtml(label)}</span>`;
    const parts = [
      `${run.projectId} · ${run.script}`,
      formatDuration(run.durationMs),
    ];
    if (run.summary) {
      parts.push(
        `${run.summary.passed ?? 0} pass / ${run.summary.failed ?? 0} fail`
      );
    }
    els.summarySub.textContent = parts.filter(Boolean).join(' · ');
    if (run.primaryReportUrl) {
      els.btnSummaryReport.hidden = false;
      els.btnSummaryReport.href = run.primaryReportUrl;
    }
  }

  function updateQueueUi(queueLen, run) {
    els.queueValue.textContent = `${queueLen} waiting`;
    if (run?.status === 'running') {
      els.queueSub.textContent = `Running ${run.script}`;
    } else if (queueLen) {
      els.queueSub.textContent = 'Next will start automatically';
    } else {
      els.queueSub.textContent = 'Idle';
    }
  }

  function showViewReport(url) {
    if (!url) {
      els.btnViewReport.hidden = true;
      return;
    }
    els.btnViewReport.hidden = false;
    els.btnViewReport.href = url;
  }

  function renderRunSummaryBox(run) {
    if (!run || run.status === 'running' || !run.summary) {
      els.runSummary.hidden = true;
      return;
    }
    const s = run.summary;
    els.runSummary.hidden = false;
    els.runSummary.textContent = `Summary: ${s.passed ?? 0} passed · ${
      s.failed ?? 0
    } failed · ${s.skipped ?? 0} skipped · ${formatDuration(run.durationMs)}`;
  }

  /** Soft gradient art themes for project cards (teal / coral / ink — not purple). */
  const CARD_THEMES = [
    ['#0f766e', '#2dd4bf', '#ea580c'],
    ['#115e59', '#f97316', '#fde68a'],
    ['#134e4a', '#0ea5e9', '#fbbf24'],
    ['#1c1917', '#65a30d', '#fdba74'],
    ['#0c4a6e', '#14b8a6', '#fb923c'],
  ];

  function themeForId(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997;
    return CARD_THEMES[h % CARD_THEMES.length];
  }

  /**
   * Build a script row (checkbox + title + Run).
   * @param {string} projectId
   * @param {{ name: string, title: string, selectable?: boolean, runnable?: boolean }} s
   */
  function createScriptRow(projectId, s) {
    const row = document.createElement('div');
    row.className = 'script-row';
    const left = document.createElement('div');
    left.className = 'left';
    if (s.selectable) {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'script-check';
      cb.value = s.name;
      cb.addEventListener('change', updateRunSelectedState);
      left.appendChild(cb);
    }
    const info = document.createElement('div');
    info.innerHTML = `<p class="name">${escapeHtml(
      s.title
    )}</p><p class="cmd">npm run ${escapeHtml(s.name)}</p>`;
    left.appendChild(info);
    row.appendChild(left);
    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'btn btn-run';
    runBtn.textContent = s.runnable ? 'Run' : 'Open';
    runBtn.addEventListener('click', () => runScript(projectId, s.name));
    row.appendChild(runBtn);
    return row;
  }

  /** Classify npm script group → ios | android | other. */
  function platformBucket(group) {
    const g = String(group || '').toLowerCase();
    if (g.includes('ios') || g === 'apple') return 'ios';
    if (g.includes('android') || g === 'google') return 'android';
    return 'other';
  }

  function fillScriptList(el, items, projectId, emptyLabel) {
    el.innerHTML = '';
    if (!items.length) {
      el.innerHTML = `<p class="empty-platform">${escapeHtml(emptyLabel)}</p>`;
      return;
    }
    for (const s of items) {
      el.appendChild(createScriptRow(projectId, s));
    }
  }

  function renderProjects(projects) {
    lastProjects = projects.map((p) => p.id);
    if (!projects.length) {
      els.projectGrid.innerHTML =
        '<p class="muted">No projects found under <code>projects/</code>.</p>';
      return;
    }
    els.projectGrid.innerHTML = '';
    for (const p of projects) {
      const [c1, c2, c3] = themeForId(p.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'project-card';
      if (p.id === selectedProjectId) btn.classList.add('active');
      btn.innerHTML = `
        <div class="project-card-art" style="background:
          radial-gradient(circle at 18% 30%, ${c3}aa, transparent 42%),
          radial-gradient(circle at 78% 20%, ${c2}cc, transparent 48%),
          linear-gradient(135deg, ${c1}, ${c2} 55%, ${c3});">
          <span class="phone" aria-hidden="true"></span>
        </div>
        <div class="project-card-body">
          <h3>${escapeHtml(p.displayName)}</h3>
          <p class="desc">${escapeHtml(p.description || p.id)}</p>
          <div class="meta">
            <span class="chip">${escapeHtml(p.scriptLanguage || 'js')}</span>
            <span class="chip">${p.scriptCount} scripts</span>
            ${
              p.suiteCount
                ? `<span class="chip">${p.suiteCount} suite${p.suiteCount === 1 ? '' : 's'}</span>`
                : ''
            }
            ${
              p.reportCount
                ? `<span class="chip">${p.reportCount} report${p.reportCount === 1 ? '' : 's'}</span>`
                : '<span class="chip">no report</span>'
            }
            ${
              p.envOk
                ? '<span class="chip">env ok</span>'
                : '<span class="chip warn">env missing</span>'
            }
          </div>
        </div>
      `;
      btn.addEventListener('click', () => openProject(p.id));
      els.projectGrid.appendChild(btn);
    }
  }

  function renderReports(reports) {
    els.reportList.innerHTML = '';
    if (!reports?.length) {
      els.reportsEmpty.hidden = false;
      return;
    }
    els.reportsEmpty.hidden = true;
    for (const r of reports) {
      const row = document.createElement('div');
      row.className = 'report-row';
      row.innerHTML = `
        <div>
          <p class="name">${escapeHtml(r.label || r.name)}</p>
          <p class="when">${escapeHtml(
            r.mtime ? new Date(r.mtime).toLocaleString() : ''
          )} · ${escapeHtml(r.name)}</p>
        </div>
      `;
      const a = document.createElement('a');
      a.className = 'btn btn-run';
      a.href = r.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Open';
      row.appendChild(a);
      els.reportList.appendChild(row);
    }
  }

  function renderSuites(suites, projectId) {
    els.suiteList.innerHTML = '';
    if (!suites?.length) {
      els.suiteBlock.hidden = true;
      return;
    }
    els.suiteBlock.hidden = false;
    for (const s of suites) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suite-btn';
      btn.innerHTML = `<strong>${escapeHtml(s.title)}</strong><span>${escapeHtml(
        s.description || s.scripts.join(', ')
      )}</span>`;
      btn.addEventListener('click', () => runSuite(projectId, s.id));
      els.suiteList.appendChild(btn);
    }
  }

  function renderEnv(env) {
    if (!env) {
      els.envBanner.hidden = true;
      return;
    }
    els.envBanner.hidden = false;
    if (env.ok) {
      els.envBanner.className = 'env-banner ok';
      els.envBanner.textContent = `.env ready (${env.envPath})`;
    } else {
      els.envBanner.className = 'env-banner';
      const miss = (env.warnings || []).join(' · ') || 'Check .env';
      els.envBanner.textContent = env.envFileExists
        ? miss
        : `Missing ${env.envPath} — add TEST_USER / TEST_PASSWORD`;
    }
  }

  function updateRunSelectedState() {
    const n = document.querySelectorAll('.script-check:checked').length;
    els.btnRunSelected.disabled = n === 0;
    els.btnRunSelected.textContent =
      n === 0 ? 'Run selected' : `Run selected (${n})`;
  }

  async function loadProjects() {
    const data = await api('/api/projects');
    renderProjects(data.projects || []);
  }

  async function openProject(id) {
    selectedProjectId = id;
    localStorage.setItem(LS_PROJECT, id);
    const data = await api(`/api/projects/${encodeURIComponent(id)}`);
    const p = data.project;
    els.projectEyebrow.textContent = p.id;
    els.projectTitle.textContent = p.displayName;
    els.projectMeta.textContent = [
      p.bundleId && `iOS ${p.bundleId}`,
      p.appPackage && `Android ${p.appPackage}`,
      `${(data.scripts || []).length} scripts`,
      `${(data.reports || []).length} reports`,
    ]
      .filter(Boolean)
      .join(' · ');

    renderEnv(data.env);
    renderSuites(data.suites || [], id);
    refreshDevices(id);

    /** Split scripts: iOS left column, Android right, rest below. */
    const ios = [];
    const android = [];
    const other = [];
    for (const s of data.scripts || []) {
      const bucket = platformBucket(s.group);
      if (bucket === 'ios') ios.push(s);
      else if (bucket === 'android') android.push(s);
      else other.push(s);
    }

    els.chkSelectAll.checked = false;
    fillScriptList(els.listIos, ios, id, 'No iOS scripts yet');
    fillScriptList(els.listAndroid, android, id, 'No Android scripts yet');
    if (other.length) {
      els.colOther.hidden = false;
      fillScriptList(els.listOther, other, id, '');
    } else {
      els.colOther.hidden = true;
      els.listOther.innerHTML = '';
    }
    updateRunSelectedState();
    renderReports(data.reports || []);

    document.querySelector('.projects-panel').hidden = true;
    els.scriptsPanel.hidden = false;
  }

  function showProjects() {
    selectedProjectId = null;
    els.scriptsPanel.hidden = true;
    document.querySelector('.projects-panel').hidden = false;
    loadProjects().catch(() => {});
    refreshDevices('');
  }

  async function ensureAppiumForTests(script) {
    if (!String(script).startsWith('test')) return true;
    const status = await api('/api/appium');
    if (status.running) return true;
    const go = confirm('Appium is not running.\n\nStart Appium now, then run?');
    if (!go) return false;
    await startAppium();
    const again = await api('/api/appium');
    if (!again.running) {
      alert('Could not start Appium.');
      return false;
    }
    return true;
  }

  async function runScript(projectId, script) {
    if (!(await ensureAppiumForTests(script))) return;
    cachedLogLines = [`Starting npm run ${script}…`];
    lastLineCount = 0;
    renderLogView();
    els.btnStopRun.hidden = false;
    showViewReport(null);
    els.runSummary.hidden = true;
    els.runMeta.textContent = `${projectId} · ${script} · starting`;
    try {
      const result = await api('/api/run', {
        method: 'POST',
        body: JSON.stringify({ projectId, script }),
      });
      if (!result.ok) {
        alert(result.error || 'Could not start');
        return;
      }
      if (result.queued) {
        els.runMeta.textContent = `Queued (#${result.position}) · ${script}`;
      }
      startRunPolling();
    } catch (err) {
      alert(String(err.message || err));
    }
  }

  async function runSuite(projectId, suiteId) {
    if (!(await ensureAppiumForTests('test'))) return;
    try {
      const result = await api('/api/run/suite', {
        method: 'POST',
        body: JSON.stringify({ projectId, suiteId }),
      });
      if (!result.ok) {
        alert(result.error || 'Suite failed to start');
        return;
      }
      cachedLogLines = [`Suite ${suiteId} started…`];
      lastLineCount = 0;
      renderLogView();
      els.btnStopRun.hidden = false;
      startRunPolling();
    } catch (err) {
      alert(String(err.message || err));
    }
  }

  async function runSelected() {
    if (!selectedProjectId) return;
    const scripts = [...document.querySelectorAll('.script-check:checked')].map(
      (el) => el.value
    );
    if (!scripts.length) return;
    if (!(await ensureAppiumForTests('test'))) return;
    try {
      const result = await api('/api/run/many', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId, scripts }),
      });
      if (!result.ok) {
        alert('Some scripts could not be queued');
      }
      cachedLogLines = [`Queued ${scripts.length} script(s)…`];
      lastLineCount = 0;
      renderLogView();
      els.btnStopRun.hidden = false;
      startRunPolling();
    } catch (err) {
      alert(String(err.message || err));
    }
  }

  function startRunPolling() {
    if (runPoll) clearInterval(runPoll);
    runPoll = setInterval(pollRun, 800);
    pollRun();
  }

  async function pollRun() {
    try {
      const data = await api('/api/run');
      const run = data.run;
      const queue = data.queue || [];
      updateQueueUi(queue.length, run);
      if (!run) return;
      if (run.lines && run.lines.length !== lastLineCount) {
        cachedLogLines = run.lines.slice();
        renderLogView();
        lastLineCount = run.lines.length;
      }
      els.runMeta.textContent = `${run.projectId} · ${run.script} · ${run.status}${
        run.queueRemaining ? ` · +${run.queueRemaining} queued` : ''
      }`;
      if (run.status !== 'running') {
        els.btnStopRun.hidden = queue.length > 0;
        showViewReport(run.primaryReportUrl);
        renderRunSummaryBox(run);
        updateSummaryFromRun(run);
        loadHistory();
        if (run.projectId === selectedProjectId) {
          const rep = await api(
            `/api/projects/${encodeURIComponent(selectedProjectId)}/reports`
          );
          renderReports(rep.reports || []);
        }
        if (!queue.length && runPoll) {
          clearInterval(runPoll);
          runPoll = null;
        }
      } else {
        els.btnStopRun.hidden = false;
        showViewReport(null);
      }
    } catch {
      /* ignore */
    }
  }

  async function stopRun() {
    try {
      await api('/api/run/stop', { method: 'POST', body: '{}' });
      await pollRun();
    } catch (err) {
      alert(String(err.message || err));
    }
  }

  async function openShots() {
    if (!selectedProjectId) return;
    try {
      const r = await api(
        `/api/projects/${encodeURIComponent(selectedProjectId)}/screenshots/open`,
        { method: 'POST', body: '{}' }
      );
      if (!r.ok) alert(r.error || 'Could not open folder');
    } catch (err) {
      alert(String(err.message || err));
    }
  }

  async function loadHistory() {
    try {
      const data = await api('/api/history');
      const hist = data.history || [];
      els.historyList.innerHTML = '';
      if (!hist.length) {
        els.historyList.innerHTML = '<p class="muted">No history yet.</p>';
        return;
      }
      // Also seed last-run card from newest history if empty-ish
      const newest = hist[0];
      if (newest && els.summarySub.textContent === 'No runs yet') {
        updateSummaryFromRun({
          ...newest,
          durationMs: newest.durationMs,
        });
      }
      for (const h of hist) {
        const row = document.createElement('div');
        row.className = 'history-row';
        const stClass =
          h.status === 'passed' ? 'badge-pass' : 'badge-fail';
        row.innerHTML = `
          <div>
            <p class="name"><span class="${stClass}">${escapeHtml(
          h.status
        )}</span> · ${escapeHtml(h.projectId)} · ${escapeHtml(h.script)}</p>
            <p class="when">${escapeHtml(
              h.finishedAt
                ? new Date(h.finishedAt).toLocaleString()
                : ''
            )} · ${escapeHtml(formatDuration(h.durationMs))}${
          h.summary
            ? ` · ${h.summary.passed ?? 0}/${h.summary.failed ?? 0}`
            : ''
        }</p>
          </div>
        `;
        if (h.primaryReportUrl) {
          const a = document.createElement('a');
          a.className = 'btn btn-run';
          a.href = h.primaryReportUrl;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = 'Report';
          row.appendChild(a);
        }
        els.historyList.appendChild(row);
      }
    } catch {
      els.historyList.innerHTML = '<p class="muted">Could not load history.</p>';
    }
  }

  els.btnAppiumStart.addEventListener('click', startAppium);
  els.btnAppiumStop.addEventListener('click', stopAppium);
  els.btnAppiumRefresh.addEventListener('click', refreshAppium);
  els.btnTheme.addEventListener('click', toggleTheme);
  els.btnDevicesRefresh.addEventListener('click', () =>
    refreshDevices(selectedProjectId || '')
  );
  els.btnBack.addEventListener('click', showProjects);
  els.btnStopRun.addEventListener('click', stopRun);
  els.btnRunSelected.addEventListener('click', runSelected);
  els.btnOpenShots.addEventListener('click', openShots);
  els.chkSelectAll.addEventListener('change', () => {
    const on = els.chkSelectAll.checked;
    document.querySelectorAll('.script-check').forEach((cb) => {
      cb.checked = on;
    });
    updateRunSelectedState();
  });
  els.btnClearLog.addEventListener('click', () => {
    cachedLogLines = [];
    lastLineCount = 0;
    els.logView.textContent =
      logMode === 'client'
        ? 'Log cleared. Client steps will appear on the next run.'
        : 'Click a script to run it here.';
    els.runMeta.textContent = 'No run yet';
    els.runSummary.hidden = true;
    showViewReport(null);
  });

  els.btnLogClient?.addEventListener('click', () => setLogMode('client'));
  els.btnLogFull?.addEventListener('click', () => setLogMode('full'));

  applyTheme(localStorage.getItem(LS_THEME) === 'dark' ? 'dark' : 'light');
  setLogMode(logMode);
  refreshAppium();
  refreshDevices('');
  loadHistory();
  loadProjects()
    .then(() => {
      const last = localStorage.getItem(LS_PROJECT);
      if (last && lastProjects.includes(last)) {
        openProject(last);
      }
    })
    .catch((err) => {
      els.projectGrid.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
    });
  setInterval(refreshAppium, 8000);
  setInterval(() => refreshDevices(selectedProjectId || ''), 15000);
})();

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
  const LS_SETUP_COLLAPSED = 'automation-dashboard-setup-collapsed';

  /** @type {object | null} */
  let setupCache = null;
  /** User/server pick for which setup action is highlighted: 'bootstrap' | 'setup' */
  let setupActionMode = null;

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
    btnStopAck: $('btnStopAck'),
    btnClearLog: $('btnClearLog'),
    runAck: $('runAck'),
    runAckTitle: $('runAckTitle'),
    runAckDetail: $('runAckDetail'),
    historyList: $('historyList'),
    footHint: $('footHint'),
    setupPanel: $('setupPanel'),
    setupBody: $('setupBody'),
    setupChecks: $('setupChecks'),
    setupSteps: $('setupSteps'),
    setupWizardAsks: $('setupWizardAsks'),
    setupCmdHint: $('setupCmdHint'),
    setupNote: $('setupNote'),
    btnSetupToggle: $('btnSetupToggle'),
    btnSetupBootstrap: $('btnSetupBootstrap'),
    btnSetupNpm: $('btnSetupNpm'),
    btnSetupCopy: $('btnSetupCopy'),
    btnSetupRefresh: $('btnSetupRefresh'),
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
  /** @type {string | null} script currently acknowledged in the UI */
  let activeScriptName = null;
  /** Avoid re-painting run banner / row every poll tick */
  let lastRunUiKey = '';

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 404 on Setup = other Mac still running an old dashboard process (UI cached, APIs missing)
      if (
        res.status === 404 &&
        (path === '/api/setup' || path.startsWith('/api/setup/'))
      ) {
        throw new Error(
          'Setup API missing (404): an OLD dashboard process is still on port 3939 (new UI loaded from disk, old Node in memory). Fix: lsof -ti:3939 | xargs kill -9 && git pull && npm run dashboard — then hard-refresh. Terminal permission is unrelated.'
        );
      }
      throw new Error(data.error || `Request failed (${res.status})`);
    }
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

  /**
   * Only one of Run bootstrap / Run npm setup is primary.
   * Copy + Refresh stay ghost so focus/click never makes them look “selected”.
   * @param {'bootstrap' | 'setup'} mode
   */
  function setSetupActionMode(mode) {
    setupActionMode = mode === 'bootstrap' ? 'bootstrap' : 'setup';
    const pair = [els.btnSetupBootstrap, els.btnSetupNpm];
    for (const btn of pair) {
      if (!btn) continue;
      btn.classList.remove('btn-primary', 'is-setup-active');
      btn.classList.add('btn-ghost');
      btn.setAttribute('aria-pressed', 'false');
    }
    // Utility buttons must never carry primary styling
    for (const btn of [els.btnSetupCopy, els.btnSetupRefresh]) {
      if (!btn) continue;
      btn.classList.remove('btn-primary', 'is-setup-active');
      btn.classList.add('btn-ghost');
    }
    const active =
      setupActionMode === 'bootstrap' ? els.btnSetupBootstrap : els.btnSetupNpm;
    if (active) {
      active.classList.remove('btn-ghost');
      active.classList.add('btn-primary', 'is-setup-active');
      active.setAttribute('aria-pressed', 'true');
    }
    if (setupCache && els.setupCmdHint) {
      els.setupCmdHint.textContent =
        setupActionMode === 'bootstrap'
          ? setupCache.fullBootstrap
          : setupCache.fullSetup;
    }
  }

  /**
   * Render machine checks + guided bootstrap steps from /api/setup.
   * @param {object} data
   */
  function renderSetup(data) {
    setupCache = data;

    if (!els.setupChecks) return;
    els.setupChecks.innerHTML = '';
    for (const c of data.checks || []) {
      const row = document.createElement('div');
      row.className = 'setup-check';
      row.dataset.ok = c.ok ? 'true' : 'false';
      row.innerHTML = `
        <span class="setup-check-mark" aria-hidden="true">${c.ok ? '✓' : '!'}</span>
        <div>
          <strong>${escapeHtml(c.label)}</strong>
          <span>${escapeHtml(c.detail || '')}</span>
        </div>
      `;
      els.setupChecks.appendChild(row);
    }

    if (els.setupSteps) {
      els.setupSteps.innerHTML = '';
      (data.steps || []).forEach((step, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${i + 1}. ${escapeHtml(step.title)}</strong><p>${escapeHtml(
          step.body
        )}</p>`;
        els.setupSteps.appendChild(li);
      });
    }

    if (els.setupWizardAsks) {
      els.setupWizardAsks.innerHTML = '';
      for (const ask of data.wizardAsks || []) {
        const li = document.createElement('li');
        li.textContent = ask;
        els.setupWizardAsks.appendChild(li);
      }
    }

    // First load: pick recommended. Later Refresh keeps the user's last choice.
    if (!setupActionMode) {
      setupActionMode = data.recommendBootstrap ? 'bootstrap' : 'setup';
    }
    setSetupActionMode(setupActionMode);

    if (els.setupNote) {
      els.setupNote.innerHTML = data.recommendBootstrap
        ? 'Fresh Mac tip: use <strong>Run bootstrap</strong> (same as <code>bash scripts/bootstrap.sh</code>). Answer prompts in the Terminal window that opens.'
        : 'Node looks ready. Use <strong>Run npm setup</strong> for the wizard, or bootstrap if you prefer the full script. Answer prompts in Terminal.';
    }
  }

  async function refreshSetup() {
    if (!els.setupChecks) return;
    try {
      const data = await api('/api/setup');
      renderSetup(data);
    } catch (err) {
      const msg = err.message || 'Could not load setup status';
      els.setupChecks.innerHTML = `<p class="setup-error">${escapeHtml(msg)}</p>
        <ol class="setup-after">
          <li>In Terminal: <code>lsof -ti:3939 | xargs kill -9</code></li>
          <li><code>cd</code> into the repo → <code>git pull</code></li>
          <li>Run <code>npm run dashboard</code> (this now kills the old process first)</li>
          <li>Hard-refresh the browser (Cmd+Shift+R)</li>
          <li>Or skip the button: <code>bash scripts/bootstrap.sh</code></li>
        </ol>`;
    }
  }

  /**
   * Warn if the HTML is new but the Node process is old (common after sharing the repo).
   */
  async function warnIfStaleDashboard() {
    try {
      const health = await api('/api/health');
      if (health?.features?.setup) return;
    } catch {
      /* older builds may lack features; fall through to setup check */
    }
  }

  function setSetupCollapsed(collapsed) {
    els.setupPanel?.classList.toggle('is-collapsed', collapsed);
    if (els.btnSetupToggle) {
      els.btnSetupToggle.textContent = collapsed ? 'Show steps' : 'Hide steps';
      els.btnSetupToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
    localStorage.setItem(LS_SETUP_COLLAPSED, collapsed ? '1' : '0');
  }

  async function openSetupTerminal(mode) {
    setSetupActionMode(mode === 'setup' ? 'setup' : 'bootstrap');
    try {
      const result = await api('/api/setup/open-terminal', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      if (result.command && els.setupCmdHint) {
        els.setupCmdHint.textContent = result.command;
      }
      if (!result.ok) {
        // Permission deny ≠ 404 — still show the exact command to paste
        alert(
          (result.error || 'Could not open Terminal') +
            '\n\nPaste this in Terminal yourself:\n' +
            (result.command || '')
        );
        return;
      }
      setRunAck({
        title: mode === 'setup' ? 'Setup opened in Terminal' : 'Bootstrap opened in Terminal',
        detail: 'Answer the wizard questions there, then refresh checks here',
        state: 'idle',
        show: true,
      });
    } catch (err) {
      alert(String(err.message || err));
    } finally {
      // Drop focus ring so the clicked button does not look “stuck selected”
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }

  async function copySetupCommand() {
    const cmd =
      (setupCache &&
        (setupActionMode === 'bootstrap'
          ? setupCache.fullBootstrap
          : setupCache.fullSetup)) ||
      els.setupCmdHint?.textContent ||
      '';
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
      setRunAck({
        title: 'Command copied',
        detail: cmd,
        state: 'idle',
        show: true,
      });
    } catch {
      prompt('Copy this command:', cmd);
    } finally {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
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

  /**
   * Clean brand headers (solid + accent bar) — no muddy mesh blends.
   */
  const PROJECT_THEMES = {
    appraiseeie: {
      ink: '#0F3D36',
      mid: '#147A6A',
      accent: '#E8B86D',
      soft: '#F4FBF9',
      mark: 'AE',
    },
    roskids: {
      ink: '#1C1917',
      mid: '#44403C',
      accent: '#F0C987',
      soft: '#FAFAF9',
      mark: 'RK',
    },
    vetpal: {
      ink: '#0F2744',
      mid: '#1E4D7B',
      accent: '#6EB5D8',
      soft: '#F5F9FC',
      mark: 'VP',
    },
  };

  const CARD_FALLBACKS = [
    { ink: '#1A1A1A', mid: '#3F3F46', accent: '#A1A1AA', soft: '#FAFAFA', mark: '' },
    { ink: '#1C1410', mid: '#6B4423', accent: '#D4A574', soft: '#FBF7F2', mark: '' },
    { ink: '#0F2922', mid: '#1F6B55', accent: '#7BC4A8', soft: '#F3FAF7', mark: '' },
    { ink: '#111827', mid: '#1E3A5F', accent: '#93C5FD', soft: '#F8FAFC', mark: '' },
  ];

  function themeForId(id) {
    if (PROJECT_THEMES[id]) return PROJECT_THEMES[id];
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997;
    const t = { ...CARD_FALLBACKS[h % CARD_FALLBACKS.length] };
    t.mark = String(id || 'P')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 2)
      .toUpperCase() || 'P';
    return t;
  }

  /**
   * Build a script row (checkbox + title + Run).
   * @param {string} projectId
   * @param {{ name: string, title: string, selectable?: boolean, runnable?: boolean }} s
   */
  function createScriptRow(projectId, s) {
    const row = document.createElement('div');
    row.className = 'script-row';
    row.dataset.script = s.name;
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
    runBtn.dataset.script = s.name;
    runBtn.textContent = s.runnable ? 'Run' : 'Open';
    runBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (runBtn.classList.contains('is-stop')) {
        stopRun();
        return;
      }
      runScript(projectId, s.name);
    });
    row.appendChild(runBtn);
    return row;
  }

  /** Clear running/queued highlights from all script rows. */
  function clearScriptRowStates() {
    document.querySelectorAll('.script-row').forEach((row) => {
      row.classList.remove('is-running', 'is-queued', 'is-done-pass', 'is-done-fail');
      const btn = row.querySelector('.btn-run');
      if (btn) {
        btn.classList.remove('is-busy', 'is-stop');
        btn.disabled = false;
        if (
          btn.textContent === 'Running…' ||
          btn.textContent === 'Queued…' ||
          btn.textContent === 'Stop'
        ) {
          btn.textContent = 'Run';
        }
      }
    });
    document.querySelector('.log-panel')?.classList.remove('is-live');
  }

  /**
   * Highlight the script that is running / queued and update its Run button.
   * While running, the row button becomes Stop so the user can cancel.
   * @param {string | null} scriptName
   * @param {'running' | 'queued' | 'passed' | 'failed' | 'idle'} state
   */
  function setScriptRowState(scriptName, state) {
    clearScriptRowStates();
    if (!scriptName || state === 'idle') return;

    const row = document.querySelector(
      `.script-row[data-script="${CSS.escape(scriptName)}"]`
    );
    if (!row) return;

    const btn = row.querySelector('.btn-run');
    if (state === 'running') {
      row.classList.add('is-running');
      document.querySelector('.log-panel')?.classList.add('is-live');
      if (btn) {
        btn.classList.add('is-stop');
        btn.textContent = 'Stop';
        btn.disabled = false;
      }
    } else if (state === 'queued') {
      row.classList.add('is-queued');
      if (btn) {
        btn.classList.add('is-busy');
        btn.textContent = 'Queued…';
        btn.disabled = true;
      }
    } else if (state === 'passed') {
      row.classList.add('is-done-pass');
      if (btn) {
        btn.textContent = 'Run';
        btn.disabled = false;
      }
    } else if (state === 'failed') {
      row.classList.add('is-done-fail');
      if (btn) {
        btn.textContent = 'Run';
        btn.disabled = false;
      }
    }
  }

  /**
   * Banner above the log: acknowledge that a script started / finished.
   * @param {{ title: string, detail?: string, state?: string, show?: boolean }} opts
   */
  function setRunAck({ title, detail = '', state = 'running', show = true }) {
    if (!els.runAck) return;
    els.runAck.hidden = !show;
    els.runAck.dataset.state = state;
    if (els.runAckTitle) els.runAckTitle.textContent = title;
    if (els.runAckDetail) els.runAckDetail.textContent = detail;
    const canStop = state === 'running' || state === 'queued';
    if (els.btnStopAck) els.btnStopAck.hidden = !canStop;
    if (els.btnStopRun) els.btnStopRun.hidden = !canStop;
  }

  /**
   * Scroll the script row into view, then scroll the Run log into view.
   * @param {string | null} scriptName
   */
  function focusRunUi(scriptName) {
    const row = scriptName
      ? document.querySelector(
          `.script-row[data-script="${CSS.escape(scriptName)}"]`
        )
      : null;
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // After a short beat, bring the live log into view so the client sees output
    window.setTimeout(() => {
      const panel = document.querySelector('.log-panel');
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      els.logView?.scrollTo?.({ top: els.logView.scrollHeight, behavior: 'smooth' });
    }, 350);
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
      const theme = themeForId(p.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'project-card';
      if (p.id === selectedProjectId) btn.classList.add('active');
      btn.style.setProperty('--card-ink', theme.ink);
      btn.style.setProperty('--card-mid', theme.mid);
      btn.style.setProperty('--card-accent', theme.accent);
      btn.style.setProperty('--card-soft', theme.soft);
      btn.innerHTML = `
        <div class="project-card-art" aria-hidden="true">
          <span class="project-card-accent"></span>
          <span class="project-card-mark">${escapeHtml(theme.mark)}</span>
          <span class="phone"></span>
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
      const kindLabel =
        r.kind === 'latest'
          ? 'Latest'
          : r.kind === 'archive'
            ? 'Past run'
            : r.kind === 'catalog'
              ? 'Catalog'
              : 'Report';
      row.innerHTML = `
        <div>
          <p class="name"><span class="report-kind report-kind--${escapeHtml(
            r.kind || 'other'
          )}">${escapeHtml(kindLabel)}</span> ${escapeHtml(r.label || r.name)}</p>
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
    activeScriptName = script;
    setRunAck({
      title: `Running: ${script}`,
      detail: 'Script started — live steps appear below',
      state: 'running',
    });
    setScriptRowState(script, 'running');
    focusRunUi(script);
    lastRunUiKey = '';
    cachedLogLines = [`[CLIENT] Starting script: ${script}`];
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
        setRunAck({
          title: 'Could not start',
          detail: result.error || 'Request failed',
          state: 'failed',
        });
        setScriptRowState(script, 'failed');
        alert(result.error || 'Could not start');
        return;
      }
      if (result.queued) {
        setRunAck({
          title: `Queued: ${script}`,
          detail: `Waiting in queue (#${result.position})`,
          state: 'queued',
        });
        setScriptRowState(script, 'queued');
        els.runMeta.textContent = `Queued (#${result.position}) · ${script}`;
      } else {
        setRunAck({
          title: `Now running: ${script}`,
          detail: `${projectId} · watch the log below`,
          state: 'running',
        });
        setScriptRowState(script, 'running');
      }
      startRunPolling();
    } catch (err) {
      setRunAck({
        title: 'Could not start',
        detail: String(err.message || err),
        state: 'failed',
      });
      setScriptRowState(script, 'failed');
      alert(String(err.message || err));
    }
  }

  async function runSuite(projectId, suiteId) {
    if (!(await ensureAppiumForTests('test'))) return;
    activeScriptName = suiteId;
    setRunAck({
      title: `Suite started: ${suiteId}`,
      detail: 'One-click suite is running',
      state: 'running',
    });
    focusRunUi(null);
    try {
      const result = await api('/api/run/suite', {
        method: 'POST',
        body: JSON.stringify({ projectId, suiteId }),
      });
      if (!result.ok) {
        setRunAck({
          title: 'Suite failed to start',
          detail: result.error || '',
          state: 'failed',
        });
        alert(result.error || 'Suite failed to start');
        return;
      }
      cachedLogLines = [`[CLIENT] Suite started: ${suiteId}`];
      lastLineCount = 0;
      renderLogView();
      els.btnStopRun.hidden = false;
      document.querySelector('.log-panel')?.classList.add('is-live');
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
    activeScriptName = scripts[0];
    setRunAck({
      title: `Running ${scripts.length} selected script(s)`,
      detail: scripts.join(', '),
      state: 'running',
    });
    setScriptRowState(scripts[0], 'running');
    for (let i = 1; i < scripts.length; i++) {
      document
        .querySelector(`.script-row[data-script="${CSS.escape(scripts[i])}"]`)
        ?.classList.add('is-queued');
    }
    focusRunUi(scripts[0]);
    try {
      const result = await api('/api/run/many', {
        method: 'POST',
        body: JSON.stringify({ projectId: selectedProjectId, scripts }),
      });
      if (!result.ok) {
        alert('Some scripts could not be queued');
      }
      cachedLogLines = [`[CLIENT] Queued ${scripts.length} script(s)`];
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

      activeScriptName = run.script || activeScriptName;
      const uiKey = `${run.script}|${run.status}|${queue.length}|${run.exitCode ?? ''}`;
      if (uiKey !== lastRunUiKey) {
        lastRunUiKey = uiKey;
        if (run.status === 'running') {
          setRunAck({
            title: `Now running: ${run.script}`,
            detail: `${run.projectId}${
              queue.length ? ` · ${queue.length} waiting in queue` : ''
            }`,
            state: 'running',
          });
          setScriptRowState(run.script, 'running');
          for (const q of queue) {
            document
              .querySelector(
                `.script-row[data-script="${CSS.escape(q.script)}"]`
              )
              ?.classList.add('is-queued');
          }
        } else {
          const doneState =
            run.status === 'passed' || run.exitCode === 0 ? 'passed' : 'failed';
          setRunAck({
            title:
              doneState === 'passed'
                ? `Finished: ${run.script}`
                : `Failed: ${run.script}`,
            detail: `${run.projectId} · ${run.status}${
              queue.length ? ' · next in queue' : ''
            }`,
            state: doneState,
          });
          setScriptRowState(run.script, doneState);
        }
      }

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
    if (els.btnStopAck) {
      els.btnStopAck.disabled = true;
      els.btnStopAck.textContent = 'Stopping…';
    }
    if (els.btnStopRun) {
      els.btnStopRun.disabled = true;
      els.btnStopRun.textContent = 'Stopping…';
    }
    setRunAck({
      title: 'Stopping…',
      detail: 'Killing npm / WebdriverIO process tree',
      state: 'queued',
    });
    try {
      await api('/api/run/stop', { method: 'POST', body: '{}' });
      setRunAck({
        title: 'Stopped',
        detail: 'Script stopped and queue cleared',
        state: 'failed',
      });
      clearScriptRowStates();
      lastRunUiKey = '';
      // Pull final lines from server
      const data = await api('/api/run');
      if (data.run?.lines) {
        cachedLogLines = data.run.lines.slice();
        renderLogView();
        lastLineCount = cachedLogLines.length;
      }
      if (runPoll) {
        clearInterval(runPoll);
        runPoll = null;
      }
    } catch (err) {
      alert(String(err.message || err));
    } finally {
      if (els.btnStopAck) {
        els.btnStopAck.disabled = false;
        els.btnStopAck.textContent = 'Stop script';
        els.btnStopAck.hidden = true;
      }
      if (els.btnStopRun) {
        els.btnStopRun.disabled = false;
        els.btnStopRun.textContent = 'Stop script';
        els.btnStopRun.hidden = true;
      }
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
          // Archived snapshots keep this run's report; old entries may still point at latest
          const isSnapshot = /-\d{8}-/.test(h.primaryReportUrl) || Boolean(h.archivedReportName);
          a.textContent = isSnapshot ? 'This run' : 'Latest';
          a.title = isSnapshot
            ? 'Open the report saved for this run'
            : 'Opens current latest report (no snapshot for older runs)';
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
  els.btnStopAck?.addEventListener('click', stopRun);
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
    clearScriptRowStates();
    setRunAck({ title: 'Ready', detail: 'Log cleared', state: 'idle', show: false });
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

  els.btnSetupToggle?.addEventListener('click', () => {
    setSetupCollapsed(!els.setupPanel.classList.contains('is-collapsed'));
  });
  els.btnSetupBootstrap?.addEventListener('click', () => openSetupTerminal('bootstrap'));
  els.btnSetupNpm?.addEventListener('click', () => openSetupTerminal('setup'));
  els.btnSetupCopy?.addEventListener('click', copySetupCommand);
  els.btnSetupRefresh?.addEventListener('click', async () => {
    await refreshSetup();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  applyTheme(localStorage.getItem(LS_THEME) === 'dark' ? 'dark' : 'light');
  setLogMode(logMode);
  // Always start with Setup collapsed; user clicks “Show steps” to expand.
  setSetupCollapsed(true);
  warnIfStaleDashboard();
  refreshSetup();
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

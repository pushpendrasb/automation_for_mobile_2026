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
    deviceSelected: $('deviceSelected'),
    selIosDevice: $('selIosDevice'),
    selAndroidDevice: $('selAndroidDevice'),
    btnDevicesRefresh: $('btnDevicesRefresh'),
    btnApplyDevice: $('btnApplyDevice'),
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
    btnViewPdf: $('btnViewPdf'),
    btnExportPdf: $('btnExportPdf'),
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

  /** Tick drawn as SVG so it sits dead-centre in the round badge (the ✓ glyph does not in most fonts). */
const CHECK_SVG =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';

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
        <span class="setup-check-mark" aria-hidden="true">${c.ok ? CHECK_SVG : '!'}</span>
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

  /** Last devices payload — used to fill pickers without an extra round-trip. */
  let lastDevicesPayload = null;

  /**
   * Fill iOS / Android dropdowns and show which device this project will use.
   * @param {object} d /api/devices payload
   */
  function renderDevicePickers(d) {
    lastDevicesPayload = d;
    const iosSel = els.selIosDevice;
    const andSel = els.selAndroidDevice;
    const applyBtn = els.btnApplyDevice;
    if (!iosSel || !andSel) return;

    const hasProject = Boolean(selectedProjectId);
    iosSel.disabled = !hasProject;
    andSel.disabled = !hasProject;
    if (applyBtn) applyBtn.disabled = !hasProject;

    const iosOnline = d?.ios?.devices || [];
    const iosOffline = d?.ios?.offline || [];
    const configuredIos = d?.ios?.configuredUdid || '';
    const androidOnline = d?.android?.devices || [];
    const configuredAndroid = d?.android?.configuredId || '';

    iosSel.innerHTML = '';
    if (!hasProject) {
      iosSel.innerHTML = '<option value="">— open a project first —</option>';
    } else if (!iosOnline.length && !iosOffline.length) {
      iosSel.innerHTML = '<option value="">No iPhones detected</option>';
    } else {
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— choose iPhone for this project —';
      iosSel.appendChild(opt0);
      for (const x of iosOnline) {
        const opt = document.createElement('option');
        opt.value = x.udid;
        opt.textContent = `${x.name}${x.version ? ` (${x.version})` : ''} · connected${
          x.transport ? ` · ${x.transport}` : ''
        }`;
        if (x.udid === configuredIos) opt.selected = true;
        iosSel.appendChild(opt);
      }
      for (const x of iosOffline) {
        const opt = document.createElement('option');
        opt.value = x.udid;
        opt.textContent = `${x.name} · offline`;
        opt.disabled = true;
        if (x.udid === configuredIos) {
          opt.selected = true;
          opt.textContent += ' (saved in .env)';
          opt.disabled = false;
        }
        iosSel.appendChild(opt);
      }
    }

    andSel.innerHTML = '';
    if (!hasProject) {
      andSel.innerHTML = '<option value="">— open a project first —</option>';
    } else if (!androidOnline.length) {
      andSel.innerHTML = '<option value="">No Android devices</option>';
    } else {
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— choose Android for this project —';
      andSel.appendChild(opt0);
      for (const x of androidOnline) {
        const opt = document.createElement('option');
        opt.value = x.id;
        opt.textContent = `${x.id} · ${x.state || 'device'}`;
        if (x.id === configuredAndroid) opt.selected = true;
        andSel.appendChild(opt);
      }
    }

    if (els.deviceSelected) {
      if (!hasProject) {
        els.deviceSelected.textContent =
          'Open a project, then pick which phone tests should use';
      } else {
        const iosName =
          iosOnline.find((x) => x.udid === configuredIos)?.name ||
          iosOffline.find((x) => x.udid === configuredIos)?.name ||
          (configuredIos ? configuredIos.slice(0, 12) + '…' : 'not set');
        const andName = configuredAndroid || 'not set';
        els.deviceSelected.textContent = `Selected for ${selectedProjectId}: iOS ${iosName} · Android ${andName}`;
      }
    }
  }

  async function refreshDevices(projectId) {
    try {
      const q = new URLSearchParams();
      if (projectId) q.set('projectId', projectId);
      q.set('refresh', '1');
      const d = await api(`/api/devices?${q}`);
      els.deviceSummary.textContent = d.summary || '—';
      const bits = [];
      if (d.ios?.devices?.length) {
        bits.push(
          'iOS: ' +
            d.ios.devices
              .slice(0, 3)
              .map((x) => x.name)
              .join(', ')
        );
      } else if (d.ios?.offline?.length) {
        bits.push(
          'iOS offline: ' +
            d.ios.offline
              .slice(0, 3)
              .map((x) => x.name)
              .join(', ')
        );
      }
      if (d.android?.devices?.length) {
        bits.push(`Android: ${d.android.devices.length} connected`);
      }
      if (d.ios?.configuredUdid && !d.ios.configuredOk) {
        bits.push('Saved iOS UDID is not connected right now');
      }
      els.deviceSub.textContent =
        bits.filter(Boolean).join(' · ') || 'Connect a phone / emulator';
      renderDevicePickers(d);
    } catch (err) {
      els.deviceSummary.textContent = 'Error';
      els.deviceSub.textContent = String(err.message || err);
    }
  }

  /**
   * Save the dropdown selection into the open project's .env so Appium
   * targets that device on the next test run.
   */
  async function applySelectedDevices() {
    if (!selectedProjectId) {
      alert('Open a project first, then choose a device.');
      return;
    }
    const iosUdid = els.selIosDevice?.value || '';
    const androidId = els.selAndroidDevice?.value || '';
    if (!iosUdid && !androidId) {
      alert('Choose an iOS and/or Android device from the lists.');
      return;
    }

    const btn = els.btnApplyDevice;
    const prevLabel = btn?.textContent || 'Use selected device';
    if (btn) {
      btn.disabled = true;
      btn.classList.remove('is-saved', 'is-failed');
      btn.classList.add('is-saving');
      btn.textContent = 'Saving…';
    }
    els.deviceSelected?.classList.remove('is-flash-ok', 'is-flash-fail');

    try {
      if (iosUdid) {
        await api(`/api/projects/${encodeURIComponent(selectedProjectId)}/env/device`, {
          method: 'POST',
          body: JSON.stringify({ platform: 'ios', udid: iosUdid }),
        });
      }
      if (androidId) {
        await api(`/api/projects/${encodeURIComponent(selectedProjectId)}/env/device`, {
          method: 'POST',
          body: JSON.stringify({ platform: 'android', deviceId: androidId }),
        });
      }
      const iosLabel =
        els.selIosDevice?.selectedOptions?.[0]?.textContent || iosUdid || '—';
      const andLabel =
        els.selAndroidDevice?.selectedOptions?.[0]?.textContent || androidId || '—';
      setRunAck({
        title: 'Test device saved',
        detail: `${selectedProjectId} · iOS: ${iosLabel} · Android: ${andLabel}`,
        state: 'passed',
        show: true,
      });
      if (btn) {
        btn.classList.remove('is-saving');
        btn.classList.add('is-saved');
        btn.textContent = 'Saved ✓';
      }
      els.deviceSelected?.classList.add('is-flash-ok');
      await refreshDevices(selectedProjectId);
      window.setTimeout(() => {
        if (!btn) return;
        btn.classList.remove('is-saved');
        btn.textContent = prevLabel;
        btn.disabled = !selectedProjectId;
        els.deviceSelected?.classList.remove('is-flash-ok');
      }, 1800);
    } catch (err) {
      if (btn) {
        btn.classList.remove('is-saving');
        btn.classList.add('is-failed');
        btn.textContent = 'Failed';
        btn.disabled = false;
      }
      els.deviceSelected?.classList.add('is-flash-fail');
      alert(String(err.message || err));
      window.setTimeout(() => {
        if (!btn) return;
        btn.classList.remove('is-failed');
        btn.textContent = prevLabel;
        els.deviceSelected?.classList.remove('is-flash-fail');
      }, 1800);
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
    const pdfUrl = pdfUrlOf(url);
    els.btnViewReport.hidden = !url;
    els.btnViewPdf.hidden = !pdfUrl;
    els.btnExportPdf.hidden = !pdfUrl;
    if (!url) return;
    els.btnViewReport.href = url;
    if (pdfUrl) {
      els.btnViewPdf.href = pdfUrl;
      els.btnExportPdf.dataset.reportUrl = url;
    }
  }

  /**
   * PDF URL for an HTML report URL (server converts it with headless Chrome).
   * @param {string | null | undefined} htmlUrl e.g. /project-reports/vetportal/x.html
   * @returns {string | null}
   */
  function pdfUrlOf(htmlUrl) {
    if (!htmlUrl || !/\.html(\?|#|$)/.test(htmlUrl)) return null;
    return htmlUrl.replace(/\.html(?=\?|#|$)/, '.pdf');
  }

  /**
   * Build the PDF and download it, ready to attach to Mail, Slack, Teams…
   * @param {string} htmlUrl HTML report URL
   * @param {HTMLButtonElement} btn button to show progress on
   */
  async function exportPdf(htmlUrl, btn) {
    const pdfUrl = pdfUrlOf(htmlUrl);
    if (!pdfUrl) return;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Preparing…';
    try {
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const fileName = decodeURIComponent(pdfUrl.split('/').pop().split('?')[0]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (err) {
      alert(`Could not export PDF: ${err.message || err}`);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  /**
   * Open / PDF / Export buttons for one report, used by Reports and Run history rows.
   * @param {string} htmlUrl HTML report URL
   * @param {{ openLabel?: string, openTitle?: string }} [opts]
   * @returns {HTMLDivElement}
   */
  function reportActions(htmlUrl, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'report-actions';
    const open = document.createElement('a');
    open.className = 'btn btn-run';
    open.href = htmlUrl;
    open.target = '_blank';
    open.rel = 'noopener';
    open.textContent = opts.openLabel || 'Open';
    if (opts.openTitle) open.title = opts.openTitle;
    wrap.appendChild(open);

    const pdfUrl = pdfUrlOf(htmlUrl);
    if (pdfUrl) {
      const pdf = document.createElement('a');
      pdf.className = 'btn btn-ghost';
      pdf.href = pdfUrl;
      pdf.target = '_blank';
      pdf.rel = 'noopener';
      pdf.textContent = 'PDF';
      pdf.title = 'Open this report as a PDF';
      wrap.appendChild(pdf);

      const exp = document.createElement('button');
      exp.type = 'button';
      exp.className = 'btn btn-ghost';
      exp.textContent = 'Export';
      exp.title = 'Download this report as a PDF to share';
      exp.addEventListener('click', () => exportPdf(htmlUrl, exp));
      wrap.appendChild(exp);
    }
    return wrap;
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

  /** localStorage key that remembers a run-input value per project + script. */
  function runInputStorageKey(projectId, scriptName, key) {
    return `runInput:${projectId}:${scriptName}:${key}`;
  }

  /**
   * Render the script's declared run inputs (e.g. signup email / mobile).
   * Blank fields fall back to the project's .env when the script runs.
   * Secret inputs (passwords) are not saved to localStorage.
   * @param {string} projectId
   * @param {{ name: string, inputs?: Array<{ key: string, label?: string, type?: string,
   *   placeholder?: string, pattern?: string, hint?: string, checkedValue?: string,
   *   secret?: boolean }> }} s
   * @returns {HTMLElement | null}
   */
  function createRunInputs(projectId, s) {
    if (!s.inputs?.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'script-inputs';
    for (const def of s.inputs) {
      const storeKey = runInputStorageKey(projectId, s.name, def.key);
      const saved = def.secret ? '' : localStorage.getItem(storeKey) || '';
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.dataset.envKey = def.key;
      if (def.type === 'checkbox') {
        label.className = 'script-input script-input-check';
        input.type = 'checkbox';
        input.dataset.checkedValue = def.checkedValue ?? 'true';
        input.checked = saved === '1';
        input.addEventListener('change', () =>
          localStorage.setItem(storeKey, input.checked ? '1' : '')
        );
        label.append(input, document.createTextNode(def.label || def.key));
      } else {
        label.className = 'script-input';
        const caption = document.createElement('span');
        caption.textContent = `${def.label || def.key} · blank = .env`;
        input.type = def.type || 'text';
        input.placeholder = def.placeholder || '';
        if (def.pattern) input.pattern = def.pattern;
        if (def.hint) input.title = def.hint;
        input.value = saved;
        input.autocomplete = def.secret ? 'new-password' : 'off';
        input.spellcheck = false;
        if (!def.secret) {
          input.addEventListener('input', () => localStorage.setItem(storeKey, input.value.trim()));
        }
        label.append(caption, input);
      }
      wrap.appendChild(label);
    }
    return wrap;
  }

  /**
   * Read a script row's run inputs. Shows the browser's validation bubble on
   * the first bad field and returns null so the run is not started.
   * @param {string} scriptName
   * @returns {Record<string, string> | null}
   */
  function collectRunEnv(scriptName) {
    const row = document.querySelector(`.script-row[data-script="${CSS.escape(scriptName)}"]`);
    const env = {};
    if (!row) return env;
    for (const input of row.querySelectorAll('.script-inputs input[data-env-key]')) {
      if (input.type === 'checkbox') {
        if (input.checked) env[input.dataset.envKey] = input.dataset.checkedValue;
        continue;
      }
      input.value = input.value.trim();
      if (!input.checkValidity()) {
        input.reportValidity();
        return null;
      }
      if (input.value) env[input.dataset.envKey] = input.value;
    }
    return env;
  }

  /**
   * Build a script row (checkbox + title + optional run inputs + Run).
   * @param {string} projectId
   * @param {{ name: string, title: string, selectable?: boolean, runnable?: boolean, inputs?: object[] }} s
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
      cb.addEventListener('change', () => {
        updateRunSelectedState();
      });
      left.appendChild(cb);
    }
    const info = document.createElement('div');
    info.className = 'script-info';
    info.innerHTML = `<div class="script-title-row"><p class="name">${escapeHtml(
      s.title
    )}</p><span class="script-status" hidden></span></div><p class="cmd">npm run ${escapeHtml(
      s.name
    )}</p>`;
    const inputs = createRunInputs(projectId, s);
    if (inputs) info.appendChild(inputs);
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

  /** Inline SVG icons (stroke style) for tool cards, keyed by tool kind. */
  const TOOL_ICONS = {
    device:
      '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    report:
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    stop: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    run: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  };

  /**
   * Friendly title/description for known tool scripts; first match wins.
   * Unknown scripts keep their generated title and get the generic tool icon.
   */
  const TOOL_META = [
    { re: /^check:devices:ios$/, kind: 'device', title: 'Check iOS devices', desc: 'Connected iPhones and simulators' },
    { re: /^check:devices:android$/, kind: 'device', title: 'Check Android devices', desc: 'adb devices and emulators' },
    { re: /^check:devices$/, kind: 'device', title: 'Check all devices', desc: 'iOS and Android in one go' },
    { re: /^report:catalog:open$/, kind: 'report', title: 'Open test catalog', desc: 'Every test case, in the browser' },
    { re: /^report:catalog$/, kind: 'report', title: 'Build test catalog', desc: 'Regenerate the test-case catalog' },
    { re: /^report:open$/, kind: 'report', title: 'Open latest report', desc: 'Last HTML report in the browser' },
    { re: /^kill:wda:list$/, kind: 'list', title: 'List WebDriverAgent', desc: 'Show running WDA processes' },
    { re: /^kill:wda$/, kind: 'stop', title: 'Stop WebDriverAgent', desc: 'Frees a stuck iPhone session' },
    { re: /^test$/, kind: 'run', title: 'Run default suite', desc: "Project's default test run" },
  ];

  /**
   * Turn plain "other" script rows into tool cards: icon, friendly title,
   * short description and the npm command as a small tag.
   * @param {HTMLElement} listEl container filled by fillScriptList
   */
  function decorateToolRows(listEl) {
    listEl.querySelectorAll('.script-row').forEach((row) => {
      const meta = TOOL_META.find((m) => m.re.test(row.dataset.script)) || { kind: 'tool' };
      row.classList.add('tool-card', `tool-card--${meta.kind}`);
      const icon = document.createElement('span');
      icon.className = 'tool-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TOOL_ICONS[meta.kind]}</svg>`;
      const left = row.querySelector('.left');
      left.insertBefore(icon, left.querySelector('.script-info'));
      if (meta.title) row.querySelector('.name').textContent = meta.title;
      const cmd = row.querySelector('.cmd');
      if (cmd) cmd.title = cmd.textContent;
      if (meta.desc) {
        const desc = document.createElement('p');
        desc.className = 'tool-desc';
        desc.textContent = meta.desc;
        row.querySelector('.script-title-row').after(desc);
      }
    });
  }

  /** Reset busy/queue chrome on a row; keep pass/fail marks unless fullReset. */
  function resetScriptRowBusy(row, { fullReset = false } = {}) {
    row.classList.remove('is-running', 'is-queued');
    if (fullReset) {
      row.classList.remove('is-done-pass', 'is-done-fail');
    }
    const badge = row.querySelector('.script-status');
    if (badge && (fullReset || badge.dataset.state === 'running' || badge.dataset.state === 'queued')) {
      badge.hidden = true;
      badge.textContent = '';
      badge.dataset.state = '';
    }
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
  }

  /** Clear running/queued highlights from all script rows. */
  function clearScriptRowStates() {
    document.querySelectorAll('.script-row').forEach((row) => {
      resetScriptRowBusy(row, { fullReset: true });
    });
    document.querySelector('.log-panel')?.classList.remove('is-live');
  }

  /**
   * Highlight the active script + any waiting queue (multi-select / suite).
   * @param {string | null} runningScript
   * @param {Array<string | { script: string }>} queue
   * @param {{ scroll?: boolean }} [opts]
   */
  function syncScriptHighlights(runningScript, queue = [], opts = {}) {
    const queuedNames = queue
      .map((q) => (typeof q === 'string' ? q : q?.script))
      .filter(Boolean);
    const queuedSet = new Set(queuedNames);

    document.querySelectorAll('.script-row').forEach((row) => {
      const name = row.dataset.script;
      const isRunning = Boolean(runningScript && name === runningScript);
      const isQueued = queuedSet.has(name);

      if (!isRunning && !isQueued) {
        resetScriptRowBusy(row);
        return;
      }

      row.classList.remove('is-done-pass', 'is-done-fail');
      const badge = row.querySelector('.script-status');
      const btn = row.querySelector('.btn-run');

      if (isRunning) {
        row.classList.add('is-running');
        row.classList.remove('is-queued');
        if (badge) {
          badge.hidden = false;
          badge.textContent = 'NOW RUNNING';
          badge.dataset.state = 'running';
        }
        if (btn) {
          btn.classList.remove('is-busy');
          btn.classList.add('is-stop');
          btn.textContent = 'Stop';
          btn.disabled = false;
        }
      } else {
        row.classList.add('is-queued');
        row.classList.remove('is-running');
        if (badge) {
          badge.hidden = false;
          badge.textContent = `QUEUED${
            queuedNames.indexOf(name) >= 0
              ? ` #${queuedNames.indexOf(name) + 1}`
              : ''
          }`;
          badge.dataset.state = 'queued';
        }
        if (btn) {
          btn.classList.remove('is-stop');
          btn.classList.add('is-busy');
          btn.textContent = 'Queued…';
          btn.disabled = true;
        }
      }
    });

    document.querySelector('.log-panel')?.classList.add('is-live');

    if (opts.scroll && runningScript) {
      const row = document.querySelector(
        `.script-row[data-script="${CSS.escape(runningScript)}"]`
      );
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Highlight the script that is running / queued / finished and update its Run button.
   * @param {string | null} scriptName
   * @param {'running' | 'queued' | 'passed' | 'failed' | 'idle'} state
   * @param {Array<string | { script: string }>} [queue]
   */
  function setScriptRowState(scriptName, state, queue = []) {
    if (state === 'running') {
      syncScriptHighlights(scriptName, queue);
      return;
    }
    if (state === 'queued') {
      syncScriptHighlights(null, [scriptName, ...queue]);
      // Mark this one as first queued visually via sync — if only queued, no running
      const row = scriptName
        ? document.querySelector(
            `.script-row[data-script="${CSS.escape(scriptName)}"]`
          )
        : null;
      if (row) {
        row.classList.add('is-queued');
        const badge = row.querySelector('.script-status');
        if (badge) {
          badge.hidden = false;
          badge.textContent = 'QUEUED';
          badge.dataset.state = 'queued';
        }
      }
      return;
    }

    if (state === 'idle' || !scriptName) {
      clearScriptRowStates();
      return;
    }

    // Finished: clear busy on others in queue stay? Prefer keep queue highlights.
    const queuedNames = queue
      .map((q) => (typeof q === 'string' ? q : q?.script))
      .filter(Boolean);

    if (queuedNames.length) {
      // Next script will start shortly — show finished + remaining queue
      syncScriptHighlights(null, queuedNames);
    } else {
      document.querySelectorAll('.script-row').forEach((row) => {
        resetScriptRowBusy(row);
      });
      document.querySelector('.log-panel')?.classList.remove('is-live');
    }

    const row = document.querySelector(
      `.script-row[data-script="${CSS.escape(scriptName)}"]`
    );
    if (!row) return;

    const btn = row.querySelector('.btn-run');
    const badge = row.querySelector('.script-status');
    row.classList.remove('is-running', 'is-queued');
    if (state === 'passed') {
      row.classList.add('is-done-pass');
      if (badge) {
        badge.hidden = false;
        badge.textContent = 'PASSED';
        badge.dataset.state = 'passed';
      }
      if (btn) {
        btn.textContent = 'Run';
        btn.disabled = false;
        btn.classList.remove('is-busy', 'is-stop');
      }
    } else if (state === 'failed') {
      row.classList.add('is-done-fail');
      if (badge) {
        badge.hidden = false;
        badge.textContent = 'FAILED';
        badge.dataset.state = 'failed';
      }
      if (btn) {
        btn.textContent = 'Run';
        btn.disabled = false;
        btn.classList.remove('is-busy', 'is-stop');
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
   * Scroll the running script row into view (multi-run identification).
   * @param {string | null} scriptName
   */
  function focusRunUi(scriptName) {
    if (!scriptName) return;
    const row = document.querySelector(
      `.script-row[data-script="${CSS.escape(scriptName)}"]`
    );
    row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      btn.dataset.projectId = p.id;
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
      row.appendChild(reportActions(r.url));
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
    document.querySelectorAll('.project-card').forEach((card) => {
      const isTarget = card.dataset.projectId === id;
      card.classList.toggle('is-opening', isTarget);
      card.disabled = true;
    });
    try {
      const data = await api(`/api/projects/${encodeURIComponent(id)}`);
      const p = data.project;
      if (!p) throw new Error(`Project "${id}" could not be loaded`);
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
      // Devices load in the background so opening the project stays fast
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
        decorateToolRows(els.listOther);
      } else {
        els.colOther.hidden = true;
        els.listOther.innerHTML = '';
      }
      updateRunSelectedState();
      renderReports(data.reports || []);

      document.querySelector('.projects-panel').hidden = true;
      els.scriptsPanel.hidden = false;
    } catch (err) {
      alert(`Could not open ${id}: ${err.message || err}`);
    } finally {
      document.querySelectorAll('.project-card').forEach((card) => {
        card.classList.remove('is-opening');
        card.disabled = false;
      });
    }
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
    const env = collectRunEnv(script);
    if (!env) return;
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
        body: JSON.stringify({
          projectId,
          script, env,
        }),
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
    const envByScript = {};
    for (const script of scripts) {
      const env = collectRunEnv(script);
      if (!env) return;
      envByScript[script] = env;
    }
    if (!(await ensureAppiumForTests('test'))) return;
    activeScriptName = scripts[0];
    setRunAck({
      title: `Running ${scripts.length} selected script(s)`,
      detail: scripts.join(', '),
      state: 'running',
    });
    setScriptRowState(scripts[0], 'running', scripts.slice(1));
    focusRunUi(scripts[0]);
    try {
      const result = await api('/api/run/many', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          scripts, envByScript,
        }),
      });
      if (!result.ok) {
        const reasons = (result.results || []).filter((r) => !r.ok).map((r) => r.error);
        alert(['Some scripts could not be queued', ...reasons].join('\n'));
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
          setScriptRowState(run.script, 'running', queue);
          focusRunUi(run.script);
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
          setScriptRowState(run.script, doneState, queue);
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

  /** Run history panel shows only the newest runs (the server keeps more). */
  const HISTORY_ROWS_SHOWN = 10;

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
      for (const h of hist.slice(0, HISTORY_ROWS_SHOWN)) {
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
          // Archived snapshots keep this run's report; old entries may still point at latest
          const isSnapshot = /-\d{8}-/.test(h.primaryReportUrl) || Boolean(h.archivedReportName);
          row.appendChild(
            reportActions(h.primaryReportUrl, {
              openLabel: isSnapshot ? 'This run' : 'Latest',
              openTitle: isSnapshot
                ? 'Open the report saved for this run'
                : 'Opens current latest report (no snapshot for older runs)',
            })
          );
        }
        els.historyList.appendChild(row);
      }
    } catch {
      els.historyList.innerHTML = '<p class="muted">Could not load history.</p>';
    }
  }

  els.btnExportPdf.addEventListener('click', () => {
    if (els.btnExportPdf.dataset.reportUrl) {
      exportPdf(els.btnExportPdf.dataset.reportUrl, els.btnExportPdf);
    }
  });
  els.btnAppiumStart.addEventListener('click', startAppium);
  els.btnAppiumStop.addEventListener('click', stopAppium);
  els.btnAppiumRefresh.addEventListener('click', refreshAppium);
  els.btnTheme.addEventListener('click', toggleTheme);
  els.btnDevicesRefresh.addEventListener('click', () =>
    refreshDevices(selectedProjectId || '')
  );
  els.btnApplyDevice?.addEventListener('click', applySelectedDevices);
  // Changing the dropdown immediately saves for the open project
  els.selIosDevice?.addEventListener('change', () => {
    if (selectedProjectId && els.selIosDevice.value) applySelectedDevices();
  });
  els.selAndroidDevice?.addEventListener('change', () => {
    if (selectedProjectId && els.selAndroidDevice.value) applySelectedDevices();
  });
  els.btnBack.addEventListener('click', showProjects);
  // Showcase "Enter Control Desk" returns to the project list.
  document.addEventListener('desk:show-projects', () => {
    document.getElementById('navAutomation')?.click();
    showProjects();
  });
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
  // Start on the full project list. The last opened app is not restored,
  // so Enter Control Desk and a fresh load both show every project.
  loadProjects().catch((err) => {
    els.projectGrid.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  });
  setInterval(refreshAppium, 8000);
  setInterval(() => refreshDevices(selectedProjectId || ''), 15000);
})();

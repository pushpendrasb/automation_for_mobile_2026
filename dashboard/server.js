/**
 * Automation Control Dashboard — local one-click runner.
 *
 * Features: Appium status/start/stop, projects, scripts, live logs, reports,
 * devices, env checks, run queue, history, suites, screenshots, multi-run.
 *
 *   npm run dashboard  →  http://127.0.0.1:3939
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(__dirname, 'public');
const PROJECTS_DIR = path.join(ROOT, 'projects');
const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'run-history.json');
const PORT = Number(process.env.DASHBOARD_PORT || 3939);
const HOST = process.env.DASHBOARD_HOST || '127.0.0.1';
const APPIUM_URL = process.env.APPIUM_URL || 'http://127.0.0.1:4723';

/** @type {import('child_process').ChildProcess | null} */
let appiumChild = null;
/** @type {object | null} */
let activeRun = null;
/** @type {import('child_process').ChildProcess | null} */
let runChild = null;
/** @type {Array<{ projectId: string, script: string }>} */
let runQueue = [];

const HIDDEN_SCRIPTS = new Set([
  'setup',
  'typecheck',
  'report:catalog',
  'report:catalog:open',
]);

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function isRealProject(dir) {
  if (dir.startsWith('_')) return false;
  return fs.existsSync(path.join(PROJECTS_DIR, dir, 'package.json'));
}

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 12000 });
  } catch (error) {
    return error.stdout || error.message || '';
  }
}

function loadHistory() {
  ensureDataDir();
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveHistoryEntry(entry) {
  ensureDataDir();
  const list = loadHistory();
  list.unshift(entry);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(list.slice(0, 10), null, 2));
}

function readEnvFile(projectId) {
  const envPath = path.join(PROJECTS_DIR, projectId, '.env');
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync(envPath)) return { exists: false, vars: out };
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return { exists: true, vars: out };
}

/**
 * Env readiness for a project (no secret values returned).
 */
function checkProjectEnv(projectId) {
  if (!isRealProject(projectId)) {
    return { ok: false, error: 'Unknown project' };
  }
  const { exists, vars } = readEnvFile(projectId);
  const checks = [
    { key: 'TEST_USER', label: 'Test user email', required: true },
    { key: 'TEST_PASSWORD', label: 'Test password', required: true },
    { key: 'IOS_DEVICE_UDID', label: 'iOS device UDID', required: false },
    { key: 'ANDROID_DEVICE_ID', label: 'Android device id', required: false },
    {
      key: 'APPLE_TEAM_ID',
      label: 'Apple Team ID',
      required: false,
      aliases: ['XCODE_ORG_ID', 'DEVELOPMENT_TEAM'],
    },
  ];

  const results = checks.map((c) => {
    const keys = [c.key, ...(c.aliases || [])];
    const present = keys.some((k) => Boolean(vars[k] && String(vars[k]).trim()));
    return {
      key: c.key,
      label: c.label,
      required: c.required,
      present,
      ok: c.required ? present : true,
    };
  });

  const missingRequired = results.filter((r) => r.required && !r.present);
  return {
    ok: exists && missingRequired.length === 0,
    envFileExists: exists,
    envPath: `projects/${projectId}/.env`,
    checks: results,
    warnings: missingRequired.map((r) => `Missing ${r.key} in .env`),
  };
}

/**
 * Connected devices summary (iOS + Android).
 */
function getDevicesStatus(projectId) {
  let configuredUdid = '';
  let configuredAndroid = '';
  if (projectId && isRealProject(projectId)) {
    const { vars } = readEnvFile(projectId);
    configuredUdid = vars.IOS_DEVICE_UDID || '';
    configuredAndroid = vars.ANDROID_DEVICE_ID || '';
  }

  const iosOut = runCmd('xcrun xctrace list devices 2>/dev/null || true');
  const iosDevices = [];
  for (const line of iosOut.split('\n')) {
    // "Name (version) (UDID)" — skip simulators section headers loosely
    const m = line.match(/^(.+?)\s+\(([^)]+)\)\s+\(([0-9A-Fa-f-]+)\)$/);
    if (!m) continue;
    const name = m[1].trim();
    const version = m[2];
    const udid = m[3];
    if (/Simulator/i.test(line) || /simulators/i.test(name)) continue;
    iosDevices.push({ name, version, udid });
  }

  const adbOut = runCmd('adb devices 2>/dev/null || true');
  const androidDevices = [];
  for (const line of adbOut.split('\n').slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && parts[1] === 'device') {
      androidDevices.push({ id: parts[0], state: 'device' });
    }
  }

  const iosConfiguredOk = configuredUdid
    ? iosDevices.some((d) => d.udid === configuredUdid) ||
      iosOut.includes(configuredUdid)
    : iosDevices.length > 0;
  const androidConfiguredOk = configuredAndroid
    ? androidDevices.some((d) => d.id === configuredAndroid)
    : androidDevices.length > 0;

  return {
    ios: {
      devices: iosDevices,
      configuredUdid: configuredUdid || null,
      ready: iosDevices.length > 0 || Boolean(configuredUdid && iosOut.includes(configuredUdid)),
      configuredOk: !configuredUdid || iosConfiguredOk,
    },
    android: {
      devices: androidDevices,
      configuredId: configuredAndroid || null,
      ready: androidDevices.length > 0,
      configuredOk: !configuredAndroid || androidConfiguredOk,
    },
    summary:
      iosDevices.length || androidDevices.length
        ? `${iosDevices.length} iOS · ${androidDevices.length} Android`
        : 'No devices detected',
  };
}

function listReports(projectId) {
  if (!isRealProject(projectId)) return [];
  const reportsDir = path.join(PROJECTS_DIR, projectId, 'reports');
  if (!fs.existsSync(reportsDir)) return [];

  let reportBaseName = `${projectId}-report`;
  try {
    const cfg = require(path.join(PROJECTS_DIR, projectId, 'project.config.js'));
    if (cfg.reportBaseName) reportBaseName = cfg.reportBaseName;
  } catch {
    /* ignore */
  }

  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => f.endsWith('.html') && !f.startsWith('.'));

  const scored = files.map((name) => {
    const full = path.join(reportsDir, name);
    const st = fs.statSync(full);
    let kind = 'other';
    let label = name;
    if (name === `${reportBaseName}.html`) {
      kind = 'latest';
      label = 'Latest test report';
    } else if (name === 'test-catalog.html') {
      kind = 'catalog';
      label = 'Test catalog';
    } else if (name.includes('report')) {
      kind = 'report';
      label = name.replace(/\.html$/, '');
    }
    return {
      name,
      label,
      kind,
      mtime: st.mtimeMs,
      size: st.size,
      url: `/project-reports/${encodeURIComponent(projectId)}/${encodeURIComponent(name)}`,
    };
  });

  scored.sort((a, b) => {
    const rank = { latest: 0, catalog: 1, report: 2, other: 3 };
    return (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9) || b.mtime - a.mtime;
  });
  return scored;
}

function resolveReportFile(projectId, fileName) {
  if (!isRealProject(projectId)) return null;
  if (!fileName || fileName.includes('..') || /[/\\]/.test(fileName)) return null;
  if (!fileName.endsWith('.html')) return null;
  const reportsDir = path.join(PROJECTS_DIR, projectId, 'reports');
  const full = path.join(reportsDir, fileName);
  if (!full.startsWith(reportsDir) || !fs.existsSync(full)) return null;
  return full;
}

function scriptGroup(name) {
  if (name.startsWith('test:ios')) return 'iOS';
  if (name.startsWith('test:android')) return 'Android';
  if (name.startsWith('check:')) return 'Devices';
  if (name.startsWith('report:')) return 'Reports';
  if (name === 'test') return 'Default';
  return 'Other';
}

function scriptTitle(name) {
  return name.replace(/^test:/, '').replace(/:/g, ' · ').replace(/-/g, ' ');
}

function listScripts(projectId) {
  const pkgPath = path.join(PROJECTS_DIR, projectId, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};
  return Object.keys(scripts)
    .filter((k) => !HIDDEN_SCRIPTS.has(k))
    .map((name) => ({
      name,
      title: scriptTitle(name),
      group: scriptGroup(name),
      command: scripts[name],
      runnable:
        name.startsWith('test') ||
        name.startsWith('check:') ||
        name === 'report:open',
      selectable: name.startsWith('test'),
    }))
    .sort((a, b) => {
      const order = ['iOS', 'Android', 'Devices', 'Reports', 'Default', 'Other'];
      return order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name);
    });
}

/**
 * Suggested one-click suites for a project.
 */
function listSuites(projectId) {
  const scripts = listScripts(projectId).map((s) => s.name);
  const suites = [];

  const iosSignin = scripts.filter(
    (n) =>
      n === 'test:ios:signin' ||
      n === 'test:ios:signin:all' ||
      n === 'test:ios:signin:negative' ||
      n === 'test:ios:signin:password' ||
      n === 'test:ios:positive' ||
      n === 'test:ios:negative'
  );
  // Prefer dedicated suite script if present
  if (scripts.includes('test:ios:signin:all')) {
    suites.push({
      id: 'ios-signin-all',
      title: 'iOS Sign-in suite (all)',
      scripts: ['test:ios:signin:all'],
      description: 'Positive + negative + password in one npm script',
    });
  } else if (iosSignin.length) {
    const ordered = [
      'test:ios:signin',
      'test:ios:positive',
      'test:ios:signin:negative',
      'test:ios:negative',
      'test:ios:signin:password',
    ].filter((n) => scripts.includes(n));
    const unique = [...new Set(ordered.length ? ordered : iosSignin)];
    suites.push({
      id: 'ios-signin',
      title: 'iOS Sign-in suite',
      scripts: unique,
      description: 'Queue sign-in related scripts in order',
    });
  }

  if (scripts.includes('test:ios:smoke') || scripts.includes('test:ios:screens')) {
    const smoke = ['test:ios:smoke', 'test:ios:screens'].filter((n) =>
      scripts.includes(n)
    );
    suites.push({
      id: 'ios-smoke',
      title: 'iOS Smoke',
      scripts: smoke,
      description: 'Quick smoke / screen walk',
    });
  }

  const androidSignin = scripts.filter(
    (n) =>
      n === 'test:android:signin' ||
      n === 'test:android:signin:all' ||
      n === 'test:android:positive' ||
      n === 'test:android:negative'
  );
  if (androidSignin.length) {
    suites.push({
      id: 'android-signin',
      title: 'Android Sign-in suite',
      scripts: [...new Set(androidSignin)],
      description: 'Android auth scripts',
    });
  }

  return suites;
}

function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && isRealProject(d.name))
    .map((d) => {
      const id = d.name;
      const root = path.join(PROJECTS_DIR, id);
      let displayName = id;
      let description = '';
      let scriptLanguage = 'javascript';
      let bundleId = '';
      let appPackage = '';
      try {
        const cfg = require(path.join(root, 'project.config.js'));
        displayName = cfg.displayName || id;
        scriptLanguage = cfg.scriptLanguage || 'javascript';
        bundleId = cfg.defaults?.ios?.bundleId || '';
        appPackage = cfg.defaults?.android?.appPackage || '';
      } catch {
        /* no config */
      }
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        description = pkg.description || '';
      } catch {
        /* ignore */
      }
      const scripts = listScripts(id);
      const reports = listReports(id);
      const suites = listSuites(id);
      const env = checkProjectEnv(id);
      const shotsDir = path.join(root, 'screenshots');
      return {
        id,
        displayName,
        description,
        scriptLanguage,
        bundleId,
        appPackage,
        scriptCount: scripts.length,
        hasReports: reports.length > 0,
        reportCount: reports.length,
        primaryReportUrl: reports[0]?.url || null,
        suiteCount: suites.length,
        envOk: env.ok,
        hasScreenshots: fs.existsSync(shotsDir),
      };
    })
    .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
}

async function checkAppium() {
  let cliVersion = null;
  try {
    cliVersion = runCmd('appium -v 2>/dev/null || appium --version 2>/dev/null')
      .trim()
      .split('\n')[0];
  } catch {
    cliVersion = null;
  }

  try {
    const res = await fetch(`${APPIUM_URL}/status`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      return {
        running: false,
        url: APPIUM_URL,
        detail: `HTTP ${res.status}`,
        cliVersion,
        managedByDashboard: Boolean(appiumChild && !appiumChild.killed),
      };
    }
    const body = await res.json().catch(() => ({}));
    const ver = body?.value?.build?.version || cliVersion;
    return {
      running: true,
      url: APPIUM_URL,
      version: ver || null,
      cliVersion,
      detail: ver ? `Appium ${ver}` : 'Responding on /status',
      managedByDashboard: Boolean(appiumChild && !appiumChild.killed),
    };
  } catch (err) {
    return {
      running: false,
      url: APPIUM_URL,
      detail: String(err?.message || err),
      cliVersion,
      managedByDashboard: Boolean(appiumChild && !appiumChild.killed),
      hint: cliVersion
        ? 'CLI found — click Start Appium'
        : 'Install Appium: npm i -g appium',
    };
  }
}

async function startAppium() {
  const status = await checkAppium();
  if (status.running) return { ok: true, alreadyRunning: true, ...status };
  if (appiumChild && !appiumChild.killed) {
    return { ok: true, starting: true, url: APPIUM_URL };
  }

  appiumChild = spawn('appium', [], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  appiumChild.unref();

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const s = await checkAppium();
    if (s.running) return { ok: true, started: true, ...s };
  }
  return {
    ok: false,
    error: 'Appium started but /status not ready. Is `appium` on PATH?',
    url: APPIUM_URL,
  };
}

async function stopAppium() {
  if (appiumChild && !appiumChild.killed) {
    try {
      process.kill(-appiumChild.pid, 'SIGTERM');
    } catch {
      try {
        appiumChild.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
    appiumChild = null;
  }
  try {
    spawn('bash', ['-lc', 'lsof -ti:4723 | xargs kill -9 2>/dev/null || true'], {
      stdio: 'ignore',
    });
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 800));
  const status = await checkAppium();
  return { ok: !status.running, ...status };
}

function publicRun() {
  if (!activeRun) return null;
  const reports =
    activeRun.reports ||
    (activeRun.status !== 'running' ? listReports(activeRun.projectId) : []);
  const durationMs =
    (activeRun.finishedAt || Date.now()) - activeRun.startedAt;
  return {
    id: activeRun.id,
    projectId: activeRun.projectId,
    script: activeRun.script,
    status: activeRun.status,
    startedAt: activeRun.startedAt,
    finishedAt: activeRun.finishedAt || null,
    durationMs,
    exitCode: activeRun.exitCode,
    lineCount: activeRun.lines.length,
    lines: activeRun.lines.slice(-500),
    reports,
    primaryReportUrl: reports[0]?.url || null,
    summary: activeRun.summary || null,
    queueRemaining: runQueue.length,
  };
}

function parseSummaryFromLines(lines) {
  const text = lines.join('\n');
  // Common WDIO / mocha patterns
  let passed = null;
  let failed = null;
  let skipped = null;
  const m1 = text.match(/(\d+)\s+passing/i);
  const m2 = text.match(/(\d+)\s+failing/i);
  const m3 = text.match(/(\d+)\s+pending|(\d+)\s+skipped/i);
  if (m1) passed = Number(m1[1]);
  if (m2) failed = Number(m2[1]);
  if (m3) skipped = Number(m3[1] || m3[2]);
  const spec = text.match(/Spec Files:\s+(\d+)\s+passed,\s+(\d+)\s+failed/i);
  if (spec) {
    passed = Number(spec[1]);
    failed = Number(spec[2]);
  }
  const total =
    text.match(/Total:\s*(\d+)\s*\|\s*Passed:\s*(\d+)\s*\|\s*Failed:\s*(\d+)/i) ||
    text.match(/Total:\s*(\d+).*Passed:\s*(\d+).*Failed:\s*(\d+)/i);
  if (total) {
    return {
      total: Number(total[1]),
      passed: Number(total[2]),
      failed: Number(total[3]),
      skipped: skipped ?? 0,
    };
  }
  if (passed != null || failed != null) {
    return {
      total: (passed || 0) + (failed || 0) + (skipped || 0),
      passed: passed || 0,
      failed: failed || 0,
      skipped: skipped || 0,
    };
  }
  return null;
}

function finishActiveRun(code, statusOverride) {
  if (!activeRun) return;
  activeRun.status =
    statusOverride || (code === 0 ? 'passed' : 'failed');
  activeRun.exitCode = code;
  activeRun.finishedAt = Date.now();
  activeRun.lines.push('');
  activeRun.lines.push(`— finished with exit code ${code} —`);
  const reports = listReports(activeRun.projectId);
  activeRun.reports = reports;
  if (reports[0]) activeRun.lines.push(`Report: ${reports[0].url}`);
  activeRun.summary = parseSummaryFromLines(activeRun.lines);

  saveHistoryEntry({
    id: activeRun.id,
    projectId: activeRun.projectId,
    script: activeRun.script,
    status: activeRun.status,
    exitCode: activeRun.exitCode,
    startedAt: activeRun.startedAt,
    finishedAt: activeRun.finishedAt,
    durationMs: activeRun.finishedAt - activeRun.startedAt,
    primaryReportUrl: reports[0]?.url || null,
    summary: activeRun.summary,
  });
}

function pumpQueue() {
  if (activeRun && activeRun.status === 'running') return;
  const next = runQueue.shift();
  if (!next) return;
  beginScriptRun(next.projectId, next.script, { fromQueue: true });
}

/**
 * Start immediately or enqueue if busy.
 */
function enqueueOrRun(projectId, script) {
  if (!isRealProject(projectId)) {
    return { ok: false, error: `Unknown project: ${projectId}` };
  }
  const scripts = listScripts(projectId);
  const found = scripts.find((s) => s.name === script);
  if (!found) return { ok: false, error: `Unknown script: ${script}` };

  if (activeRun && activeRun.status === 'running') {
    runQueue.push({ projectId, script });
    return {
      ok: true,
      queued: true,
      position: runQueue.length,
      queue: runQueue.slice(),
      run: publicRun(),
    };
  }
  return beginScriptRun(projectId, script);
}

function beginScriptRun(projectId, script, opts = {}) {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const cwd = path.join(PROJECTS_DIR, projectId);
  activeRun = {
    id: runId,
    projectId,
    script,
    status: 'running',
    startedAt: Date.now(),
    finishedAt: null,
    exitCode: null,
    lines: [
      opts.fromQueue ? '(from queue)' : '',
      `$ npm run ${script}`,
      `cwd: ${cwd}`,
      '',
    ].filter(Boolean),
    reports: [],
    summary: null,
  };

  runChild = spawn('npm', ['run', script], {
    cwd,
    env: { ...process.env, FORCE_COLOR: '0' },
    shell: false,
  });

  const append = (chunk, stream) => {
    const text = chunk.toString('utf8');
    for (const line of text.split(/\r?\n/)) {
      if (line.length === 0) continue;
      activeRun.lines.push(stream === 'err' ? `[err] ${line}` : line);
    }
    if (activeRun.lines.length > 4000) {
      activeRun.lines = activeRun.lines.slice(-3000);
    }
  };

  runChild.stdout.on('data', (d) => append(d, 'out'));
  runChild.stderr.on('data', (d) => append(d, 'err'));
  runChild.on('close', (code) => {
    finishActiveRun(code);
    runChild = null;
    setTimeout(pumpQueue, 400);
  });
  runChild.on('error', (err) => {
    if (activeRun) {
      activeRun.lines.push(`Spawn error: ${err.message}`);
      finishActiveRun(1);
    }
    runChild = null;
    setTimeout(pumpQueue, 400);
  });

  return { ok: true, queued: false, run: publicRun(), queue: runQueue.slice() };
}

function enqueueMany(projectId, scripts) {
  const list = (scripts || []).filter(Boolean);
  if (!list.length) return { ok: false, error: 'No scripts provided' };
  const results = [];
  for (const script of list) {
    results.push(enqueueOrRun(projectId, script));
  }
  return {
    ok: results.every((r) => r.ok),
    results,
    queue: runQueue.slice(),
    run: publicRun(),
  };
}

function stopScriptRun() {
  runQueue = [];
  if (!runChild) {
    if (activeRun && activeRun.status === 'running') {
      activeRun.status = 'stopped';
      activeRun.finishedAt = Date.now();
    }
    return { ok: true, run: publicRun(), queue: [] };
  }
  try {
    runChild.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  if (activeRun) {
    activeRun.status = 'stopped';
    activeRun.finishedAt = Date.now();
    activeRun.lines.push('— stopped by user (queue cleared) —');
    activeRun.reports = listReports(activeRun.projectId);
    saveHistoryEntry({
      id: activeRun.id,
      projectId: activeRun.projectId,
      script: activeRun.script,
      status: 'stopped',
      exitCode: activeRun.exitCode,
      startedAt: activeRun.startedAt,
      finishedAt: activeRun.finishedAt,
      durationMs: activeRun.finishedAt - activeRun.startedAt,
      primaryReportUrl: activeRun.reports[0]?.url || null,
      summary: activeRun.summary,
    });
  }
  return { ok: true, run: publicRun(), queue: [] };
}

function openScreenshots(projectId) {
  if (!isRealProject(projectId)) {
    return { ok: false, error: 'Unknown project' };
  }
  const dir = path.join(PROJECTS_DIR, projectId, 'screenshots');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const openCmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'explorer'
        : 'xdg-open';
  try {
    spawn(openCmd, [dir], { stdio: 'ignore', detached: true }).unref();
    return { ok: true, path: dir };
  } catch (err) {
    return { ok: false, error: String(err.message || err), path: dir };
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data, null, 2));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function serveStatic(urlPath, res) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  rel = decodeURIComponent(rel.split('?')[0]);
  if (rel.includes('..')) {
    res.writeHead(400);
    res.end('Bad path');
    return;
  }
  const filePath = path.join(PUBLIC, rel);
  if (!filePath.startsWith(PUBLIC) || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const { pathname } = u;
  const method = req.method || 'GET';

  try {
    if (method === 'GET' && pathname === '/api/health') {
      return json(res, { ok: true, root: ROOT, host: HOST, port: PORT });
    }

    if (method === 'GET' && pathname === '/api/appium') {
      return json(res, await checkAppium());
    }
    if (method === 'POST' && pathname === '/api/appium/start') {
      return json(res, await startAppium());
    }
    if (method === 'POST' && pathname === '/api/appium/stop') {
      return json(res, await stopAppium());
    }

    if (method === 'GET' && pathname === '/api/devices') {
      const projectId = u.searchParams.get('projectId') || '';
      return json(res, getDevicesStatus(projectId));
    }

    if (method === 'GET' && pathname === '/api/history') {
      return json(res, { history: loadHistory() });
    }

    if (method === 'GET' && pathname === '/api/projects') {
      return json(res, { projects: listProjects() });
    }

    const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (method === 'GET' && projectMatch) {
      const id = decodeURIComponent(projectMatch[1]);
      if (!isRealProject(id)) return json(res, { error: 'Not found' }, 404);
      const meta = listProjects().find((p) => p.id === id);
      return json(res, {
        project: meta,
        scripts: listScripts(id),
        reports: listReports(id),
        suites: listSuites(id),
        env: checkProjectEnv(id),
        devices: getDevicesStatus(id),
      });
    }

    const envMatch = pathname.match(/^\/api\/projects\/([^/]+)\/env$/);
    if (method === 'GET' && envMatch) {
      const id = decodeURIComponent(envMatch[1]);
      return json(res, checkProjectEnv(id));
    }

    const reportsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/reports$/);
    if (method === 'GET' && reportsMatch) {
      const id = decodeURIComponent(reportsMatch[1]);
      if (!isRealProject(id)) return json(res, { error: 'Not found' }, 404);
      return json(res, { reports: listReports(id) });
    }

    const shotsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/screenshots\/open$/);
    if (method === 'POST' && shotsMatch) {
      const id = decodeURIComponent(shotsMatch[1]);
      return json(res, openScreenshots(id));
    }

    const reportFileMatch = pathname.match(
      /^\/project-reports\/([^/]+)\/([^/]+\.html)$/
    );
    if (method === 'GET' && reportFileMatch) {
      const projectId = decodeURIComponent(reportFileMatch[1]);
      const fileName = decodeURIComponent(reportFileMatch[2]);
      const full = resolveReportFile(projectId, fileName);
      if (!full) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Report not found. Run a test first to generate it.');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(full).pipe(res);
      return;
    }

    if (method === 'POST' && pathname === '/api/run') {
      const body = await readBody(req);
      return json(
        res,
        enqueueOrRun(String(body.projectId || ''), String(body.script || ''))
      );
    }

    if (method === 'POST' && pathname === '/api/run/many') {
      const body = await readBody(req);
      return json(
        res,
        enqueueMany(String(body.projectId || ''), body.scripts || [])
      );
    }

    if (method === 'POST' && pathname === '/api/run/suite') {
      const body = await readBody(req);
      const projectId = String(body.projectId || '');
      const suiteId = String(body.suiteId || '');
      const suites = listSuites(projectId);
      const suite = suites.find((s) => s.id === suiteId);
      if (!suite) return json(res, { ok: false, error: 'Unknown suite' }, 404);
      return json(res, enqueueMany(projectId, suite.scripts));
    }

    if (method === 'POST' && pathname === '/api/run/stop') {
      return json(res, stopScriptRun());
    }

    if (method === 'GET' && pathname === '/api/run') {
      return json(res, { run: publicRun(), queue: runQueue.slice() });
    }

    if (method === 'GET') {
      return serveStatic(pathname, res);
    }

    json(res, { error: 'Not found' }, 404);
  } catch (err) {
    json(res, { error: String(err?.message || err) }, 500);
  }
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log('');
  console.log('  Automation Dashboard');
  console.log(`  ${url}`);
  console.log('  Projects:', listProjects().map((p) => p.id).join(', ') || '(none)');
  if (HOST !== '127.0.0.1') {
    console.log('  Note: DASHBOARD_HOST is not localhost — only use on trusted networks.');
  }
  console.log('');
  const openCmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
  try {
    spawn(openCmd, [url], { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* ignore */
  }
});

/**
 * Automation Control Dashboard — local one-click runner.
 *
 * Features: Appium status/start/stop, setup/bootstrap guide, projects, scripts,
 * live logs, reports, devices, env checks, run queue, history, suites,
 * screenshots, multi-run.
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
/** Name shown in the browser; /etc/hosts maps it to 127.0.0.1 (see setup-local-domain.sh). */
const DOMAIN = process.env.DASHBOARD_DOMAIN ?? 'testsuite.appdesign.ie';
const APPIUM_URL = process.env.APPIUM_URL || 'http://127.0.0.1:4723';

/**
 * Resolve ANDROID_HOME / ANDROID_SDK_ROOT for Appium UiAutomator2.
 * Control Desk / nohup often starts without the user's interactive shell profile,
 * so Appium then fails session create with "Neither ANDROID_HOME nor ANDROID_SDK_ROOT".
 * @returns {{ ANDROID_HOME: string, ANDROID_SDK_ROOT: string } | Record<string, never>}
 */
function resolveAndroidSdkEnv() {
  const fromEnv =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    '';
  const candidates = [
    fromEnv,
    path.join(require('os').homedir(), 'Library/Android/sdk'),
    path.join(require('os').homedir(), 'Android/Sdk'),
    '/usr/local/share/android-sdk',
    '/opt/homebrew/share/android-commandlinetools',
  ].filter(Boolean);
  for (const dir of candidates) {
    if (
      fs.existsSync(dir) &&
      (fs.existsSync(path.join(dir, 'platform-tools')) ||
        fs.existsSync(path.join(dir, 'platforms')))
    ) {
      return { ANDROID_HOME: dir, ANDROID_SDK_ROOT: dir };
    }
  }
  return {};
}

/**
 * Environment for Appium + test child processes (SDK paths + platform-tools on PATH).
 * @param {Record<string, string>} [extra]
 */
function childProcessEnv(extra = {}) {
  const sdk = resolveAndroidSdkEnv();
  const pathParts = [process.env.PATH || ''];
  if (sdk.ANDROID_HOME) {
    pathParts.unshift(
      path.join(sdk.ANDROID_HOME, 'platform-tools'),
      path.join(sdk.ANDROID_HOME, 'emulator'),
      path.join(sdk.ANDROID_HOME, 'tools'),
      path.join(sdk.ANDROID_HOME, 'tools', 'bin')
    );
  }
  return {
    ...process.env,
    ...sdk,
    PATH: pathParts.filter(Boolean).join(path.delimiter),
    ...extra,
  };
}

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

const MAX_HISTORY_PER_PROJECT = 10;

function saveHistoryEntry(entry) {
  ensureDataDir();
  const list = loadHistory();
  list.unshift(entry);
  // Cap per project, not globally — a project run often (e.g. during active
  // development) was otherwise evicting other projects' history entirely
  // once the old shared cap of 25 total runs filled up. Order stays
  // newest-first since `list` already is.
  const perProjectCount = new Map();
  const kept = [];
  for (const item of list) {
    const count = perProjectCount.get(item.projectId) || 0;
    if (count >= MAX_HISTORY_PER_PROJECT) continue;
    kept.push(item);
    perProjectCount.set(item.projectId, count + 1);
  }
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(kept, null, 2));
}

/**
 * Resolve report base name from project.config.js (e.g. appraiseeie-report).
 * @param {string} projectId
 */
function getReportBaseName(projectId) {
  let reportBaseName = `${projectId}-report`;
  try {
    const cfg = require(path.join(PROJECTS_DIR, projectId, 'project.config.js'));
    if (cfg.reportBaseName) reportBaseName = cfg.reportBaseName;
  } catch {
    /* ignore */
  }
  return reportBaseName;
}

/**
 * Copy the latest HTML report into a unique snapshot so history links
 * do not all open the same overwritten file.
 * @param {string} projectId
 * @param {string} runId
 * @returns {{ url: string, name: string } | null}
 */
function archiveLatestReport(projectId, runId) {
  if (!isRealProject(projectId)) return null;
  const reportsDir = path.join(PROJECTS_DIR, projectId, 'reports');
  const base = getReportBaseName(projectId);
  const latest = path.join(reportsDir, `${base}.html`);
  if (!fs.existsSync(latest)) return null;

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z')
    .replace('T', '-');
  const shortId = String(runId || 'run')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(-8);
  const name = `${base}-${stamp}-${shortId}.html`;
  const dest = path.join(reportsDir, name);
  try {
    fs.copyFileSync(latest, dest);
  } catch {
    return null;
  }

  // Prune very old snapshots (keep latest + newest 30 archives)
  try {
    const archives = fs
      .readdirSync(reportsDir)
      .filter(
        (f) =>
          f.startsWith(`${base}-`) &&
          f.endsWith('.html') &&
          f !== `${base}.html`
      )
      .map((f) => ({
        f,
        m: fs.statSync(path.join(reportsDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.m - a.m);
    for (const old of archives.slice(30)) {
      try {
        fs.unlinkSync(path.join(reportsDir, old.f));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  return {
    name,
    url: `/project-reports/${encodeURIComponent(projectId)}/${encodeURIComponent(name)}`,
  };
}

function listReports(projectId) {
  if (!isRealProject(projectId)) return [];
  const reportsDir = path.join(PROJECTS_DIR, projectId, 'reports');
  if (!fs.existsSync(reportsDir)) return [];

  const reportBaseName = getReportBaseName(projectId);

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
    } else if (
      name.startsWith(`${reportBaseName}-`) &&
      name.endsWith('.html')
    ) {
      kind = 'archive';
      // Prefer readable time from file mtime
      const when = new Date(st.mtimeMs).toLocaleString();
      label = `Run report · ${when}`;
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

  // Latest first, then archives by date, catalog last among specials
  scored.sort((a, b) => {
    const rank = { latest: 0, archive: 1, report: 2, catalog: 3, other: 4 };
    const ra = rank[a.kind] ?? 9;
    const rb = rank[b.kind] ?? 9;
    if (ra !== rb) return ra - rb;
    return b.mtime - a.mtime;
  });

  // Show only the 10 most recent run reports ("latest" + "archive") per
  // project — matches the same 10-recent-runs cap as the dashboard's run
  // history. Reference docs (catalog) aren't a "run" and stay unlimited.
  const runKinds = new Set(['latest', 'archive']);
  let runsKept = 0;
  return scored.filter((r) => {
    if (!runKinds.has(r.kind)) return true;
    runsKept++;
    return runsKept <= MAX_HISTORY_PER_PROJECT;
  });
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
 * Update (or add) a single KEY=VALUE line in a project's .env, preserving
 * every other line as-is. Used for device-specific values (IOS_DEVICE_UDID)
 * that differ per machine when the same project checkout is copied to
 * another Mac with a different connected iPhone.
 */
function writeEnvVar(projectId, key, value) {
  const envPath = path.join(PROJECTS_DIR, projectId, '.env');
  const lines = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    : [];
  const linePattern = new RegExp(`^\\s*${key}\\s*=`);
  const newLine = `${key}=${value}`;
  const idx = lines.findIndex((l) => linePattern.test(l));
  if (idx >= 0) {
    lines[idx] = newLine;
  } else {
    // Drop a single trailing blank line so the new var doesn't pile up gaps
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    lines.push(newLine);
  }
  fs.writeFileSync(envPath, lines.join('\n') + '\n');
}

/**
 * Device targeting for a project run — always taken from that project's .env
 * so Control Desk "selected device" is what Appium uses (not a stale parent env).
 * @param {string} projectId
 * @returns {Record<string, string>}
 */
function readProjectDeviceEnv(projectId) {
  const { vars } = readEnvFile(projectId);
  /** @type {Record<string, string>} */
  const out = {};
  if (vars.IOS_DEVICE_UDID) out.IOS_DEVICE_UDID = vars.IOS_DEVICE_UDID;
  if (vars.ANDROID_DEVICE_ID) out.ANDROID_DEVICE_ID = vars.ANDROID_DEVICE_ID;
  return out;
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
 * Cached briefly — xctrace is slow (~5–8s) and must not block opening a project.
 */
let devicesCache = { at: 0, key: '', value: null };

function getDevicesStatus(projectId) {
  const cacheKey = String(projectId || '');
  const now = Date.now();
  if (
    devicesCache.value &&
    devicesCache.key === cacheKey &&
    now - devicesCache.at < 8000
  ) {
    return devicesCache.value;
  }

  let configuredUdid = '';
  let configuredAndroid = '';
  if (projectId && isRealProject(projectId)) {
    const { vars } = readEnvFile(projectId);
    configuredUdid = vars.IOS_DEVICE_UDID || '';
    configuredAndroid = vars.ANDROID_DEVICE_ID || '';
  }

  const iosDevices = [];
  const iosOffline = [];
  const iosSimulators = [];
  const seenUdids = new Set();

  /**
   * Prefer CoreDevice (`devicectl`) — xctrace often leaves wired phones under
   * "Devices Offline" even when they are connected for Appium.
   */
  try {
    const tmpJson = path.join(
      require('os').tmpdir(),
      `control-desk-devices-${process.pid}.json`
    );
    runCmd(
      `xcrun devicectl list devices --json-output ${JSON.stringify(tmpJson)} 2>/dev/null || true`
    );
    if (fs.existsSync(tmpJson)) {
      const raw = JSON.parse(fs.readFileSync(tmpJson, 'utf8'));
      fs.unlinkSync(tmpJson);
      const list =
        raw?.result?.devices ||
        raw?.result?.deviceList ||
        raw?.devices ||
        [];
      for (const d of Array.isArray(list) ? list : []) {
        const name =
          d?.deviceProperties?.name ||
          d?.deviceProperties?.marketingName ||
          d?.name ||
          'iPhone';
        const version =
          d?.deviceProperties?.osVersionNumber ||
          d?.deviceProperties?.osVersion ||
          '';
        const udid =
          d?.hardwareProperties?.udid ||
          d?.identifier ||
          d?.udid ||
          '';
        if (!udid || /Simulator/i.test(name)) continue;
        const conn = d?.connectionProperties || {};
        const tunnel = String(conn.tunnelState || '').toLowerCase();
        const transport = String(conn.transportType || '').toLowerCase();
        const entry = {
          name: String(name).trim(),
          version: String(version),
          udid: String(udid),
          transport: transport || null,
        };
        seenUdids.add(entry.udid);
        // connected / available with an active tunnel = usable for automation
        if (
          tunnel === 'connected' ||
          (transport === 'wired' && tunnel !== 'unavailable')
        ) {
          iosDevices.push(entry);
        } else {
          iosOffline.push({
            ...entry,
            state: tunnel || 'unavailable',
          });
        }
      }
    }
  } catch {
    /* fall through to xctrace */
  }

  // Fallback / supplement from xctrace (also picks up simulators)
  const iosOut = runCmd('xcrun xctrace list devices 2>/dev/null || true');
  let section = '';
  for (const line of iosOut.split('\n')) {
    const header = line.match(/^==\s*(.+?)\s*==$/);
    if (header) {
      const h = header[1].trim().toLowerCase();
      if (h === 'devices') section = 'online';
      else if (h.includes('offline')) section = 'offline';
      else if (h.includes('simulator')) section = 'sim';
      else section = '';
      continue;
    }
    if (!section) continue;
    const m = line.match(/^(.+?)\s+\(([^)]+)\)\s+\(([0-9A-Fa-f-]+)\)$/);
    if (!m) continue;
    const name = m[1].trim();
    const version = m[2];
    const udid = m[3];
    if (section === 'sim' || /Simulator/i.test(line)) {
      iosSimulators.push({ name, version, udid });
      continue;
    }
    if (seenUdids.has(udid)) continue;
    const entry = { name, version, udid };
    seenUdids.add(udid);
    if (section === 'online') iosDevices.push(entry);
    else if (section === 'offline') iosOffline.push({ ...entry, state: 'offline' });
  }

  const adbOut = runCmd('adb devices 2>/dev/null || true');
  const androidDevices = [];
  const androidOther = [];
  for (const line of adbOut.split('\n').slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const id = parts[0];
    const state = parts[1];
    if (state === 'device') {
      androidDevices.push({ id, state: 'device' });
    } else if (state === 'unauthorized' || state === 'offline' || state === 'recovery') {
      androidOther.push({ id, state });
    }
  }

  const iosConfiguredOk = configuredUdid
    ? iosDevices.some((d) => d.udid === configuredUdid) ||
      iosOut.includes(configuredUdid)
    : iosDevices.length > 0;
  const androidConfiguredOk = configuredAndroid
    ? androidDevices.some((d) => d.id === configuredAndroid)
    : androidDevices.length > 0;

  const hintParts = [];
  if (iosDevices.length) {
    hintParts.push(
      `iOS: ${iosDevices.map((d) => d.name).slice(0, 3).join(', ')}`
    );
  } else if (iosOffline.length) {
    hintParts.push(
      `iOS offline: ${iosOffline
        .map((d) => d.name)
        .slice(0, 4)
        .join(', ')} — unlock, USB cable, Trust This Computer`
    );
  }
  if (!iosDevices.length && iosSimulators.length) {
    hintParts.push(
      `${iosSimulators.length} simulators — boot one in Simulator.app`
    );
  }
  if (androidOther.some((d) => d.state === 'unauthorized')) {
    hintParts.push(
      'Android USB unauthorized — unlock phone and tap Allow USB debugging'
    );
  }

  const summary =
    iosDevices.length || androidDevices.length
      ? `${iosDevices.length} iOS · ${androidDevices.length} Android`
      : 'No devices connected';

  const value = {
    ios: {
      devices: iosDevices,
      offline: iosOffline,
      simulators: iosSimulators.slice(0, 8),
      configuredUdid: configuredUdid || null,
      ready: iosDevices.length > 0 || Boolean(configuredUdid && iosOut.includes(configuredUdid)),
      configuredOk: !configuredUdid || iosConfiguredOk,
    },
    android: {
      devices: androidDevices,
      other: androidOther,
      configuredId: configuredAndroid || null,
      ready: androidDevices.length > 0,
      configuredOk: !configuredAndroid || androidConfiguredOk,
    },
    summary,
    hint: hintParts.join(' · ') || '',
  };
  devicesCache = { at: Date.now(), key: cacheKey, value };
  return value;
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

/**
 * Locate a Chromium-based browser for headless PDF printing.
 * Override with CHROME_PATH in the environment.
 * @returns {string | null}
 */
function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/**
 * Convert an HTML report to PDF with headless Chrome.
 * PDFs are cached in reports/pdf/ and rebuilt only when the HTML is newer.
 * @param {string} htmlPath absolute path of the report HTML
 * @returns {Promise<string>} absolute path of the PDF
 */
function reportToPdf(htmlPath) {
  const pdfDir = path.join(path.dirname(htmlPath), 'pdf');
  const pdfPath = path.join(pdfDir, path.basename(htmlPath).replace(/\.html$/, '.pdf'));
  if (
    fs.existsSync(pdfPath) &&
    fs.statSync(pdfPath).mtimeMs >= fs.statSync(htmlPath).mtimeMs
  ) {
    return Promise.resolve(pdfPath);
  }
  const chrome = findChrome();
  if (!chrome) {
    return Promise.reject(
      new Error('Google Chrome not found — install it or set CHROME_PATH to export PDF.')
    );
  }
  fs.mkdirSync(pdfDir, { recursive: true });
  const tmp = `${pdfPath}.tmp`;
  const profile = fs.mkdtempSync(path.join(require('os').tmpdir(), 'desk-pdf-'));
  return new Promise((resolve, reject) => {
    const child = spawn(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--use-mock-keychain',
        '--password-store=basic',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-sync',
        '--disable-extensions',
        `--user-data-dir=${profile}`,
        '--no-pdf-header-footer',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=4000',
        `--print-to-pdf=${tmp}`,
        `file://${htmlPath}`,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let output = '';
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // On macOS Chrome often stays alive after writing the PDF, so stop it ourselves.
      if (child.exitCode === null) child.kill('SIGKILL');
      fs.rm(profile, { recursive: true, force: true }, () => {});
      if (!err && fs.existsSync(tmp) && fs.statSync(tmp).size > 0) {
        fs.renameSync(tmp, pdfPath);
        resolve(pdfPath);
      } else {
        fs.rm(tmp, { force: true }, () => {});
        reject(err || new Error(`PDF export failed. ${output.slice(-300)}`));
      }
    };
    const onData = (d) => {
      output += d;
      if (/bytes written to file/.test(output)) finish();
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(
      () => finish(new Error('PDF export timed out after 60s.')),
      60000
    );
    child.on('error', (e) => finish(e));
    child.on('close', () => finish());
  });
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

/**
 * Per-run inputs a project declares in package.json under `dashboard.runInputs`:
 *   { key, label, type: 'text'|'email'|'tel'|'password'|'checkbox', placeholder?,
 *     hint?, pattern?, checkedValue?, secret?, scripts: [scriptName, ...] }
 * The dashboard shows them on the listed script rows and passes the values to
 * that run as environment variables (they win over the project's .env).
 * secret: true → masked in the run log and never remembered by the browser.
 */
function readRunInputs(projectId) {
  const pkgPath = path.join(PROJECTS_DIR, projectId, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const inputs = pkg.dashboard?.runInputs;
  if (!Array.isArray(inputs)) return [];
  return inputs.filter(
    (i) => i && /^[A-Z][A-Z0-9_]*$/.test(String(i.key || '')) && Array.isArray(i.scripts)
  );
}

/** Inputs for one script, without the `scripts` list (safe to send to the UI). */
function inputsForScript(allInputs, scriptName) {
  return allInputs
    .filter((i) => i.scripts.includes(scriptName))
    .map(({ scripts: _scripts, ...rest }) => rest);
}

/**
 * Validate UI-supplied values against the script's declared inputs.
 * Undeclared keys are rejected so the dashboard can't set arbitrary env vars.
 * Blank values are dropped, leaving .env / defaults in charge.
 * @returns {{ ok: true, env: Record<string, string> } | { ok: false, error: string }}
 */
function sanitizeRunEnv(projectId, script, rawEnv) {
  const env = {};
  if (!rawEnv || typeof rawEnv !== 'object') return { ok: true, env };
  const allowed = new Map(
    inputsForScript(readRunInputs(projectId), script).map((i) => [i.key, i])
  );
  for (const [key, raw] of Object.entries(rawEnv)) {
    const def = allowed.get(key);
    if (!def) return { ok: false, error: `${key} is not an input of ${script}` };
    const value = String(raw ?? '').trim();
    if (!value) continue;
    if (value.length > 200 || /[\r\n\0]/.test(value)) {
      return { ok: false, error: `${def.label || key} has an invalid value` };
    }
    if (def.pattern && !new RegExp(`^(?:${def.pattern})$`).test(value)) {
      return {
        ok: false,
        error: `${def.label || key}: ${def.hint || 'value does not match the expected format'}`,
      };
    }
    env[key] = value;
  }
  return { ok: true, env };
}

function listScripts(projectId) {
  const pkgPath = path.join(PROJECTS_DIR, projectId, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};
  const runInputs = readRunInputs(projectId);
  return Object.keys(scripts)
    .filter((k) => !HIDDEN_SCRIPTS.has(k))
    .map((name) => ({
      name,
      title: scriptTitle(name),
      group: scriptGroup(name),
      command: scripts[name],
      inputs: inputsForScript(runInputs, name),
      runnable:
        name.startsWith('test') ||
        name.startsWith('check:') ||
        name === 'report:open',
      selectable: name.startsWith('test'),
    }))
    .sort((a, b) => {
      const order = ['iOS', 'Android', 'Devices', 'Reports', 'Default', 'Other'];
      const ka = scriptSortKey(a.name);
      const kb = scriptSortKey(b.name);
      return (
        order.indexOf(a.group) - order.indexOf(b.group) ||
        ka.feature - kb.feature ||
        ka.base.localeCompare(kb.base) ||
        ka.rank - kb.rank
      );
    });
}

/**
 * Feature order inside each platform group (matched on the part after
 * `test:<platform>:`); anything not listed comes last, A–Z.
 */
const FEATURE_ORDER = [/^signin\b/, /^signup\b/, /^compose:practice\b/, /^compose:remedy\b/];

/**
 * Sort key for the Scripts panel:
 * - feature: sign in → sign up → compose practice → compose remedy → rest.
 * - base + rank keep a suite's variants together, in the order `…:positive`,
 *   `…:negative`, then the full suite (both specs), e.g.
 *   compose · practice · positive → · negative → compose · practice.
 * @param {string} name npm script name
 * @returns {{ feature: number, base: string, rank: number }}
 */
function scriptSortKey(name) {
  const rest = name.replace(/^test:(ios|android):?/, '');
  const idx = FEATURE_ORDER.findIndex((re) => re.test(rest));
  const feature = idx === -1 ? FEATURE_ORDER.length : idx;
  const m = name.match(/^(.*):(positive|negative)$/);
  if (m) {
    return { feature, base: m[1], rank: m[2] === 'positive' ? 0 : 1 };
  }
  return { feature, base: name, rank: 2 };
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

  if (scripts.includes('test:ios:appraisal')) {
    suites.push({
      id: 'ios-appraisal',
      title: 'iOS Create Appraisal',
      scripts: ['test:ios:appraisal'],
      description: 'TradeIn 4-step create appraisal (validation + photos)',
    });
  }

  if (scripts.includes('test:ios:history')) {
    suites.push({
      id: 'ios-history',
      title: 'iOS Appraisals History',
      scripts: ['test:ios:history'],
      description:
        'Side menu APPRAISALS HISTORY — My / All Appraisals cards and detail tabs (AP-HI-P01)',
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
    .map((d) => getProjectMeta(d.name))
    .filter(Boolean)
    .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
}

/**
 * Metadata for one project card / detail header (does not scan other projects).
 * @param {string} id
 */
function getProjectMeta(id) {
  if (!isRealProject(id)) return null;
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

  const sdk = resolveAndroidSdkEnv();
  if (!sdk.ANDROID_HOME) {
    return {
      ok: false,
      error:
        'ANDROID_HOME not found. Install Android Studio SDK (usually ~/Library/Android/sdk), then Start Appium again.',
      url: APPIUM_URL,
    };
  }

  appiumChild = spawn('appium', [], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    // Must include ANDROID_HOME — Appium UiAutomator2 reads it for session create
    env: childProcessEnv({ DASHBOARD_NO_OPEN: '1' }),
  });
  appiumChild.unref();

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const s = await checkAppium();
    if (s.running) {
      return { ok: true, started: true, androidHome: sdk.ANDROID_HOME, ...s };
    }
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
  const primaryReportUrl =
    activeRun.primaryReportUrl ||
    reports.find((r) => r.kind === 'latest')?.url ||
    reports[0]?.url ||
    null;
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
    primaryReportUrl,
    archivedReportName: activeRun.archivedReportName || null,
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
  // Already finalized (e.g. user Stop) — don't overwrite or double-save history
  if (activeRun.status !== 'running' && !statusOverride) return;

  activeRun.status =
    statusOverride || (code === 0 ? 'passed' : 'failed');
  activeRun.exitCode = code;
  activeRun.finishedAt = Date.now();
  activeRun.lines.push('');
  if (statusOverride === 'stopped') {
    activeRun.lines.push('— stopped by user (queue cleared) —');
  } else {
    activeRun.lines.push(`— finished with exit code ${code} —`);
  }

  // Snapshot HTML so this run's Report link never changes when the next run overwrites latest
  const archived = archiveLatestReport(activeRun.projectId, activeRun.id);
  const reports = listReports(activeRun.projectId);
  activeRun.reports = reports;
  const reportUrl =
    archived?.url ||
    reports.find((r) => r.kind === 'latest')?.url ||
    reports[0]?.url ||
    null;
  if (reportUrl) {
    activeRun.lines.push(`Report: ${reportUrl}`);
    if (archived?.name) {
      activeRun.lines.push(`Archived as: ${archived.name}`);
    }
  }
  activeRun.summary = parseSummaryFromLines(activeRun.lines);
  activeRun.primaryReportUrl = reportUrl;
  activeRun.archivedReportName = archived?.name || null;

  saveHistoryEntry({
    id: activeRun.id,
    projectId: activeRun.projectId,
    script: activeRun.script,
    status: activeRun.status,
    exitCode: activeRun.exitCode,
    startedAt: activeRun.startedAt,
    finishedAt: activeRun.finishedAt,
    durationMs: activeRun.finishedAt - activeRun.startedAt,
    primaryReportUrl: reportUrl,
    archivedReportName: archived?.name || null,
    summary: activeRun.summary,
  });
}

function pumpQueue() {
  if (activeRun && activeRun.status === 'running') return;
  const next = runQueue.shift();
  if (!next) return;
  beginScriptRun(next.projectId, next.script, {
    fromQueue: true,
    env: next.env,
    controlDeskBody: next.controlDeskBody,
  });
}

/**
 * Start immediately or enqueue if busy.
 * @param {Record<string, string>} [rawEnv] values from the script's run inputs
 */
/** Known step-4 photo captions. Anything else from the dashboard is dropped. */
const APPRAISAL_PHOTO_SLOTS = [
  'FRONT',
  'DRIVER FRONT',
  'DRIVER REAR',
  'REAR',
  'PASSENGER REAR',
  'PASSENGER FRONT',
];

const APPRAISAL_DAMAGE_SLOTS = [
  'DRIVER FRONT',
  'DRIVER REAR',
  'PASSENGER FRONT',
  'PASSENGER REAR',
  'EXTRA',
];

/**
 * Control Desk success run: env lists exactly the checked boxes (comma-separated).
 * Empty string means no gallery picks for that step.
 */
function normalizeSlotList(arr, order) {
  const allowed = new Set(order);
  const picked = (Array.isArray(arr) ? arr : [])
    .map((s) => String(s || '').trim().toUpperCase())
    .filter((s) => allowed.has(s));
  return order.filter((s) => picked.includes(s));
}

/** Persist Control Desk checkbox state for the success script (read by the test). */
function writeControlDeskAppraisalRun(projectId, body) {
  const cwd = path.join(PROJECTS_DIR, projectId);
  const file = path.join(cwd, '.control-desk-appraisal-run.json');
  const payload = {
    source: 'control-desk',
    writtenAt: Date.now(),
    tyreDamage: Boolean(body.tyreDamage),
    alloyDamage: Boolean(body.alloyDamage),
    vehiclePhotoSlots: [...APPRAISAL_PHOTO_SLOTS],
    damagePhotoSlots: normalizeSlotList(body.damagePhotoSlots, APPRAISAL_DAMAGE_SLOTS),
  };
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

function slotsEnvFromCheckboxes(arr, order, envKey) {
  const unique = normalizeSlotList(arr, order);
  return { [envKey]: unique.join(',') };
}

/**
 * Checked dashboard boxes → APPRAISEE_VEHICLE_SLOTS (non-success scripts: omit = no override).
 */
function photoSlotsEnv(photoSlots) {
  if (!Array.isArray(photoSlots) || photoSlots.length === 0) return {};
  return slotsEnvFromCheckboxes(photoSlots, APPRAISAL_PHOTO_SLOTS, 'APPRAISEE_VEHICLE_SLOTS');
}

function damageSlotsEnv(damagePhotoSlots) {
  if (!Array.isArray(damagePhotoSlots) || damagePhotoSlots.length === 0) return {};
  return slotsEnvFromCheckboxes(
    damagePhotoSlots,
    APPRAISAL_DAMAGE_SLOTS,
    'APPRAISEE_DAMAGE_SLOTS'
  );
}

/**
 * Control Desk options for test:ios:appraisal:success only.
 * Step 3 damage slots from checkboxes; step 4 vehicle photos are always all 6 in the test.
 */
function appraisalSuccessRunEnv(body) {
  return {
    ...slotsEnvFromCheckboxes(
      body.damagePhotoSlots,
      APPRAISAL_DAMAGE_SLOTS,
      'APPRAISEE_DAMAGE_SLOTS'
    ),
    APPRAISEE_TYRE_DAMAGE: body.tyreDamage ? 'true' : 'false',
    APPRAISEE_ALLOY_DAMAGE: body.alloyDamage ? 'true' : 'false',
    APPRAISEE_CONTROL_DESK: '1',
  };
}

function enqueueOrRun(projectId, script, extraEnv = {}, controlDeskBody = null) {
  if (!isRealProject(projectId)) {
    return { ok: false, error: `Unknown project: ${projectId}` };
  }
  const scripts = listScripts(projectId);
  const found = scripts.find((s) => s.name === script);
  if (!found) return { ok: false, error: `Unknown script: ${script}` };

  // Run-input fields are validated; APPRAISEE_* helper env is passed through for appraisal flows.
  const raw = extraEnv && typeof extraEnv === 'object' ? extraEnv : {};
  const appraisalEnv = {};
  const inputEnv = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('APPRAISEE_')) appraisalEnv[key] = value;
    else inputEnv[key] = value;
  }
  const checked = sanitizeRunEnv(projectId, script, inputEnv);
  if (!checked.ok) return checked;
  const env = { ...appraisalEnv, ...(checked.env || {}) };

  if (activeRun && activeRun.status === 'running') {
    runQueue.push({ projectId, script, env, controlDeskBody });
    return {
      ok: true,
      queued: true,
      position: runQueue.length,
      queue: runQueue.slice(),
      run: publicRun(),
    };
  }
  return beginScriptRun(projectId, script, { env, controlDeskBody });
}

function controlDeskBodyFromEnv(extraEnv) {
  if (extraEnv.APPRAISEE_CONTROL_DESK !== '1') return null;
  return {
    tyreDamage: extraEnv.APPRAISEE_TYRE_DAMAGE === 'true',
    alloyDamage: extraEnv.APPRAISEE_ALLOY_DAMAGE === 'true',
    damagePhotoSlots: String(extraEnv.APPRAISEE_DAMAGE_SLOTS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/**
 * @param {{ fromQueue?: boolean, env?: Record<string, string> }} [opts]
 *   env: already-sanitized run-input values, layered over process.env.
 */
function beginScriptRun(projectId, script, opts = {}) {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const cwd = path.join(PROJECTS_DIR, projectId);
  const runEnv = opts.env || {};
  const secretKeys = new Set(
    readRunInputs(projectId).filter((i) => i.secret).map((i) => i.key)
  );
  const envLines = Object.entries(runEnv).map(
    ([k, v]) => `env: ${k}=${secretKeys.has(k) ? '••••••' : v}`
  );
  const extraEnv = opts.env && typeof opts.env === 'object' ? opts.env : {};
  let deskPayload = null;
  if (script === 'test:ios:appraisal:success') {
    const body =
      opts.controlDeskBody ||
      controlDeskBodyFromEnv(extraEnv);
    if (body) {
      deskPayload = writeControlDeskAppraisalRun(projectId, body);
    }
  }
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
      ...envLines,
      '',
    ].filter(Boolean),
    reports: [],
    summary: null,
  };
  if (deskPayload) {
    activeRun.lines.push(
      `Control Desk: damage [${deskPayload.damagePhotoSlots.join(', ') || 'none'}] · vehicle [all 6 sides — automation]`
    );
  } else if (script === 'test:ios:appraisal:success') {
    activeRun.lines.push(
      'Control Desk: no photo options — using test defaults (all slots). Run from the success row Run button or restart Control Desk.'
    );
  }

  if (extraEnv.APPRAISEE_DAMAGE_SLOTS !== undefined) {
    activeRun.lines.push(
      extraEnv.APPRAISEE_DAMAGE_SLOTS
        ? `damage photos: ${extraEnv.APPRAISEE_DAMAGE_SLOTS}`
        : 'damage photos: (none — no checkboxes selected)'
    );
  }
  if (script === 'test:ios:appraisal:success') {
    activeRun.lines.push('vehicle photos: all 6 sides (fixed in automation)');
  }
  if (extraEnv.APPRAISEE_TYRE_DAMAGE !== undefined) {
    activeRun.lines.push(`tyres damage: ${extraEnv.APPRAISEE_TYRE_DAMAGE}`);
  }
  if (extraEnv.APPRAISEE_ALLOY_DAMAGE !== undefined) {
    activeRun.lines.push(`alloys damage: ${extraEnv.APPRAISEE_ALLOY_DAMAGE}`);
  }
  const deviceEnv = readProjectDeviceEnv(projectId);
  if (deviceEnv.IOS_DEVICE_UDID) {
    activeRun.lines.push(`iOS device UDID: ${deviceEnv.IOS_DEVICE_UDID}`);
  }
  if (deviceEnv.ANDROID_DEVICE_ID) {
    activeRun.lines.push(`Android device: ${deviceEnv.ANDROID_DEVICE_ID}`);
  }
  runChild = spawn('npm', ['run', script], {
    cwd,
    // Re-read project .env device ids on every run so the Control Desk picker
    // wins over any stale IOS_DEVICE_UDID / ANDROID_DEVICE_ID in the parent env.
    // Also inject ANDROID_HOME so Android sessions work when started from Control Desk.
    env: childProcessEnv({
      ...deviceEnv,
      ...runEnv,
      FORCE_COLOR: '0',
      ...extraEnv,
    }),
    shell: false,
    // New process group so Stop can kill npm + WDIO children together
    detached: process.platform !== 'win32',
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
    // If user already stopped, leave status as stopped
    if (activeRun && activeRun.status === 'running') {
      finishActiveRun(code);
    }
    runChild = null;
    setTimeout(pumpQueue, 400);
  });
  runChild.on('error', (err) => {
    if (activeRun && activeRun.status === 'running') {
      activeRun.lines.push(`Spawn error: ${err.message}`);
      finishActiveRun(1);
    }
    runChild = null;
    setTimeout(pumpQueue, 400);
  });

  return { ok: true, queued: false, run: publicRun(), queue: runQueue.slice() };
}

/**
 * Queue items may be script names or `{ script, tyreDamage, photoSlots, … }`
 * for test:ios:appraisal:success checkbox options.
 */
function normalizeQueuedScript(entry) {
  if (typeof entry === 'string') {
    return { script: entry, env: {}, controlDeskBody: null };
  }
  if (!entry || typeof entry !== 'object') {
    return { script: '', env: {}, controlDeskBody: null };
  }
  const script = String(entry.script || entry.name || '').trim();
  if (script === 'test:ios:appraisal:success') {
    return {
      script,
      env: appraisalSuccessRunEnv(entry),
      controlDeskBody: entry,
    };
  }
  return {
    script,
    env: photoSlotsEnv(entry.photoSlots),
    controlDeskBody: null,
  };
}

/**
 * @param {Record<string, Record<string, string>>} [envByScript] run-input values per script
 */
function enqueueMany(projectId, scripts, envByScript = {}) {
  const list = (scripts || [])
    .filter(Boolean)
    .map(normalizeQueuedScript)
    .filter((x) => x.script);
  if (!list.length) return { ok: false, error: 'No scripts provided' };
  const results = [];
  for (const item of list) {
    const mergedEnv = {
      ...(envByScript?.[item.script] || {}),
      ...(item.env || {}),
    };
    results.push(
      enqueueOrRun(projectId, item.script, mergedEnv, item.controlDeskBody)
    );
  }
  return {
    ok: results.every((r) => r.ok),
    results,
    queue: runQueue.slice(),
    run: publicRun(),
  };
}

/**
 * Stop the active npm/WDIO run and clear the queue.
 * Kills the whole process group so child test processes die too.
 */
function stopScriptRun() {
  runQueue = [];
  const child = runChild;
  const pid = child?.pid;

  if (pid) {
    try {
      // Negative PID = kill process group (npm + wdio + mocha)
      if (process.platform !== 'win32') {
        process.kill(-pid, 'SIGTERM');
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
    // Force-kill if still alive after 1.5s
    setTimeout(() => {
      try {
        if (process.platform !== 'win32') {
          process.kill(-pid, 'SIGKILL');
        }
      } catch {
        /* ignore */
      }
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* ignore */
      }
    }, 1500);
  }

  if (activeRun && activeRun.status === 'running') {
    finishActiveRun(null, 'stopped');
  }

  runChild = null;
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

/**
 * Soft tool check for the Setup panel (does not install anything).
 * @param {string} cmd
 * @returns {{ ok: boolean, detail: string }}
 */
function softCmdCheck(cmd) {
  try {
    const out = execSync(cmd, {
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .trim()
      .split('\n')[0];
    return { ok: true, detail: out || 'OK' };
  } catch {
    return { ok: false, detail: 'Not found' };
  }
}

/**
 * Machine readiness + guided steps for fresh-Mac bootstrap.
 * Wizard is interactive → dashboard opens Terminal; it does not answer prompts in the browser.
 */
function getSetupStatus() {
  const brew = softCmdCheck('brew --version');
  const node = softCmdCheck('node -v');
  const npm = softCmdCheck('npm -v');
  const xcode = softCmdCheck('xcodebuild -version');
  const appium = softCmdCheck('appium -v');

  let nodeOk = node.ok;
  if (node.ok) {
    const major = Number(String(node.detail).replace(/^v/, '').split('.')[0]);
    if (!Number.isFinite(major) || major < 18) {
      nodeOk = false;
      node.detail = `${node.detail} (need ≥ 18)`;
    }
  }

  const projects = listProjects().map((p) => {
    const envPath = path.join(PROJECTS_DIR, p.id, '.env');
    const hasEnv = fs.existsSync(envPath);
    return { id: p.id, name: p.displayName || p.id, hasEnv };
  });
  const projectsWithEnv = projects.filter((p) => p.hasEnv).length;

  const checks = [
    {
      id: 'brew',
      label: 'Homebrew',
      ok: brew.ok,
      detail: brew.ok ? brew.detail : 'Missing — bootstrap installs it',
    },
    {
      id: 'node',
      label: 'Node.js ≥ 18',
      ok: nodeOk,
      detail: node.ok ? node.detail : 'Missing — bootstrap installs it',
    },
    {
      id: 'npm',
      label: 'npm',
      ok: npm.ok,
      detail: npm.ok ? npm.detail : 'Comes with Node',
    },
    {
      id: 'xcode',
      label: 'Xcode / xcodebuild',
      ok: xcode.ok,
      detail: xcode.ok
        ? xcode.detail
        : 'Install from App Store, then open Xcode once',
    },
    {
      id: 'appium',
      label: 'Appium CLI',
      ok: appium.ok,
      detail: appium.ok ? `v${appium.detail}` : 'Wizard installs Appium + drivers',
    },
    {
      id: 'projects',
      label: 'Project .env files',
      ok: projects.length > 0 && projectsWithEnv > 0,
      detail:
        projects.length === 0
          ? 'No projects yet — create one in the wizard'
          : `${projectsWithEnv}/${projects.length} configured`,
    },
  ];

  const missingTools = checks.filter(
    (c) => !c.ok && ['brew', 'node', 'npm'].includes(c.id)
  ).length;
  const recommendBootstrap = missingTools > 0 || !nodeOk;

  return {
    root: ROOT,
    platform: process.platform,
    recommendBootstrap,
    bootstrapCommand: 'bash scripts/bootstrap.sh',
    setupCommand: 'npm run setup',
    fullBootstrap: `cd "${ROOT}" && bash scripts/bootstrap.sh`,
    fullSetup: `cd "${ROOT}" && npm run setup`,
    checks,
    projects,
    steps: [
      {
        title: 'Open setup in Terminal',
        body: recommendBootstrap
          ? 'Use Run bootstrap (recommended on a fresh Mac). It installs Homebrew + Node if needed, then starts the wizard.'
          : 'Node is already available. You can run npm setup, or still use bootstrap — both end in the same wizard.',
      },
      {
        title: 'Answer the wizard prompts',
        body: 'Language → Appium drivers → existing or new project → iOS/Android/Both → bundle ID / package → device → Apple Team ID (real iPhone) → optional credentials.',
      },
      {
        title: 'WebDriverAgent (real iPhone)',
        body: 'Allow the wizard to build & install WDA when offered. Fix Development signing for your Team ID if that step fails, then re-run setup.',
      },
      {
        title: 'Back to Control Desk',
        body: 'Start Appium from the header, refresh Devices, open your project, then run a smoke or sign-in suite.',
      },
    ],
    wizardAsks: [
      'Script language (JavaScript / TypeScript / Python)',
      'Install or verify Appium + XCUITest + UiAutomator2',
      'Configure an existing project or create a new one',
      'Platform: iOS / Android / Both',
      'iOS bundle ID and/or Android package',
      'App source path or git URL (optional)',
      'Connected device + Apple Team ID (iOS real device)',
      'Build WebDriverAgent on the phone',
      'Test credentials (optional)',
    ],
  };
}

/**
 * Open macOS Terminal in the repo and run bootstrap or setup.
 * Interactive prompts must be answered in Terminal — not in the browser.
 * @param {'bootstrap' | 'setup'} mode
 */
function openSetupInTerminal(mode = 'bootstrap') {
  const command =
    mode === 'setup'
      ? `cd "${ROOT}" && npm run setup`
      : `cd "${ROOT}" && bash scripts/bootstrap.sh`;

  if (process.platform !== 'darwin') {
    return {
      ok: false,
      error:
        'Auto-open Terminal is macOS-only. Copy the command below and run it in your shell.',
      command,
      mode,
    };
  }

  // AppleScript string escaping for do script "..."
  const escaped = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  // Wait for osascript so Automation / Terminal permission failures are visible
  // (not a silent "ok" while the other Mac shows a deny dialog).
  try {
    execSync(
      `osascript -e 'tell application "Terminal" to activate' -e 'tell application "Terminal" to do script "${escaped}"'`,
      { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return { ok: true, command, mode };
  } catch (err) {
    const detail = String(err.stderr || err.message || err).trim();
    return {
      ok: false,
      error:
        'Could not control Terminal (often macOS Automation permission). ' +
        'System Settings → Privacy & Security → Automation → allow Terminal for Node, ' +
        'or paste the command into Terminal yourself. ' +
        (detail ? `(${detail.slice(0, 180)})` : ''),
      command,
      mode,
      permissionHint: true,
    };
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
      return json(res, {
        ok: true,
        root: ROOT,
        host: HOST,
        port: PORT,
        /** Lets the UI detect a stale dashboard process (old code without Setup APIs). */
        features: { setup: true },
      });
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
      // Bust cache when the user clicks Refresh devices
      if (u.searchParams.get('refresh') === '1') {
        devicesCache = { at: 0, key: '', value: null };
      }
      return json(res, getDevicesStatus(projectId));
    }

    if (method === 'GET' && pathname === '/api/history') {
      return json(res, { history: loadHistory() });
    }

    if (method === 'GET' && pathname === '/api/setup') {
      return json(res, getSetupStatus());
    }

    if (method === 'POST' && pathname === '/api/setup/open-terminal') {
      const body = await readBody(req);
      const mode = body.mode === 'setup' ? 'setup' : 'bootstrap';
      return json(res, openSetupInTerminal(mode));
    }

    if (method === 'GET' && pathname === '/api/projects') {
      return json(res, { projects: listProjects() });
    }

    const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (method === 'GET' && projectMatch) {
      const id = decodeURIComponent(projectMatch[1]);
      if (!isRealProject(id)) return json(res, { error: 'Not found' }, 404);
      // Do not call getDevicesStatus here — xctrace is slow and the UI already
      // loads devices via /api/devices after the project panel opens.
      const meta = getProjectMeta(id);
      return json(res, {
        project: meta,
        scripts: listScripts(id),
        reports: listReports(id),
        suites: listSuites(id),
        env: checkProjectEnv(id),
      });
    }

    const envMatch = pathname.match(/^\/api\/projects\/([^/]+)\/env$/);
    if (method === 'GET' && envMatch) {
      const id = decodeURIComponent(envMatch[1]);
      return json(res, checkProjectEnv(id));
    }

    // Device-specific — pick which connected phone this project's tests use.
    const deviceEnvMatch = pathname.match(/^\/api\/projects\/([^/]+)\/env\/device$/);
    if (method === 'POST' && deviceEnvMatch) {
      const id = decodeURIComponent(deviceEnvMatch[1]);
      if (!isRealProject(id)) return json(res, { error: 'Not found' }, 404);
      const body = await readBody(req);
      const platform = String(body.platform || '').toLowerCase();
      if (platform === 'ios') {
        const udid = String(body.udid || body.id || '').trim();
        if (!/^[0-9A-Fa-f-]{8,64}$/.test(udid)) {
          return json(res, { ok: false, error: 'Invalid iOS UDID' }, 400);
        }
        writeEnvVar(id, 'IOS_DEVICE_UDID', udid);
        devicesCache = { at: 0, key: '', value: null };
        return json(res, { ok: true, platform: 'ios', udid });
      }
      if (platform === 'android') {
        const deviceId = String(body.deviceId || body.id || '').trim();
        if (!/^[A-Za-z0-9._:-]{2,64}$/.test(deviceId)) {
          return json(res, { ok: false, error: 'Invalid Android device id' }, 400);
        }
        writeEnvVar(id, 'ANDROID_DEVICE_ID', deviceId);
        devicesCache = { at: 0, key: '', value: null };
        return json(res, { ok: true, platform: 'android', deviceId });
      }
      return json(res, { ok: false, error: 'platform must be ios or android' }, 400);
    }

    const udidMatch = pathname.match(/^\/api\/projects\/([^/]+)\/env\/udid$/);
    if (method === 'POST' && udidMatch) {
      const id = decodeURIComponent(udidMatch[1]);
      if (!isRealProject(id)) return json(res, { error: 'Not found' }, 404);
      const body = await readBody(req);
      const udid = String(body.udid || '').trim();
      if (!/^[0-9A-Fa-f-]{8,64}$/.test(udid)) {
        return json(res, { ok: false, error: 'Invalid UDID' }, 400);
      }
      writeEnvVar(id, 'IOS_DEVICE_UDID', udid);
      devicesCache = { at: 0, key: '', value: null };
      return json(res, { ok: true, udid });
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

    // Same report as PDF (?download=1 forces a file download instead of inline view)
    const reportPdfMatch = pathname.match(/^\/project-reports\/([^/]+)\/([^/]+)\.pdf$/);
    if (method === 'GET' && reportPdfMatch) {
      const projectId = decodeURIComponent(reportPdfMatch[1]);
      const baseName = decodeURIComponent(reportPdfMatch[2]);
      const full = resolveReportFile(projectId, `${baseName}.html`);
      if (!full) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Report not found. Run a test first to generate it.');
        return;
      }
      try {
        const pdf = await reportToPdf(full);
        const disposition = u.searchParams.get('download') ? 'attachment' : 'inline';
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${disposition}; filename="${baseName}.pdf"`,
          'Content-Length': fs.statSync(pdf).size,
          'Cache-Control': 'no-store',
        });
        fs.createReadStream(pdf).pipe(res);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(String(e.message || e));
      }
      return;
    }

    if (method === 'POST' && pathname === '/api/run') {
      const body = await readBody(req);
      const script = String(body.script || '');
      return json(res, enqueueOrRun(String(body.projectId || ''), script));
    }

    if (method === 'POST' && pathname === '/api/run/many') {
      const body = await readBody(req);
      return json(
        res,
        enqueueMany(String(body.projectId || ''), body.scripts || [], body.envByScript)
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

/** True if `url` reaches this dashboard (not some other server with that name). */
function reachesDashboard(url) {
  return new Promise((resolve) => {
    const req = http.get(`${url}/api/health`, { timeout: 1000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(res.statusCode === 200 && JSON.parse(body).root === ROOT);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(false));
  });
}

/**
 * Browser URL: http://DOMAIN when port 80 is forwarded here, else
 * http://DOMAIN:PORT when the name maps to this Mac, else HOST:PORT.
 */
async function publicUrl() {
  const local = `http://${HOST}:${PORT}`;
  if (!DOMAIN) return local;
  for (const candidate of [`http://${DOMAIN}`, `http://${DOMAIN}:${PORT}`]) {
    if (await reachesDashboard(candidate)) return candidate;
  }
  return local;
}

server.listen(PORT, HOST, async () => {
  const url = await publicUrl();
  console.log('');
  console.log('  Automation Dashboard');
  console.log(`  ${url}`);
  if (DOMAIN && !url.includes(DOMAIN)) {
    console.log(`  (${DOMAIN} is not set up on this Mac — run: sudo bash dashboard/setup-local-domain.sh)`);
  }
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
  // Skip auto-open when launched by Control Desk.app (it opens the browser itself)
  if (!process.env.DASHBOARD_NO_OPEN) {
    try {
      spawn(openCmd, [url], { stdio: 'ignore', detached: true }).unref();
    } catch {
      /* ignore */
    }
  }
});

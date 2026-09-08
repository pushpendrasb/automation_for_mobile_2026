/**
 * Detect local tooling and connected mobile devices for setup wizards.
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Run a command and return trimmed stdout, or null on failure.
 * @param {string} command
 * @param {string[]} [args]
 * @returns {string|null}
 */
function runQuiet(command, args = []) {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) return null;
    return String(result.stdout || '').trim();
  } catch {
    return null;
  }
}

/**
 * @returns {boolean}
 */
function isMac() {
  return process.platform === 'darwin';
}

/**
 * @returns {{ node: string|null, npm: string|null, appium: string|null, xcode: string|null, adb: string|null }}
 */
function detectTools() {
  return {
    node: runQuiet('node', ['-v']),
    npm: runQuiet('npm', ['-v']),
    appium: runQuiet('appium', ['-v']),
    xcode: runQuiet('xcodebuild', ['-version'])?.split('\n')[0] || null,
    adb: runQuiet('adb', ['version'])?.split('\n')[0] || null,
  };
}

/**
 * List installed Appium drivers (names only).
 * @returns {string[]}
 */
function listAppiumDrivers() {
  const out = runQuiet('appium', ['driver', 'list', '--installed', '--json']);
  if (!out) return [];
  try {
    const parsed = JSON.parse(out);
    // Appium 2 returns { xcuitest: {...}, uiautomator2: {...} } or array shapes
    if (Array.isArray(parsed)) {
      return parsed.map((d) => d.name || d).filter(Boolean);
    }
    return Object.keys(parsed);
  } catch {
    const text = runQuiet('appium', ['driver', 'list', '--installed']) || '';
    const names = [];
    if (/xcuitest/i.test(text)) names.push('xcuitest');
    if (/uiautomator2/i.test(text)) names.push('uiautomator2');
    return names;
  }
}

/**
 * Parse physical iOS devices from `xcrun xctrace list devices`.
 * @returns {{ name: string, udid: string, os?: string }[]}
 */
function listIosDevices() {
  const out = runQuiet('xcrun', ['xctrace', 'list', 'devices']);
  if (!out) return [];

  const devices = [];
  const lines = out.split('\n');
  let section = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^==/.test(trimmed) || /Devices|Simulators/i.test(trimmed)) {
      section = trimmed.toLowerCase();
      continue;
    }
    // Skip simulators section
    if (section.includes('simulator')) continue;

    // e.g. "Pushpendra’s iPhone (18.3.1) (00008120-...)"
    const match = trimmed.match(/^(.+?)\s+\(([^)]+)\)\s+\(([0-9A-Fa-f-]+)\)$/);
    if (match) {
      const [, name, osOrBuild, udid] = match;
      // Filter out Mac hosts that sometimes appear
      if (/mac/i.test(name) && !/iphone|ipad/i.test(name)) continue;
      devices.push({ name: name.trim(), udid, os: osOrBuild });
      continue;
    }
    // Fallback: trailing UDID in parens
    const loose = trimmed.match(/^(.+?)\s+\(([0-9A-Fa-f-]{20,})\)$/);
    if (loose) {
      devices.push({ name: loose[1].trim(), udid: loose[2] });
    }
  }
  return devices;
}

/**
 * Connected Android devices via adb.
 * @returns {{ id: string, status: string }[]}
 */
function listAndroidDevices() {
  const out = runQuiet('adb', ['devices']);
  if (!out) return [];
  return out
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, status] = line.split(/\s+/);
      return { id, status: status || 'unknown' };
    })
    .filter((d) => d.status === 'device');
}

/**
 * Ensure a global npm package is installed.
 * @param {string} pkg
 * @returns {boolean} true if installed or already present
 */
function ensureGlobalNpmPackage(pkg) {
  const check = runQuiet('npm', ['list', '-g', pkg, '--depth=0']);
  if (check && !/empty|extraneous/i.test(check) && check.includes(pkg)) {
    return true;
  }
  console.log(`\nInstalling ${pkg} globally (may need network)…`);
  const result = spawnSync('npm', ['install', '-g', pkg], {
    stdio: 'inherit',
    shell: false,
  });
  return result.status === 0;
}

/**
 * Ensure an Appium driver is installed.
 * @param {string} driverName
 * @returns {boolean}
 */
function ensureAppiumDriver(driverName) {
  const installed = listAppiumDrivers().map((n) => n.toLowerCase());
  if (installed.some((n) => n.includes(driverName.toLowerCase()))) {
    console.log(`  ✓ Appium driver already installed: ${driverName}`);
    return true;
  }
  console.log(`  Installing Appium driver: ${driverName}…`);
  const result = spawnSync('appium', ['driver', 'install', driverName], {
    stdio: 'inherit',
  });
  return result.status === 0;
}

/**
 * Repo root (automation_for_mobile_2026).
 * @returns {string}
 */
function repoRoot() {
  return path.resolve(__dirname, '..', '..');
}

/**
 * @param {string} projectId
 * @returns {string}
 */
function projectDir(projectId) {
  return path.join(repoRoot(), 'projects', projectId);
}

/**
 * List project folder names under projects/ (skips _template and hidden).
 * @returns {string[]}
 */
function listProjects() {
  const dir = path.join(repoRoot(), 'projects');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();
}

/**
 * @param {string} command
 * @returns {string}
 */
function execOrThrow(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

module.exports = {
  isMac,
  detectTools,
  listAppiumDrivers,
  listIosDevices,
  listAndroidDevices,
  ensureGlobalNpmPackage,
  ensureAppiumDriver,
  repoRoot,
  projectDir,
  listProjects,
  runQuiet,
  execOrThrow,
  homedir: () => os.homedir(),
};

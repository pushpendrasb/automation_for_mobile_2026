/**
 * Build + install WebDriverAgent during Mac setup so the first iOS test
 * does not fail with xcodebuild code 65 / "Unable to launch WebDriverAgent".
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { runQuiet } = require('./detect');

/**
 * Locate Appium's bundled WebDriverAgent.xcodeproj.
 * @returns {string|null}
 */
function findWdaProject() {
  const home = os.homedir();
  const candidates = [
    path.join(
      home,
      '.appium/node_modules/appium-xcuitest-driver/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj',
    ),
  ];
  // Fallback: search shallow under ~/.appium
  const appiumRoot = path.join(home, '.appium');
  if (fs.existsSync(appiumRoot)) {
    const walk = (dir, depth) => {
      if (depth > 6) return;
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === 'WebDriverAgent.xcodeproj') {
            candidates.push(full);
            return;
          }
          if (e.name === 'node_modules' || e.name.startsWith('.')) {
            walk(full, depth + 1);
          } else {
            walk(full, depth + 1);
          }
        }
      }
    };
    walk(appiumRoot, 0);
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Default DerivedData folder for WDA builds.
 * @returns {string}
 */
function defaultDerivedDataPath() {
  return path.join(
    os.homedir(),
    'Library/Developer/Xcode/DerivedData/WebDriverAgent-automation',
  );
}

/**
 * @param {{
 *   udid: string,
 *   teamId: string,
 *   signingId?: string,
 *   derivedDataPath?: string,
 * }} opts
 * @returns {{
 *   ok: boolean,
 *   derivedDataPath?: string,
 *   wdaBundleId?: string,
 *   error?: string,
 *   logTail?: string,
 * }}
 */
function buildAndInstallWda(opts) {
  const udid = String(opts.udid || '').trim();
  const teamId = String(opts.teamId || '').trim();
  const signingId = opts.signingId || 'Apple Development';
  const derivedDataPath = opts.derivedDataPath || defaultDerivedDataPath();

  if (!udid || !teamId) {
    return {
      ok: false,
      error: 'IOS_DEVICE_UDID and IOS_TEAM_ID are required to prepare WebDriverAgent.',
    };
  }

  const wdaProject = findWdaProject();
  if (!wdaProject) {
    return {
      ok: false,
      error:
        'WebDriverAgent.xcodeproj not found. Install Appium XCUITest driver first (setup tooling step).',
    };
  }

  const wdaDir = path.dirname(wdaProject);
  fs.mkdirSync(derivedDataPath, { recursive: true });

  console.log('\n=== Prepare WebDriverAgent (required for real iPhone) ===');
  console.log(`  Project: ${wdaProject}`);
  console.log(`  Device:  ${udid}`);
  console.log(`  Team:    ${teamId}`);
  console.log('  Building + installing WDA (1–3 minutes)…');

  const build = spawnSync(
    'xcodebuild',
    [
      '-project',
      'WebDriverAgent.xcodeproj',
      '-scheme',
      'WebDriverAgentRunner',
      '-destination',
      `id=${udid}`,
      '-derivedDataPath',
      derivedDataPath,
      '-allowProvisioningUpdates',
      `DEVELOPMENT_TEAM=${teamId}`,
      'CODE_SIGN_STYLE=Automatic',
      `CODE_SIGN_IDENTITY=${signingId}`,
      'build-for-testing',
    ],
    {
      cwd: wdaDir,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  const combined = `${build.stdout || ''}\n${build.stderr || ''}`;
  if (build.status !== 0 || !/TEST BUILD SUCCEEDED|BUILD SUCCEEDED/i.test(combined)) {
    const tail = combined.split('\n').slice(-40).join('\n');
    return {
      ok: false,
      derivedDataPath,
      error:
        'WebDriverAgent xcodebuild failed (often missing Apple Development cert for this Team ID, or phone not trusted / Developer Mode off).',
      logTail: tail,
    };
  }

  const appPath = path.join(
    derivedDataPath,
    'Build/Products/Debug-iphoneos/WebDriverAgentRunner-Runner.app',
  );
  if (!fs.existsSync(appPath)) {
    return {
      ok: false,
      derivedDataPath,
      error: `WDA build finished but app missing at ${appPath}`,
    };
  }

  const install = spawnSync(
    'xcrun',
    ['devicectl', 'device', 'install', 'app', '--device', udid, appPath],
    { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 },
  );
  if (install.status !== 0) {
    return {
      ok: false,
      derivedDataPath,
      error: `WDA built but install failed: ${(install.stderr || install.stdout || '').slice(0, 500)}`,
    };
  }

  console.log('  ✓ WebDriverAgent installed on the device');
  console.log('  → Unlock phone and trust Developer / WDA if iOS asks');

  return {
    ok: true,
    derivedDataPath,
    wdaBundleId: 'com.facebook.WebDriverAgentRunner',
  };
}

/**
 * Whether this env update set looks like a real-device iOS target needing WDA.
 * @param {Record<string, string>} updates
 * @returns {boolean}
 */
function needsWdaSetup(updates) {
  return Boolean(
    updates &&
      String(updates.IOS_DEVICE_UDID || '').trim() &&
      String(updates.IOS_TEAM_ID || '').trim(),
  );
}

module.exports = {
  findWdaProject,
  defaultDerivedDataPath,
  buildAndInstallWda,
  needsWdaSetup,
  runQuiet,
};

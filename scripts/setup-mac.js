#!/usr/bin/env node
/**
 * Interactive Mac setup for Appium + project .env configuration.
 *
 * Usage:
 *   node scripts/setup-mac.js
 *   node scripts/setup-mac.js --project vetpal
 *   npm run setup
 *
 * On a Mac with no Node yet, use:  bash scripts/bootstrap.sh
 */
const fs = require('fs');
const path = require('path');

const { ask, askChoice, askYesNo } = require('./lib/prompt');
const {
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
} = require('./lib/detect');
const { writeProjectEnv } = require('./lib/env');
const {
  askScriptLanguage,
  normalizeLanguage,
  languageLabel,
} = require('./lib/language');
const {
  installForLanguage,
  firstTestCommand,
  deviceCheckCommand,
  detectProjectLanguage,
} = require('./lib/installLanguage');
const { askPlatformAndAppIds } = require('./lib/platformIds');
const { buildAndInstallWda, needsWdaSetup } = require('./lib/wdaSetup');

/**
 * Parse simple CLI flags.
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ project?: string, skipTools?: boolean, yes?: boolean, language?: string }} */
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--project' && argv[i + 1]) {
      opts.project = argv[++i];
    } else if (a === '--skip-tools') {
      opts.skipTools = true;
    } else if (a === '--yes' || a === '-y') {
      opts.yes = true;
    } else if ((a === '--language' || a === '--lang') && argv[i + 1]) {
      opts.language = String(argv[++i]).toLowerCase();
    }
  }
  return opts;
}

/**
 * Install / verify Node-side Appium tooling.
 */
function installAppiumStack() {
  console.log('\n=== Appium tooling ===');
  const tools = detectTools();
  if (!tools.node) {
    console.error('Node.js is not available. Run: bash scripts/bootstrap.sh');
    process.exit(1);
  }
  console.log(`  Node  ${tools.node}`);
  console.log(`  npm   ${tools.npm || '?'}`);

  if (!ensureGlobalNpmPackage('appium')) {
    console.error('Failed to install Appium globally. Try: npm install -g appium');
    process.exit(1);
  }
  const appiumVer = detectTools().appium;
  console.log(`  Appium ${appiumVer || '(installed)'}`);

  const driversOk =
    ensureAppiumDriver('xcuitest') && ensureAppiumDriver('uiautomator2');
  if (!driversOk) {
    console.error('Failed to install one or more Appium drivers.');
    process.exit(1);
  }
  console.log(`  Drivers: ${listAppiumDrivers().join(', ') || 'xcuitest, uiautomator2'}`);
}

/**
 * Read default bundle id from JS project.config.js or Python project_config.py.
 * @param {string} pDir
 * @returns {{ bundle: string, packageName: string }}
 */
function readDefaultIds(pDir) {
  const configPath = path.join(pDir, 'project.config.js');
  try {
    delete require.cache[require.resolve(configPath)];
    const config = require(configPath);
    const bundle = config.defaults?.ios?.bundleId || 'com.example.app';
    const packageName = config.defaults?.android?.appPackage || bundle;
    return { bundle, packageName };
  } catch {
    // Python template
  }

  const pyPath = path.join(pDir, 'project_config.py');
  if (fs.existsSync(pyPath)) {
    const text = fs.readFileSync(pyPath, 'utf8');
    const m = text.match(/BUNDLE_ID\s*=\s*["']([^"']+)["']/);
    if (m) {
      return { bundle: m[1], packageName: m[1] };
    }
  }

  const envExample = path.join(pDir, '.env.example');
  if (fs.existsSync(envExample)) {
    const text = fs.readFileSync(envExample, 'utf8');
    const m = text.match(/^IOS_BUNDLE_ID=(.+)$/m);
    if (m && m[1].trim() && !m[1].includes('__')) {
      return { bundle: m[1].trim(), packageName: m[1].trim() };
    }
  }

  return { bundle: 'com.example.app', packageName: 'com.example.app' };
}

/**
 * Pick or create a project folder under projects/.
 * @param {string|undefined} preferred
 * @param {import('./lib/language').ScriptLanguage} scriptLanguage
 * @returns {Promise<{
 *   projectId: string,
 *   platform?: import('./lib/platformIds').TargetPlatform,
 *   iosBundleId?: string,
 *   androidPackage?: string,
 * }>}
 */
async function resolveProject(preferred, scriptLanguage) {
  const projects = listProjects();
  if (preferred) {
    const p = projectDir(preferred);
    if (!fs.existsSync(p)) {
      console.error(`Project not found: ${preferred}`);
      process.exit(1);
    }
    return { projectId: preferred };
  }

  console.log('\n=== Project ===');
  const action = await askChoice('What do you want to do?', [
    'Configure an existing project (.env + install deps)',
    'Create a new project from template, then configure it',
  ]);

  if (action.startsWith('Create')) {
    const { createProject } = require('./new-project');
    const created = await createProject({
      skipLanguageAsk: true,
      skipInstall: true,
      scriptLanguage,
    });
    return {
      projectId: created.id,
      platform: created.platform,
      iosBundleId: created.iosBundleId,
      androidPackage: created.androidPackage,
    };
  }

  if (!projects.length) {
    console.log('No projects found. Creating one from template…');
    const { createProject } = require('./new-project');
    const created = await createProject({
      skipLanguageAsk: true,
      skipInstall: true,
      scriptLanguage,
    });
    return {
      projectId: created.id,
      platform: created.platform,
      iosBundleId: created.iosBundleId,
      androidPackage: created.androidPackage,
    };
  }

  const projectId = await askChoice('Select project', projects);
  return { projectId };
}

/**
 * Collect device + credential values for .env.
 * @param {string} projectId
 * @param {{
 *   scriptLanguage?: string,
 *   platform?: import('./lib/platformIds').TargetPlatform,
 *   iosBundleId?: string,
 *   androidPackage?: string,
 * }} [extra]
 */
async function collectEnvUpdates(projectId, extra = {}) {
  const pDir = projectDir(projectId);
  const { bundle: defaultBundle, packageName: defaultPackage } =
    readDefaultIds(pDir);

  // Platform first, then only the matching app id fields.
  // If create-project already asked, reuse those answers (do not ask again).
  const alreadyAsked = Boolean(
    extra.platform && (extra.iosBundleId || extra.androidPackage),
  );
  const ids = alreadyAsked
    ? {
        platform: /** @type {import('./lib/platformIds').TargetPlatform} */ (
          extra.platform
        ),
        iosBundleId: extra.iosBundleId || defaultBundle,
        androidPackage: extra.androidPackage || defaultPackage || defaultBundle,
      }
    : await askPlatformAndAppIds(projectId, {
        platform: extra.platform,
        iosBundleId: extra.iosBundleId || defaultBundle,
        androidPackage: extra.androidPackage || defaultPackage || defaultBundle,
        defaultBundle,
      });

  const platform = ids.platform;

  /** @type {Record<string, string>} */
  const updates = {
    AUTOMATION_SCRIPT_LANGUAGE: extra.scriptLanguage || 'javascript',
    APPIUM_HOST: '127.0.0.1',
    APPIUM_PORT: '4723',
    APPIUM_SHOW_XCODE_LOG: 'true',
    IOS_BUNDLE_ID: ids.iosBundleId,
    ANDROID_APP_PACKAGE: ids.androidPackage,
    IOS_XCODE_SIGNING_ID: 'Apple Development',
    IOS_APP_PATH: '',
    ANDROID_APP_PATH: '',
    ANDROID_APP_ACTIVITY: '',
    IOS_DEVICE_NAME: 'iPhone 16',
    IOS_PLATFORM_VERSION: '18.0',
    IOS_REAL_PLATFORM_VERSION: '',
  };

  if (extra.scriptLanguage === 'python') {
    updates.PYTEST_PLATFORM =
      platform === 'Android' ? 'android' : 'ios';
  }

  if (platform === 'iOS' || platform === 'Both') {
    console.log('\n=== iOS device ===');
    const iosDevices = listIosDevices();
    if (iosDevices.length) {
      const labels = iosDevices.map(
        (d) => `${d.name}${d.os ? ` (${d.os})` : ''} — ${d.udid}`,
      );
      labels.push('Enter UDID manually');
      labels.push('Skip (simulator / fill later)');
      const pick = await askChoice('Select iPhone / iPad', labels, 0);
      if (pick === 'Enter UDID manually') {
        updates.IOS_DEVICE_UDID = await ask('iOS device UDID');
      } else if (pick === 'Skip (simulator / fill later)') {
        updates.IOS_DEVICE_UDID = '';
      } else {
        const idx = labels.indexOf(pick);
        updates.IOS_DEVICE_UDID = iosDevices[idx].udid;
      }
    } else {
      console.log('  No physical iOS devices detected via xctrace.');
      updates.IOS_DEVICE_UDID = await ask(
        'iOS device UDID (leave blank for simulator)',
        '',
      );
    }

    if (updates.IOS_DEVICE_UDID) {
      console.log(`
  Apple Team ID (required for real-device tests)
  ---------------------------------------------
  Xcode → Settings → Accounts does NOT show a field named "Membership ID".

  Easiest place to copy it (what you already found):
    1. Open https://developer.apple.com/account
    2. Sign in with the same Apple ID used in Xcode
    3. Membership details → copy Team ID (10 characters, e.g. AB12CD34EF)

  Also OK:
    • Apple Developer app / portal → Membership → Team ID
    • Or ask your Apple Developer Admin for the Team ID for "Smooglei Ltd"

  Paste that Team ID below (not the membership expiry date / not your email).
`);
      updates.IOS_TEAM_ID = await ask('Apple Team ID (10 characters)');
      if (!updates.IOS_TEAM_ID) {
        console.warn(
          '  Warning: empty IOS_TEAM_ID usually causes WebDriverAgent signing failures on a real iPhone.',
        );
      } else if (!/^[A-Z0-9]{10}$/i.test(String(updates.IOS_TEAM_ID).trim())) {
        console.warn(
          '  Warning: Team ID is usually exactly 10 letters/numbers. Double-check developer.apple.com → Membership details.',
        );
      }
    } else {
      updates.IOS_TEAM_ID = await ask('Apple Team ID (optional for simulator)', '');
    }

    if (!alreadyAsked) {
      // IDs already collected above via askPlatformAndAppIds
    }

    const appInstalled = await askYesNo(
      `Is the iOS app already installed on the device as ${updates.IOS_BUNDLE_ID}?`,
      true,
    );
    if (!appInstalled) {
      updates.IOS_APP_PATH = await ask('Path to .app or .ipa (optional)', '');
    }
  }

  if (platform === 'Android' || platform === 'Both') {
    console.log('\n=== Android device ===');
    const androidDevices = listAndroidDevices();
    if (androidDevices.length) {
      const labels = androidDevices.map((d) => `${d.id} (${d.status})`);
      labels.push('Use first connected device (leave ANDROID_DEVICE_ID empty)');
      labels.push('Enter serial manually');
      const pick = await askChoice('Select Android device', labels, 0);
      if (pick.startsWith('Use first')) {
        updates.ANDROID_DEVICE_ID = '';
      } else if (pick === 'Enter serial manually') {
        updates.ANDROID_DEVICE_ID = await ask('Android device serial');
      } else {
        updates.ANDROID_DEVICE_ID = pick.split(' ')[0];
      }
    } else {
      console.log('  No adb devices found (is USB debugging on?).');
      updates.ANDROID_DEVICE_ID = await ask('Android device serial (optional)', '');
    }

    updates.ANDROID_APP_ACTIVITY = await ask(
      'Android app activity (blank = wait for any)',
      '',
    );

    const apkInstalled = await askYesNo(
      `Is the Android app already installed as ${updates.ANDROID_APP_PACKAGE}?`,
      true,
    );
    if (!apkInstalled) {
      updates.ANDROID_APP_PATH = await ask('Path to .apk (optional)', '');
    }
  }

  console.log('\n=== Test credentials (optional — you can edit .env later) ===');
  // Project-specific common keys
  if (projectId === 'vetpal') {
    updates.VETPAL_COUNTRY_CODE = await ask('Country code', '+353');
    updates.VETPAL_TEST_MOBILE = await ask('Test mobile (no country code)', '');
    updates.VETPAL_TEST_PASSWORD = await ask('Test password', '');
  } else if (projectId === 'roskids') {
    updates.ROS_KIDS_TEST_EMAIL = await ask('Test email', '');
    updates.ROS_KIDS_TEST_PASSWORD = await ask('Test password', '');
  } else {
    const addCreds = await askYesNo('Add generic TEST_USER / TEST_PASSWORD to .env?', false);
    if (addCreds) {
      updates.TEST_USER = await ask('TEST_USER', '');
      updates.TEST_PASSWORD = await ask('TEST_PASSWORD', '');
    }
  }

  return updates;
}

/**
 * Print next steps after setup.
 * @param {string} projectId
 * @param {import('./lib/language').ScriptLanguage} scriptLanguage
 */
function printNextSteps(projectId, scriptLanguage) {
  const pDir = projectDir(projectId);
  const detected = detectProjectLanguage(pDir);
  const lang =
    detected === 'unknown' ? scriptLanguage : /** @type {typeof scriptLanguage} */ (detected);
  const testCmd = firstTestCommand(pDir, lang);
  const checkCmd = deviceCheckCommand(pDir, lang);
  console.log(`
========================================
Setup complete for: ${projectId}
Language: ${languageLabel(lang)}
========================================

Next steps:

  1. Start Appium (keep this running):
       appium

  2. In another terminal:
       cd ${pDir}
       ${checkCmd}
       ${testCmd}

  3. If iOS fails with signing / WebDriverAgent:
       - Re-run setup so it can rebuild WDA, or fix Team ID / Development cert first
       - IOS_TEAM_ID must match the team that can sign apps on this Mac
       - Trust this Mac on the phone + Developer Mode ON
       - Xcode → Settings → Accounts → Download Manual Profiles

Docs: ${path.join(repoRoot(), 'SETUP.md')}
`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('Mobile automation — Mac setup wizard');
  console.log(`Repo: ${repoRoot()}`);

  if (!isMac()) {
    console.warn(
      '\nWarning: this host is not macOS. iOS (XCUITest) will not work here; Android may still work.\n',
    );
  } else {
    const tools = detectTools();
    if (!tools.xcode) {
      console.warn(
        '\nWarning: xcodebuild not found. Install Xcode + CLT before iOS real-device runs.\n',
      );
    } else {
      console.log(`Xcode: ${tools.xcode}`);
    }
  }

  // Language first — scaffolds JS / TS / Python templates accordingly.
  /** @type {import('./lib/language').ScriptLanguage} */
  let scriptLanguage = 'javascript';
  if (opts.language) {
    const normalized = normalizeLanguage(opts.language);
    if (!normalized) {
      console.error(
        `Unknown --language ${opts.language}. Use javascript, typescript, or python.`,
      );
      process.exit(1);
    }
    scriptLanguage = normalized;
    console.log(`\nScript language: ${languageLabel(scriptLanguage)} (--language flag)`);
  } else if (opts.yes) {
    scriptLanguage = 'javascript';
    console.log('\nScript language: JavaScript (default with --yes)');
  } else {
    scriptLanguage = await askScriptLanguage({});
  }

  if (!opts.skipTools) {
    const doTools = opts.yes
      ? true
      : await askYesNo('Install/verify Appium + XCUITest + UiAutomator2?', true);
    if (doTools) installAppiumStack();
  }

  const resolved = await resolveProject(opts.project, scriptLanguage);
  const projectId = resolved.projectId;
  const pDir = projectDir(projectId);
  const detected = detectProjectLanguage(pDir);
  if (
    detected !== 'unknown' &&
    detected !== scriptLanguage &&
    opts.project
  ) {
    console.log(
      `\nNote: projects/${projectId} looks like ${detected}; ` +
        `installing that stack (your language choice was ${scriptLanguage}).`,
    );
  }
  const effectiveLanguage =
    detected === 'unknown' ? scriptLanguage : /** @type {typeof scriptLanguage} */ (detected);

  const updates = await collectEnvUpdates(projectId, {
    scriptLanguage: effectiveLanguage,
    platform: resolved.platform,
    iosBundleId: resolved.iosBundleId,
    androidPackage: resolved.androidPackage,
  });

  // Real iPhone: build+install WebDriverAgent DURING setup (before first test).
  if (isMac() && needsWdaSetup(updates)) {
    const doWda = opts.yes
      ? true
      : await askYesNo(
          'Prepare WebDriverAgent on this iPhone now? (needed before the first test)',
          true,
        );
    if (doWda) {
      const wda = buildAndInstallWda({
        udid: updates.IOS_DEVICE_UDID,
        teamId: updates.IOS_TEAM_ID,
        signingId: updates.IOS_XCODE_SIGNING_ID || 'Apple Development',
      });
      if (wda.ok) {
        updates.IOS_USE_PREBUILT_WDA = 'true';
        updates.IOS_WDA_DERIVED_DATA_PATH = wda.derivedDataPath || '';
        updates.IOS_WDA_BUNDLE_ID =
          wda.wdaBundleId || 'com.facebook.WebDriverAgentRunner';
      } else {
        console.error(`\n  ✗ ${wda.error}`);
        if (wda.logTail) {
          console.error('\n--- xcodebuild (last lines) ---');
          console.error(wda.logTail);
          console.error('--------------------------------\n');
        }
        console.error(`
  Fix, then re-run setup (or only WDA):
    • Xcode → Settings → Accounts → your Appraisee/Smooglei team
    • Manage Certificates → Apple Development for Team ${updates.IOS_TEAM_ID}
    • Download Manual Profiles
    • Phone: Trust this Mac + Developer Mode ON + unlocked
    • Then: npm run setup -- --project ${projectId} --skip-tools
`);
        const cont = opts.yes
          ? false
          : await askYesNo('Continue setup without WDA? (iOS tests will fail until WDA works)', false);
        if (!cont) {
          process.exit(1);
        }
      }
    }
  }

  const envPath = writeProjectEnv({
    projectPath: pDir,
    updates,
  });
  console.log(`\nWrote ${envPath}`);
  console.log(`Script language recorded: ${effectiveLanguage}`);

  const installPrompt =
    effectiveLanguage === 'python'
      ? `Create .venv + pip install in projects/${projectId}?`
      : `Run npm install in projects/${projectId}?`;
  const doInstall = opts.yes ? true : await askYesNo(installPrompt, true);
  if (doInstall) installForLanguage(pDir, effectiveLanguage);

  printNextSteps(projectId, effectiveLanguage);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  main,
  installAppiumStack,
  collectEnvUpdates,
  readDefaultIds,
  buildAndInstallWda: require('./lib/wdaSetup').buildAndInstallWda,
};

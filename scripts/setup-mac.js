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
const { spawnSync } = require('child_process');

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
const { askScriptLanguage } = require('./lib/language');

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
 * Pick or create a project folder under projects/.
 * @param {string|undefined} preferred
 */
async function resolveProject(preferred) {
  const projects = listProjects();
  if (preferred) {
    const p = projectDir(preferred);
    if (!fs.existsSync(p)) {
      console.error(`Project not found: ${preferred}`);
      process.exit(1);
    }
    return preferred;
  }

  console.log('\n=== Project ===');
  const action = await askChoice('What do you want to do?', [
    'Configure an existing project (.env + npm install)',
    'Create a new project from template, then configure it',
  ]);

  if (action.startsWith('Create')) {
    const { createProject } = require('./new-project');
    const id = await createProject({ skipLanguageAsk: true, skipInstall: true });
    return id;
  }

  if (!projects.length) {
    console.log('No projects found. Creating one from template…');
    const { createProject } = require('./new-project');
    return createProject({ skipLanguageAsk: true, skipInstall: true });
  }

  return askChoice('Select project', projects);
}

/**
 * Collect device + credential values for .env.
 * @param {string} projectId
 * @param {{ scriptLanguage?: string }} [extra]
 */
async function collectEnvUpdates(projectId, extra = {}) {
  const pDir = projectDir(projectId);
  const configPath = path.join(pDir, 'project.config.js');
  /** @type {{ defaults?: { ios?: { bundleId?: string }, android?: { appPackage?: string } } }} */
  let config = {};
  try {
    // Fresh require each time
    delete require.cache[require.resolve(configPath)];
    config = require(configPath);
  } catch {
    config = {};
  }

  const defaultBundle = config.defaults?.ios?.bundleId || 'com.example.app';
  const defaultPackage = config.defaults?.android?.appPackage || defaultBundle;

  console.log('\n=== Platforms ===');
  const platform = await askChoice('Which platform(s) will you run?', [
    'iOS',
    'Android',
    'Both',
  ]);

  /** @type {Record<string, string>} */
  const updates = {
    AUTOMATION_SCRIPT_LANGUAGE: extra.scriptLanguage || 'javascript',
    APPIUM_HOST: '127.0.0.1',
    APPIUM_PORT: '4723',
    APPIUM_SHOW_XCODE_LOG: 'true',
    IOS_BUNDLE_ID: defaultBundle,
    ANDROID_APP_PACKAGE: defaultPackage,
    IOS_XCODE_SIGNING_ID: 'Apple Development',
    IOS_APP_PATH: '',
    ANDROID_APP_PATH: '',
    ANDROID_APP_ACTIVITY: '',
    IOS_DEVICE_NAME: 'iPhone 16',
    IOS_PLATFORM_VERSION: '18.0',
    IOS_REAL_PLATFORM_VERSION: '',
  };

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
      console.log(
        '\n  Tip: Xcode → Settings → Accounts → Team → copy Team ID (10 chars).',
      );
      updates.IOS_TEAM_ID = await ask('Apple Team ID (required for real device WDA)');
      if (!updates.IOS_TEAM_ID) {
        console.warn(
          '  Warning: empty IOS_TEAM_ID usually causes “membership / signing” WDA failures.',
        );
      }
    } else {
      updates.IOS_TEAM_ID = await ask('Apple Team ID (optional for simulator)', '');
    }

    const bundle = await ask('iOS bundle ID', defaultBundle);
    updates.IOS_BUNDLE_ID = bundle;
    updates.ANDROID_APP_PACKAGE = defaultPackage || bundle;

    const appInstalled = await askYesNo(
      `Is the app already installed on the device as ${updates.IOS_BUNDLE_ID}?`,
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

    updates.ANDROID_APP_PACKAGE = await ask(
      'Android app package',
      updates.ANDROID_APP_PACKAGE || defaultPackage,
    );
    updates.ANDROID_APP_ACTIVITY = await ask(
      'Android app activity (blank = wait for any)',
      '',
    );

    const apkInstalled = await askYesNo(
      `Is the app already installed as ${updates.ANDROID_APP_PACKAGE}?`,
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
 * npm install inside the project folder.
 * @param {string} projectId
 */
function npmInstallProject(projectId) {
  const cwd = projectDir(projectId);
  console.log(`\n=== npm install (${projectId}) ===`);
  const result = spawnSync('npm', ['install'], { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error('npm install failed. Fix errors, then re-run setup.');
    process.exit(1);
  }
}

/**
 * Print next steps after setup.
 * @param {string} projectId
 */
function printNextSteps(projectId) {
  const pDir = projectDir(projectId);
  console.log(`
========================================
Setup complete for: ${projectId}
========================================

Next steps:

  1. Start Appium (keep this running):
       appium

  2. In another terminal:
       cd ${pDir}
       npm run check:devices:ios      # or :android
       npm run test:ios:signin        # adjust script for your project

  3. If iOS WDA fails with signing / "membership":
       - Confirm IOS_TEAM_ID in .env matches Xcode → Accounts → Team
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

  // Language first — so PM/engineer confirms JS vs Python before tooling.
  let scriptLanguage = 'javascript';
  if (opts.language === 'javascript' || opts.language === 'js') {
    scriptLanguage = 'javascript';
    console.log('\nScript language: JavaScript (--language flag)');
  } else if (opts.language === 'python' || opts.language === 'py') {
    scriptLanguage = await askScriptLanguage({});
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

  const projectId = await resolveProject(opts.project);
  const updates = await collectEnvUpdates(projectId, { scriptLanguage });
  const envPath = writeProjectEnv({
    projectPath: projectDir(projectId),
    updates,
  });
  console.log(`\nWrote ${envPath}`);
  console.log(`Script language recorded: ${scriptLanguage}`);

  const doInstall = opts.yes
    ? true
    : await askYesNo(`Run npm install in projects/${projectId}?`, true);
  if (doInstall) npmInstallProject(projectId);

  printNextSteps(projectId);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main, installAppiumStack, collectEnvUpdates };

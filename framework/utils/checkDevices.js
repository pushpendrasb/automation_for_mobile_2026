#!/usr/bin/env node
/**
 * Verifies connected iOS / Android devices for Appium runs.
 * Loads .env from AUTOMATION_PROJECT_ROOT or the first CLI argument (project path).
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

/**
 * Resolve dotenv from the project (peer dep), not from framework/.
 * Running this file with node does not see projects/<name>/node_modules by default.
 * @param {string} projectRoot
 */
function loadDotenv(projectRoot) {
  const absRoot = path.resolve(projectRoot);
  try {
    return createRequire(path.join(absRoot, 'package.json'))('dotenv');
  } catch {
    try {
      return require('dotenv');
    } catch {
      return null;
    }
  }
}

function loadProjectEnv() {
  const projectRoot =
    process.env.AUTOMATION_PROJECT_ROOT ||
    process.argv[3] ||
    process.cwd();
  const envPath = path.join(path.resolve(projectRoot), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }
  const dotenv = loadDotenv(projectRoot);
  if (!dotenv) {
    console.warn(
      'dotenv not found in the project — run npm install, then retry. Skipping .env load.',
    );
    return;
  }
  dotenv.config({ path: envPath });
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' });
  } catch (error) {
    return error.stdout || error.message || '';
  }
}

function checkIos() {
  console.log('\n=== iOS devices (xcrun xctrace list devices) ===');
  const out = run('xcrun xctrace list devices');
  console.log(out || '(no output)');

  const udid = process.env.IOS_DEVICE_UDID;
  if (!udid) {
    console.log(
      'IOS_DEVICE_UDID is not set — iOS runs will fall back to Simulator env.',
    );
    return true;
  }

  if (!out.includes(udid)) {
    console.error(
      `\nERROR: Configured IOS_DEVICE_UDID (${udid}) was not found.\n` +
        'Unlock the phone, trust this Mac, enable Developer Mode, reconnect USB.',
    );
    return false;
  }

  console.log(`OK: Found IOS_DEVICE_UDID ${udid}`);
  return true;
}

function checkAndroid() {
  console.log('\n=== Android devices (adb devices) ===');
  const out = run('adb devices');
  console.log(out || '(adb not installed or no output)');

  const deviceId = process.env.ANDROID_DEVICE_ID;
  if (!deviceId) {
    console.log(
      'ANDROID_DEVICE_ID is not set — Appium uses the default adb device when only one is connected.',
    );
    return true;
  }

  const lines = out
    .split('\n')
    .filter(line => line.includes('\tdevice') || line.includes(' device'));
  const found = lines.some(line => line.startsWith(deviceId));
  if (!found) {
    console.error(
      `\nERROR: Configured ANDROID_DEVICE_ID (${deviceId}) was not found.\n` +
        'Enable USB debugging, accept the RSA prompt, then run: adb devices',
    );
    return false;
  }

  console.log(`OK: Found ANDROID_DEVICE_ID ${deviceId}`);
  return true;
}

loadProjectEnv();

const platform = (process.argv[2] || 'all').toLowerCase();
let ok = true;

if (platform === 'ios' || platform === 'all') {
  ok = checkIos() && ok;
}
if (platform === 'android' || platform === 'all') {
  ok = checkAndroid() && ok;
}

process.exit(ok ? 0 : 1);

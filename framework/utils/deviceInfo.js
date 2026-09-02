/**
 * Live device / toolchain facts for the HTML report.
 *
 * `.env` values like IOS_DEVICE_NAME=iPhone 16 are often leftover simulator
 * defaults. This module reads the phone that is actually connected
 * (`xcrun xctrace` / `devicectl`) and the installed Xcode version.
 */
const { execSync } = require('child_process');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 15000 });
  } catch (error) {
    return (error && error.stdout) || '';
  }
}

/**
 * Parse a xctrace devices line:
 * `iPhone15Max SB 24 (26.3) (00008120-000109300A00201E)`
 * @param {string} line
 * @param {string} udid
 */
function parseXctraceLine(line, udid) {
  if (!udid || !line.includes(udid)) return null;
  const match = line.trim().match(/^(.*)\s+\(([^)]+)\)\s+\(([^)]+)\)\s*$/);
  if (!match) return null;
  return {
    deviceName: match[1].trim(),
    osVersion: match[2].trim(),
    udid: match[3].trim(),
  };
}

/**
 * Marketing model from `xcrun devicectl list devices` (e.g. iPhone 15 Plus).
 * @param {string} listing
 * @param {string} deviceName
 */
function parseDeviceModel(listing, deviceName) {
  if (!listing || !deviceName) return '';
  const needle = deviceName.replace(/\s+/g, ' ').trim();
  const line = listing.split('\n').find(
    row => row.includes(needle) || row.includes(needle.replace(/\s/g, '-')),
  );
  if (!line) return '';
  // Prefer "iPhone 15 Plus (iPhone15,5)" at the end — not the given name "iPhone15Max SB 24".
  const model = line.match(
    /\s(iPhone \d+[\w\s]*?|iPad [\w\s]*?)\s+\((iPhone\d+,\d+|iPad\d+,\d+)\)/,
  );
  return model ? model[1].trim() : '';
}

/**
 * Installed Xcode version, e.g. "26.6".
 */
function detectXcodeVersion() {
  const out = run('xcodebuild -version');
  const match = out.match(/Xcode\s+([\d.]+)/);
  return match ? match[1] : '';
}

/**
 * Resolve the real iOS device for a UDID (name, model, OS).
 * @param {string} [udid]
 */
function detectIosDevice(udid) {
  const target = udid || process.env.IOS_DEVICE_UDID || '';
  const xctrace = run('xcrun xctrace list devices');
  const parsed = target
    ? xctrace
        .split('\n')
        .map(line => parseXctraceLine(line, target))
        .find(Boolean)
    : null;

  const deviceName = (parsed && parsed.deviceName) || '';
  const listing = run('xcrun devicectl list devices');
  const deviceModel = parseDeviceModel(listing, deviceName);

  return {
    deviceName: deviceName || process.env.IOS_DEVICE_NAME || '',
    deviceModel,
    osVersion:
      (parsed && parsed.osVersion) ||
      process.env.IOS_REAL_PLATFORM_VERSION ||
      '',
    udid: (parsed && parsed.udid) || target,
    xcode: detectXcodeVersion(),
  };
}

/**
 * Pull deviceName / platformVersion from a live Appium session.
 * Session caps beat `.env` because they come from the phone that ran the tests.
 * @param {Record<string, unknown>} [caps]
 */
function fromSessionCaps(caps) {
  if (!caps || typeof caps !== 'object') return {};
  const deviceName = String(
    caps.deviceName || caps['appium:deviceName'] || '',
  ).trim();
  const osVersion = String(
    caps.platformVersion || caps['appium:platformVersion'] || '',
  ).trim();
  const udid = String(caps.udid || caps['appium:udid'] || '').trim();
  const out = {};
  if (deviceName) out.deviceName = deviceName;
  if (osVersion) out.osVersion = osVersion;
  if (udid) out.udid = udid;
  return out;
}

/**
 * Platform block for the report (iOS or Android).
 * @param {'iOS'|'Android'} platformName
 * @param {string} appId
 */
function buildPlatformMeta(platformName, appId) {
  const xcode = detectXcodeVersion();
  if (platformName === 'iOS') {
    const live = detectIosDevice(process.env.IOS_DEVICE_UDID);
    const displayName = live.deviceModel || live.deviceName || 'iOS device';
    return {
      platformName,
      device: displayName,
      deviceName: displayName,
      deviceGivenName: live.deviceName,
      deviceModel: live.deviceModel,
      deviceId: live.udid,
      osVersion: live.osVersion,
      appId,
      appBuild: process.env.APP_BUILD || appId,
      driver: 'XCUITest · Appium 3.x',
      xcode: xcode || process.env.IOS_XCODE_VERSION || '',
    };
  }

  return {
    platformName,
    device: process.env.ANDROID_DEVICE_ID || 'default',
    deviceName: process.env.ANDROID_DEVICE_ID || 'default',
    deviceId: process.env.ANDROID_DEVICE_ID || '',
    osVersion: process.env.ANDROID_PLATFORM_VERSION || '',
    appId,
    appBuild: process.env.APP_BUILD || appId,
    driver: 'UiAutomator2 · Appium 3.x',
    xcode: '',
  };
}

module.exports = {
  detectIosDevice,
  detectXcodeVersion,
  fromSessionCaps,
  buildPlatformMeta,
};

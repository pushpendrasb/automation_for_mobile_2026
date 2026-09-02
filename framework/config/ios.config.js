/**
 * iOS XCUITest capabilities for Appium.
 * Bundle ID and device values come from the active project's .env file.
 */
function buildIosCapabilities() {
  const bundleId = process.env.IOS_BUNDLE_ID || '';
  const udid = process.env.IOS_DEVICE_UDID;
  const teamId = process.env.IOS_TEAM_ID;
  const appPath = process.env.IOS_APP_PATH;

  if (!bundleId) {
    throw new Error(
      'IOS_BUNDLE_ID is required. Set it in the project .env file.',
    );
  }

  /** @type {Record<string, string | number | boolean>} */
  const caps = {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:bundleId': bundleId,
    'appium:noReset': process.env.APPIUM_NO_RESET === 'true',
    'appium:fullReset': false,
    'appium:newCommandTimeout': 240,
    'appium:wdaLaunchTimeout': 120000,
    'appium:wdaConnectionTimeout': 120000,
    'appium:useNewWDA': process.env.IOS_USE_PREBUILT_WDA !== 'true',
  };

  if (appPath) {
    caps['appium:app'] = appPath;
  }

  if (udid) {
    caps['appium:udid'] = udid;
    if (teamId) {
      caps['appium:xcodeOrgId'] = teamId;
      caps['appium:xcodeSigningId'] =
        process.env.IOS_XCODE_SIGNING_ID || 'Apple Development';
      caps['appium:allowProvisioningUpdates'] = true;
      caps['appium:updatedWDABundleId'] =
        process.env.IOS_WDA_BUNDLE_ID || `com.facebook.wda.${teamId}`;
    }
    caps['appium:showXcodeLog'] = process.env.APPIUM_SHOW_XCODE_LOG === 'true';
    const realOs = (process.env.IOS_REAL_PLATFORM_VERSION || '').trim();
    if (realOs) {
      caps['appium:platformVersion'] = realOs;
    }
    if (process.env.IOS_USE_PREBUILT_WDA === 'true') {
      caps['appium:usePrebuiltWDA'] = true;
      caps['appium:useNewWDA'] = false;
      const derived = (process.env.IOS_WDA_DERIVED_DATA_PATH || '').trim();
      if (derived) {
        caps['appium:derivedDataPath'] = derived;
      }
    }
  } else {
    caps['appium:deviceName'] = process.env.IOS_DEVICE_NAME || 'iPhone 16';
    caps['appium:platformVersion'] =
      process.env.IOS_PLATFORM_VERSION || '18.0';
  }

  return caps;
}

module.exports = { buildIosCapabilities };

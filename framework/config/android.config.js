/**
 * Android UiAutomator2 capabilities for Appium.
 * Package name and device values come from the active project's .env file.
 */
function buildAndroidCapabilities() {
  const deviceId = process.env.ANDROID_DEVICE_ID;
  const appPackage = process.env.ANDROID_APP_PACKAGE || '';
  const appActivity = process.env.ANDROID_APP_ACTIVITY;
  const appPath = process.env.ANDROID_APP_PATH;

  if (!appPackage) {
    throw new Error(
      'ANDROID_APP_PACKAGE is required. Set it in the project .env file.',
    );
  }

  /** @type {Record<string, string | number | boolean>} */
  const caps = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:appPackage': appPackage,
    'appium:noReset': process.env.APPIUM_NO_RESET === 'true',
    'appium:fullReset': false,
    'appium:newCommandTimeout': 240,
    'appium:autoGrantPermissions': true,
  };

  if (deviceId) {
    caps['appium:udid'] = deviceId;
  }

  if (appPath) {
    caps['appium:app'] = appPath;
  }

  if (appActivity) {
    caps['appium:appActivity'] = appActivity;
  } else {
    caps['appium:appWaitActivity'] = '*';
  }

  return caps;
}

module.exports = { buildAndroidCapabilities };

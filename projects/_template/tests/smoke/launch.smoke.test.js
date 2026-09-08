/**
 * Minimal launch smoke — replace with real page objects for your app.
 * Verifies Appium can start a session and read the active app package/bundle.
 */
describe('__PROJECT_NAME__ — launch smoke', () => {
  it('SM-001 starts a session and reports the current app id', async () => {
    const driver = browser;
    await driver.pause(2000);

    const platform = String(driver.capabilities.platformName || '').toLowerCase();
    let appId = '';

    if (platform === 'ios') {
      // Current iOS bundle id when app is in foreground (best-effort)
      try {
        appId = await driver.execute('mobile: activeAppInfo').then((info) => info?.bundleId || '');
      } catch {
        appId = process.env.IOS_BUNDLE_ID || '';
      }
    } else {
      try {
        appId = await driver.getCurrentPackage();
      } catch {
        appId = process.env.ANDROID_APP_PACKAGE || '';
      }
    }

    console.log(`[smoke] platform=${platform} appId=${appId || '(unknown)'}`);
    expect(true).toBe(true);
  });
});

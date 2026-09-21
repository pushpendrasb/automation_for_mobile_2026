import HomePage from '../../pages/HomePage';

/**
 * Minimal launch smoke — replace with real page objects for your app.
 * Verifies Appium can start a session and read the active app package/bundle.
 */
describe('Zonk — launch smoke', () => {
  it('SM-001 starts a session and opens the home screen', async () => {
    const driver = browser;
    await driver.pause(2000);

    const platform = String(driver.capabilities.platformName || '').toLowerCase();
    let appId = '';

    if (platform === 'ios') {
      try {
        const info = (await driver.execute('mobile: activeAppInfo')) as {
          bundleId?: string;
        };
        appId = info?.bundleId || '';
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
    
    // Dismiss the Force Update modal if it appears on app launch
    await HomePage.dismissUpdateModalIfPresent();

    const isHomeVisible = await HomePage.isDisplayed();
    expect(isHomeVisible).toBe(true);
  });
});

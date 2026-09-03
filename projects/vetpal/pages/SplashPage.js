/**
 * Splash.js after force-update: validateAuth() calls refresh-token (auth API).
 *
 * Same profile gate as Login.js (without OTP):
 *   refreshToken missing / API fail → Login
 *   is_profile_completed == '1' → Home
 *   else → CreateProfile
 *
 * Do not logout. Tokens in DefaultPreference must stay so splash can refresh.
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');
const LoginPage = require('./LoginPage');
const CreateProfilePage = require('./CreateProfilePage');

class SplashPage {
  #isAndroid() {
    const name = String(browser.capabilities.platformName || '').toLowerCase();
    return name === 'android';
  }

  #appId() {
    const project = require('../project.config');
    if (this.#isAndroid()) {
      return (
        process.env.ANDROID_APP_PACKAGE ||
        (project.defaults.android && project.defaults.android.appPackage)
      );
    }
    return (
      process.env.IOS_BUNDLE_ID ||
      (project.defaults.ios && project.defaults.ios.bundleId)
    );
  }

  /**
   * Kill and reopen the app so Splash runs validateAuth.
   * Does not logout — refresh token must still be stored.
   */
  async relaunchKeepingSession() {
    const appId = this.#appId();
    ui.log('Splash', `Relaunch ${appId} (keep session for refresh-token API)`);
    try {
      if (this.#isAndroid()) {
        await browser.terminateApp(appId);
        await browser.activateApp(appId);
      } else {
        await browser.execute('mobile: terminateApp', { bundleId: appId });
        await browser.execute('mobile: activateApp', { bundleId: appId });
      }
    } catch (err) {
      console.log(`relaunchKeepingSession warning: ${err && err.message}`);
    }
  }

  /**
   * Optional force-update sheet: Later continues to validateAuth().
   */
  async dismissForceUpdateLaterIfPresent() {
    try {
      const later = await ui.firstDisplayed(
        this.#isAndroid()
          ? 'android=new UiSelector().text("Later")'
          : '-ios predicate string:label == "Later" OR name == "Later"',
      );
      if (later) {
        ui.log('Splash', 'Force update — Later (continue to validateAuth)');
        await later.click();
      }
    } catch {
      // no alert
    }
  }

  /**
   * Wait until Splash.js has navigated after the auth API.
   *
   * @param {number} [timeout=45000]
   * @returns {Promise<'createProfile'|'home'|'login'>}
   */
  async waitForAuthDestination(timeout = 45000) {
    await LoginPage.dismissNoInternetAlertIfPresent();
    let dest = null;
    await browser.waitUntil(
      async () => {
        await this.dismissForceUpdateLaterIfPresent();
        await LoginPage.dismissNoInternetAlertIfPresent();
        if (await CreateProfilePage.isVisible()) {
          dest = 'createProfile';
          return true;
        }
        if (await ui.firstByTestId(TEST_IDS.home.requestTreatment)) {
          dest = 'home';
          return true;
        }
        if (
          (await ui.firstByTestId(TEST_IDS.login.email)) ||
          (await ui.firstByTestId(TEST_IDS.login.signInTab)) ||
          (await ui.firstByTestId(TEST_IDS.login.mobile))
        ) {
          dest = 'login';
          return true;
        }
        return false;
      },
      {
        timeout,
        interval: 400,
        timeoutMsg:
          'After Splash auth expected Create Profile, Home, or Login (Splash.js is_profile_completed / refresh token)',
      },
    );
    ui.log('Splash', `validateAuth landed on ${dest}`);
    return dest;
  }
}

module.exports = new SplashPage();

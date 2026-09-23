/**
 * Login screen Page Object — VetPortal (vet user app).
 *
 * Sign In uses email + password.
 * Source: vetpal-vetuser/src/Screens/Login.js
 * Credentials: projects/vetportal/.env (TEST_USER / TEST_PASSWORD)
 *
 * All taps/typing go through React Native testIDs (data/testIds.js):
 *   iOS  → accessibilityIdentifier (`name`)
 *   Android → resource-id
 */
const project = require('../project.config');
const { TEST_IDS } = require('../data/testIds');

class LoginPage {
  #isAndroid() {
    return String(browser.capabilities.platformName || '').toLowerCase() === 'android';
  }

  #escape(text) {
    return String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  #testIdSelector(id) {
    const e = this.#escape(id);
    if (this.#isAndroid()) {
      return `android=new UiSelector().resourceId("${e}")`;
    }
    return `-ios predicate string:name == "${e}"`;
  }

  #containsTextSelector(text) {
    const e = this.#escape(text);
    if (this.#isAndroid()) {
      return `android=new UiSelector().textContains("${e}")`;
    }
    return `-ios predicate string:label CONTAINS "${e}" OR name CONTAINS "${e}"`;
  }

  /**
   * First displayed match, or null. `$$` = one Appium round-trip when nothing matches.
   * @param {string} selector
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #firstDisplayed(selector) {
    try {
      const els = await $$(selector);
      for (const el of els) {
        if (await el.isDisplayed().catch(() => false)) {
          return el;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  async #byTestId(id) {
    return this.#firstDisplayed(this.#testIdSelector(id));
  }

  async #isTestIdShown(id) {
    return Boolean(await this.#byTestId(id));
  }

  async #waitForTestId(id, timeout = 15000) {
    let el = null;
    await browser.waitUntil(
      async () => {
        el = await this.#byTestId(id);
        return Boolean(el);
      },
      { timeout, interval: 300, timeoutMsg: `testID "${id}" not displayed after ${timeout}ms` },
    );
    return el;
  }

  async #tapTestId(id, timeout = 15000) {
    const el = await this.#waitForTestId(id, timeout);
    await el.click();
  }

  // ---------------------------------------------------------------- state

  async isOnLoginScreen() {
    return (
      (await this.#isTestIdShown(TEST_IDS.login.email)) &&
      (await this.#isTestIdShown(TEST_IDS.login.submit))
    );
  }

  async isHomeVisible() {
    return this.#isTestIdShown(TEST_IDS.home.menu);
  }

  async isSubscribeVetsVisible() {
    return this.#isTestIdShown(TEST_IDS.subscribeVets.screen);
  }

  /** Logged in: Home (practice joined) or Subscribe Vets (no practice yet). */
  async isLandedAfterLogin() {
    return (await this.isHomeVisible()) || (await this.isSubscribeVetsVisible());
  }

  async waitForLoginScreen(timeout = 30000) {
    await browser.waitUntil(() => this.isOnLoginScreen(), {
      timeout,
      interval: 500,
      timeoutMsg: 'VetPortal Sign In screen (login.email / login.submit) did not appear',
    });
  }

  // ---------------------------------------------------------------- reset

  /**
   * Bring the app to a clean Sign In form.
   * Already on Login → just clear fields. On Home → log out. Otherwise relaunch.
   */
  async resetAppToLoginScreen() {
    if (await this.isOnLoginScreen()) {
      await this.clearLoginFields();
      return;
    }

    if (!(await this.isLandedAfterLogin())) {
      await this.#relaunchApp();
    }

    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (await this.isOnLoginScreen()) {
        await this.clearLoginFields();
        return;
      }
      if (await this.isHomeVisible()) {
        await this.logoutFromHome();
        await this.waitForLoginScreen(20000);
        await this.clearLoginFields();
        return;
      }
      if (await this.isSubscribeVetsVisible()) {
        throw new Error(
          'App is logged in on Subscribe Vets (account has not joined a practice) — ' +
            'there is no logout there. Use an account that has joined a practice, or reinstall the app.',
        );
      }
      await browser.pause(500);
    }
    throw new Error('VetPortal Sign In screen did not appear. Check IOS_BUNDLE_ID / app install.');
  }

  /**
   * Make sure the app is signed in and on Home, without logging out first.
   * Already on Home → nothing to do. On Sign In → sign in with `credentials()`
   * (called only then, so .env is read only when a login is really needed).
   * Anywhere else (e.g. left on another screen by an earlier run) → relaunch.
   * @param {() => { email: string, password: string }} credentials
   */
  async ensureLoggedIn(credentials) {
    if (!(await this.isOnLoginScreen()) && !(await this.isHomeVisible())) {
      await this.#relaunchApp();
    }

    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (await this.isHomeVisible()) {
        console.log('[login] Already signed in — skipping login');
        await this.#dismissHomePopup();
        return;
      }
      if (await this.isOnLoginScreen()) {
        const { email, password } = credentials();
        console.log(`[login] Signed out — signing in as ${email} (.env)`);
        await this.clearLoginFields();
        await this.enterEmail(email);
        await this.enterPassword(password);
        await this.tapSignIn();
        if (!(await this.isLoginSuccessful(25000))) {
          const message = await this.getToastMessage();
          throw new Error(`Sign in failed${message ? `: ${message}` : ''}. Check TEST_USER / TEST_PASSWORD in .env`);
        }
        await this.#dismissHomePopup();
        return;
      }
      if (await this.isSubscribeVetsVisible()) {
        throw new Error(
          'Signed in on Subscribe Vets (account has not joined a practice) — Home is not reachable with this account.',
        );
      }
      await browser.pause(500);
    }
    throw new Error('Neither Home nor Sign In appeared after launching the app.');
  }

  /** Home shows a ConfirmAlert shortly after mount; close it if it is up. */
  async #dismissHomePopup() {
    await browser.pause(700);
    const popupCancel = await this.#firstDisplayed(this.#testIdSelector(TEST_IDS.alert.cancel));
    if (popupCancel) {
      await popupCancel.click();
      await browser.pause(400);
    }
  }

  async #relaunchApp() {
    const appId = this.#isAndroid()
      ? process.env.ANDROID_APP_PACKAGE || project.defaults.android.appPackage
      : process.env.IOS_BUNDLE_ID || project.defaults.ios.bundleId;
    try {
      await browser.terminateApp(appId);
    } catch {
      // not running
    }
    await browser.activateApp(appId);
  }

  /** Home → dismiss "Join Practice" popup → side menu → Logout → OK. */
  async logoutFromHome() {
    // Home always shows a ConfirmAlert ~500ms after mount; its "OK" is the cancel button.
    const popupCancel = await this.#firstDisplayed(this.#testIdSelector(TEST_IDS.alert.cancel));
    if (popupCancel) {
      await popupCancel.click();
      await browser.pause(500);
    }
    await this.#tapTestId(TEST_IDS.home.menu);
    await this.#tapTestId(TEST_IDS.menu.logout);
    await this.#tapTestId(TEST_IDS.alert.ok);
  }

  // ---------------------------------------------------------------- form

  async clearLoginFields() {
    for (const id of [TEST_IDS.login.email, TEST_IDS.login.password]) {
      const el = await this.#byTestId(id);
      if (el) {
        await el.clearValue().catch(() => {});
      }
    }
    await this.#dismissKeyboard();
  }

  async enterEmail(email) {
    const el = await this.#waitForTestId(TEST_IDS.login.email);
    await el.setValue(email);
  }

  async enterPassword(password) {
    const el = await this.#waitForTestId(TEST_IDS.login.password);
    await el.setValue(password);
  }

  /**
   * The form's ScrollView uses the default keyboardShouldPersistTaps="never",
   * so with the keyboard up the first tap on Sign In only dismisses it.
   */
  async #dismissKeyboard() {
    let shown = false;
    try {
      shown = await browser.isKeyboardShown();
    } catch {
      return;
    }
    if (!shown) {
      return;
    }
    if (this.#isAndroid()) {
      await browser.hideKeyboard().catch(() => {});
      return;
    }
    // Password field: return key blurs (blurOnSubmit default) and does not submit.
    const pwd = await this.#byTestId(TEST_IDS.login.password);
    if (pwd) {
      await pwd.addValue('\n').catch(() => {});
    }
    await browser.pause(300);
  }

  async tapSignIn() {
    await this.#dismissKeyboard();
    await this.#tapTestId(TEST_IDS.login.submit);
  }

  async assertLoginFormVisible() {
    for (const id of [
      TEST_IDS.login.email,
      TEST_IDS.login.password,
      TEST_IDS.login.submit,
      TEST_IDS.login.forgotPassword,
      TEST_IDS.login.registerNow,
    ]) {
      await this.#waitForTestId(id, 15000);
    }
  }

  // ---------------------------------------------------------------- outcomes

  async waitForToastContaining(text, timeout = 12000) {
    const selector = this.#containsTextSelector(text);
    await browser.waitUntil(async () => Boolean(await this.#firstDisplayed(selector)), {
      timeout,
      interval: 250,
      timeoutMsg: `Expected toast containing: ${text}`,
    });
  }

  async isToastVisible(text) {
    return Boolean(await this.#firstDisplayed(this.#containsTextSelector(text)));
  }

  /**
   * Text of the visible error/success toast (BannerView), or null.
   * iOS may fold the message Text into the tappable banner, so fall back to it.
   * @returns {Promise<string|null>}
   */
  async getToastMessage() {
    for (const id of [TEST_IDS.toast.message, TEST_IDS.toast.banner]) {
      const el = await this.#byTestId(id);
      if (!el) {
        continue;
      }
      const text = String(
        (await el.getText().catch(() => '')) ||
          (await el.getAttribute(this.#isAndroid() ? 'text' : 'label').catch(() => '')) ||
          '',
      ).trim();
      if (text && text !== id) {
        return text;
      }
    }
    return null;
  }

  /**
   * After tapping Sign In: wait until the app either lands past Sign In or shows
   * an error toast. Returns right away so a failure screenshot still has the toast.
   * @returns {Promise<{ landed: boolean, message: string|null }>}
   */
  async waitForSignInOutcome(timeout = 20000) {
    let outcome = { landed: false, message: null };
    await browser
      .waitUntil(
        async () => {
          if (await this.isLandedAfterLogin()) {
            outcome = { landed: true, message: null };
            return true;
          }
          const message = await this.getToastMessage();
          if (message) {
            outcome = { landed: false, message };
            return true;
          }
          return false;
        },
        { timeout, interval: 300 },
      )
      .catch(() => {});
    return outcome;
  }

  /**
   * True once Home / Subscribe Vets shows; false if still on Sign In at timeout.
   */
  async isLoginSuccessful(timeout = 25000) {
    try {
      await browser.waitUntil(() => this.isLandedAfterLogin(), { timeout, interval: 500 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for an API-rejected sign-in to settle: the loader modal hides the form
   * while the request runs, so require the form to be back and stable, and never
   * land on Home / Subscribe Vets.
   */
  async waitForLoginRejected(timeout = 20000) {
    const minSettleMs = 4000;
    const start = Date.now();
    let stablePolls = 0;
    while (Date.now() - start < timeout) {
      if (await this.isLandedAfterLogin()) {
        throw new Error('Unexpected navigation past Sign In after invalid credentials');
      }
      stablePolls = (await this.isOnLoginScreen()) ? stablePolls + 1 : 0;
      if (Date.now() - start >= minSettleMs && stablePolls >= 3) {
        return;
      }
      await browser.pause(500);
    }
    throw new Error('Sign In attempt did not settle back on the Sign In form (loader stuck?)');
  }
}

module.exports = new LoginPage();

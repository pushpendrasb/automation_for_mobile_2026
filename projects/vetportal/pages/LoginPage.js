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
const { step } = require('./clientLog');

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

  /**
   * iOS reports Subscribe Vets and its children as visible="false" even while
   * the screen is up, so this checks that the element exists, not isDisplayed.
   */
  async isSubscribeVetsVisible() {
    return Boolean(await this.#existingTestId(TEST_IDS.subscribeVets.screen));
  }

  /** First element with this testID that has a size, displayed or not; else null. */
  async #existingTestId(id) {
    for (const el of await $$(this.#testIdSelector(id)).catch(() => [])) {
      const size = await el.getSize().catch(() => null);
      if (size && size.width > 0 && size.height > 0) {
        return el;
      }
    }
    return null;
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
   * Already on Login → just clear fields. On Home → log out. On Subscribe
   * Vets → Skip Now to Home, then log out. Otherwise relaunch.
   */
  async resetAppToLoginScreen() {
    step('Opening the Sign In screen');
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
        await this.skipJoinPractice();
        continue;
      }
      await browser.pause(500);
    }
    throw new Error('VetPortal Sign In screen did not appear. Check IOS_BUNDLE_ID / app install.');
  }

  /**
   * Subscribe Vets ("Join Vet Practice", shown to a vet with no practice yet)
   * has no logout, and the app reopens it on every launch while the account
   * stays signed in. "Skip Now" opens Home, where the side menu can log out.
   * The screen opens with a "Please join and connect…" popup (and after a
   * sign-in, iOS may show "Save Password?") that blocks taps, and either can
   * appear a moment after the screen — so close whatever is up, tap Skip Now,
   * and repeat until Home opens.
   */
  async skipJoinPractice() {
    const homeOpened = async () =>
      (await this.#isTestIdShown(TEST_IDS.alert.cancel)) || (await this.#isTestIdShown(TEST_IDS.home.menu));
    let opened = false;
    for (let attempt = 0; attempt < 4 && !opened; attempt++) {
      await this.dismissSavePasswordPrompt();
      const popupOk = await this.#firstDisplayed(this.#testIdSelector(TEST_IDS.alert.ok));
      if (popupOk) {
        await popupOk.click();
        step('Join Vet Practice popup closed (OK)');
        await browser.pause(500);
      }
      const skip = await this.#existingTestId(TEST_IDS.subscribeVets.skip);
      if (skip) {
        // Reported as not visible (see isSubscribeVetsVisible), so tap its centre.
        const { x, y } = await skip.getLocation();
        const { width, height } = await skip.getSize();
        await browser
          .action('pointer', { parameters: { pointerType: 'touch' } })
          .move({ x: Math.round(x + width / 2), y: Math.round(y + height / 2) })
          .down()
          .pause(80)
          .up()
          .perform();
        step('Join Vet Practice: Skip Now tapped');
      }
      // Home opens with "unable to access certain app features… Join Practice / OK";
      // it hides the menu until closed. Its OK button is alert.cancel.
      opened = await browser
        .waitUntil(homeOpened, { timeout: 6000, interval: 500 })
        .catch(() => false);
    }
    if (!opened) {
      throw new Error('Home did not open after Skip Now on Join Vet Practice');
    }
    await this.#dismissHomePopup();
    await this.#waitForTestId(TEST_IDS.home.menu, 10000);
    step('Home screen shown');
  }

  /**
   * iOS "Save Password?" sheet (from the phone's Passwords settings, not the
   * app) shows after a sign-in and blocks taps. Tap "Not Now" if it is up.
   * @param {{ waitMs?: number }} [opts] waitMs: how long to wait for the sheet
   *   to appear (it shows a moment after the app lands)
   * @returns {Promise<boolean>} true when the sheet was closed
   */
  async dismissSavePasswordPrompt({ waitMs = 0 } = {}) {
    if (this.#isAndroid()) {
      return false;
    }
    const selector = '-ios predicate string:type == "XCUIElementTypeButton" AND label == "Not Now"';
    let notNow = await this.#firstDisplayed(selector);
    const deadline = Date.now() + waitMs;
    while (!notNow && Date.now() < deadline) {
      await browser.pause(500);
      notNow = await this.#firstDisplayed(selector);
    }
    if (!notNow) {
      return false;
    }
    await notNow.click();
    step('iOS "Save Password?" — Not Now tapped');
    await browser.pause(500);
    return true;
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
        step('Already signed in — Home screen shown');
        await this.#dismissHomePopup();
        return;
      }
      if (await this.isOnLoginScreen()) {
        const { email, password } = credentials();
        console.log(`[login] Signed out — signing in as ${email} (.env)`);
        step('Signed out — signing in with the saved account');
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
      step('Home popup closed');
      await browser.pause(400);
    }
  }

  async #relaunchApp() {
    step('Restarting the app');
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
      step('Home popup closed');
      await browser.pause(500);
    }
    await this.#tapTestId(TEST_IDS.home.menu);
    step('Menu button tapped');
    await this.#tapTestId(TEST_IDS.menu.logout);
    step('Logout tapped');
    await this.#tapTestId(TEST_IDS.alert.ok);
    step('Logout confirmed');
  }

  // ---------------------------------------------------------------- form

  async clearLoginFields() {
    for (const id of [TEST_IDS.login.email, TEST_IDS.login.password]) {
      const el = await this.#byTestId(id);
      if (el) {
        await el.clearValue().catch(() => {});
      }
    }
    step('Email and password fields cleared');
    await this.#dismissKeyboard();
  }

  async enterEmail(email) {
    const el = await this.#waitForTestId(TEST_IDS.login.email);
    await el.setValue(email);
    step(email ? 'Email entered' : 'Email left blank');
  }

  async enterPassword(password) {
    const el = await this.#waitForTestId(TEST_IDS.login.password);
    await el.setValue(password);
    step(password ? 'Password entered' : 'Password left blank');
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
    step('Keyboard hidden');
  }

  async tapSignIn() {
    await this.#dismissKeyboard();
    await this.#tapTestId(TEST_IDS.login.submit);
    step('Sign In button tapped');
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
    step(
      outcome.landed
        ? 'Signed in — app moved past Sign In'
        : outcome.message
          ? `App showed message: "${outcome.message}"`
          : 'No result shown after Sign In',
    );
    if (outcome.landed) {
      await this.dismissSavePasswordPrompt({ waitMs: 3000 });
    }
    return outcome;
  }

  /**
   * True once Home / Subscribe Vets shows; false if still on Sign In at timeout.
   */
  async isLoginSuccessful(timeout = 25000) {
    try {
      await browser.waitUntil(() => this.isLandedAfterLogin(), { timeout, interval: 500 });
      step('Signed in — Home screen shown');
      await this.dismissSavePasswordPrompt({ waitMs: 3000 });
      return true;
    } catch {
      step('Sign in did not reach the Home screen');
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
        step('Sign in rejected — still on the Sign In screen');
        return;
      }
      await browser.pause(500);
    }
    throw new Error('Sign In attempt did not settle back on the Sign In form (loader stuck?)');
  }
}

module.exports = new LoginPage();

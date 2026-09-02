/**
 * Login screen Page Object — Vet-Pal Animal Owner.
 *
 * Sign In uses mobile number (+353 default) + password — not email.
 * Source: vetpal-animal-owner/src/Screens/Login.js
 *
 * Credentials: projects/vetpal/.env
 *
 * Speed notes (XCUITest):
 * - Prefer `$$` over `$` for absence checks. `$` does findElement (error)
 *   then findElements — two snapshots (~600ms). `$$` is one snapshot.
 * - Combine Home / OTP labels into a single predicate so each poll is 1 query.
 * - Do not terminate+relaunch when the Sign In form is already visible.
 */
class LoginPage {
  #isAndroid() {
    const name = String(browser.capabilities.platformName || '').toLowerCase();
    return name === 'android';
  }

  async #isShown(el) {
    try {
      return (await el.isExisting()) && (await el.isDisplayed());
    } catch {
      return false;
    }
  }

  /**
   * First displayed match, or null. One Appium round-trip when nothing matches.
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

  async #anyDisplayed(selector) {
    return Boolean(await this.#firstDisplayed(selector));
  }

  #testData() {
    return require('../data/testData').testData;
  }

  #escape(text) {
    return String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  /** Combined iOS predicate: label/name CONTAINS any of the given strings. */
  #iosContainsAny(needles) {
    const parts = needles.flatMap(n => {
      const e = this.#escape(n);
      return [`label CONTAINS "${e}"`, `name CONTAINS "${e}"`];
    });
    return `-ios predicate string:${parts.join(' OR ')}`;
  }

  async dismissNoInternetAlertIfPresent() {
    if (this.#isAndroid()) {
      return;
    }
    try {
      const alertTitle = await this.#firstDisplayed(
        '-ios predicate string:label == "No Internet Connection" OR name == "No Internet Connection"',
      );
      if (!alertTitle) {
        return;
      }
      const retry = await this.#firstDisplayed(
        '-ios predicate string:label == "Retry" OR name == "Retry"',
      );
      if (retry) {
        await retry.click();
      }
    } catch {
      // no alert
    }
  }

  async ensureSignInMode() {
    const { loginTab, welcomeHint } = this.#testData();
    if (await this.#anyDisplayed(this.#exactSelector(welcomeHint))) {
      return;
    }
    const signInTab = await this.#firstDisplayed(this.#exactSelector(loginTab));
    if (signInTab) {
      await this.#tapCenter(signInTab);
      await browser.waitUntil(
        async () => this.#anyDisplayed(this.#exactSelector(welcomeHint)),
        {
          timeout: 3000,
          interval: 150,
          timeoutMsg: 'Sign In tab did not show the login form',
        },
      ).catch(() => {});
    }
  }

  #exactSelector(text) {
    const label = this.#escape(text);
    if (this.#isAndroid()) {
      return `android=new UiSelector().text("${label}")`;
    }
    return `-ios predicate string:label == "${label}" OR name == "${label}"`;
  }

  /**
   * Type the full string in one command. Avoid per-character `keys` + pauses.
   * @param {WebdriverIO.Element} el
   * @param {string} text
   */
  async #typeInto(el, text) {
    const value = String(text);
    if (this.#isAndroid()) {
      await el.click();
      await el.clearValue().catch(() => {});
      await el.addValue(value);
      return;
    }

    try {
      await el.setValue(value);
      return;
    } catch {
      await el.click();
      await browser.execute('mobile: type', { text: value });
    }
  }

  async resolveMobileField() {
    const { mobilePlaceholder } = this.#testData();
    if (this.#isAndroid()) {
      const byHint = await this.#firstDisplayed(
        `android=new UiSelector().textContains("${this.#escape(mobilePlaceholder)}")`,
      );
      if (byHint) {
        return byHint;
      }
      const inputs = await $$(
        'android=new UiSelector().className("android.widget.EditText")',
      );
      for (const el of inputs) {
        if (await this.#isShown(el)) {
          return el;
        }
      }
      return null;
    }

    const byPlaceholder = await this.#firstDisplayed(
      `-ios predicate string:placeholderValue == "${this.#escape(mobilePlaceholder)}" OR value == "${this.#escape(mobilePlaceholder)}"`,
    );
    if (byPlaceholder) {
      return byPlaceholder;
    }

    const textFields = await $$(
      '-ios class chain:**/XCUIElementTypeTextField',
    );
    for (const el of textFields) {
      if (!(await this.#isShown(el))) {
        continue;
      }
      const placeholder =
        (await el.getAttribute('placeholderValue').catch(() => '')) || '';
      const value = (await el.getAttribute('value').catch(() => '')) || '';
      if (
        placeholder === mobilePlaceholder ||
        value === mobilePlaceholder ||
        /^\d*$/.test(value)
      ) {
        return el;
      }
    }
    if (textFields.length > 0 && (await this.#isShown(textFields[0]))) {
      return textFields[0];
    }
    return null;
  }

  async resolvePasswordField() {
    const { passwordPlaceholder } = this.#testData();
    if (this.#isAndroid()) {
      const byHint = await this.#firstDisplayed(
        `android=new UiSelector().textContains("${this.#escape(passwordPlaceholder)}")`,
      );
      if (byHint) {
        return byHint;
      }
      const inputs = await $$(
        'android=new UiSelector().className("android.widget.EditText")',
      );
      if (inputs.length >= 2) {
        return inputs[inputs.length - 1];
      }
      return null;
    }

    const secure = await $$(
      '-ios class chain:**/XCUIElementTypeSecureTextField',
    );
    for (const el of secure) {
      if (await this.#isShown(el)) {
        return el;
      }
    }

    return this.#firstDisplayed(
      `-ios predicate string:placeholderValue == "${this.#escape(passwordPlaceholder)}" OR value == "${this.#escape(passwordPlaceholder)}"`,
    );
  }

  /**
   * Wait for the Sign In form after a cold start. Poll lightly so XCUITest
   * snapshots do not delay the splash/login render.
   */
  async waitForLoginScreen(timeout = 45000) {
    await this.dismissNoInternetAlertIfPresent();
    await browser.waitUntil(
      async () => this.isOnLoginScreenFast(),
      {
        timeout,
        interval: 500,
        timeoutMsg:
          'Vet-Pal Sign In screen did not appear (mobile field not found). Check IOS_BUNDLE_ID / app install.',
      },
    );
    await this.ensureSignInMode();
  }

  /**
   * True when the Sign In form is already showing — skip terminate/relaunch.
   */
  async isOnLoginScreenFast() {
    const { welcomeHint, mobilePlaceholder } = this.#testData();
    if (await this.#anyDisplayed(this.#exactSelector(welcomeHint))) {
      return true;
    }
    if (this.#isAndroid()) {
      return this.#anyDisplayed(
        `android=new UiSelector().textContains("${this.#escape(mobilePlaceholder)}")`,
      );
    }
    return this.#anyDisplayed(
      `-ios predicate string:placeholderValue == "${this.#escape(mobilePlaceholder)}" OR value == "${this.#escape(mobilePlaceholder)}"`,
    );
  }

  /**
   * Restart the app only when we are not already on Sign In.
   * If a previous test left us logged in (Home), logout instead of waiting
   * for a login form that will never appear (session is restored on activate).
   *
   * @param {{ force?: boolean }} [opts]
   */
  async resetAppToLoginScreen(opts = {}) {
    const force = Boolean(opts.force);
    if (!force && (await this.isOnLoginScreenFast())) {
      await this.ensureSignInMode();
      return;
    }

    if (await this.#isHomeVisible()) {
      await this.#logoutFromHome();
      await this.waitForLoginScreen(20000);
      return;
    }

    const isAndroid = this.#isAndroid();
    const project = require('../project.config');
    const appId = isAndroid
      ? process.env.ANDROID_APP_PACKAGE ||
        (project.defaults.android && project.defaults.android.appPackage)
      : process.env.IOS_BUNDLE_ID ||
        (project.defaults.ios && project.defaults.ios.bundleId);

    try {
      if (isAndroid) {
        await browser.terminateApp(appId);
        await browser.activateApp(appId);
      } else {
        await browser.execute('mobile: terminateApp', { bundleId: appId });
        await browser.execute('mobile: activateApp', { bundleId: appId });
      }
    } catch (err) {
      console.log(`resetAppToLoginScreen warning: ${err && err.message}`);
    }

    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (await this.isOnLoginScreenFast()) {
        await this.ensureSignInMode();
        return;
      }
      if (await this.#isHomeVisible()) {
        await this.#logoutFromHome();
        await this.waitForLoginScreen(20000);
        return;
      }
      await browser.pause(500);
    }
    throw new Error(
      'Vet-Pal Sign In screen did not appear (mobile field not found). Check IOS_BUNDLE_ID / app install.',
    );
  }

  /**
   * Home → drawer → Logout → OK. Used when the session is still authenticated.
   */
  async #logoutFromHome() {
    console.log('Session still on Home — logging out to reach Sign In');
    try {
      await browser.execute('mobile: tap', {
        x: 32,
        y: 90,
      });
    } catch {
      // ignore
    }

    await browser.waitUntil(
      async () => this.#anyDisplayed(this.#exactSelector('Logout')),
      {
        timeout: 8000,
        interval: 300,
        timeoutMsg: 'Logout item not visible in side menu',
      },
    ).catch(async () => {
      await browser.execute('mobile: swipe', {
        direction: 'up',
        velocity: 500,
      });
    });

    const logout = await this.#firstDisplayed(this.#exactSelector('Logout'));
    if (!logout) {
      throw new Error('Logout menu item not found');
    }
    await this.#tapCenter(logout);

    const ok = await this.#firstDisplayed(this.#exactSelector('OK'));
    if (ok) {
      await this.#tapCenter(ok);
    }
  }

  async assertLoginFormVisible() {
    await this.ensureSignInMode();
    const mobile = await this.resolveMobileField();
    if (!mobile) {
      throw new Error('Mobile number field not visible on Sign In');
    }
    const password = await this.resolvePasswordField();
    if (!password) {
      throw new Error('Password field not visible on Sign In');
    }

    const { signInButton } = this.#testData();
    const btn = await this.#firstDisplayed(this.#exactSelector(signInButton));
    if (!btn) {
      throw new Error(`${signInButton} button not visible`);
    }
  }

  /**
   * Clear mobile + password so empty-field cases stay valid when we skip relaunch.
   */
  async clearLoginFields() {
    const mobile = await this.resolveMobileField();
    if (mobile) {
      await mobile.clearValue().catch(() => {});
    }
    const password = await this.resolvePasswordField();
    if (password) {
      await password.clearValue().catch(() => {});
    }
  }

  async enterMobile(mobileNumber) {
    await this.ensureSignInMode();
    const el = await this.resolveMobileField();
    if (!el) {
      throw new Error('Mobile number field not found');
    }
    await this.#typeInto(el, mobileNumber);
  }

  async enterPassword(password) {
    const el = await this.resolvePasswordField();
    if (!el) {
      throw new Error('Password field not found');
    }
    await this.#typeInto(el, password);
    await this.#dismissKeyboardFast();
  }

  /**
   * Hide the keyboard without `mobile: hideKeyboard`.
   * WDA cannot dismiss this React Native keyboard that way, and WebdriverIO
   * retries a failed `execute` three times (~6s each).
   */
  async #dismissKeyboardFast() {
    if (this.#isAndroid()) {
      try {
        await browser.hideKeyboard();
      } catch {
        // ignore
      }
      return;
    }
    try {
      const shown = await browser.isKeyboardShown();
      if (!shown) {
        return;
      }
    } catch {
      // continue — tap is cheap if the keyboard is already down
    }
    try {
      const { width } = await browser.getWindowSize();
      await browser.execute('mobile: tap', {
        x: Math.round(width / 2),
        y: 80,
      });
    } catch {
      // ignore
    }
  }

  async tapSignIn() {
    const { signInButton } = this.#testData();
    const btn = await this.#firstDisplayed(this.#exactSelector(signInButton));
    if (!btn) {
      throw new Error(`${signInButton} button not found`);
    }
    await this.#tapCenter(btn);
  }

  async #tapCenter(el) {
    try {
      const loc = await el.getLocation();
      const size = await el.getSize();
      await browser.execute('mobile: tap', {
        x: Math.round(loc.x + size.width / 2),
        y: Math.round(loc.y + size.height / 2),
      });
    } catch {
      await el.click();
    }
  }

  async #isLoginLoaderVisible() {
    try {
      const indicators = await $$(
        '-ios class chain:**/XCUIElementTypeActivityIndicator',
      );
      for (const el of indicators) {
        if (await this.#isShown(el)) {
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  /**
   * Home is identified by the first indicator only (default `VETPAL`).
   * A 10-way OR CONTAINS predicate against a loading tree can take ~5s.
   */
  async isHomeVisibleFast() {
    return this.#isHomeVisible();
  }

  async #isHomeVisible() {
    const { homeIndicators } = this.#testData();
    const primary = homeIndicators[0];
    if (!primary) {
      return false;
    }
    if (this.#isAndroid()) {
      return this.#anyDisplayed(
        `android=new UiSelector().textContains("${this.#escape(primary)}")`,
      );
    }
    const e = this.#escape(primary);
    return this.#anyDisplayed(
      `-ios predicate string:label CONTAINS "${e}" OR name CONTAINS "${e}"`,
    );
  }

  async #isOtpScreenVisible() {
    if (this.#isAndroid()) {
      return this.#anyDisplayed(
        'android=new UiSelector().textContains("OTP")',
      );
    }
    return this.#anyDisplayed(
      '-ios predicate string:label CONTAINS "OTP" OR name CONTAINS "OTP"',
    );
  }

  async getVisibleLoginErrorMessage() {
    try {
      const { genericApiErrorFallback } = this.#testData();
      const needles = [
        'incorrect',
        'invalid',
        'wrong',
        'failed',
        'not found',
        'Something went wrong',
        genericApiErrorFallback,
      ];
      if (this.#isAndroid()) {
        for (const needle of needles) {
          const el = await this.#firstDisplayed(
            `android=new UiSelector().textContains("${this.#escape(needle)}")`,
          );
          if (el) {
            return needle;
          }
        }
        return null;
      }
      const el = await this.#firstDisplayed(this.#iosContainsAny(needles));
      if (!el) {
        return null;
      }
      const label =
        (await el.getAttribute('label').catch(() => null)) ||
        (await el.getAttribute('name').catch(() => null));
      return label ? String(label) : needles[0];
    } catch {
      return null;
    }
  }

  /**
   * Wait until Home (or OTP) appears after tapping Sign In.
   * Polls a single Home predicate every 250ms — not 5 labels × 1.5s.
   *
   * @param {number} [timeout=25000]
   * @returns {Promise<boolean>}
   */
  async isLoginSuccessful(timeout = 25000) {
    await this.dismissNoInternetAlertIfPresent();
    let landedOnOtp = false;
    try {
      await browser.waitUntil(
        async () => {
          if (await this.#isHomeVisible()) {
            return true;
          }
          if (await this.#isOtpScreenVisible()) {
            landedOnOtp = true;
            return true;
          }
          return false;
        },
        {
          timeout,
          interval: 250,
          timeoutMsg:
            'Vet-Pal Home was not displayed after Sign In (check VETPAL_HOME_INDICATORS or OTP on account)',
        },
      );

      if (landedOnOtp) {
        console.log(
          'Account requires OTP verification — Home not reached. Use an account with otp_status=false or add OTP automation.',
        );
        return false;
      }
      return true;
    } catch {
      console.log(
        `Login diagnostic: loader=${await this.#isLoginLoaderVisible()} stillOnLogin=${await this.isStillOnLoginScreen()}`,
      );
      return false;
    }
  }

  async isStillOnLoginScreen() {
    return this.isOnLoginScreenFast();
  }

  /**
   * Vet-Pal shows toast message text only (react-native-toast-message text1).
   */
  async waitForToastContaining(text, timeout = 12000) {
    const needle = String(text);
    await browser.waitUntil(
      async () => {
        if (this.#isAndroid()) {
          return this.#anyDisplayed(
            `android=new UiSelector().textContains("${this.#escape(needle)}")`,
          );
        }
        const escaped = this.#escape(needle);
        return this.#anyDisplayed(
          `-ios predicate string:label CONTAINS "${escaped}" OR name CONTAINS "${escaped}"`,
        );
      },
      {
        timeout,
        interval: 250,
        timeoutMsg: `Expected toast/text containing: ${needle}`,
      },
    );
  }

  async waitForLoginRejected(timeout = 15000) {
    await browser.waitUntil(
      async () => {
        if (await this.#isHomeVisible()) {
          return true;
        }
        if (await this.#isLoginLoaderVisible()) {
          return false;
        }
        return true;
      },
      {
        timeout,
        interval: 250,
        timeoutMsg: 'Login attempt did not settle (loader stuck?)',
      },
    );

    if (await this.#isHomeVisible()) {
      throw new Error('Unexpected navigation to Home after invalid login');
    }
  }

  async tapSignInOnly() {
    await this.tapSignIn();
  }
}

module.exports = new LoginPage();

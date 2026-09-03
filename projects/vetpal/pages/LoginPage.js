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
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');

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

  /**
   * Sign In tab only exists once Login.js has rendered. Wait for `login.mobile`
   * (already on Sign In) or `login.signInTab` (on Sign Up) — never tap the tab
   * against the splash tree.
   *
   * Sign Up also has `login.mobile`, so if `login.email` is present we are on
   * Sign Up and must tap Sign In (Login.js defaults `isSignIn` to false).
   */
  async ensureSignInMode() {
    if (await ui.firstByTestId(TEST_IDS.login.email)) {
      await ui.requireTapTestId(TEST_IDS.login.signInTab);
      await browser.waitUntil(
        async () =>
          Boolean(await ui.firstByTestId(TEST_IDS.login.mobile)) &&
          !(await ui.firstByTestId(TEST_IDS.login.email)),
        {
          timeout: 5000,
          interval: 150,
          timeoutMsg: 'Sign In tab did not hide login.email',
        },
      );
      return;
    }
    if (await ui.firstByTestId(TEST_IDS.login.mobile)) {
      return;
    }
    await browser.waitUntil(
      async () =>
        Boolean(
          (await ui.firstByTestId(TEST_IDS.login.email)) ||
            (await ui.firstByTestId(TEST_IDS.login.mobile)) ||
            (await ui.firstByTestId(TEST_IDS.login.signInTab)),
        ),
      {
        timeout: 20000,
        interval: 300,
        timeoutMsg:
          'login.mobile / login.signInTab not found — wait for splash, or rebuild/reinstall the Vet Pal app',
      },
    );
    if (await ui.firstByTestId(TEST_IDS.login.email)) {
      await ui.requireTapTestId(TEST_IDS.login.signInTab);
      await browser.waitUntil(
        async () =>
          Boolean(await ui.firstByTestId(TEST_IDS.login.mobile)) &&
          !(await ui.firstByTestId(TEST_IDS.login.email)),
        {
          timeout: 5000,
          interval: 150,
          timeoutMsg: 'Sign In tab did not hide login.email',
        },
      );
      return;
    }
    if (await ui.firstByTestId(TEST_IDS.login.mobile)) {
      return;
    }
    await ui.requireTapTestId(TEST_IDS.login.signInTab);
    await browser.waitUntil(
      async () => Boolean(await ui.firstByTestId(TEST_IDS.login.mobile)),
      {
        timeout: 5000,
        interval: 150,
        timeoutMsg: 'Sign In tab did not show login.mobile',
      },
    );
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
    const byId = await ui.firstByTestId(TEST_IDS.login.mobile);
    if (byId) {
      return byId;
    }
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
    const byId = await ui.firstByTestId(TEST_IDS.login.password);
    if (byId) {
      return byId;
    }
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
   * Wait until Login.js is showing (Sign In or Sign Up). Does not tap either
   * tab — signup scripts must not bounce Sign In ↔ Sign Up.
   * @param {number} [timeout=45000]
   */
  async waitForLoginForm(timeout = 45000) {
    await this.dismissNoInternetAlertIfPresent();
    await browser.waitUntil(
      async () =>
        Boolean(
          (await ui.firstByTestId(TEST_IDS.login.mobile)) ||
            (await ui.firstByTestId(TEST_IDS.login.email)) ||
            (await ui.firstByTestId(TEST_IDS.login.signUpTab)),
        ),
      {
        timeout,
        interval: 500,
        timeoutMsg:
          'Vet-Pal Login screen did not appear (mobile / email / Sign Up tab not found). Check IOS_BUNDLE_ID / app install.',
      },
    );
  }

  /**
   * Wait for the Sign In form after a cold start. Poll lightly so XCUITest
   * snapshots do not delay the splash/login render.
   */
  async waitForLoginScreen(timeout = 45000) {
    await this.waitForLoginForm(timeout);
    await this.ensureSignInMode();
  }

  /**
   * True when the Sign In form is already showing — skip terminate/relaunch.
   */
  async isOnLoginScreenFast() {
    if (await ui.firstByTestId(TEST_IDS.login.mobile)) {
      return true;
    }
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
   * Restart the app only when we are not already on Login.
   * If a previous test left us logged in (Home), logout instead of waiting
   * for a login form that will never appear (session is restored on activate).
   *
   * @param {{ force?: boolean, skipSignInTab?: boolean }} [opts]
   *   skipSignInTab — signup specs: land on Login without tapping Sign In.
   */
  async resetAppToLoginScreen(opts = {}) {
    const force = Boolean(opts.force);
    const skipSignInTab = Boolean(opts.skipSignInTab);
    if (!force && (await this.isOnLoginScreenFast())) {
      if (!skipSignInTab) {
        await this.ensureSignInMode();
      }
      return;
    }

    if (await this.#isHomeVisible()) {
      await this.#logoutFromHome();
      if (skipSignInTab) {
        await this.waitForLoginForm(20000);
      } else {
        await this.waitForLoginScreen(20000);
      }
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
        if (!skipSignInTab) {
          await this.ensureSignInMode();
        }
        return;
      }
      if (await this.#isHomeVisible()) {
        await this.#logoutFromHome();
        if (skipSignInTab) {
          await this.waitForLoginForm(20000);
        } else {
          await this.waitForLoginScreen(20000);
        }
        return;
      }
      await browser.pause(500);
    }
    throw new Error(
      'Vet-Pal Sign In screen did not appear (mobile field not found). Check IOS_BUNDLE_ID / app install.',
    );
  }

  /**
   * Home → drawer (`home.menu`) → Logout (`menu.logout`) → OK (`alert.ok`).
   * Used when the session is still authenticated.
   */
  async #logoutFromHome() {
    console.log('Session still on Home — logging out to reach Sign In');
    await ui.requireTapTestId(TEST_IDS.home.menu);

    await browser.waitUntil(
      async () => Boolean(await ui.firstByTestId(TEST_IDS.menu.logout)),
      {
        timeout: 8000,
        interval: 300,
        timeoutMsg:
          'menu.logout not visible — rebuild/reinstall the Vet Pal app',
      },
    );

    await ui.requireTapTestId(TEST_IDS.menu.logout);
    await ui.requireTapTestId(TEST_IDS.alert.ok);
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
    if (!(await ui.firstByTestId(TEST_IDS.login.submit))) {
      throw new Error(`${signInButton} button not visible (login.submit)`);
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

  /**
   * Sign In country picker — same IDs as Sign Up (`login.country.{code}`).
   * @param {string} code e.g. '+91'
   */
  async selectCountryCode(code) {
    await this.ensureSignInMode();
    const wanted = String(code || '+353').trim();
    await ui.requireTapTestId(TEST_IDS.login.countryCode);
    await browser.pause(200);
    await ui.requireTapTestId(TEST_IDS.login.countryOption(wanted));
    await ui.requireTapTestId(TEST_IDS.login.countrySave);
    await browser.pause(150);
  }

  /**
   * Login.js after a 200/201:
   * - otp_status true → OtpVerifyScreen
   * - is_profile_completed == '1' → Home
   * - else → CreateProfile
   *
   * @param {number} [timeout=25000]
   * @returns {Promise<'home'|'createProfile'|'otp'>}
   */
  async waitForPostLoginDestination(timeout = 25000) {
    await this.dismissNoInternetAlertIfPresent();
    let dest = null;
    await browser.waitUntil(
      async () => {
        if (await ui.firstByTestId(TEST_IDS.home.requestTreatment)) {
          dest = 'home';
          return true;
        }
        if (await ui.firstByTestId(TEST_IDS.profile.firstName)) {
          dest = 'createProfile';
          return true;
        }
        if (await ui.firstByTestId(TEST_IDS.otp.input)) {
          dest = 'otp';
          return true;
        }
        if (await this.#isHomeVisible()) {
          dest = 'home';
          return true;
        }
        if (await this.#isOtpScreenVisible()) {
          dest = 'otp';
          return true;
        }
        return false;
      },
      {
        timeout,
        interval: 300,
        timeoutMsg:
          'After Sign In expected Home, Create Profile, or Enter OTP (see Login.js otp_status / is_profile_completed)',
      },
    );
    ui.log('Login', `Post-login screen: ${dest}`);
    return dest;
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
      await ui.dismissKeyboard();
    } catch {
      // ignore
    }
  }

  async tapSignIn() {
    await ui.requireTapTestId(TEST_IDS.login.submit);
  }

  async #tapCenter(el) {
    try {
      await el.click();
    } catch {
      await ui.press(el);
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
    if (await ui.firstByTestId(TEST_IDS.home.requestTreatment)) {
      return true;
    }
    const { homeIndicators } = this.#testData();
    const primary = homeIndicators[0];
    if (!primary) {
      return false;
    }
    if (this.#isAndroid()) {
      return this.#anyDisplayed(
        `android=new UiSelector().text("${this.#escape(primary)}")`,
      );
    }
    const e = this.#escape(primary);
    try {
      const els = await $$(
        `-ios predicate string:label == "${e}" OR name == "${e}"`,
      );
      return els.length > 0;
    } catch {
      return false;
    }
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

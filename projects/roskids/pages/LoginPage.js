/**
 * Login screen Page Object for RosKids.
 *
 * Credentials come from projects/roskids/.env (ROS_KIDS_TEST_EMAIL / ROS_KIDS_TEST_PASSWORD).
 * Use stable TextField indexes on iOS — never find-by-placeholder after typing
 * (value "Email" becomes "qa@..." and Appium reports element not found / "crash").
 */
class LoginPage {
  /** Prefer accessibility id when present; always fall back to TextField indexes (no app rebuild required). */
  get emailByTestId() {
    return $('~login-email-input');
  }

  get passwordByTestId() {
    return $('~login-password-input');
  }

  get signInByTestId() {
    return $('~login-sign-in-button');
  }

  /** Stable: 1st text field on Sign In */
  get emailField() {
    return $('-ios class chain:**/XCUIElementTypeTextField[1]');
  }

  /** Stable: 2nd text field (RN password often is TextField, not SecureTextField) */
  get passwordField() {
    return $('-ios class chain:**/XCUIElementTypeTextField[2]');
  }

  get passwordSecure() {
    return $('-ios class chain:**/XCUIElementTypeSecureTextField[1]');
  }

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

  async dismissNoInternetAlertIfPresent() {
    if (this.#isAndroid()) {
      return;
    }
    try {
      const alertTitle = await $(
        '-ios predicate string:label == "No Internet Connection" OR name == "No Internet Connection"',
      );
      if (!(await this.#isShown(alertTitle))) {
        return;
      }
      const retry = await $(
        '-ios predicate string:label == "Retry" OR name == "Retry"',
      );
      if (await this.#isShown(retry)) {
        await retry.click();
        await browser.pause(800);
      }
    } catch {
      // no alert
    }
  }

  /**
   * Click field, type with keyboard events (RN onChangeText), do not re-find by "Email".
   */
  async #typeInto(el, text) {
    await el.click();
    await browser.pause(150);

    try {
      const current = (await el.getAttribute('value').catch(() => '')) || '';
      if (current && current !== 'Email' && current !== 'Password') {
        await el.clearValue().catch(() => {});
        await browser.pause(80);
        await el.click();
        await browser.pause(80);
      }
    } catch {
      // ignore
    }

    const value = String(text);
    if (this.#isAndroid()) {
      await el.addValue(value);
      return;
    }

    try {
      await browser.execute('mobile: type', { text: value });
    } catch {
      for (const ch of value) {
        await browser.keys([ch]);
        await browser.pause(8);
      }
    }
    await browser.pause(100);
  }

  async resolveEmailField() {
    if (this.#isAndroid()) {
      if (await this.#isShown(this.emailByTestId)) {
        return this.emailByTestId;
      }
      const android = $(
        'android=new UiSelector().className("android.widget.EditText").instance(0)',
      );
      if (await this.#isShown(android)) {
        return android;
      }
      return null;
    }
    if (await this.#isShown(this.emailByTestId)) {
      return this.emailByTestId;
    }
    if (await this.#isShown(this.emailField)) {
      return this.emailField;
    }
    return null;
  }

  async resolvePasswordField() {
    if (this.#isAndroid()) {
      if (await this.#isShown(this.passwordByTestId)) {
        return this.passwordByTestId;
      }
      const android = $(
        'android=new UiSelector().className("android.widget.EditText").instance(1)',
      );
      if (await this.#isShown(android)) {
        return android;
      }
      return null;
    }
    if (await this.#isShown(this.passwordByTestId)) {
      return this.passwordByTestId;
    }
    if (await this.#isShown(this.passwordSecure)) {
      return this.passwordSecure;
    }
    if (await this.#isShown(this.passwordField)) {
      return this.passwordField;
    }
    return null;
  }

  async waitForLoginScreen(timeout = 45000) {
    await this.dismissNoInternetAlertIfPresent();
    await browser.waitUntil(
      async () => {
        await this.dismissNoInternetAlertIfPresent();
        return Boolean(await this.resolveEmailField());
      },
      {
        timeout,
        interval: 1000,
        timeoutMsg:
          'Login screen did not appear (Email TextField not found).',
      },
    );
  }

  /**
   * Cold-start login screen between cases (avoids leftover session / home).
   */
  async resetAppToLoginScreen() {
    const isAndroid = this.#isAndroid();
    const appId = isAndroid
      ? process.env.ANDROID_APP_PACKAGE || 'ie.myroskids'
      : process.env.IOS_BUNDLE_ID || 'ie.myroskids';

    try {
      if (isAndroid) {
        await browser.terminateApp(appId);
        await browser.pause(400);
        await browser.activateApp(appId);
      } else {
        await browser.execute('mobile: terminateApp', { bundleId: appId });
        await browser.pause(400);
        await browser.execute('mobile: activateApp', { bundleId: appId });
      }
    } catch (err) {
      console.log(`resetAppToLoginScreen warning: ${err && err.message}`);
    }
    await this.waitForLoginScreen(60000);
  }

  /** Assert core Sign In controls are present (SI-P01). */
  async assertLoginFormVisible() {
    const email = await this.resolveEmailField();
    if (!email) {
      throw new Error('Email field not visible on Sign In');
    }
    const password = await this.resolvePasswordField();
    if (!password) {
      throw new Error('Password field not visible on Sign In');
    }
    // Title or primary button labeled Sign In
    if (this.#isAndroid()) {
      const btn = await $(
        'android=new UiSelector().text("Sign In")',
      );
      if (!(await this.#isShown(btn))) {
        throw new Error('Sign In control not visible');
      }
      return;
    }
    const signInBits = await $$(
      '-ios predicate string:label == "Sign In" OR name == "Sign In"',
    );
    if (!signInBits.length) {
      throw new Error('Sign In control not visible');
    }
  }

  async enterEmail(email) {
    await this.dismissNoInternetAlertIfPresent();
    const el = await this.resolveEmailField();
    if (!el) {
      throw new Error('Email field not found');
    }
    // Skip keyboard hide after email — password is next (avoids slow dismiss twice).
    await this.#typeInto(el, email);
  }

  async enterPassword(password) {
    await this.dismissNoInternetAlertIfPresent();
    const el = await this.resolvePasswordField();
    if (!el) {
      throw new Error('Password field not found');
    }
    await this.#typeInto(el, password);
    await this.#dismissKeyboardFast();
  }

  /**
   * Fast keyboard dismiss for RN iOS.
   * Avoids `mobile: hideKeyboard` (often slow / no-op) and expensive Sign In scans.
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
      const { width } = await browser.getWindowSize();
      // Tap near top title area (above inputs) to resign first responder.
      await browser.execute('mobile: tap', {
        x: Math.round(width / 2),
        y: 120,
      });
      await browser.pause(120);
      return;
    } catch {
      // fall through
    }
    try {
      await browser.keys(['\uE007']); // Return
      await browser.pause(80);
    } catch {
      // ignore
    }
  }

  async tapSignIn() {
    await this.#dismissKeyboardFast();

    if (await this.#isShown(this.signInByTestId)) {
      await this.#tapCenter(this.signInByTestId);
      return;
    }

    const button = await $(
      '-ios class chain:**/XCUIElementTypeButton[`name == "Sign In" OR label == "Sign In"`]',
    );
    if (await this.#isShown(button)) {
      await this.#tapCenter(button);
      return;
    }

    const candidates = await $$(
      '-ios predicate string:name == "Sign In" OR label == "Sign In"',
    );
    if (candidates.length === 0) {
      throw new Error('Sign In button not found');
    }

    let best = candidates[0];
    let maxY = -1;
    for (const el of candidates) {
      try {
        const loc = await el.getLocation();
        if (loc.y > maxY) {
          maxY = loc.y;
          best = el;
        }
      } catch {
        // skip
      }
    }
    await this.#tapCenter(best);
  }

  async #tapCenter(el) {
    try {
      const loc = await el.getLocation();
      const size = await el.getSize();
      const x = Math.round(loc.x + size.width / 2);
      const y = Math.round(loc.y + size.height / 2);
      await browser.execute('mobile: tap', { x, y });
    } catch {
      await el.click();
    }
  }

  /**
   * True while DefaultLoader overlay is up (login API in flight).
   * Spinner uses react-native-progress Circle → XCUIElementTypeOther / ActivityIndicator.
   */
  async #isLoginLoaderVisible() {
    if (this.#isAndroid()) {
      return false;
    }
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

  async #isHomeVisible() {
    const { testData } = require('../data/testData');
    if (this.#isAndroid()) {
      const aTile = await $(
        `android=new UiSelector().text("${testData.dashboardTileMyChildren}")`,
      );
      return this.#isShown(aTile);
    }
    const tileByText = await $(
      `-ios predicate string:label == "${testData.dashboardTileMyChildren}" OR name == "${testData.dashboardTileMyChildren}"`,
    );
    const bookByText = await $(
      `-ios predicate string:label == "${testData.dashboardTileBookService}" OR name == "${testData.dashboardTileBookService}"`,
    );
    return (
      (await this.#isShown(tileByText)) || (await this.#isShown(bookByText))
    );
  }

  async #isErrorToastVisible() {
    const { testData } = require('../data/testData');
    const byPredicate = await $(
      `-ios predicate string:label == "${testData.errorToastTitle}" OR name == "${testData.errorToastTitle}"`,
    );
    return this.#isShown(byPredicate);
  }

  /**
   * Reads login error toast body if visible (e.g. "Email or password is incorrect.").
   * Used to distinguish API rejection from a real crash / hang.
   */
  async getVisibleLoginErrorMessage() {
    if (this.#isAndroid()) {
      return null;
    }
    try {
      if (!(await this.#isErrorToastVisible())) {
        return null;
      }
      // react-native-toast-message usually exposes text2 as a StaticText
      const candidates = await $$(
        '-ios predicate string:label CONTAINS "incorrect" OR label CONTAINS "password" OR name CONTAINS "incorrect"',
      );
      for (const el of candidates) {
        if (await this.#isShown(el)) {
          const label =
            (await el.getAttribute('label').catch(() => null)) ||
            (await el.getAttribute('name').catch(() => null));
          if (label && label !== 'Error') {
            return String(label);
          }
        }
      }
      return 'Error (toast shown; see screenshot)';
    } catch {
      return null;
    }
  }

  /**
   * After Sign In: wait for home, or fail with a clear reason
   * (stuck loader = API hang; error toast = bad credentials / server error).
   */
  async isLoginSuccessful(timeout = 90000) {
    try {
      await browser.waitUntil(
        async () => {
          await this.dismissNoInternetAlertIfPresent();
          if (await this.#isHomeVisible()) {
            return true;
          }
          // Keep waiting while loader spins (API still in flight)
          if (await this.#isLoginLoaderVisible()) {
            return false;
          }
          // Loader gone but still on login → treat as settled failure
          if (await this.#isErrorToastVisible()) {
            return true; // exit wait; caller checks home
          }
          return false;
        },
        {
          timeout,
          interval: 1500,
          timeoutMsg: 'MainDashBoard was not displayed after Sign In',
        },
      );
      return await this.#isHomeVisible();
    } catch (err) {
      const loaderUp = await this.#isLoginLoaderVisible();
      const onLogin = await this.isStillOnLoginScreen();
      const errToast = await this.#isErrorToastVisible();
      console.log(
        `Login result diagnostic: loaderVisible=${loaderUp} stillOnLogin=${onLogin} errorToast=${errToast}`,
      );
      if (loaderUp) {
        console.log(
          'Login API appears stuck (loader never dismissed). Check device network and https://api.myroskids.ie/v1/auth/login (app uses production).',
        );
      }
      return false;
    }
  }

  async isStillOnLoginScreen() {
    return Boolean(await this.resolveEmailField());
  }

  async waitForErrorIndication(timeout = 20000) {
    const { testData } = require('../data/testData');
    await browser.waitUntil(
      async () => {
        const byPredicate = await $(
          `-ios predicate string:label == "${testData.errorToastTitle}" OR name == "${testData.errorToastTitle}"`,
        );
        return this.#isShown(byPredicate);
      },
      {
        timeout,
        interval: 500,
        timeoutMsg: 'Expected Error toast after invalid login',
      },
    );
  }

  /**
   * Wait until a toast / StaticText containing `text` is visible.
   * Covers client validation ("Please enter Email") and API Error body.
   */
  async waitForToastContaining(text, timeout = 20000) {
    const needle = String(text);
    await browser.waitUntil(
      async () => {
        if (this.#isAndroid()) {
          const el = await $(
            `android=new UiSelector().textContains("${needle.replace(/"/g, '\\"')}")`,
          );
          return this.#isShown(el);
        }
        const escaped = needle.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const el = await $(
          `-ios predicate string:label CONTAINS "${escaped}" OR name CONTAINS "${escaped}"`,
        );
        return this.#isShown(el);
      },
      {
        timeout,
        interval: 400,
        timeoutMsg: `Expected toast/text containing: ${needle}`,
      },
    );
  }

  /**
   * Tap Sign In with empty fields (no typing). Used by blank validation cases.
   */
  async tapSignInOnly() {
    await this.#dismissKeyboardFast();
    await this.tapSignIn();
  }
}

module.exports = new LoginPage();

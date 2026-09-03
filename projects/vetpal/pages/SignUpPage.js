/**
 * Sign Up tab (Login.js). Fill from data/signUpData.js — edit that file to
 * change email, +91, mobile, passwords. All taps use testID.
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');
const { signUpData } = require('../data/signUpData');
const LoginPage = require('./LoginPage');

class SignUpPage {
  /**
   * Open Sign Up after splash/login. Does not logout a Home session first —
   * call LoginPage.resetAppToLoginScreen() in beforeEach.
   */
  async ensureSignUpMode() {
    if (await ui.firstByTestId(TEST_IDS.login.email)) {
      return;
    }
    await LoginPage.waitForLoginScreen();
    await ui.requireTapTestId(TEST_IDS.login.signUpTab);
    await browser.waitUntil(
      async () => Boolean(await ui.firstByTestId(TEST_IDS.login.email)),
      {
        timeout: 8000,
        interval: 200,
        timeoutMsg:
          'login.email not visible after Sign Up tab — rebuild/reinstall the Vet Pal app',
      },
    );
  }

  /**
   * Sign Up form is showing (email field exists).
   * @returns {Promise<boolean>}
   */
  async isSignUpFormVisible() {
    return Boolean(await ui.firstByTestId(TEST_IDS.login.email));
  }

  async assertSignUpFormVisible() {
    await this.ensureSignUpMode();
    if (!(await ui.firstByTestId(TEST_IDS.login.email))) {
      throw new Error('Email field (login.email) not visible');
    }
    if (!(await ui.firstByTestId(TEST_IDS.login.mobile))) {
      throw new Error('Mobile field (login.mobile) not visible');
    }
    if (!(await ui.firstByTestId(TEST_IDS.login.password))) {
      throw new Error('Password field (login.password) not visible');
    }
    if (!(await ui.firstByTestId(TEST_IDS.login.confirmPassword))) {
      throw new Error('Confirm Password (login.confirmPassword) not visible');
    }
    if (!(await ui.firstByTestId(TEST_IDS.login.tncCheckbox))) {
      throw new Error('T&C checkbox (login.tncCheckbox) not visible');
    }
    if (!(await ui.firstByTestId(TEST_IDS.login.submit))) {
      throw new Error('Sign Up Now (login.submit) not visible');
    }
  }

  /**
   * Type into a field by testID.
   * @param {string} id
   * @param {string} value
   */
  async #typeByTestId(id, value) {
    const el = await ui.firstByTestId(id);
    if (!el) {
      throw new Error(
        `testID "${id}" not found — rebuild/reinstall the Vet Pal app`,
      );
    }
    try {
      await el.clearValue().catch(() => {});
      await el.setValue(String(value));
    } catch {
      await ui.typeInto(el, value);
    }
  }

  async enterEmail(email) {
    await this.#typeByTestId(TEST_IDS.login.email, email);
  }

  /**
   * Open country picker, tap `login.country.{code}`, Save.
   * @param {string} [code]
   */
  async selectCountryCode(code = signUpData.countryCode) {
    const wanted = String(code || '+91').trim();
    await ui.requireTapTestId(TEST_IDS.login.countryCode);
    await browser.pause(200);
    await ui.requireTapTestId(TEST_IDS.login.countryOption(wanted));
    await ui.requireTapTestId(TEST_IDS.login.countrySave);
    await browser.pause(150);
  }

  async enterMobile(mobile) {
    await this.#typeByTestId(TEST_IDS.login.mobile, mobile);
  }

  async enterPassword(password) {
    await this.#typeByTestId(TEST_IDS.login.password, password);
    await ui.dismissKeyboard().catch(() => {});
  }

  async enterConfirmPassword(password) {
    await this.#typeByTestId(TEST_IDS.login.confirmPassword, password);
    await ui.dismissKeyboard().catch(() => {});
  }

  async tickTerms() {
    await ui.requireTapTestId(TEST_IDS.login.tncCheckbox);
  }

  async tapSignUpNow() {
    await ui.dismissKeyboard().catch(() => {});
    await ui.requireTapTestId(TEST_IDS.login.submit);
  }

  /**
   * Happy path from signUpData.js.
   */
  async fillValidForm(overrides = {}) {
    const data = { ...signUpData, ...overrides };
    await this.ensureSignUpMode();
    await this.enterEmail(data.email);
    await this.selectCountryCode(data.countryCode);
    await this.enterMobile(data.mobileNumber);
    await this.enterPassword(data.password);
    await this.enterConfirmPassword(data.confirmPassword);
    await this.tickTerms();
  }

  /**
   * Successful register navigates to OtpVerifyScreen ("Enter OTP").
   * @param {number} [timeout=20000]
   * @returns {Promise<boolean>}
   */
  async isSignUpSuccessful(timeout = 20000) {
    try {
      await browser.waitUntil(
        async () => this.isOnOtpScreen(),
        { timeout, interval: 300 },
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @returns {Promise<boolean>}
   */
  async isOnOtpScreen() {
    if (ui.isAndroid()) {
      return ui.anyDisplayed('android=new UiSelector().textContains("Enter OTP")');
    }
    const els = await $$(
      '-ios predicate string:label == "Enter OTP" OR name == "Enter OTP"',
    );
    return els.length > 0;
  }

  /**
   * Stay on Enter OTP after register. OTP arrives on WhatsApp.
   * Duration comes from signUpData.otpWaitMs (default 30s).
   * @param {number} [ms]
   */
  async waitOnOtpScreen(ms = signUpData.otpWaitMs) {
    const waitMs = Number(ms) > 0 ? Number(ms) : 30000;
    ui.log('Sign Up', `On OTP screen — waiting ${waitMs}ms for WhatsApp OTP`);
    await browser.pause(waitMs);
  }

  /**
   * After WhatsApp wait: type OTP from signUpData.otp if set, tap Verify,
   * then Ok on SignUpSuccess → Login.
   */
  async completeOtpAndGoToSignIn() {
    await this.waitOnOtpScreen(signUpData.otpWaitMs);

    const fromData = String(signUpData.otp || '').replace(/\D/g, '');
    if (fromData.length === 6) {
      ui.log('Sign Up', 'Entering OTP from signUpData.otp');
      await ui.typeByTestId(TEST_IDS.otp.input, fromData);
    }

    await browser.waitUntil(
      async () => {
        if (await ui.firstByTestId(TEST_IDS.signupSuccess.ok)) {
          return true;
        }
        const typed = String(await ui.valueByTestId(TEST_IDS.otp.input)).replace(
          /\D/g,
          '',
        );
        return typed.length === 6;
      },
      {
        timeout: 90000,
        interval: 500,
        timeoutMsg:
          'Need a 6-digit OTP: set signUpData.otp or type it on the Enter OTP screen (WhatsApp)',
      },
    );

    if (!(await ui.firstByTestId(TEST_IDS.signupSuccess.ok))) {
      await ui.dismissKeyboard().catch(() => {});
      await ui.requireTapTestId(TEST_IDS.otp.verify);
    }

    await browser.waitUntil(
      async () => Boolean(await ui.firstByTestId(TEST_IDS.signupSuccess.ok)),
      {
        timeout: 25000,
        interval: 300,
        timeoutMsg:
          'SignUpSuccess Ok not shown after Verify OTP — rebuild/reinstall, or OTP was invalid',
      },
    );
    await ui.requireTapTestId(TEST_IDS.signupSuccess.ok);
    await LoginPage.ensureSignInMode();
  }

  async isStillOnSignUp() {
    return this.isSignUpFormVisible();
  }
}

module.exports = new SignUpPage();

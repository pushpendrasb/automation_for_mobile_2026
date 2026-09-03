/**
 * Sign Up tab (Login.js). Fill from data/signUpData.js — edit that file to
 * change email, +91, mobile, passwords. All taps use testID.
 *
 * Happy-path order (matches the Sign Up card):
 *   1. Email, country, mobile, password, confirm password
 *   2. Dismiss keyboard (Done) so T&C is not covered
 *   3. Tick login.tncCheckbox (not the Terms & Conditions link)
 *   4. Tap Sign Up Now
 *   5. Wait on Enter OTP (signUpData.otpWaitMs, default 20s) for a manual OTP
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');
const { signUpData } = require('../data/signUpData');
const LoginPage = require('./LoginPage');

class SignUpPage {
  /**
   * Open Sign Up from the default Sign In tab. Never taps Sign In — that
   * bounce (Sign In → Sign Up → Sign In) is what signup specs must avoid.
   */
  async ensureSignUpMode() {
    if (await ui.firstByTestId(TEST_IDS.login.email)) {
      return;
    }
    await LoginPage.waitForLoginForm();
    if (await ui.firstByTestId(TEST_IDS.login.email)) {
      return;
    }
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
   * Type into a field by testID. Always click first so iOS does not send
   * keys into the previous first responder (mobile swallowing the password).
   * @param {string} id
   * @param {string} value
   */
  async #typeByTestId(id, value) {
    await ui.typeByTestId(id, value);
  }

  /**
   * iOS SecureTextField often has name=null even with testID. Find by
   * placeholder ("Password" / "Confirm Password").
   * @param {string} placeholder
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #resolveSecureByPlaceholder(placeholder) {
    const escaped = ui.escape(placeholder);
    if (ui.isAndroid()) {
      return ui.firstDisplayed(
        `android=new UiSelector().text("${escaped}")`,
      );
    }
    const byPh = await ui.firstDisplayed(
      `-ios predicate string:placeholderValue == "${escaped}" OR value == "${escaped}"`,
    );
    if (byPh) {
      return byPh;
    }
    const secure = await $$(
      '-ios class chain:**/XCUIElementTypeSecureTextField',
    );
    for (const el of secure) {
      const ph =
        (await el.getAttribute('placeholderValue').catch(() => '')) || '';
      if (ph === placeholder) {
        return el;
      }
    }
    return null;
  }

  /**
   * Click then type a password field. Prefer testID; fall back to placeholder.
   * Does not dismiss the keyboard — caller does that after confirm password.
   * @param {string} id
   * @param {string} placeholder
   * @param {string} value
   */
  async #typeSecureField(id, placeholder, value) {
    try {
      if (await ui.firstByTestId(id)) {
        await ui.typeByTestId(id, value);
        return;
      }
    } catch {
      ui.log('Sign Up', `${id} setValue failed — try placeholder "${placeholder}"`);
    }
    const el = await this.#resolveSecureByPlaceholder(placeholder);
    if (!el) {
      throw new Error(
        `Password field "${placeholder}" not found — rebuild/reinstall the Vet Pal app`,
      );
    }
    await ui.typeInto(el, value);
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

  /**
   * Password field. Keyboard stays up so Confirm Password can be typed next.
   * @param {string} password
   */
  async enterPassword(password) {
    await this.#typeSecureField(
      TEST_IDS.login.password,
      'Password',
      password,
    );
  }

  /**
   * Confirm Password field. Keyboard stays up until {@link dismissKeyboardThenTickTerms}.
   * @param {string} password
   */
  async enterConfirmPassword(password) {
    await this.#typeSecureField(
      TEST_IDS.login.confirmPassword,
      'Confirm Password',
      password,
    );
  }

  /**
   * After Confirm Password: hide the keyboard, then tap T&C.
   * KeyboardToolbar.Done is not in the XCUITest tree — tap the hint
   * (`login.dismissKeyboard`) which sits above the keypad, then Return
   * so Confirm Password onSubmitEditing also calls Keyboard.dismiss().
   * Do not tap the Sign Up tab (that clears email/password in Login.js).
   * Do not tap the Terms & Conditions link.
   */
  async dismissKeyboardThenTickTerms() {
    try {
      await browser.keys(['Return']);
    } catch {
      // Return not mapped — hint tap below still dismisses
    }
    await browser.pause(150);
    await ui.dismissKeyboardUntilGone();
    await browser.pause(200);
    await this.tickTerms();
  }

  async tickTerms() {
    await ui.requireTapTestId(TEST_IDS.login.tncCheckbox);
    await browser.pause(150);
  }

  /**
   * Keyboard must already be gone so Sign Up Now is not covered.
   */
  async tapSignUpNow() {
    await ui.dismissKeyboardUntilGone();
    await ui.requireTapTestId(TEST_IDS.login.submit);
  }

  /**
   * Happy path from signUpData.js: fill fields → hide keyboard → T&C → ready
   * for Sign Up Now (caller taps submit).
   * @param {object} [overrides]
   */
  async fillValidForm(overrides = {}) {
    const data = { ...signUpData, ...overrides };
    await this.ensureSignUpMode();
    await this.enterEmail(data.email);
    await this.selectCountryCode(data.countryCode);
    await this.enterMobile(data.mobileNumber);
    await this.enterPassword(data.password);
    await this.enterConfirmPassword(data.confirmPassword);
    await this.dismissKeyboardThenTickTerms();
  }

  /**
   * Successful register navigates to OtpVerifyScreen ("Enter OTP").
   * @param {number} [timeout=25000]
   * @returns {Promise<boolean>}
   */
  async isSignUpSuccessful(timeout = 25000) {
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
   * OtpVerifyScreen — testIDs only (otp.input / otp.verify / otp.title).
   * Do not search "Enter OTP" by caption (that walks rect/x,y).
   * @returns {Promise<boolean>}
   */
  async isOnOtpScreen() {
    return ui.anyTestIdExists([
      TEST_IDS.otp.input,
      TEST_IDS.otp.verify,
      TEST_IDS.otp.title,
    ]);
  }

  /**
   * Stay on Enter OTP after register so you can type the WhatsApp OTP.
   * Duration comes from signUpData.otpWaitMs (default 20s).
   * @param {number} [ms]
   */
  async waitOnOtpScreen(ms = signUpData.otpWaitMs) {
    const waitMs = Number(ms) > 0 ? Number(ms) : 20000;
    ui.log(
      'Sign Up',
      `On OTP screen — waiting ${waitMs}ms. Type the 6-digit OTP on the device.`,
    );
    await browser.pause(waitMs);
  }

  /**
   * 6-digit value currently in otp.input, or empty.
   * @returns {Promise<string>}
   */
  async #otpDigits() {
    return String(await ui.valueByTestId(TEST_IDS.otp.input)).replace(/\D/g, '');
  }

  /**
   * Wait on Enter OTP, re-apply digits into otp.input so React state matches
   * the field, tap otp.verify, then signupSuccess.ok. TestIDs only — no x/y.
   */
  async completeOtpAndGoToSignIn() {
    await this.waitOnOtpScreen(signUpData.otpWaitMs);

    const fromData = String(signUpData.otp || '').replace(/\D/g, '');
    if (fromData.length === 6) {
      ui.log('Sign Up', 'Entering OTP from signUpData.otp');
      await ui.typeByTestId(TEST_IDS.otp.input, fromData);
    } else {
      ui.log(
        'Sign Up',
        'signUpData.otp is empty — waiting for a 6-digit OTP typed on the device',
      );
    }

    await browser.waitUntil(
      async () => {
        if (await ui.firstByTestId(TEST_IDS.signupSuccess.ok)) {
          return true;
        }
        return (await this.#otpDigits()).length === 6;
      },
      {
        timeout: 90000,
        interval: 500,
        timeoutMsg:
          'Need a 6-digit OTP: type it on the Enter OTP screen during/after the 20s wait (or set signUpData.otp)',
      },
    );

    if (!(await ui.firstByTestId(TEST_IDS.signupSuccess.ok))) {
      const digits = await this.#otpDigits();
      if (digits.length === 6) {
        // Manual iOS typing can fill XCUITest text without RN onChangeText.
        await ui.typeByTestId(TEST_IDS.otp.input, digits);
      }
      await ui.tapTestId(TEST_IDS.otp.title);
      ui.log('Sign Up', 'Tap Verify OTP (otp.verify)');
      await ui.requireTapTestId(TEST_IDS.otp.verify);
    }

    await browser.waitUntil(
      async () =>
        Boolean(
          (await ui.firstByTestId(TEST_IDS.signupSuccess.ok)) ||
            (await ui.firstByTestId(TEST_IDS.login.mobile)),
        ),
      {
        timeout: 25000,
        interval: 300,
        timeoutMsg:
          'signupSuccess.ok not shown after otp.verify — rebuild/reinstall, or OTP was invalid',
      },
    );
    if (await ui.firstByTestId(TEST_IDS.signupSuccess.ok)) {
      await ui.requireTapTestId(TEST_IDS.signupSuccess.ok);
    }
  }

  async isStillOnSignUp() {
    return this.isSignUpFormVisible();
  }
}

module.exports = new SignUpPage();

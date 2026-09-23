/**
 * Registration screen Page Object — VetPortal (vet user app).
 *
 * Source: vetpal-vetuser/src/Screens/Signup.js (+ Components/PlacePicker.js)
 * Opened from Sign In → "Register Now".
 */
const { ui } = require('./ui');
const LoginPage = require('./LoginPage');
const { TEST_IDS } = require('../data/testIds');
const { pickFromGallery, tapFirstShown } = require('../helpers/photos');

const IDS = TEST_IDS.signup;

/** iOS reports an empty TextField's placeholder as its value. */
const PLACEHOLDERS = {
  [IDS.eircode]: 'Enter eircode',
  [IDS.address]: 'Search address or eircode/postcode',
};

class SignUpPage {
  async openFromLogin() {
    await LoginPage.resetAppToLoginScreen();
    await ui.tapTestId(TEST_IDS.login.registerNow);
    // Wait for the push animation to finish before the first tap.
    await ui.waitForStable(await ui.waitForTestId(IDS.profileImage, 15000));
  }

  // ---------------------------------------------------------------- profile image

  async addProfileImageFromGallery() {
    await this.#openImageActionSheetAndChoose('Photos Library');
    await pickFromGallery();

    // The pencil badge renders as soon as the image is set; the S3 upload then
    // runs behind a modal loader that hides the form until it finishes.
    await ui.waitForTestId(IDS.editProfileImage, 30000);
    await ui.waitForTestId(IDS.firstName, 60000);
  }

  /**
   * Tap the profile image and choose an action-sheet option. The first tap can
   * land mid screen-transition and do nothing, so wait for the button to settle
   * and retry. On iOS the sheet is a native UIAlertController — if the button
   * query misses it, fall back to the XCUITest alert API.
   */
  async #openImageActionSheetAndChoose(option) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const button = await this.#reveal(IDS.profileImage);
      await ui.waitForStable(button);
      await button.click();

      if (await tapFirstShown([option], 4000)) {
        return;
      }
      if (!ui.isAndroid()) {
        const buttons = await browser.execute('mobile: alert', { action: 'getButtons' }).catch(() => null);
        if (Array.isArray(buttons) && buttons.includes(option)) {
          await browser.execute('mobile: alert', { action: 'accept', buttonLabel: option });
          await browser.pause(400);
          return;
        }
      }
      console.log(`[Registration] Image action sheet not shown (attempt ${attempt}/3) — retrying`);
    }
    await ui.dumpPageSource('profile-image-action-sheet');
    throw new Error(`"${option}" option did not appear in the image action sheet after 3 taps`);
  }

  // ---------------------------------------------------------------- text fields

  /** Scroll until the field is clear of the header, keyboard and Register Now bar. */
  async #reveal(id) {
    return ui.scrollToTestId(id, { topId: IDS.back, coverIds: [IDS.submit] });
  }

  /**
   * Type into a field, then read it back and retype on mismatch. setValue can
   * "succeed" while keystrokes land elsewhere (e.g. iOS Strong Password took focus).
   */
  async #type(id, value) {
    const expected = String(value || '');
    const name = id.replace('signup.', '');
    const isSecret = id === IDS.password;
    let actual = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      const el = await this.#reveal(id);
      await el.clearValue().catch(() => {});
      if (expected) {
        await el.setValue(expected);
      }
      if (isSecret) {
        await this.#declineStrongPassword(el, expected);
      }
      actual = await this.#fieldValue(await this.#reveal(id));
      const ok = isSecret ? actual.length === expected.length : actual === expected;
      if (ok) {
        console.log(`[Registration] ${name}: "${isSecret ? '*'.repeat(expected.length) : expected}"`);
        return;
      }
      console.log(
        `[Registration] ${name}: typed "${isSecret ? '***' : expected}" but field shows "${isSecret ? `${actual.length} chars` : actual}" — retry ${attempt}/3`,
      );
    }
    throw new Error(`Field "${name}" did not keep the typed value (shows "${isSecret ? `${actual.length} chars` : actual}")`);
  }

  /** Current text of an input; '' when empty (iOS reports the placeholder as value). */
  async #fieldValue(el) {
    const attr = ui.isAndroid() ? 'text' : 'value';
    const value = String((await el.getAttribute(attr).catch(() => '')) || '').trim();
    const placeholder = String(
      (await el.getAttribute(ui.isAndroid() ? 'hint' : 'placeholderValue').catch(() => '')) || '',
    ).trim();
    return value === placeholder ? '' : value;
  }

  /**
   * iOS may take over a new-password field with "Automatic Strong Password"
   * (yellow cover). Choose our own password and type it again.
   */
  async #declineStrongPassword(el, password) {
    if (ui.isAndroid()) {
      return;
    }
    const cover = await ui.firstDisplayed(ui.containsTextSelector('Strong Password'));
    if (!cover) {
      return;
    }
    console.log('[Registration] iOS Strong Password offered — choosing own password');
    const picked = await tapFirstShown(
      ['Choose My Own Password', 'Other Options…', 'Other Options...', 'Other Options'],
      4000,
    );
    if (picked && picked.startsWith('Other Options')) {
      await tapFirstShown(['Choose My Own Password', 'Don’t Use', "Don't Use"], 4000);
    }
    if (!picked) {
      await ui.dumpPageSource('strong-password');
    }
    await el.clearValue().catch(() => {});
    await el.setValue(password);
  }

  async #valueOf(id) {
    const el = await this.#reveal(id);
    const raw = String(
      (await el.getText().catch(() => '')) ||
        (await el.getAttribute(ui.isAndroid() ? 'text' : 'value').catch(() => '')) ||
        '',
    ).trim();
    return raw === PLACEHOLDERS[id] ? '' : raw;
  }

  async fillPersonalDetails(d) {
    await this.#type(IDS.firstName, d.firstName);
    await this.#type(IDS.middleName, d.middleName);
    await this.#type(IDS.lastName, d.lastName);
    await this.#type(IDS.email, d.email);
    await this.#type(IDS.password, d.password);
    await this.#type(IDS.mobile, d.mobile);
    await this.#type(IDS.qualification, d.qualification);
    await this.#type(IDS.vetRegNo, d.vetRegNo);
  }

  // ---------------------------------------------------------------- address

  /**
   * Map icon → Place Picker → search → tap the Nth suggestion (0-based).
   * @returns {Promise<string>} the address shown on the form afterwards
   */
  async pickAddress(search, index) {
    await this.#reveal(IDS.pickAddress);
    await ui.tapTestId(IDS.pickAddress);

    const field = await ui.waitForTestId(TEST_IDS.placePicker.search, 15000);
    await field.setValue(search);

    const row = await this.#waitForSuggestion(search, index);
    console.log(`[Registration] Address suggestion #${index + 1}: ${await row.getText().catch(() => '')}`);
    await row.click();

    await ui.waitForTestId(IDS.firstName, 15000).catch(() => {});
    let address = '';
    await browser.waitUntil(
      async () => {
        address = await this.#valueOf(IDS.address);
        return Boolean(address);
      },
      { timeout: 15000, interval: 500, timeoutMsg: 'Picked address did not appear on the form' },
    );
    return address;
  }

  /** Texts of the visible suggestion rows (placePicker.row.0 … row.N), in order. */
  async #suggestionTexts(max = 6) {
    const texts = [];
    for (let i = 0; i < max; i++) {
      const row = await ui.byTestId(TEST_IDS.placePicker.row(i));
      if (!row) {
        break;
      }
      texts.push(String(await row.getText().catch(() => '')).trim());
    }
    return texts;
  }

  /**
   * The autocomplete fires a request per typed letter and results arrive out of
   * order, so the list keeps changing for a moment. Only tap once two reads a
   * second apart are identical.
   */
  async #waitForSuggestion(search, index) {
    let previous = '';
    let texts = [];
    await browser.waitUntil(
      async () => {
        texts = await this.#suggestionTexts();
        const snapshot = texts.join(' | ');
        const stable = texts.length > index && snapshot === previous;
        previous = snapshot;
        return stable;
      },
      {
        timeout: 20000,
        interval: 1000,
        timeoutMsg: `Place Picker suggestions for "${search}" did not settle with at least ${index + 1} rows`,
      },
    );
    console.log(`[Registration] Suggestions for "${search}": ${texts.map((t, i) => `${i + 1}) ${t}`).join('  ')}`);
    return ui.byTestId(TEST_IDS.placePicker.row(index));
  }

  /** Keeps the eircode Google returned; types the fallback only if it is empty. */
  async ensureEircode(fallback) {
    let eircode = await this.#valueOf(IDS.eircode);
    if (!eircode) {
      await this.#type(IDS.eircode, fallback);
      eircode = fallback;
    }
    await this.#dismissKeyboard();
    return eircode;
  }

  // ---------------------------------------------------------------- consent + submit

  async checkAgreements() {
    for (const id of [IDS.agreement, IDS.terms]) {
      const box = await this.#reveal(id);
      await box.click();
      await browser.pause(200);
    }
  }

  async #dismissKeyboard() {
    if (!(await ui.isKeyboardShown())) {
      return;
    }
    if (ui.isAndroid()) {
      await browser.hideKeyboard().catch(() => {});
      return;
    }
    // Eircode has no onSubmitEditing, so return just blurs it.
    const eircode = await ui.byTestId(IDS.eircode);
    if (eircode) {
      await eircode.addValue('\n').catch(() => {});
    }
    await browser.pause(300);
  }

  async tapRegisterNow() {
    await this.#dismissKeyboard();
    await ui.tapTestId(IDS.submit);
  }

  /**
   * @returns {Promise<{ success: boolean, message: string|null }>}
   */
  async waitForRegistrationOutcome(successTitle, timeout = 45000) {
    let outcome = { success: false, message: null };
    await browser
      .waitUntil(
        async () => {
          if (await ui.firstDisplayed(ui.containsTextSelector(successTitle))) {
            outcome = { success: true, message: successTitle };
            return true;
          }
          const message = await LoginPage.getToastMessage();
          if (message) {
            outcome = { success: false, message };
            return true;
          }
          return false;
        },
        { timeout, interval: 500 },
      )
      .catch(() => {});
    return outcome;
  }

  /** Success alert "Ok" → app goes back to Sign In. */
  async confirmSuccessAlert() {
    await ui.tapTestId(TEST_IDS.alert.ok);
    await LoginPage.waitForLoginScreen(20000);
  }
}

module.exports = new SignUpPage();

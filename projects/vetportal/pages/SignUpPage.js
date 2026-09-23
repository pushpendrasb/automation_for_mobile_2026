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
    ui.resetLayoutCache();
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

  /**
   * Scroll until the field is clear of the header, keyboard and Register Now bar.
   * @param {string} id
   * @param {{ keepKeyboard?: boolean }} [opts] false = close the keyboard first
   */
  async #reveal(id, { keepKeyboard = true } = {}) {
    return ui.scrollToTestId(id, { topId: IDS.back, coverIds: [IDS.submit], keepKeyboard });
  }

  /**
   * Type into a field, then read it back and retype on mismatch. setValue can
   * "succeed" while keystrokes land elsewhere (e.g. iOS Strong Password took focus).
   * setValue already clears the field first; the read-back reuses the same
   * element instead of scrolling to it again (the field has not moved).
   * Retries close the keyboard first, in case it was covering the field.
   *
   * submit: press Return afterwards (iOS). Every signup field has
   * returnKeyType "next" + onSubmitEditing → focus the next field, and the
   * form then scrolls that field above the keyboard — so the next #type needs
   * no keyboard close or scroll. Not for the mobile field: its phone pad has
   * no Return key.
   * @param {string} id
   * @param {string} value
   * @param {{ submit?: boolean }} [opts]
   */
  async #type(id, value, { submit = false } = {}) {
    const expected = String(value || '');
    const name = id.replace('signup.', '');
    const isSecret = id === IDS.password;
    let actual = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      const el = await this.#reveal(id, { keepKeyboard: attempt === 1 });
      if (expected) {
        await el.setValue(expected);
      } else {
        await el.clearValue().catch(() => {});
      }
      if (isSecret) {
        await this.#declineStrongPassword(el, expected);
      }
      actual = await this.#fieldValue(el, isSecret ? '' : expected);
      const ok = isSecret ? actual.length === expected.length : actual === expected;
      if (ok) {
        console.log(`[Registration] ${name}: "${isSecret ? '*'.repeat(expected.length) : expected}"`);
        if (submit && !ui.isAndroid()) {
          await el.addValue('\n').catch(() => {});
        }
        return;
      }
      console.log(
        `[Registration] ${name}: typed "${isSecret ? '***' : expected}" but field shows "${isSecret ? `${actual.length} chars` : actual}" — retry ${attempt}/3`,
      );
    }
    throw new Error(`Field "${name}" did not keep the typed value (shows "${isSecret ? `${actual.length} chars` : actual}")`);
  }

  /**
   * Current text of an input; '' when empty (iOS reports the placeholder as value).
   * When the value already equals `expected` the placeholder lookup is skipped
   * (saves one Appium call on the common, successful path).
   * @param {WebdriverIO.Element} el
   * @param {string} [expected]
   */
  async #fieldValue(el, expected = '') {
    const attr = ui.isAndroid() ? 'text' : 'value';
    const value = String((await el.getAttribute(attr).catch(() => '')) || '').trim();
    if (!value || (expected && value === expected)) {
      return value;
    }
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

  /**
   * Fill the personal-details fields top to bottom, pressing Return between
   * them so the app itself moves focus + scrolls to the next field.
   */
  async fillPersonalDetails(d) {
    await this.#type(IDS.firstName, d.firstName, { submit: true });
    await this.#type(IDS.middleName, d.middleName, { submit: true });
    await this.#type(IDS.lastName, d.lastName, { submit: true });
    await this.#type(IDS.email, d.email, { submit: true });
    await this.#type(IDS.password, d.password, { submit: true });
    await this.#type(IDS.mobile, d.mobile);
    await this.#type(IDS.qualification, d.qualification, { submit: true });
    await this.#type(IDS.vetRegNo, d.vetRegNo);
  }

  // ---------------------------------------------------------------- address

  /**
   * Map icon → Place Picker → search → tap the Nth suggestion (0-based).
   * @returns {Promise<string>} the address shown on the form afterwards
   */
  async pickAddress(search, index) {
    await (await this.#reveal(IDS.pickAddress)).click();

    const field = await ui.waitForTestId(TEST_IDS.placePicker.search, 15000);
    await field.setValue(search);

    const row = await this.#waitForSuggestion(search, index);
    console.log(`[Registration] Address suggestion #${index + 1}: ${await row.getText().catch(() => '')}`);
    await row.click();

    // Back on the form once the picker's search box is gone. (Not firstName:
    // the form stays scrolled to the address, so firstName is off-screen.)
    await browser.waitUntil(async () => !(await ui.isTestIdShown(TEST_IDS.placePicker.search)), {
      timeout: 15000,
      interval: 300,
      timeoutMsg: 'Place Picker did not close after tapping a suggestion',
    });
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

  /**
   * All suggestion rows (placePicker.row.0 … row.N) in one query, in list
   * order, with their texts. One lookup + one getText per row, instead of a
   * displayed-check lookup per row index.
   * @returns {Promise<{ rows: WebdriverIO.Element[], texts: string[] }>}
   */
  async #suggestionRows() {
    const prefix = TEST_IDS.placePicker.row('');
    const selector = ui.isAndroid()
      ? `android=new UiSelector().resourceIdMatches("${prefix.replace(/\./g, '\\\\.')}[0-9]+")`
      : `-ios predicate string:name BEGINSWITH "${prefix}"`;
    const found = await $$(selector);
    const rows = [];
    const texts = [];
    for (const row of found) {
      rows.push(row);
      texts.push(String(await row.getText().catch(() => '')).trim());
    }
    return { rows, texts };
  }

  /**
   * The autocomplete fires a request per typed letter and results arrive out of
   * order, so the list keeps changing for a moment. Only tap once two reads in
   * a row (~0.6s apart) are identical.
   */
  async #waitForSuggestion(search, index) {
    let previous = '';
    let current = { rows: [], texts: [] };
    await browser.waitUntil(
      async () => {
        current = await this.#suggestionRows();
        const snapshot = current.texts.join(' | ');
        const stable = current.texts.length > index && snapshot === previous;
        previous = snapshot;
        return stable;
      },
      {
        timeout: 20000,
        interval: 600,
        timeoutMsg: `Place Picker suggestions for "${search}" did not settle with at least ${index + 1} rows`,
      },
    );
    console.log(
      `[Registration] Suggestions for "${search}": ${current.texts.map((t, i) => `${i + 1}) ${t}`).join('  ')}`,
    );
    return current.rows[index];
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

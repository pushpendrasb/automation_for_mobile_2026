/**
 * Create Profile (CreateProfile.js) — first login when
 * is_profile_completed != '1'. Fill from signUpData.profile.
 * All taps/types use testID.
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');
const { signUpData } = require('../data/signUpData');

/** Visible AnimalCat captions in CreateProfile.js (slash-safe lookup uses the first word). */
const ANIMAL_LABELS = {
  dairy: 'Dairy',
  beef: 'Beef/Suckler',
  equine: 'Equine',
  goats: 'Goats',
  sheep: 'Sheep',
  pigs: 'Pigs',
  poultry: 'Poultry',
};

class CreateProfilePage {
  /**
   * Create Profile is showing. Do not rely only on profile.firstName —
   * XCUITest often hides TextInput testIDs until accessible={true}.
   * Header "Create Profile" + "Hi," is unique to this screen (Splash/Login).
   * @returns {Promise<boolean>}
   */
  async isVisible() {
    if (
      await ui.anyTestIdExists([
        TEST_IDS.profile.firstName,
        TEST_IDS.profile.lastName,
        TEST_IDS.profile.submit,
      ])
    ) {
      return true;
    }
    if (!(await ui.isTextVisible('Create Profile'))) {
      return false;
    }
    if (await ui.isTextVisible('Hi,')) {
      return true;
    }
    const firstNamePh = await ui.firstDisplayed(
      ui.isAndroid()
        ? 'android=new UiSelector().text("Enter first name")'
        : '-ios predicate string:placeholderValue == "Enter first name" OR value == "Enter first name" OR label == "Enter first name"',
    );
    return Boolean(firstNamePh);
  }

  async waitForScreen(timeout = 20000) {
    await browser.waitUntil(async () => this.isVisible(), {
      timeout,
      interval: 300,
      timeoutMsg:
        'Create Profile screen not visible after Splash auth',
    });
  }

  /**
   * Google Place Picker (IE/UK only). Search then tap first result.
   * Address row often has no XCUITest name for profile.address — tap
   * placeholder / map pin after dismissing the last-name keyboard.
   * @param {string} query
   */
  async pickAddress(query) {
    await ui.dismissKeyboard().catch(() => {});
    await this.#openPlacePicker();

    await browser.waitUntil(
      async () =>
        Boolean(await ui.firstByTestId(TEST_IDS.placePicker.search)) ||
        (await ui.isTextVisible('Place Picker')),
      {
        timeout: 10000,
        interval: 200,
        timeoutMsg: 'Place Picker did not open',
      },
    );

    if (await ui.firstByTestId(TEST_IDS.placePicker.search)) {
      await ui.typeByTestId(TEST_IDS.placePicker.search, query);
    } else {
      const fields = await $$(
        '-ios class chain:**/XCUIElementTypeTextField',
      );
      if (!fields[0]) {
        throw new Error('Place Picker search field not found');
      }
      await fields[0].click();
      await fields[0].setValue(String(query));
    }

    // Do not tap Done — keepResultsAfterBlur is false, so Done hides the list.
    // Rows are StaticText (not Cells). First suggestion is typically "Dublin, Ireland".
    await browser.waitUntil(
      async () => Boolean(await this.#placeResultElement(query)),
      {
        timeout: 15000,
        interval: 300,
        timeoutMsg: `No Place Picker result for "${query}"`,
      },
    );
    const result = await this.#placeResultElement(query);
    ui.log('Profile', 'Tap Place Picker result');
    await result.click();
    await this.#dismissPlacePicker();
  }

  /**
   * Wait until Place Picker is gone. Do not tap Done here — the app moves
   * caret to Eircode, and Done would dismiss that and restore Last Name.
   * County and Country are filled by the picker — do not tap those fields next.
   */
  async #dismissPlacePicker() {
    await browser.waitUntil(
      async () =>
        !(await ui.firstByTestId(TEST_IDS.placePicker.search)) &&
        !(await ui.isTextVisible('Place Picker')),
      {
        timeout: 10000,
        interval: 200,
        timeoutMsg: 'Place Picker did not close after selecting an address',
      },
    );
    ui.log('Profile', 'Place Picker dismissed');
    await browser.pause(400);
  }

  /**
   * Open Place Picker from the Address row (testID, map pin, or placeholder).
   */
  async #openPlacePicker() {
    if (await ui.tapTestId(TEST_IDS.profile.address)) {
      return;
    }
    if (await ui.tapTestId(TEST_IDS.profile.addressMap)) {
      return;
    }
    const ph = 'Search address or eircode/postcode';
    const el = await ui.firstDisplayed(
      ui.isAndroid()
        ? `android=new UiSelector().textContains("Search address")`
        : `-ios predicate string:placeholderValue == "${ph}" OR value == "${ph}" OR label == "${ph}" OR placeholderValue CONTAINS "Search address" OR label CONTAINS "Search address"`,
    );
    if (el) {
      ui.log('Profile', 'Tap address placeholder to open Place Picker');
      await el.click();
      return;
    }
    throw new Error('Address field not found on Create Profile');
  }

  /**
   * First Google suggestion (StaticText), not the search field value.
   * @param {string} query
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #placeResultElement(query) {
    if (await ui.firstByTestId(TEST_IDS.placePicker.result(0))) {
      return ui.firstByTestId(TEST_IDS.placePicker.result(0));
    }

    const preferred = `${query}, Ireland`;
    const exact = await ui.firstDisplayed(
      `-ios predicate string:label == "${ui.escape(preferred)}" OR name == "${ui.escape(preferred)}"`,
    );
    if (exact) {
      return exact;
    }

    const needle = ui.escape(query);
    const texts = await $$(
      `-ios predicate string:type == "XCUIElementTypeStaticText" AND (label CONTAINS "${needle}" OR name CONTAINS "${needle}")`,
    );
    for (const el of texts) {
      const label = String(
        (await el.getAttribute('label').catch(() => '')) || '',
      );
      if (label === 'Place Picker' || label === query) {
        continue;
      }
      if (label.includes(',')) {
        return el;
      }
    }
    return null;
  }

  /**
   * True when the Country field already has a name (Place Picker sets IRELAND).
   * Do not treat the mobile +91 control ("Select country code") as this field.
   * @param {string} wanted
   */
  async #countryAlreadySet(wanted) {
    const needle = String(wanted || '').trim();
    if (
      needle &&
      ((await ui.firstCaption(needle)) || (await ui.firstCaptionContains(needle)))
    ) {
      return true;
    }
    const empty =
      (await ui.firstCaption('Enter Country')) ||
      (await ui.isTextVisible('Enter Country'));
    return !empty;
  }

  /**
   * Country sheet (IRELAND / UNITED KINGDOM). Place Picker already fills this
   * from the address — skip whenever a country name is showing.
   * Never tap the mobile country-code (+91) control.
   * @param {string} country
   */
  async selectCountry(country) {
    const wanted = String(country || 'IRELAND').trim();
    if (await this.#countryAlreadySet(wanted)) {
      ui.log(
        'Profile',
        `Country already set from address (${wanted}) — do not tap country or country code`,
      );
      return;
    }
    ui.log('Profile', `Country empty — select ${wanted}`);
    if (await ui.firstByTestId(TEST_IDS.profile.country)) {
      await ui.requireTapTestId(TEST_IDS.profile.country);
    } else if (await ui.firstCaption('Enter Country')) {
      await ui.tapText('Enter Country');
    } else {
      ui.log('Profile', 'Country picker not empty — skip rather than tap country code');
      return;
    }
    await browser.pause(200);
    if (await ui.firstByTestId(TEST_IDS.profile.countryOption(wanted))) {
      await ui.requireTapTestId(TEST_IDS.profile.countryOption(wanted));
      await ui.requireTapTestId(TEST_IDS.profile.countrySave);
    } else {
      await ui.tapText(wanted);
      await ui.tapText('Save');
    }
    await browser.pause(150);
  }

  /**
   * First match in the tree (KeyboardAwareScrollView often reports
   * isDisplayed=false for fields below the keyboard).
   * @param {string} selector
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #firstInTree(selector) {
    try {
      const els = await $$(selector);
      return els[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Find a placeholder field. Do not use `mobile: scroll` toVisible — XCUITest
   * swipes horizontally and selects First Name text after eircode.
   * Vertical swipe only when the field is not in the tree yet.
   * @param {string} placeholder
   */
  async #scrollToPlaceholder(placeholder) {
    const label = ui.escape(placeholder);
    const selector = ui.isAndroid()
      ? `android=new UiSelector().text("${label}")`
      : `-ios predicate string:placeholderValue == "${label}" OR value == "${label}"`;
    const existing = await this.#firstInTree(selector);
    if (existing) {
      return existing;
    }
    for (let i = 0; i < 6; i += 1) {
      await ui.dismissKeyboard().catch(() => {});
      await ui.swipeUp();
      const el = await this.#firstInTree(selector);
      if (el) {
        return el;
      }
    }
    return this.#firstInTree(selector);
  }

  /**
   * Splash/login already set mobile_number on the user. Do not retype it.
   * @returns {Promise<boolean>}
   */
  async #mobileAlreadyFilled() {
    const wanted = String(signUpData.mobileNumber || '').replace(/\D/g, '');
    const fields = await $$(
      '-ios class chain:**/XCUIElementTypeTextField',
    );
    for (const el of fields) {
      const raw =
        (await el.getAttribute('value').catch(() => '')) ||
        (await el.getText().catch(() => '')) ||
        '';
      const digits = String(raw).replace(/\D/g, '');
      if (wanted && digits.includes(wanted)) {
        return true;
      }
      if (digits.length >= 8) {
        return true;
      }
    }
    return false;
  }

  /**
   * Type by testID, or by placeholder when XCUITest hides the ID.
   * Scrolls the field into view first (eircode sits below the keyboard).
   * @param {string} id
   * @param {string} placeholder
   * @param {string} value
   */
  async #typeField(id, placeholder, value) {
    await ui.dismissKeyboard().catch(() => {});
    if (await ui.firstByTestId(id)) {
      await ui.scrollToTestId(id).catch(() => {});
      await ui.typeByTestId(id, value);
      return;
    }
    const el = await this.#scrollToPlaceholder(placeholder);
    if (!el) {
      throw new Error(
        `Field "${placeholder}" not found — scroll/dismiss keyboard and retry`,
      );
    }
    await el.click();
    await browser.pause(80);
    await el.clearValue().catch(() => {});
    try {
      await el.setValue(String(value));
    } catch {
      await el.addValue(String(value));
    }
  }

  /**
   * True when a text field has a real value (not empty / not the placeholder).
   * iOS often reports placeholder as `value`, so "Enter postcode" looked filled.
   * @param {string} id
   * @param {string[]} placeholders
   * @returns {Promise<boolean>}
   */
  async #hasRealValue(id, placeholders = []) {
    const raw = await ui.valueByTestId(id);
    const value = String(raw || '').trim();
    if (!value) {
      return false;
    }
    const lower = value.toLowerCase();
    return !placeholders.some(p => String(p).trim().toLowerCase() === lower);
  }

  /**
   * Dismiss keyboard, then swipe up so fields below come on screen
   * (company under mobile country code, Dairy under company).
   * @param {number} [times=1]
   */
  async #scrollUp(times = 1) {
    await ui.dismissKeyboard().catch(() => {});
    await browser.pause(200);
    for (let i = 0; i < times; i += 1) {
      ui.log('Profile', 'Scroll up');
      await ui.swipeUp();
      await browser.pause(250);
    }
  }

  /**
   * Wait until the iOS keyboard is gone so the next tap is not typed into
   * the previous field (eircode was keeping focus).
   */
  async #waitKeyboardHidden() {
    await ui.dismissKeyboard().catch(() => {});
    try {
      await browser.waitUntil(
        async () => !(await browser.isKeyboardShown()),
        { timeout: 4000, interval: 200 },
      );
    } catch {
      await ui.dismissKeyboard().catch(() => {});
    }
    await browser.pause(150);
  }

  /**
   * Value shown on a text field (placeholder is returned as value when empty).
   * @param {WebdriverIO.Element} el
   */
  async #textFieldValue(el) {
    return String(
      (await el.getAttribute('value').catch(() => '')) ||
        (await el.getText().catch(() => '')) ||
        '',
    );
  }

  /**
   * First TextField whose value or placeholder matches any needle.
   * @param {string[]} needles
   */
  async #findFieldByValueOrPlaceholder(needles) {
    const list = (needles || []).map(n => String(n).toLowerCase());
    const fields = await $$(
      ui.isAndroid()
        ? 'android=new UiSelector().className("android.widget.EditText")'
        : '-ios class chain:**/XCUIElementTypeTextField',
    );
    for (const el of fields) {
      const raw = (await this.#textFieldValue(el)).toLowerCase();
      const ph = String(
        (await el.getAttribute('placeholderValue').catch(() => '')) || '',
      ).toLowerCase();
      if (list.some(n => raw === n || raw.includes(n) || ph === n)) {
        return el;
      }
    }
    return null;
  }

  /**
   * Company name field (testID or empty placeholder). Never the eircode field.
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #companyField() {
    const byId = await ui.firstByTestId(TEST_IDS.profile.company);
    if (byId) {
      return byId;
    }
    return this.#findFieldByValueOrPlaceholder([
      'enter company name (optional)',
      'enter company name',
    ]);
  }

  /**
   * True when this TextField is County (already filled by Place Picker).
   * Never tap or type into it.
   * @param {WebdriverIO.Element} el
   * @returns {Promise<boolean>}
   */
  async #isCountyField(el) {
    const name = String(
      (await el.getAttribute('name').catch(() => '')) || '',
    ).toLowerCase();
    const ph = String(
      (await el.getAttribute('placeholderValue').catch(() => '')) || '',
    ).toLowerCase();
    return name === 'profile.county' || ph.includes('enter county');
  }

  /**
   * TextField whose placeholder is exactly `placeholder`. Skips County.
   * iOS often hides testID and only exposes placeholderValue.
   * @param {string} placeholder
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #fieldByPlaceholder(placeholder) {
    const want = String(placeholder).trim().toLowerCase();
    const fields = await $$(
      ui.isAndroid()
        ? 'android=new UiSelector().className("android.widget.EditText")'
        : '-ios class chain:**/XCUIElementTypeTextField',
    );
    for (const el of fields) {
      if (await this.#isCountyField(el)) {
        continue;
      }
      const ph = String(
        (await el.getAttribute('placeholderValue').catch(() => '')) || '',
      ).toLowerCase();
      if (ph === want) {
        return el;
      }
    }
    return null;
  }

  /**
   * Resolve an input by testID, else by placeholder. Never returns County.
   * @param {string} id
   * @param {string} placeholder
   * @returns {Promise<WebdriverIO.Element>}
   */
  async #resolveInput(id, placeholder) {
    const byId = await ui.firstByTestId(id);
    if (byId && !(await this.#isCountyField(byId))) {
      return byId;
    }
    const byPh = await this.#fieldByPlaceholder(placeholder);
    if (byPh) {
      return byPh;
    }
    throw new Error(`Field "${placeholder}" not found (id ${id})`);
  }

  /**
   * XCUITest first-responder flag. This WDA does not support hasKeyboardFocus;
   * use `focused` / `wdFocused`.
   * @param {WebdriverIO.Element} el
   * @returns {Promise<boolean|null>}
   */
  async #keyboardFocusState(el) {
    if (ui.isAndroid()) {
      return true;
    }
    const raw =
      (await el.getAttribute('focused').catch(() => '')) ||
      (await el.getAttribute('wdFocused').catch(() => '')) ||
      '';
    const v = String(raw).toLowerCase();
    if (v === 'true' || v === '1') {
      return true;
    }
    if (v === 'false' || v === '0') {
      return false;
    }
    return null;
  }

  /**
   * True only when XCUITest reports this field as first responder.
   * @param {WebdriverIO.Element} el
   * @returns {Promise<boolean>}
   */
  async #hasKeyboardFocus(el) {
    return (await this.#keyboardFocusState(el)) === true;
  }

  /**
   * True when the field is on screen and tappable (not covered by keyboard).
   * @param {WebdriverIO.Element} el
   * @returns {Promise<boolean>}
   */
  async #isHittable(el) {
    const raw =
      (await el.getAttribute('hittable').catch(() => '')) ||
      (await el.getAttribute('wdHittable').catch(() => '')) ||
      '';
    if (String(raw).toLowerCase() === 'true') {
      return true;
    }
    return el.isDisplayed().catch(() => false);
  }

  /**
   * Placeholder shown on a TextField (iOS placeholderValue).
   * @param {WebdriverIO.Element} el
   * @returns {Promise<string>}
   */
  async #placeholderOf(el) {
    return String(
      (await el.getAttribute('placeholderValue').catch(() => '')) || '',
    ).toLowerCase();
  }

  /**
   * True when this field is Mobile (pre-filled, not editable for this flow).
   * @param {WebdriverIO.Element} el
   */
  async #isMobileField(el) {
    const name = String(
      (await el.getAttribute('name').catch(() => '')) || '',
    ).toLowerCase();
    const ph = await this.#placeholderOf(el);
    return name === 'profile.mobile' || ph.includes('mobile');
  }

  /**
   * True when this field is Company name (never Mobile / Eircode / County).
   * @param {WebdriverIO.Element} el
   */
  async #isCompanyField(el) {
    const name = String(
      (await el.getAttribute('name').catch(() => '')) || '',
    ).toLowerCase();
    const ph = await this.#placeholderOf(el);
    return name === 'profile.company' || ph.includes('company');
  }

  /**
   * Company TextField only. Never returns Mobile (that caused "got 9664070794").
   * @returns {Promise<WebdriverIO.Element>}
   */
  async #resolveCompanyField() {
    const fields = await $$(
      ui.isAndroid()
        ? 'android=new UiSelector().className("android.widget.EditText")'
        : '-ios class chain:**/XCUIElementTypeTextField',
    );
    for (const el of fields) {
      if (await this.#isMobileField(el)) {
        continue;
      }
      if (await this.#isCountyField(el)) {
        continue;
      }
      if (await this.#isCompanyField(el)) {
        return el;
      }
    }
    throw new Error(
      'Company name field not found — swipe up so "Enter Company name" is on screen',
    );
  }

  /**
   * Hide keyboard if possible, then swipe the form up for the next section.
   * @param {string} reason
   */
  async #swipeUpForSection(reason) {
    ui.log('Profile', reason);
    await this.#hideKeyboardOnce();
    await browser.pause(200);
    await ui.swipeUp();
    await browser.pause(300);
  }

  /**
   * After Place Picker the address is multiline and Eircode sits below the
   * keyboard. Swipe up until "Enter postcode" is hittable, then tap it.
   * @returns {Promise<WebdriverIO.Element>}
   */
  async #swipeToEircodeAndTap() {
    ui.log('Profile', 'Swipe up then tap Eircode (Enter postcode)');
    let el = null;
    for (let i = 0; i < 4; i += 1) {
      el = await this.#fieldByPlaceholder('Enter postcode');
      if (el && (await this.#isHittable(el))) {
        break;
      }
      await ui.swipeUp();
      await browser.pause(300);
    }
    if (!el) {
      el = await this.#resolveInput(
        TEST_IDS.profile.postcode,
        'Enter postcode',
      );
    }
    await el.click().catch(() => ui.press(el));
    await browser.pause(250);
    return el;
  }

  /**
   * If Last Name still has the caret, tap accessory Done.
   */
  async #blurLastNameIfFocused() {
    const last = await this.#fieldByPlaceholder('Enter last name');
    if (!last || !(await this.#hasKeyboardFocus(last))) {
      return;
    }
    ui.log('Profile', 'Last Name still has caret — tap keyboard Done');
    await this.#hideKeyboardOnce();
  }

  /**
   * Tap KeyboardToolbar.Next until Eircode has the caret. Address (now editable)
   * and County sit between Last Name and Postcode — we never type into them.
   * @param {WebdriverIO.Element} postcodeEl
   * @returns {Promise<boolean>}
   */
  async #advanceKeyboardToPostcode(postcodeEl) {
    for (let i = 0; i < 4; i += 1) {
      if (await this.#hasKeyboardFocus(postcodeEl)) {
        return true;
      }
      ui.log('Profile', 'Tap keyboard Next toward Eircode (do not type County)');
      if (await ui.tapTestId(TEST_IDS.keyboard.next)) {
        await browser.pause(250);
        continue;
      }
      const nextBtn = await ui.firstDisplayed(
        '-ios predicate string:name == "keyboard.toolbar.next" OR label == "Next"',
      );
      if (!nextBtn) {
        return false;
      }
      await nextBtn.click();
      await browser.pause(250);
    }
    return this.#hasKeyboardFocus(postcodeEl);
  }

  /**
   * Click this field then addValue. Do not use setValue — on iOS that
   * sendKeys to the first responder (Last Name became "SinghD02 AF30").
   * @param {WebdriverIO.Element} el
   * @param {string} value
   */
  async #typeIntoElement(el, value) {
    if (await this.#isCountyField(el)) {
      throw new Error(
        'Refusing to type into County — Place Picker already set it',
      );
    }
    await this.#blurLastNameIfFocused();
    await el.click();
    await browser.pause(250);
    if ((await this.#keyboardFocusState(el)) === false) {
      ui.log(
        'Profile',
        'Clicked field did not take caret — dismiss then click again',
      );
      await this.#hideKeyboardOnce();
      await el.click();
      await browser.pause(250);
    }
    await el.addValue(String(value));
    await browser.pause(150);
  }

  /**
   * Click a field by testID or placeholder, then addValue.
   * @param {string} id
   * @param {string} placeholder
   * @param {string} value
   */
  async #typeIntoIdOrPlaceholder(id, placeholder, value) {
    const el = await this.#resolveInput(id, placeholder);
    ui.log('Profile', `Type "${value}" into ${id} / "${placeholder}"`);
    await this.#typeIntoElement(el, value);
    return el;
  }

  /**
   * Type eircode into Eircode/Postcode only. After Place Picker: swipe up so
   * the field is on screen, tap it, then type. Never tap County or Country.
   * @param {string} postcode
   */
  async #typePostcodeOnce(postcode) {
    await this.#hideKeyboardOnce();
    const el = await this.#swipeToEircodeAndTap();
    const now = await this.#textFieldValue(el);
    if (
      now.includes(postcode) &&
      !/vetpal|company|enter postcode/i.test(now)
    ) {
      ui.log('Profile', `Eircode already ${now} — skip`);
      return;
    }

    if (!(await this.#hasKeyboardFocus(el))) {
      await this.#advanceKeyboardToPostcode(el);
    }

    ui.log('Profile', `Type eircode into Enter postcode only: ${postcode}`);
    await el.addValue(String(postcode));
    await browser.pause(150);

    const written = await this.#textFieldValue(el);
    const last = await this.#fieldByPlaceholder('Enter last name');
    const lastVal = last ? await this.#textFieldValue(last) : '';
    if (String(lastVal).includes(postcode)) {
      throw new Error(
        `Eircode went into Last Name (got "${lastVal}") — reload Metro so Last Name locks after Place Picker`,
      );
    }
    if (!written.includes(postcode)) {
      throw new Error(
        `Eircode not in postcode field (got "${written}")`,
      );
    }
    await this.#dismissKeyboardUntilGone('Dismiss keyboard after Eircode');
  }

  /**
   * Tap accessory Done / Return until the keyboard is gone.
   * @param {string} reason
   */
  async #dismissKeyboardUntilGone(reason) {
    ui.log('Profile', reason);
    await this.#hideKeyboardOnce();
    for (let i = 0; i < 4; i += 1) {
      const shown = await browser.isKeyboardShown().catch(() => false);
      if (!shown) {
        return;
      }
      ui.log('Profile', 'Keyboard still up — tap Done / press Return');
      await this.#hideKeyboardOnce();
      try {
        await browser.keys(['Return']);
      } catch {
        await browser.execute('mobile: keys', { keys: ['\n'] });
      }
      await browser.pause(300);
    }
  }

  /**
   * Tap the "Company name" label, then the Company TextInput.
   * @returns {Promise<WebdriverIO.Element>}
   */
  async #tapCompanyNameThenField() {
    const caption =
      (await ui.firstCaption('Company name')) ||
      (await ui.firstCaptionContains('Company name'));
    if (caption) {
      ui.log('Profile', 'Tap Company name label');
      await caption.click().catch(() => ui.press(caption));
      await browser.pause(200);
    }
    const el = await this.#resolveCompanyField();
    ui.log('Profile', 'Tap Enter Company name (Optional)');
    await el.click().catch(() => ui.press(el));
    await browser.pause(300);
    return el;
  }

  /**
   * Type company into Company name only. Caller already dismissed the
   * Eircode keyboard and swiped up. Tap Company name, wait until Eircode
   * is not focused, then type.
   * @param {string} company
   */
  async #fillCompanyOnly(company) {
    let el = await this.#tapCompanyNameThenField();
    if (await this.#isMobileField(el)) {
      throw new Error('Refusing to type company into Mobile number');
    }

    const now = await this.#textFieldValue(el);
    if (
      now.includes(company) &&
      !/enter company/i.test(now) &&
      !/^\d+$/.test(now)
    ) {
      ui.log('Profile', `Company already "${now}"`);
      return;
    }

    const post = await this.#fieldByPlaceholder('Enter postcode');
    if (post && (await this.#hasKeyboardFocus(post))) {
      ui.log('Profile', 'Eircode still has caret — tap Company name again');
      await this.#dismissKeyboardUntilGone('Dismiss keyboard before Company');
      el = await this.#tapCompanyNameThenField();
    }
    if (post && (await this.#hasKeyboardFocus(post))) {
      throw new Error(
        'Cannot type Company — Eircode still has the caret. Keyboard Done did not dismiss.',
      );
    }

    ui.log('Profile', `Type "${company}" into Company name`);
    await el.addValue(String(company));
    await browser.pause(150);

    el = await this.#resolveCompanyField();
    const companyVal = await this.#textFieldValue(el);
    if (/^\d{6,}$/.test(String(companyVal).replace(/\s/g, ''))) {
      throw new Error(
        `Company name is the mobile number ("${companyVal}") — caret was on Mobile`,
      );
    }
    const postcodeEl = await this.#fieldByPlaceholder('Enter postcode');
    const postcodeVal = postcodeEl
      ? await this.#textFieldValue(postcodeEl)
      : '';
    if (String(postcodeVal).includes(company)) {
      throw new Error(
        `Company went into Eircode (got "${postcodeVal}")`,
      );
    }
    if (!String(companyVal).includes(company)) {
      throw new Error(
        `Company name still empty (got "${companyVal}")`,
      );
    }
    ui.log('Profile', `Company name is "${companyVal}"`);
    await this.#hideKeyboardOnce();
  }

  /**
   * Tick AnimalCat checkboxes. Herd No is not in the tree until at least one
   * livestock category is checked — do not type "Enter No" before this returns.
   * @param {string[]} keys dairy | beef | equine | goats | sheep | pigs | poultry
   */
  async #selectAnimals(keys) {
    const list = (keys || []).map(k => String(k).toLowerCase()).filter(Boolean);
    if (!list.length) {
      throw new Error('No animal categories configured in signUpData.profile.animals');
    }
    await this.#waitKeyboardHidden();
    ui.log('Profile', `Select animals: ${list.join(', ')}`);
    for (const key of list) {
      await this.#tapAnimalCategory(key);
      await browser.pause(250);
    }
    await browser.waitUntil(async () => this.#herdFieldReady(), {
      timeout: 8000,
      interval: 300,
      timeoutMsg:
        'Herd No ("Enter No") not shown — Dairy/Beef checkbox was not ticked',
    });
  }

  /**
   * Herd field only mounts after Dairy / Beef / Equine / … is checked.
   * @returns {Promise<boolean>}
   */
  async #herdFieldReady() {
    if (await ui.firstByTestId(TEST_IDS.profile.herdNo)) {
      return true;
    }
    if (await ui.firstCaptionContains('Herd No')) {
      return true;
    }
    const el = await ui.firstDisplayed(
      ui.isAndroid()
        ? 'android=new UiSelector().text("Enter No")'
        : '-ios predicate string:placeholderValue == "Enter No" OR value == "Enter No" OR label == "Enter No"',
    );
    return Boolean(el);
  }

  /**
   * 22px checkbox Other/Image sitting immediately left of a category caption.
   * @param {WebdriverIO.Element} labelEl
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #checkboxLeftOf(labelEl) {
    const loc = await labelEl.getLocation();
    const size = await labelEl.getSize();
    const midY = loc.y + size.height / 2;
    const selectors = [
      '-ios class chain:**/XCUIElementTypeImage',
      '-ios class chain:**/XCUIElementTypeButton',
      '-ios class chain:**/XCUIElementTypeOther',
    ];
    let best = null;
    let bestScore = Infinity;
    let scanned = 0;
    for (const sel of selectors) {
      let els = [];
      try {
        els = await $$(sel);
      } catch {
        els = [];
      }
      for (const el of els) {
        scanned += 1;
        if (scanned > 120) {
          break;
        }
        const r = await el.getLocation().catch(() => null);
        const s = await el.getSize().catch(() => null);
        if (!r || !s) {
          continue;
        }
        if (s.width < 14 || s.height < 14 || s.width > 36 || s.height > 36) {
          continue;
        }
        const dy = Math.abs(r.y + s.height / 2 - midY);
        const gap = loc.x - (r.x + s.width);
        if (dy > 18 || gap < -6 || gap > 48) {
          continue;
        }
        const score = dy + Math.abs(gap - 8);
        if (score < bestScore) {
          best = el;
          bestScore = score;
        }
      }
      if (best && sel !== selectors[2]) {
        return best;
      }
    }
    return best;
  }

  /**
   * Tap one AnimalCat checkbox. W3C pointer taps miss the SVG box on iOS —
   * click the native control, or XCUITest `mobile: tap` on the box left of the word.
   * @param {string} key
   */
  async #tapAnimalCategory(key) {
    const id = TEST_IDS.profile.animal(key);
    const label = ANIMAL_LABELS[key] || key;
    const needle = label.includes('/') ? label.split('/')[0].trim() : label;
    const escaped = ui.escape(needle);

    const tryHerd = async () => this.#herdFieldReady();

    if (await ui.firstByTestId(id)) {
      ui.log('Profile', `Tap animal testID ${id}`);
      await ui.tapTestId(id);
      await browser.pause(400);
      if (await tryHerd()) {
        return;
      }
    }

    let named = [];
    try {
      named = await $$(
        `-ios predicate string:(label == "${escaped}" OR name == "${escaped}") AND type != XCUIElementTypeApplication AND type != XCUIElementTypeWindow`,
      );
    } catch {
      named = [];
    }
    for (const el of named) {
      if (!(await ui.isUsableCaption(el))) {
        continue;
      }
      ui.log('Profile', `Click animal control "${needle}"`);
      await el.click().catch(() => ui.tap(el));
      await browser.pause(400);
      if (await tryHerd()) {
        return;
      }
    }

    const caption =
      (await ui.firstCaption(needle)) ||
      (await ui.firstCaptionContains(needle));
    if (!caption) {
      await this.#scrollUp(1);
    }
    const textEl =
      caption ||
      (await ui.firstCaption(needle)) ||
      (await ui.firstCaptionContains(needle));
    if (!textEl) {
      throw new Error(`Animal category "${label}" not on screen`);
    }

    const loc = await textEl.getLocation();
    const size = await textEl.getSize();
    const y = loc.y + size.height / 2;
    // Checkbox is 22px + 8px margin to the left of the caption.
    const xs = [loc.x - 19, loc.x - 11, loc.x + 8];
    for (const x of xs) {
      ui.log(
        'Profile',
        `mobile: tap ${needle} checkbox at ${Math.round(x)},${Math.round(y)}`,
      );
      await ui.tapAt(x, y);
      await browser.pause(400);
      if (await tryHerd()) {
        return;
      }
    }

    const box = await this.#checkboxLeftOf(textEl);
    if (box) {
      ui.log('Profile', `Click checkbox left of "${needle}"`);
      await box.click().catch(() => ui.tap(box));
      await browser.pause(400);
      if (await tryHerd()) {
        return;
      }
    }
  }

  /**
   * Type herd number into Enter No. Swipe until the field is on screen, tap
   * it, type, then dismiss the keyboard (Done) so Organic Yes is visible.
   * @param {string} herdNo
   */
  async #typeHerdOnce(herdNo) {
    ui.log('Profile', 'Swipe up then tap Herd No (Enter No)');
    let el = null;
    for (let i = 0; i < 4; i += 1) {
      el =
        (await ui.firstByTestId(TEST_IDS.profile.herdNo)) ||
        (await this.#fieldByPlaceholder('Enter No'));
      if (el && (await this.#isHittable(el))) {
        break;
      }
      await ui.swipeUp();
      await browser.pause(300);
    }
    if (!el) {
      throw new Error('Herd No field not found');
    }
    const now = await this.#textFieldValue(el);
    if (now.includes(herdNo) && !/enter no/i.test(now)) {
      ui.log('Profile', `Herd already ${now}`);
      await this.#dismissKeyboardUntilGone('Dismiss keyboard after Herd No');
      return;
    }
    ui.log('Profile', `Type herd ${herdNo}`);
    await el.click().catch(() => ui.press(el));
    await browser.pause(250);
    await el.addValue(String(herdNo));
    await browser.pause(150);
    await this.#dismissKeyboardUntilGone('Dismiss keyboard after Herd No');
  }

  /**
   * Tap accessory Done so Last Name is not still the first responder.
   * Do not skip when isKeyboardShown is false — WDA reported that after
   * Last Name and then D02 AF30 was typed into Singh.
   */
  async #hideKeyboardOnce() {
    ui.log('Profile', 'Tap Done to hide keyboard');
    await ui.tapKeyboardDone().catch(() => {});
    await browser.pause(300);
  }

  /**
   * Tap Organic Farming Yes. Keyboard must already be dismissed and the
   * form swiped so the Yes pill is on screen.
   */
  async #tapOrganicYes() {
    const id = TEST_IDS.profile.organicYes;
    for (let i = 0; i < 3; i += 1) {
      ui.log('Profile', `Tap Organic Farming Yes (${id})`);
      if (await ui.tapTestId(id)) {
        ui.log('Profile', `Tapped Organic Yes ${id}`);
        return;
      }
      const caption =
        (await ui.firstCaption('Organic Farming')) ||
        (await ui.firstCaptionContains('Organic Farming'));
      if (caption) {
        ui.log('Profile', 'Tap Organic Farming label');
        await caption.click().catch(() => ui.press(caption));
        await browser.pause(150);
        if (await ui.tapTestId(id)) {
          ui.log('Profile', `Tapped Organic Yes ${id}`);
          return;
        }
      }
      const yes = await this.#organicYesControl();
      if (yes) {
        ui.log('Profile', 'Tap Organic Farming Yes');
        await yes.click().catch(() => ui.tap(yes));
        return;
      }
      ui.log('Profile', 'Organic Yes not on screen — swipe up');
      await ui.swipeUp();
      await browser.pause(300);
    }
    throw new Error('Organic Farming Yes not found after swipe');
  }

  /**
   * Organic pill when testID is not in the tree. Prefer the Yes on the
   * Organic Farming row. Do not require isDisplayed — keyboard/footer often
   * make XCUITest report false while the control is still tappable.
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #organicYesControl() {
    const caption = await ui.firstDisplayed(
      ui.isAndroid()
        ? 'android=new UiSelector().text("Organic Farming")'
        : '-ios predicate string:label == "Organic Farming" OR name == "Organic Farming" OR value == "Organic Farming"',
    );
    const yesEls = await $$(
      ui.isAndroid()
        ? 'android=new UiSelector().text("Yes")'
        : '-ios predicate string:label == "Yes" OR name == "Yes"',
    );
    const captionLoc = caption
      ? await caption.getLocation().catch(() => null)
      : null;

    let best = null;
    let bestScore = Infinity;
    for (const el of yesEls) {
      const loc = await el.getLocation().catch(() => null);
      if (!loc) {
        continue;
      }
      const score = captionLoc
        ? Math.abs(loc.y - captionLoc.y) + loc.x
        : loc.y;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best || yesEls[0] || null;
  }

  /**
   * Footer Create Profile via testID `profile.submit` (TouchableOpacity, not a
   * native Button — do not require XCUIElementTypeButton).
   */
  async #tapCreateProfileButton() {
    await this.#hideKeyboardOnce();
    const id = TEST_IDS.profile.submit;
    ui.log('Profile', `Tap Create Profile testID ${id}`);
    if (await ui.tapTestId(id)) {
      return;
    }
    const els = await $$(
      ui.isAndroid()
        ? `android=new UiSelector().resourceId("${id}")`
        : '-ios predicate string:name == "profile.submit" OR label == "Create Profile" OR name == "Create Profile"',
    );
    let best = null;
    let bestY = -1;
    for (const el of els) {
      const loc = await el.getLocation().catch(() => null);
      const size = await el.getSize().catch(() => null);
      if (!loc || !size || size.height < 24) {
        continue;
      }
      if (loc.y > bestY) {
        best = el;
        bestY = loc.y;
      }
    }
    if (!best) {
      throw new Error(
        `testID "${id}" not found — rebuild/reinstall the Vet Pal app`,
      );
    }
    ui.log('Profile', 'Tap footer Create Profile (lowest Create Profile control)');
    await best.click().catch(() => ui.tap(best));
  }

  /**
   * Required fields from CreateProfile.js isValidateProfileInfo.
   * After country code / mobile: scroll up → tap company → type →
   * scroll up → tap Dairy (then Beef). Do not retype eircode after company.
   * @param {object} [overrides]
   */
  async fillAndSubmit(overrides = {}) {
    const data = { ...signUpData.profile, ...overrides };
    await this.waitForScreen();

    await this.#typeField(
      TEST_IDS.profile.firstName,
      'Enter first name',
      data.firstName,
    );
    await this.#typeField(
      TEST_IDS.profile.lastName,
      'Enter last name',
      data.lastName,
    );
    await this.#hideKeyboardOnce();
    await this.pickAddress(data.addressSearch);
    // 1) Picker closed → swipe up → Eircode only (do not tap County / Country / Mobile).
    await this.#swipeUpForSection('Swipe up for Eircode');
    await this.#typePostcodeOnce(data.postcode);

    // Mobile is pre-filled — never tap it.
    if (await this.#mobileAlreadyFilled()) {
      ui.log('Profile', 'Mobile already filled — skip');
    }

    // 2) Eircode filled → keyboard gone → swipe up → tap Company name → type.
    if (data.company) {
      ui.log('Profile', 'Swipe up for Company name');
      await ui.swipeUp();
      await browser.pause(300);
      await this.#fillCompanyOnly(data.company);
    }

    // 3) Company filled → swipe up → Animal category.
    await this.#swipeUpForSection('Swipe up for Animal category');

    const animals =
      Array.isArray(data.animals) && data.animals.length
        ? data.animals
        : [data.animal || 'dairy'];
    await this.#selectAnimals(animals);

    // 4) Animals ticked → swipe up → Herd No.
    ui.log('Profile', 'Swipe up for Herd No');
    await ui.swipeUp();
    await browser.pause(300);
    await this.#typeHerdOnce(data.herdNo);

    // 5) Herd filled, keyboard gone → swipe up → Organic Farming Yes.
    ui.log('Profile', 'Swipe up for Organic Farming Yes');
    await ui.swipeUp();
    await browser.pause(300);
    await this.#tapOrganicYes();
    await this.#tapCreateProfileButton();
    ui.log('Profile', 'Tapped Create Profile — waiting for Subscribe Vets');
  }

  /**
   * After a successful create, flash-message onHide → SubscribeVets
   * (isFromCreateProfile) with a welcome OK, then Skip Now → Home.
   */
  async skipSubscribeAndWaitHome(timeout = 35000) {
    const skipReady = async () =>
      Boolean(
        (await ui.firstByTestId(TEST_IDS.subscribe.skip)) ||
          (await ui.firstCaption('Skip Now')),
      );

    let retriedSubmit = false;
    await browser.waitUntil(
      async () => {
        if (await ui.firstByTestId(TEST_IDS.home.requestTreatment)) {
          return true;
        }
        if (await ui.firstByTestId(TEST_IDS.alert.ok)) {
          await ui.tapTestId(TEST_IDS.alert.ok);
          await browser.pause(250);
        }
        if (await skipReady()) {
          return true;
        }
        const errorAlert = await ui.firstDisplayed(
          ui.isAndroid()
            ? 'android=new UiSelector().text("Error")'
            : '-ios predicate string:label == "Error" OR name == "Error"',
        );
        if (errorAlert) {
          throw new Error(
            'Create Profile API returned Error — check address/eircode and try again',
          );
        }
        if (!retriedSubmit && (await this.isVisible())) {
          retriedSubmit = true;
          ui.log(
            'Profile',
            'Still on Create Profile — dismiss keyboard, Organic Yes, submit again',
          );
          await this.#dismissKeyboardUntilGone('Dismiss keyboard before retry submit');
          await ui.swipeUp();
          await this.#tapOrganicYes().catch(() => {});
          await this.#tapCreateProfileButton();
        }
        return false;
      },
      {
        timeout,
        interval: 400,
        timeoutMsg:
          'Still on Create Profile after submit (organic/eircode/validation) or Subscribe Skip Now not shown',
      },
    );

    if (await ui.firstByTestId(TEST_IDS.home.requestTreatment)) {
      return;
    }

    if (await ui.firstByTestId(TEST_IDS.alert.ok)) {
      await ui.requireTapTestId(TEST_IDS.alert.ok);
    }

    if (await ui.firstByTestId(TEST_IDS.subscribe.skip)) {
      await ui.requireTapTestId(TEST_IDS.subscribe.skip);
    } else {
      await ui.tapText('Skip Now');
    }

    await browser.waitUntil(
      async () =>
        Boolean(await ui.firstByTestId(TEST_IDS.home.requestTreatment)),
      {
        timeout: 20000,
        interval: 300,
        timeoutMsg: 'Home (home.tile.0) not shown after Skip Now',
      },
    );
  }
}

module.exports = new CreateProfilePage();

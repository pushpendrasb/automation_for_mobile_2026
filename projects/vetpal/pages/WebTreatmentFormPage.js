/**
 * Nearby Step 3 assessment only (`NewPrescriptionForRemedyStore.js`).
 * Vet Practice uses RequestSummaryPage (`summary.submitNow`) — do not call
 * this page from TC-VP-* tests.
 *
 * The form is a react-native-webview, but XCUITest on this device flattens
 * it into NATIVE_APP (checkbox, text fields, footer Submit). There is often
 * no WEBVIEW_* context. Fill native first; use HTML only if a WEBVIEW exists.
 *
 * Success: app `postMessage` / success URL → `navigation.goBack()` to
 * Pending Prescriptions — not Vet Practice “Submit Request Now”.
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');

class WebTreatmentFormPage {
  #nativeForm = true;

  async listContexts() {
    try {
      return await browser.getContexts();
    } catch (err) {
      ui.log('WebView', `getContexts failed: ${err.message}`);
      return ['NATIVE_APP'];
    }
  }

  /**
   * @returns {Promise<string|null>} WEBVIEW context name, or null to stay native
   */
  async switchToWebView() {
    const found = await ui.waitTrue(
      async () => {
        const contexts = await this.listContexts();
        ui.log('WebView', `Contexts: ${contexts.join(', ')}`);
        return contexts.some(c => /WEBVIEW/i.test(String(c)));
      },
      4000,
      400,
    );
    if (!found) {
      ui.log(
        'WebView',
        'No WEBVIEW context — fill Step 3 in NATIVE_APP (XCUITest flattens the assessment)',
      );
      this.#nativeForm = true;
      return null;
    }
    const contexts = await this.listContexts();
    const web = contexts.find(c => /WEBVIEW/i.test(String(c)));
    await browser.switchContext(web);
    ui.log('WebView', `Switched to ${web}`);
    this.#nativeForm = false;
    await browser.pause(800);
    return web;
  }

  async switchToNative() {
    const contexts = await this.listContexts();
    const native = contexts.find(c => c === 'NATIVE_APP') || 'NATIVE_APP';
    await browser.switchContext(native);
    ui.log('WebView', `Returned to ${native}`);
  }

  async fillMandatoryFields() {
    const web = await this.switchToWebView();
    if (!web) {
      await this.#fillNativeAssessment();
      return;
    }
    await this.#fillHtmlAssessment();
  }

  /**
   * True when Nearby already landed on Pending Prescriptions — stop filling.
   * @returns {Promise<boolean>}
   */
  async #isOnPendingPrescriptions() {
    if (await ui.firstByTestId(TEST_IDS.pending.requestAdvice)) {
      return true;
    }
    return ui.anyDisplayed(ui.pendingPrescriptionsSelector());
  }

  /**
   * Protocol findElements — a real Array. WDIO `$$()[i]` on an empty
   * ElementArray waits then throws "Index out of bounds".
   * @param {string} using
   * @param {string} value
   * @returns {Promise<object[]>}
   */
  async #rawFind(using, value) {
    try {
      const refs = await browser.findElements(using, value);
      return Array.isArray(refs) && refs.length > 0 ? refs : [];
    } catch {
      return [];
    }
  }

  /**
   * @param {object} ref WebDriver element reference
   */
  async #clickRef(ref) {
    const id =
      ref &&
      (ref.ELEMENT || ref['element-6066-11e4-a52e-4f735466cecf']);
    if (!id) {
      return;
    }
    try {
      await browser.elementClick(id);
    } catch {
      try {
        await $(ref).click();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Snapshot `$$` into a real array. Empty WDIO ElementArray `[0]` / for-of
   * waits then throws "Index out of bounds" (Cattle log).
   * @param {string} selector
   * @returns {Promise<object[]>}
   */
  async #elements(selector) {
    let using = 'css selector';
    let value = selector;
    if (selector.startsWith('-ios class chain:')) {
      using = '-ios class chain';
      value = selector.replace(/^-ios class chain:/, '').trim();
    } else if (selector.startsWith('-ios predicate string:')) {
      using = '-ios predicate string';
      value = selector.replace(/^-ios predicate string:/, '').trim();
    } else if (selector.startsWith('android=')) {
      using = '-android uiautomator';
      value = selector.replace(/^android=/, '');
    }
    return this.#rawFind(using, value);
  }

  /**
   * Horse / species assessment as native XCUITest nodes.
   * WKWebView keyboard exposes toolbar Done — do not tap rt.header (it does not blur).
   */
  async #fillNativeAssessment() {
    if (await this.#isOnPendingPrescriptions()) {
      ui.log('WebView', 'Already on Pending Prescriptions — skip fill');
      return;
    }
    await this.#dismissRequiredAlert();

    const consent =
      (await ui.firstCaptionContains('I confirm that the animals')) ||
      (await ui.firstUsableContains('Animal Health Confirmation'));
    if (consent) {
      ui.log('WebView', 'Tap consent checkbox (native)');
      await consent.click().catch(() => ui.press(consent));
    }

    for (let pass = 0; pass < 3; pass += 1) {
      await this.#fillNativeTextFields();
      await this.#dismissWebKeyboard();
      await this.#tickNativeCheckControls();
      if (pass < 2) {
        await ui.swipeUp();
      }
    }
    await this.#dismissWebKeyboard();
  }

  async #fillNativeTextFields() {
    const fields = await this.#nativeTextFields();
    ui.log('WebView', `Native text fields: ${fields.length}`);
    for (let i = 0; i < fields.length; i += 1) {
      const el = $(fields[i]);
      if (!(await this.#isEmptyNativeField(el))) {
        continue;
      }
      const fill = (await this.#looksNumeric(el)) ? '5' : 'demo';
      ui.log('WebView', `Fill native field → ${fill}`);
      await el.click().catch(() => {});
      try {
        await el.setValue(fill);
      } catch {
        await ui.typeInto(el, fill);
      }
    }
  }

  /**
   * Assessment WKWebView toolbar Done is in the XCUITest tree.
   */
  async #dismissWebKeyboard() {
    if (!(await ui.isKeyboardVisible())) {
      return;
    }
    ui.log('WebView', 'Dismiss assessment keyboard (toolbar Done)');
    if (await ui.tapKeyboardDone()) {
      await browser.pause(200);
      return;
    }
    await ui.tapKeyboardAccessoryDone();
    await browser.pause(200);
  }

  /**
   * HTML checkboxes flatten as CheckBox / unchecked Button — never Switch
   * (`$$` Switch on an empty tree throws Index out of bounds and never stops).
   */
  async #tickNativeCheckControls() {
    const boxes = ui.isAndroid()
      ? await this.#rawFind(
          '-android uiautomator',
          'new UiSelector().className("android.widget.CheckBox")',
        )
      : await this.#rawFind('-ios class chain', '**/XCUIElementTypeCheckBox');
    ui.log('WebView', `Native CheckBox count=${boxes.length}`);
    for (let i = 0; i < boxes.length; i += 1) {
      await this.#clickRef(boxes[i]);
    }

    const buttons = await this.#rawFind(
      '-ios class chain',
      '**/XCUIElementTypeButton',
    );
    let ticked = 0;
    for (let i = 0; i < buttons.length && ticked < 12; i += 1) {
      const ref = buttons[i];
      const id =
        ref.ELEMENT || ref['element-6066-11e4-a52e-4f735466cecf'];
      if (!id) {
        continue;
      }
      let label = '';
      let value = '';
      try {
        label = String(
          (await browser.getElementAttribute(id, 'label')) ||
            (await browser.getElementAttribute(id, 'name')) ||
            '',
        );
        value = String(
          (await browser.getElementAttribute(id, 'value')) || '',
        ).toLowerCase();
      } catch {
        continue;
      }
      if (/submit|done|ok|back|next|close/i.test(label)) {
        continue;
      }
      if (value === '1' || value === 'true' || value === 'checked') {
        continue;
      }
      if (value === '0' || value === 'false' || value === 'unchecked') {
        ui.log('WebView', `Tick option button "${label || value}"`);
        await this.#clickRef(ref);
        ticked += 1;
      }
    }
  }

  /**
   * Web form alert: "Please fill all the required fields" + Ok.
   * @returns {Promise<boolean>}
   */
  async #dismissRequiredAlert() {
    const msg =
      (await ui.firstCaptionContains('required fields')) ||
      (await ui.firstCaptionContains('Please fill all'));
    if (!msg) {
      return false;
    }
    ui.log('WebView', 'Required-fields popup — tap Ok');
    const ok =
      (await this.#firstButtonLabeled(['Ok', 'OK'])) ||
      (await ui.firstCaption('Ok')) ||
      (await ui.firstCaption('OK'));
    if (ok) {
      await ok.click().catch(() => ui.press(ok));
      await browser.pause(400);
      return true;
    }
    return false;
  }

  /**
   * @param {string[]} labels
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #firstButtonLabeled(labels) {
    for (const label of labels) {
      const els = await this.#elements(
        `-ios predicate string:type == "XCUIElementTypeButton" AND (label == "${label}" OR name == "${label}")`,
      );
      if (els.length) {
        return $(els[0]);
      }
    }
    return null;
  }

  /**
   * @returns {Promise<WebdriverIO.Element[]>}
   */
  async #nativeTextFields() {
    const chain = ui.isAndroid()
      ? 'android=new UiSelector().className("android.widget.EditText")'
      : '-ios class chain:**/XCUIElementTypeTextField';
    return this.#elements(chain);
  }

  /**
   * @param {WebdriverIO.Element} el
   * @returns {Promise<boolean>}
   */
  async #isEmptyNativeField(el) {
    const value = String(
      (await el.getValue().catch(() => '')) ||
        (await el.getAttribute('value').catch(() => '')) ||
        '',
    ).trim();
    if (!value) {
      return true;
    }
    return /enter|total|placeholder|select/i.test(value);
  }

  /**
   * @param {WebdriverIO.Element} el
   * @returns {Promise<boolean>}
   */
  async #looksNumeric(el) {
    const hint = String(
      (await el.getAttribute('placeholderValue').catch(() => '')) ||
        (await el.getAttribute('label').catch(() => '')) ||
        (await el.getValue().catch(() => '')) ||
        '',
    );
    return /number|horses|count|age|1-10|total/i.test(hint);
  }

  async #fillHtmlAssessment() {
    const inputs = await $$('input, textarea, select');
    ui.log('WebView', `Found ${inputs.length} form controls`);
    for (const el of inputs) {
      const type = (
        (await el.getAttribute('type').catch(() => '')) || ''
      ).toLowerCase();
      const required =
        (await el.getAttribute('required').catch(() => null)) != null;
      const value = (await el.getValue().catch(() => '')) || '';
      if (type === 'hidden' || type === 'submit' || type === 'button') {
        continue;
      }
      if (type === 'checkbox' || type === 'radio') {
        const checked = await el.isSelected().catch(() => false);
        if (!checked && required) {
          await el.click();
        }
        continue;
      }
      if (value.trim()) {
        continue;
      }
      const fill = type === 'number' || type === 'tel' ? '1' : 'demo';
      await el.setValue(fill);
    }

    const boxes = await $$('input[type="checkbox"]');
    if (boxes.length) {
      const checked = await boxes[0].isSelected().catch(() => false);
      if (!checked) {
        await boxes[0].click();
      }
    }
  }

  async submitForm() {
    if (!this.#nativeForm) {
      const buttons = await this.#elements(
        'button, input[type="submit"], [role="button"]',
      );
      for (let i = 0; i < buttons.length; i += 1) {
        const btn = buttons[i];
        const text = (
          (await btn.getText().catch(() => '')) ||
          (await btn.getAttribute('value').catch(() => '')) ||
          ''
        ).toLowerCase();
        if (/submit|continue|next|finish/i.test(text)) {
          await btn.click();
          ui.log('WebView', `Clicked web button: ${text}`);
          await browser.pause(1500);
          return;
        }
      }
      throw new Error(
        'No Submit/Continue button found in assessment WebView. Inspect the live HTML.',
      );
    }

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      if (await this.#isOnPendingPrescriptions()) {
        ui.log('WebView', 'Already on Pending Prescriptions — skip Submit');
        return;
      }
      await this.#dismissRequiredAlert();
      if (attempt > 1) {
        await this.#fillNativeAssessment();
      }
      await this.#submitNative();
      await browser.pause(800);
      if (await this.#isOnPendingPrescriptions()) {
        ui.log('WebView', 'Pending Prescriptions after Submit — stop');
        return;
      }
      if (await this.#dismissRequiredAlert()) {
        ui.log('WebView', `Required-fields Ok, fill again (attempt ${attempt})`);
        continue;
      }
      return;
    }
  }

  async #submitNative() {
    await this.#dismissWebKeyboard();
    await browser.waitUntil(
      async () => Boolean(await this.#nativeSubmitButton()),
      {
        timeout: 8000,
        interval: 250,
        timeoutMsg: 'Nearby Step 3 native Submit button not found',
      },
    );
    const btn = await this.#nativeSubmitButton();
    ui.log('WebView', 'Tap native Submit');
    await btn.click().catch(() => ui.press(btn));
    await browser.pause(1500);
  }

  /**
   * Footer Submit is a Button (not StaticText). Hidden while the keypad is up.
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #nativeSubmitButton() {
    const selectors = ui.isAndroid()
      ? ['android=new UiSelector().text("Submit")']
      : [
          '-ios class chain:**/XCUIElementTypeButton[`label == "Submit" OR name == "Submit"`]',
          '-ios predicate string:type == "XCUIElementTypeButton" AND (label == "Submit" OR name == "Submit")',
        ];
    for (const sel of selectors) {
      const els = await this.#elements(sel);
      if (els.length > 0) {
        return $(els[0]);
      }
    }
    return (
      (await ui.firstCaption('Submit')) ||
      (await ui.firstUsableContains('Submit'))
    );
  }

  /**
   * App `handleFormSubmission` navigates back to Pending Prescriptions.
   */
  async verifySubmission() {
    if (await this.#isOnPendingPrescriptions()) {
      ui.log('WebView', 'Already on Pending Prescriptions after Nearby submit');
      await ui.screenshot('nearby-after-webview-submit');
      return;
    }
    if (await this.#dismissRequiredAlert()) {
      await this.#fillNativeAssessment();
      await this.submitForm();
    }
    if (!this.#nativeForm) {
      const url = await browser.getUrl().catch(() => '');
      ui.log('WebView', `After submit url=${url}`);
      await this.switchToNative().catch(() => {});
    }
    await browser.waitUntil(
      async () => {
        if (await this.#dismissRequiredAlert()) {
          return false;
        }
        return this.#isOnPendingPrescriptions();
      },
      {
        timeout: 25000,
        interval: 400,
        timeoutMsg:
          'Pending Prescriptions not shown after Nearby Step 3 Submit (app goBack)',
      },
    );
    ui.log('WebView', 'Back on Pending Prescriptions after Nearby submit');
    await ui.screenshot('nearby-after-webview-submit');
  }
}

module.exports = new WebTreatmentFormPage();

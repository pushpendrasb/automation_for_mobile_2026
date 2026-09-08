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
 *
 * Horse/species forms can include a **Remedy Store** `<select>` below the
 * fold. Do not `setValue` on that control (it hangs). Open the picker,
 * choose `REMEDY_STORE_NAME`, then tick Animal Health Confirmation and Submit.
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');
const { providerData } = require('../data/providerData');

class WebTreatmentFormPage {
  #nativeForm = true;
  /** Consent is a toggle — click only once or later passes untick it. */
  #animalHealthTicked = false;
  /** Y of the consent caption — skip later clicks in this band. */
  #animalHealthY = null;

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
    this.#animalHealthTicked = false;
    this.#animalHealthY = null;
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
   * After the mandatory consent * tick: dismiss keyboard, then Submit
   * (`submitForm`) — do not type again (that re-opens the keypad over Submit).
   */
  async #fillNativeAssessment() {
    if (await this.#isOnPendingPrescriptions()) {
      ui.log('WebView', 'Already on Pending Prescriptions — skip fill');
      return;
    }
    await this.#dismissRequiredAlert();
    await this.#dismissWebKeyboard();
    await this.#fillRequiredStarFields();
    await this.#fillNativeTextFields();
    await this.#dismissWebKeyboard();
    await this.#tickAnimalHealthConfirmation();
    await this.#dismissWebKeyboard();
    ui.log('WebView', 'Consent done — keyboard dismissed, ready for Submit');
  }

  /**
   * WKWebView accessory Next — moves to the next question (including `<select>`).
   * @returns {Promise<boolean>}
   */
  async #tapToolbarNext() {
    if (await ui.tapTestId(TEST_IDS.keyboard.next)) {
      ui.log('WebView', 'Toolbar Next');
      return true;
    }
    const next = await this.#firstButtonLabeled(['Next']);
    if (next) {
      ui.log('WebView', 'Toolbar Next (button)');
      await next.click().catch(() => ui.press(next));
      return true;
    }
    return false;
  }

  /**
   * Scroll the assessment WKWebView (app-level swipe does not move its content).
   */
  async #scrollWebView() {
    const webs = await this.#rawFind(
      '-ios class chain',
      '**/XCUIElementTypeWebView',
    );
    if (webs.length) {
      const id =
        webs[0].ELEMENT || webs[0]['element-6066-11e4-a52e-4f735466cecf'];
      ui.log('WebView', 'Scroll assessment WebView down');
      try {
        await browser.execute('mobile: scroll', {
          element: id,
          direction: 'down',
        });
        return;
      } catch {
        try {
          await browser.execute('mobile: swipe', {
            direction: 'up',
            element: id,
          });
          return;
        } catch {
          // fall through
        }
      }
    }
    await ui.swipeUp();
  }

  /**
   * Q1 Animal Health Confirmation. The web form often loads already ticked.
   * Clicking the caption or the square toggles it off — never click it once
   * it is ticked (on load or after we tick an unchecked box).
   */
  async #tickAnimalHealthConfirmation() {
    if (this.#animalHealthTicked) {
      return;
    }
    const title =
      (await ui.firstCaptionContains('Animal Health Confirmation')) ||
      (await ui.firstUsableContains('Animal Health Confirmation'));
    const consent =
      title || (await ui.firstCaptionContains('I confirm that the animals'));
    if (consent) {
      const loc = await consent.getLocation().catch(() => null);
      this.#animalHealthY = loc && Number.isFinite(loc.y) ? loc.y : 280;
    }

    const state = await this.#animalHealthCheckState();
    if (state === 'checked') {
      ui.log(
        'WebView',
        'Animal Health Confirmation already ticked — leave it',
      );
      this.#animalHealthTicked = true;
      return;
    }

    ui.log('WebView', 'Tick mandatory Animal Health Confirmation *');
    const square = await this.#smallConsentCheckbox();
    if (square) {
      await this.#clickRef(square);
    } else if (title) {
      await title.click().catch(() => ui.press(title));
    } else {
      const para = await ui.firstCaptionContains('I confirm that the animals');
      if (para) {
        await para.click().catch(() => ui.press(para));
      }
    }
    this.#animalHealthTicked = true;
  }

  /**
   * Empty grey square next to the consent sentence (not the long text).
   * @returns {Promise<object|null>}
   */
  async #smallConsentCheckbox() {
    const fromState = await this.#animalHealthCheckboxRef();
    if (fromState) {
      return fromState;
    }
    const buttons = await this.#rawFind(
      '-ios class chain',
      '**/XCUIElementTypeButton',
    );
    const boxes = await this.#rawFind(
      '-ios class chain',
      '**/XCUIElementTypeCheckBox',
    );
    const refs = [...boxes, ...buttons];
    for (let i = 0; i < refs.length; i += 1) {
      const ref = refs[i];
      const id =
        ref.ELEMENT || ref['element-6066-11e4-a52e-4f735466cecf'];
      if (!id) {
        continue;
      }
      let label = '';
      let y = null;
      let w = 0;
      let h = 0;
      try {
        label = String(
          (await browser.getElementAttribute(id, 'label')) || '',
        );
        const rect = await browser.getElementRect(id);
        y = rect.y;
        w = rect.width;
        h = rect.height;
      } catch {
        continue;
      }
      if (/submit|done|ok|back|next|close/i.test(label)) {
        continue;
      }
      if (this.#isAnimalHealthText(label)) {
        continue;
      }
      if (w > 48 || h > 48 || w < 8 || h < 8) {
        continue;
      }
      if (
        this.#animalHealthY != null &&
        y >= this.#animalHealthY - 20 &&
        y <= this.#animalHealthY + 140
      ) {
        return ref;
      }
    }
    return null;
  }

  /**
   * @returns {Promise<'checked'|'unchecked'|'unknown'>}
   */
  async #animalHealthCheckState() {
    const boxes = await this.#consentAreaCheckControls();
    let sawUnchecked = false;
    for (const item of boxes) {
      if (item.checked) {
        return 'checked';
      }
      if (item.unchecked) {
        sawUnchecked = true;
      }
    }
    if (sawUnchecked) {
      return 'unchecked';
    }
    return 'unknown';
  }

  /**
   * Unchecked consent checkbox ref, if any.
   * @returns {Promise<object|null>}
   */
  async #animalHealthCheckboxRef() {
    const boxes = await this.#consentAreaCheckControls();
    const unchecked = boxes.find(item => item.unchecked && item.ref);
    return unchecked ? unchecked.ref : null;
  }

  /**
   * CheckBox / toggle buttons in the Q1 consent band (or labeled as consent).
   * @returns {Promise<Array<{ ref: object, checked: boolean, unchecked: boolean }>>}
   */
  async #consentAreaCheckControls() {
    const out = [];
    const chains = ui.isAndroid()
      ? [
          [
            '-android uiautomator',
            'new UiSelector().className("android.widget.CheckBox")',
          ],
        ]
      : [
          ['-ios class chain', '**/XCUIElementTypeCheckBox'],
          ['-ios class chain', '**/XCUIElementTypeButton'],
        ];
    for (const [using, value] of chains) {
      const refs = await this.#rawFind(using, value);
      for (let i = 0; i < refs.length; i += 1) {
        const ref = refs[i];
        const id =
          ref.ELEMENT || ref['element-6066-11e4-a52e-4f735466cecf'];
        if (!id) {
          continue;
        }
        let label = '';
        let val = '';
        let y = null;
        try {
          label = String(
            (await browser.getElementAttribute(id, 'label')) ||
              (await browser.getElementAttribute(id, 'name')) ||
              '',
          );
          val = String(
            (await browser.getElementAttribute(id, 'value')) || '',
          ).toLowerCase();
          const rect = await browser.getElementRect(id);
          y = rect && typeof rect.y === 'number' ? rect.y : null;
        } catch {
          continue;
        }
        if (/submit|done|ok|back|next|close/i.test(label)) {
          continue;
        }
        const inBand =
          this.#animalHealthY != null &&
          y != null &&
          y >= this.#animalHealthY - 40 &&
          y <= this.#animalHealthY + 160;
        const labeled = this.#isAnimalHealthText(`${label} ${val}`);
        if (!inBand && !labeled) {
          continue;
        }
        out.push({
          ref,
          checked:
            val === '1' || val === 'true' || val === 'checked',
          unchecked:
            val === '0' || val === 'false' || val === 'unchecked',
        });
      }
    }
    return out;
  }

  /**
   * True for the Q1 consent control (caption, empty checkbox square, or
   * long sentence button). Must not be clicked again after the first tick.
   * @param {string} id
   * @param {string} label
   * @param {string} value
   * @returns {Promise<boolean>}
   */
  async #isConsentControl(id, label, value) {
    const blob = `${label || ''} ${value || ''}`;
    if (this.#isAnimalHealthText(blob)) {
      return true;
    }
    if (String(label || '').length > 50) {
      return true;
    }
    if (this.#animalHealthY == null || !id) {
      return false;
    }
    let y = null;
    try {
      const rect = await browser.getElementRect(id);
      y = rect && typeof rect.y === 'number' ? rect.y : null;
    } catch {
      y = null;
    }
    if (y == null) {
      return false;
    }
    return y >= this.#animalHealthY - 40 && y <= this.#animalHealthY + 160;
  }

  /**
   * @param {string} text
   * @returns {boolean}
   */
  #isAnimalHealthText(text) {
    return /animal health|i confirm that the animals|consent to share/i.test(
      String(text || ''),
    );
  }

  /**
   * Fill every question whose title includes `*` (mandatory). Consent * is
   * handled by {@link #tickAnimalHealthConfirmation} and is not clicked again.
   */
  async #fillRequiredStarFields() {
    const questions = await this.#starQuestionLabels();
    ui.log('WebView', `Mandatory * questions visible: ${questions.length}`);
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      if (this.#isAnimalHealthText(q.text)) {
        continue;
      }
      ui.log('WebView', `Fill mandatory * "${q.text.slice(0, 64)}"`);
      await this.#fillControlBelowStar(q);
    }
  }

  /**
   * Visible StaticText titles that include an asterisk.
   * @returns {Promise<Array<{ el: WebdriverIO.Element, text: string, y: number }>>}
   */
  async #starQuestionLabels() {
    const refs = await this.#rawFind(
      '-ios predicate string',
      'type == "XCUIElementTypeStaticText" AND (label CONTAINS "*" OR name CONTAINS "*" OR value CONTAINS "*")',
    );
    const out = [];
    for (let i = 0; i < refs.length; i += 1) {
      const el = $(refs[i]);
      const text = String(
        (await el.getAttribute('label').catch(() => '')) ||
          (await el.getText().catch(() => '')) ||
          '',
      ).trim();
      if (!text || /core treatment|must complete|every treatment/i.test(text)) {
        continue;
      }
      const loc = await el.getLocation().catch(() => null);
      if (!loc) {
        continue;
      }
      out.push({ el, text, y: loc.y });
    }
    out.sort((a, b) => a.y - b.y);
    return out;
  }

  /**
   * Fill the input / select sitting under a `*` question title.
   * @param {{ el: WebdriverIO.Element, text: string, y: number }} question
   */
  async #fillControlBelowStar(question) {
    const store = String(providerData.remedyStore || '').trim();
    const fields = await this.#nativeTextFields();
    let best = null;
    let bestDy = 9999;
    for (let i = 0; i < fields.length; i += 1) {
      const el = $(fields[i]);
      const loc = await el.getLocation().catch(() => null);
      if (!loc) {
        continue;
      }
      const dy = loc.y - question.y;
      if (dy > 4 && dy < 220 && dy < bestDy) {
        best = el;
        bestDy = dy;
      }
    }
    if (best) {
      if (await this.#isSelectLikeField(best)) {
        await this.#openAndPickSelect(best, store);
        return;
      }
      if (await this.#isEmptyNativeField(best)) {
        const fill = (await this.#looksNumeric(best)) ? '5' : 'demo';
        ui.log('WebView', `Mandatory * field → ${fill}`);
        await best.click().catch(() => {});
        try {
          await best.setValue(fill);
        } catch {
          await ui.typeInto(best, fill);
        }
        await this.#dismissWebKeyboard();
      }
      return;
    }
    const popups = await this.#elements(
      '-ios class chain:**/XCUIElementTypePopUpButton',
    );
    for (let i = 0; i < popups.length; i += 1) {
      const el = $(popups[i]);
      const loc = await el.getLocation().catch(() => null);
      if (!loc) {
        continue;
      }
      const dy = loc.y - question.y;
      if (dy > 4 && dy < 220) {
        await this.#openAndPickSelect(el, store);
        return;
      }
    }
  }

  async #fillNativeTextFields() {
    const fields = await this.#nativeTextFields();
    ui.log('WebView', `Native text fields: ${fields.length}`);
    for (let i = 0; i < fields.length; i += 1) {
      const el = $(fields[i]);
      if (await this.#isSelectLikeField(el)) {
        continue;
      }
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
      const ref = boxes[i];
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
      if (await this.#isConsentControl(id, label, value)) {
        continue;
      }
      if (
        this.#animalHealthTicked &&
        i === 0 &&
        !String(label || '').trim()
      ) {
        continue;
      }
      if (value === '1' || value === 'true' || value === 'checked') {
        continue;
      }
      await this.#clickRef(ref);
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
      if (await this.#isConsentControl(id, label, value)) {
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
    if (await this.#isSelectLikeField(el)) {
      return false;
    }
    return /enter|total|placeholder/i.test(value);
  }

  /**
   * HTML `<select>` / iOS PopUpButton — value is often "Select Remedy Store".
   * Typing into these hangs XCUITest; pick an option instead.
   * @param {WebdriverIO.Element} el
   * @returns {Promise<boolean>}
   */
  async #isSelectLikeField(el) {
    const blob = await this.#fieldBlob(el);
    if (/animal health|consent|confirm that the animals|submit/i.test(blob)) {
      return false;
    }
    if (/select all that apply/i.test(blob)) {
      return false;
    }
    return (
      /remedy store|pharmacy|dispense store|select store|select a store/i.test(
        blob,
      ) || /^(select|choose)\b/i.test(blob.trim())
    );
  }

  /**
   * @param {WebdriverIO.Element} el
   * @returns {Promise<string>}
   */
  async #fieldBlob(el) {
    const parts = await Promise.all([
      el.getValue().catch(() => ''),
      el.getAttribute('value').catch(() => ''),
      el.getAttribute('label').catch(() => ''),
      el.getAttribute('name').catch(() => ''),
      el.getAttribute('placeholderValue').catch(() => ''),
      el.getText().catch(() => ''),
    ]);
    return parts.map(p => String(p || '')).join(' ');
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

  /**
   * One lookup for the Remedy Store `<select>` (no inner scroll loop).
   */
  async #pickRemedyStoreSelectOnce() {
    const store = String(providerData.remedyStore || '').trim();
    const control = await this.#remedyStoreSelectControl();
    if (!control) {
      return;
    }
    const blob = await this.#fieldBlob(control);
    if (store && blob.toLowerCase().includes(store.toLowerCase())) {
      return;
    }
    if (!/select|choose/i.test(blob) && /pharmacy|store/i.test(blob)) {
      return;
    }
    ui.log('WebView', `Open Remedy Store select (${blob.slice(0, 60)})`);
    await this.#openAndPickSelect(control, store);
  }

  /**
   * Step 3 Remedy Store dropdown — scroll the WebView until the control exists,
   * then pick `REMEDY_STORE_NAME`.
   */
  async #pickRemedyStoreSelect() {
    for (let i = 0; i < 4; i += 1) {
      const before = await this.#remedyStoreSelectControl();
      if (before) {
        await this.#pickRemedyStoreSelectOnce();
        return;
      }
      await this.#scrollWebView();
      await browser.pause(250);
    }
    await this.#pickRemedyStoreSelectOnce();
  }

  /**
   * Control for the assessment Remedy Store `<select>`.
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #remedyStoreSelectControl() {
    const named =
      (await ui.firstUsableContains('Select Remedy Store')) ||
      (await ui.firstCaptionContains('Select Remedy Store')) ||
      (await ui.firstUsableContains('Remedy Store')) ||
      (await ui.firstCaptionContains('Remedy Store')) ||
      (await ui.firstUsableContains('Select pharmacy')) ||
      (await ui.firstCaptionContains('pharmacy')) ||
      (await ui.firstCaptionContains('Select a')) ||
      (await ui.firstCaption('Select'));
    if (named) {
      return named;
    }
    const popups = await this.#elements(
      '-ios class chain:**/XCUIElementTypePopUpButton',
    );
    if (popups.length) {
      return $(popups[0]);
    }
    const fields = await this.#nativeTextFields();
    for (let i = 0; i < fields.length; i += 1) {
      const el = $(fields[i]);
      if (await this.#isSelectLikeField(el)) {
        return el;
      }
    }
    return null;
  }

  /**
   * Any leftover Select placeholders after the store pick (vet, branch, …).
   */
  async #pickRemainingSelects() {
    const store = String(providerData.remedyStore || '').trim();
    const fields = await this.#nativeTextFields();
    for (let i = 0; i < fields.length; i += 1) {
      const el = $(fields[i]);
      if (!(await this.#isSelectLikeField(el))) {
        continue;
      }
      const blob = await this.#fieldBlob(el);
      if (!/^(select|choose)\b/i.test(blob.trim()) && !/select /i.test(blob)) {
        continue;
      }
      ui.log('WebView', `Open leftover select (${blob.slice(0, 60)})`);
      await this.#openAndPickSelect(el, store);
    }
    const popups = await this.#elements(
      '-ios class chain:**/XCUIElementTypePopUpButton',
    );
    for (let i = 0; i < popups.length; i += 1) {
      const el = $(popups[i]);
      const blob = await this.#fieldBlob(el);
      if (!/select|choose/i.test(blob)) {
        continue;
      }
      await this.#openAndPickSelect(el, store);
    }
  }

  /**
   * Tap a flattened `<select>`, then PickerWheel or a caption list.
   * @param {WebdriverIO.Element} el
   * @param {string} preferredName
   */
  async #openAndPickSelect(el, preferredName) {
    await el.click().catch(() => ui.press(el));
    await browser.pause(500);
    if (await this.#pickOpenPicker(preferredName)) {
      return;
    }
    if (preferredName) {
      const named =
        (await ui.firstCaptionContains(preferredName)) ||
        (await ui.firstUsableContains(preferredName));
      if (named) {
        ui.log('WebView', `Tap select option "${preferredName}"`);
        await named.click().catch(() => ui.press(named));
        await this.#confirmPicker();
        return;
      }
    }
    ui.log('WebView', 'No picker options after select tap');
  }

  /**
   * iOS WKWebView `<select>` → XCUIElementTypePickerWheel + toolbar Done.
   * @param {string} preferredName
   * @returns {Promise<boolean>}
   */
  async #pickOpenPicker(preferredName) {
    const wheels = await this.#rawFind(
      '-ios class chain',
      '**/XCUIElementTypePickerWheel',
    );
    if (!wheels.length) {
      return false;
    }
    const wheel = $(wheels[0]);
    ui.log('WebView', 'Assessment picker wheel');
    if (preferredName) {
      try {
        await wheel.setValue(preferredName);
      } catch {
        await browser
          .execute('mobile: selectPickerWheelValue', {
            order: 'next',
            offset: 0.15,
            element: wheels[0],
          })
          .catch(() => {});
      }
    } else {
      await browser
        .execute('mobile: selectPickerWheelValue', {
          order: 'next',
          offset: 0.15,
          element: wheels[0],
        })
        .catch(() => {});
    }
    await this.#confirmPicker();
    return true;
  }

  /**
   * Close the iOS select popover (Done), same as the working keyboard toolbar.
   */
  async #confirmPicker() {
    const done = await this.#firstButtonLabeled(['Done']);
    if (done) {
      await done.click().catch(() => ui.press(done));
      await browser.pause(250);
      return;
    }
    await this.#dismissWebKeyboard();
  }

  async #fillHtmlAssessment() {
    const store = String(providerData.remedyStore || '').trim();
    const selects = await this.#elements('select');
    ui.log('WebView', `HTML select count=${selects.length}`);
    for (let i = 0; i < selects.length; i += 1) {
      const sel = $(selects[i]);
      await browser
        .execute(
          (node, name) => {
            if (!node || !node.options) {
              return;
            }
            const opts = Array.from(node.options);
            const match = name
              ? opts.find(o =>
                  String(o.text || o.label || '')
                    .toLowerCase()
                    .includes(String(name).toLowerCase()),
                )
              : null;
            const fallback = opts.find(
              o =>
                o.value &&
                String(o.text || '').trim() &&
                !/select|choose/i.test(String(o.text || '')),
            );
            const pick = match || fallback;
            if (!pick) {
              return;
            }
            node.value = pick.value;
            node.dispatchEvent(new Event('input', { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
          },
          sel,
          store,
        )
        .catch(() => {});
    }

    const inputs = await $$('input, textarea');
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
        const name = String(
          (await el.getAttribute('name').catch(() => '')) ||
            (await el.getAttribute('aria-label').catch(() => '')) ||
            '',
        );
        if (this.#isAnimalHealthText(name)) {
          const checked = await el.isSelected().catch(() => true);
          if (checked) {
            this.#animalHealthTicked = true;
          }
          continue;
        }
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
    if (boxes.length && !this.#animalHealthTicked) {
      const checked = await boxes[0].isSelected().catch(() => false);
      if (checked) {
        this.#animalHealthTicked = true;
      } else {
        await boxes[0].click();
        this.#animalHealthTicked = true;
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

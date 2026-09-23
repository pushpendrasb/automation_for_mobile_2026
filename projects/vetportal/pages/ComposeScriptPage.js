/**
 * Compose New Script → Veterinary Practice (Dispensing).
 * App: src/Screens/HomePage/ComposeNewScript.js and the screens it pushes
 * (PopUpWithSearchBar, CatPopup, DrugCompendium, AddMedicine, AddSignaturePopup).
 *
 * Flow: Home → My Prescriptions → Compose New Script → Select Format
 *   tab 1 Vet Practice (practice preselected) → Next
 *   tab 2 Client/Dispenser (client, animal category/type) → Next
 *   tab 3 Medicine (Add Medicine → compendium → quantity + animal ID → Add)
 *   → Compose and Dispense → signature popup → "Prescription created successfully".
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');

const C = TEST_IDS.compose;

/** Header bottom / bottom button used to keep compose fields in the tappable area. */
const COMPOSE_AREA = { topId: C.tab(1), coverIds: [C.submit] };

class ComposeScriptPage {
  // ---------------------------------------------------------------- helpers

  /** iOS predicate for a testID prefix whose label also contains `text`. */
  #rowSelector(idPrefix, text, { beginsWith = false } = {}) {
    const e = ui.escape(text);
    if (ui.isAndroid()) {
      return `android=new UiSelector().resourceIdMatches("^${idPrefix}.*").descriptionContains("${e}")`;
    }
    const op = beginsWith ? 'BEGINSWITH[c]' : 'CONTAINS[c]';
    return `-ios predicate string:name BEGINSWITH "${idPrefix}" AND label ${op} "${e}"`;
  }

  /** Visible label of a testID (iOS folds child texts into it), or ''. */
  async #labelOf(id) {
    const el = await ui.byTestId(id);
    if (!el) {
      return '';
    }
    return String((await el.getAttribute(ui.isAndroid() ? 'text' : 'label').catch(() => '')) || '');
  }

  /**
   * Current value of a TextInput testID ('' when empty or not rendered).
   * iOS reports an empty field's placeholder as its value, so that counts as ''.
   */
  async #valueOf(id) {
    const el = (await $$(ui.testIdSelector(id)))[0];
    if (!el) {
      return '';
    }
    const value = String((await el.getAttribute(ui.isAndroid() ? 'text' : 'value').catch(() => '')) || '');
    const placeholder = ui.isAndroid()
      ? ''
      : String((await el.getAttribute('placeholderValue').catch(() => '')) || '');
    return placeholder && value === placeholder ? '' : value;
  }

  /** Scroll a compose-form testID clear of the header / bottom button, then tap it. */
  async #tapComposeField(id) {
    const el = await ui.scrollToTestId(id, { ...COMPOSE_AREA, keepKeyboard: false });
    await el.click();
  }

  // ---------------------------------------------------------------- navigation

  /**
   * From Home (or My Prescriptions, where leave() ends up): open Compose New
   * Script → Veterinary Practice.
   */
  async openFromHome() {
    ui.resetLayoutCache();
    if (!(await ui.isTestIdShown(TEST_IDS.myPrescriptions.compose))) {
      await ui.tapTestId(TEST_IDS.homeTile.myPrescriptions, 20000);
    }
    await ui.tapTestId(TEST_IDS.myPrescriptions.compose, 20000);
    await ui.tapTestId(TEST_IDS.selectFormat.vetPractice);
    await ui.waitForTestId(C.tab(1), 20000);
  }

  /**
   * Tab 1 → tab 2. The app skips tab 1 on its own when the vet belongs to a
   * single practice, so only tap Next if the client form is not showing yet.
   */
  async goToClientTab() {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await ui.isTestIdShown(C.clientNameValue)) {
        return;
      }
      if (await ui.isTestIdShown(C.practiceName)) {
        const practice = await this.#labelOf(C.practiceName);
        // Practice list loads async; "Select" means not loaded yet.
        if (practice && !/^Select\b/.test(practice.trim())) {
          await ui.tapTestId(C.submit);
        }
      }
      await browser.pause(500);
    }
    await ui.waitForTestId(C.clientNameValue, 5000);
  }

  /** Bottom button: "Next" on tabs 1–2, "Compose and Dispense" on tab 3. */
  async tapSubmit() {
    await ui.tapTestId(C.submit);
  }

  // ---------------------------------------------------------------- tab 2

  /**
   * Pick an existing client from the Client Name search list.
   * The app filters with `name.toLowerCase().includes(text)` without lowering
   * the typed text, so the search term must be typed in lowercase.
   * @param {string} name client name as shown in the list
   */
  async selectClient(name) {
    await this.#tapComposeField(C.clientNameValue);
    const search = await ui.waitForTestId(TEST_IDS.searchPopup.search, 15000);
    await search.setValue(name.toLowerCase());
    const selector = this.#rowSelector('searchPopup.row.', name, { beginsWith: true });
    await ui.waitFor(selector, 15000, `client "${name}" in the Client Name list`);
    // The list sits in a KeyboardAwareScrollView: with the keyboard up, the
    // first tap on a row only closes the keyboard. Close it on the header first.
    const header = await ui.rectOf(await ui.waitForTestId(TEST_IDS.searchPopup.close));
    await ui.dismissKeyboard({ x: header.x + header.width + 120, y: header.y + header.height / 2 });
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await ui.firstDisplayed(selector);
      if (!row) {
        break;
      }
      await row.click();
      await browser.pause(800);
    }
    await ui.waitForTestId(C.clientNameValue, 15000);
    await browser.waitUntil(async () => (await this.getClientName()).includes(name), {
      timeout: 8000,
      timeoutMsg: `Client Name did not show "${name}" after picking it`,
    });
  }

  /** Picked client's name ('' when none). */
  async getClientName() {
    return this.#valueOf(C.clientNameValue);
  }

  /** Current Address field value ('' when empty). */
  async getAddress() {
    await ui.scrollToTestId(C.address, COMPOSE_AREA);
    return this.#valueOf(C.address);
  }

  /**
   * Address is only editable for a new client (isAddNewClient), never for an
   * existing one. RN editable={false} still reports enabled=true on iOS, so
   * try typing and check whether the value changed.
   */
  async isAddressEditable() {
    const el = await ui.scrollToTestId(C.address, COMPOSE_AREA);
    const before = await this.#valueOf(C.address);
    await el.addValue('x').catch(() => {});
    await ui.dismissKeyboard({ x: 10, y: (await ui.usableArea(COMPOSE_AREA)).top + 12 });
    return (await this.#valueOf(C.address)) !== before;
  }

  /**
   * Open "Animal Category/ Type" and pick the row whose label contains `text`
   * (e.g. "Horses - Horses", or "Dog" for a client's companion pet).
   * @param {string} text
   */
  async selectAnimal(text) {
    await this.#tapComposeField(C.animalCategoryValue);
    await ui.waitForTestId(TEST_IDS.catPopup.row(0), 10000);
    const rows = await $$(this.#rowSelector('catPopup.row.', text));
    if (!rows.length) {
      const labels = [];
      for (const r of await $$('-ios predicate string:name BEGINSWITH "catPopup.row."')) {
        labels.push(await r.getAttribute('label'));
      }
      await ui.tapTestId(TEST_IDS.catPopup.backdrop).catch(() => {});
      throw new Error(`No "Animal Category/ Type" row contains "${text}". Rows: ${labels.join(' | ')}`);
    }
    const row = rows[0];
    if (!(await row.isDisplayed().catch(() => false)) && !ui.isAndroid()) {
      await browser.execute('mobile: scroll', { elementId: row.elementId, toVisible: true }).catch(() => {});
    }
    await row.click();
    await browser.waitUntil(async () => !(await ui.isTestIdShown(TEST_IDS.catPopup.row(0))), {
      timeout: 5000,
      timeoutMsg: 'Animal Category/ Type picker did not close',
    });
  }

  /** Picked "Category - Type" ('' when none). */
  async getAnimal() {
    return this.#valueOf(C.animalCategoryValue);
  }

  // ---------------------------------------------------------------- tab 3

  /** True once tab 3 (Medicine) shows the Add Medicine button or a medicine row. */
  async isOnMedicineTab() {
    return (
      (await ui.isTestIdShown(C.addMedicine)) ||
      (await ui.isTestIdShown(C.addMoreMedicine)) ||
      (await ui.isTestIdShown(C.medicine(0)))
    );
  }

  async waitForMedicineTab(timeout = 10000) {
    await browser.waitUntil(() => this.isOnMedicineTab(), {
      timeout,
      timeoutMsg: 'Medicine tab (Add Medicine) did not open',
    });
  }

  /**
   * Add Medicine → Drug Compendium → pick a drug → fill what the drug does not
   * prefill (quantity, animal ID free text) → Add. Product name, VPA No,
   * active ingredient, withdrawal, dosage, unit and route come from the drug.
   * @param {{ search?: string, quantity: string, animalId: string }} medicine
   */
  async addMedicine({ search = '', quantity, animalId }) {
    const index = (await $$('-ios predicate string:name BEGINSWITH "compose.medicine."')).length;
    await ui.tapTestId(index === 0 ? C.addMedicine : C.addMoreMedicine);

    const box = await ui.waitForTestId(TEST_IDS.compendium.search, 20000);
    if (search) {
      // The compendium searches on Return / end editing, not while typing.
      await box.setValue(`${search}\n`);
    }
    const drug = await ui.waitForTestId(TEST_IDS.compendium.row(0), 30000);
    await browser.pause(500);
    await drug.click();

    const M = TEST_IDS.addMedicine;
    await ui.waitForTestId(M.productName, 20000);
    ui.resetLayoutCache();
    await this.#typeInto(M.quantity, quantity, { coverIds: [M.submit] });
    await this.#typeInto(TEST_IDS.animalId.freeText, animalId, { coverIds: [M.submit] });
    await ui.dismissKeyboard({ x: 10, y: 120 });
    await ui.tapTestId(M.submit);

    await ui.waitForTestId(C.medicine(index), 20000);
    ui.resetLayoutCache();
  }

  /** Scroll a field into the typeable area and set its value. */
  async #typeInto(id, value, { coverIds = [] } = {}) {
    const el = await ui.scrollToTestId(id, { coverIds, keepKeyboard: false });
    await el.click();
    await el.setValue(value);
  }

  /** Number of medicines listed on tab 3. */
  async medicineCount() {
    return (await $$('-ios predicate string:name BEGINSWITH "compose.medicine."')).length;
  }

  // ---------------------------------------------------------------- sign + submit

  /**
   * Tap "Compose and Dispense", draw a signature, tick the confirmation and
   * tap "Complete Script Now". Drawing always starts a fresh signature, so the
   * run does not depend on a signature already saved on the account.
   */
  async signAndComplete() {
    await this.tapSubmit();
    const S = TEST_IDS.signature;
    await ui.waitForTestId(S.confirm, 15000);
    await this.#drawSignature();
    await ui.tapTestId(S.confirm);
    await ui.tapTestId(S.complete);
  }

  /** Zig-zag stroke across the signature pad. */
  async #drawSignature() {
    const pad = (await $$(ui.testIdSelector(TEST_IDS.signature.pad)))[0];
    const r = await ui.rectOf(pad);
    const y = r.y + r.height / 2;
    const x0 = r.x + r.width * 0.15;
    const step = (r.width * 0.7) / 6;
    let chain = browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(x0), y: Math.round(y) })
      .down();
    for (let i = 1; i <= 6; i++) {
      const dy = i % 2 ? -r.height * 0.2 : r.height * 0.2;
      chain = chain.move({ x: Math.round(x0 + step * i), y: Math.round(y + dy), duration: 120 });
    }
    await chain.up().perform();
    await browser.pause(300);
  }

  /**
   * Wait for the success alert, read the RX number and close it with OK.
   * @param {string} message
   * @returns {Promise<string|null>} RX number shown in the alert
   */
  async confirmSuccess(message, timeout = 40000) {
    await ui.waitFor(ui.containsTextSelector(message), timeout, `"${message}" alert`);
    const rx = await ui.firstDisplayed(ui.containsTextSelector('RX NO:'));
    const rxText = rx ? String((await rx.getAttribute('label').catch(() => '')) || '') : '';
    const match = rxText.match(/RX NO:\s*([A-Za-z0-9-]+)/);
    await ui.tapTestId(TEST_IDS.alert.ok);
    return match ? match[1] : null;
  }

  // ---------------------------------------------------------------- toasts

  /**
   * Wait for the error toast (BannerView) containing `text`. The app shows it
   * for only 1.5s, so poll fast. Matched on the toast's own testIDs because
   * "Enter/select client name" is also the Client Name placeholder.
   */
  async waitForToast(text, timeout = 6000) {
    const e = ui.escape(text);
    const selector = ui.isAndroid()
      ? `android=new UiSelector().textContains("${e}")`
      : `-ios predicate string:(name == "${TEST_IDS.toast.banner}" OR name == "${TEST_IDS.toast.message}") AND label CONTAINS[c] "${e}"`;
    await browser.waitUntil(async () => (await $$(selector)).length > 0, {
      timeout,
      interval: 150,
      timeoutMsg: `Expected toast containing: ${text}`,
    });
  }

  // ---------------------------------------------------------------- exit

  /**
   * Back out of Compose New Script to My Prescriptions: close an open client
   * search list / picker / signature popup first, then tab 3 → 2 → 1 → back.
   */
  async leave() {
    for (const id of [TEST_IDS.searchPopup.close, TEST_IDS.catPopup.backdrop, TEST_IDS.signature.close]) {
      if (await ui.isTestIdShown(id)) {
        await ui.tapTestId(id);
        await browser.pause(800);
      }
    }
    for (let i = 0; i < 4 && (await ui.isTestIdShown(C.back)); i++) {
      await ui.tapTestId(C.back);
      await browser.pause(600);
    }
  }
}

module.exports = new ComposeScriptPage();

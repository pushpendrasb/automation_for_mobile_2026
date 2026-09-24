/**
 * Compose New Script → Veterinary Practice (Dispensing) or Animal Remedy Store
 * (Prescribing). Both formats share the flow below; Remedy Store also needs
 * Dispenser Details (dispenser + branch) and the client's mobile on tab 2, and
 * its final button reads "Compose and Prescribe".
 * App: src/Screens/HomePage/ComposeNewScript.js and the screens it pushes
 * (PopUpWithSearchBar, CatPopup, DrugCompendium, AddMedicine, AddSignaturePopup).
 *
 * Flow: Home → My Prescriptions → Compose New Script → Select Format
 *   tab 1 Vet Practice (practice preselected) → Next
 *   tab 2 Client/Dispenser (client, animal category/type) → Next
 *   tab 3 Medicine (Add Medicine → compendium → fill any empty Withdrawal
 *     Period / Notes, Qty/Unit, Route, Dosage, Recommendation + animal ID → Add)
 *   → Compose and Dispense → signature popup → "Prescription created successfully".
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');
const { step } = require('./clientLog');

const C = TEST_IDS.compose;

/** Header bottom / bottom button used to keep compose fields in the tappable area. */
const COMPOSE_AREA = { topId: C.tab(1), coverIds: [C.submit] };

/**
 * Add Medicine: the Animal ID panel and Add button are fixed at the bottom;
 * the panel's "ⓘ" marks its top edge.
 */
const MEDICINE_AREA = {
  coverIds: [TEST_IDS.animalId.placeholderInfo, TEST_IDS.addMedicine.submit],
};

/** Fallback texts for empty Add Medicine fields (data/testData.js composeData). */
const composeDefaults = () => {
  const { composeData } = require('../data/testData');
  return {
    withdrawalPeriod: composeData.withdrawalPeriod,
    withdrawalNotes: composeData.withdrawalNotes,
    dosage: composeData.dosage,
    recommendation: composeData.recommendation,
  };
};

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
   * Script in the given format.
   * @param {{ format?: 'vetPractice' | 'remedyStore' }} [opts]
   */
  async openFromHome({ format = 'vetPractice' } = {}) {
    ui.resetLayoutCache();
    if (!(await ui.isTestIdShown(TEST_IDS.myPrescriptions.compose))) {
      await ui.tapTestId(TEST_IDS.homeTile.myPrescriptions, 20000);
      step('My Prescriptions tapped');
    }
    await ui.tapTestId(TEST_IDS.myPrescriptions.compose, 20000);
    step('Compose New Script tapped');
    await ui.tapTestId(TEST_IDS.selectFormat[format]);
    step(`Format selected: ${format === 'remedyStore' ? 'Animal Remedy Store' : 'Veterinary Practice'}`);
    await ui.waitForTestId(C.tab(1), 20000);
    step('Compose New Script screen opened');
  }

  /**
   * Tab 1 → tab 2. The app skips tab 1 on its own when the vet belongs to a
   * single practice, so only tap Next if the client form is not showing yet.
   */
  async goToClientTab() {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await ui.isTestIdShown(C.clientNameValue)) {
        step('Client/Dispenser tab opened');
        return;
      }
      if (await ui.isTestIdShown(C.practiceName)) {
        const practice = await this.#labelOf(C.practiceName);
        // Practice list loads async; "Select" means not loaded yet.
        if (practice && !/^Select\b/.test(practice.trim())) {
          await ui.tapTestId(C.submit);
          step('Vet Practice tab: Next tapped');
        }
      }
      await browser.pause(500);
    }
    await ui.waitForTestId(C.clientNameValue, 5000);
    step('Client/Dispenser tab opened');
  }

  /** Bottom button: "Next" on tabs 1–2, "Compose and Dispense" on tab 3. */
  async tapSubmit() {
    const label = (await this.#labelOf(C.submit)).trim();
    await ui.tapTestId(C.submit);
    step(`${label || 'Next'} button tapped`);
  }

  // ---------------------------------------------------------------- tab 2

  /**
   * Pick an existing client from the Client Name search list.
   * The app filters with `name.toLowerCase().includes(text)` without lowering
   * the typed text, so the search term must be typed in lowercase.
   * @param {string} name client name as shown in the list
   */
  async selectClient(name) {
    await ui.withoutIdleWait(() => this.#pickClient(name));
  }

  /**
   * selectClient body; runs with WDA idle-waits off (see ui.withoutIdleWait).
   * Speed notes: with the full client list on screen every element query is
   * slow, so the search text goes in via raw key actions (ui.typeByKeys) and
   * only the first name is typed — the row match below is on the full name.
   * Return closes the keyboard, so the first tap on the row selects it.
   */
  async #pickClient(name) {
    await this.#tapComposeField(C.clientNameValue);
    step('Client Name field tapped');
    const search = await ui.waitForTestId(TEST_IDS.searchPopup.search, 15000);
    step('Client search list opened');
    await ui.typeByKeys(search, name.trim().split(/\s+/)[0].toLowerCase(), { submit: true });
    step('Client name typed in the search box');
    const selector = this.#rowSelector('searchPopup.row.', name, { beginsWith: true });
    await ui.waitFor(selector, 15000, `client "${name}" in the Client Name list`);
    step(`Client "${name}" found in the list`);
    // Retry only if a tap is swallowed (e.g. keyboard still up); stop once the popup closes.
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await ui.firstDisplayed(selector);
      if (!row) {
        break;
      }
      await row.click();
      const closed = await browser
        .waitUntil(async () => !(await ui.isTestIdShown(TEST_IDS.searchPopup.search)), {
          timeout: 1500,
          interval: 200,
        })
        .catch(() => false);
      if (closed) {
        break;
      }
    }
    await ui.waitForTestId(C.clientNameValue, 15000);
    await browser.waitUntil(async () => (await this.getClientName()).includes(name), {
      timeout: 8000,
      timeoutMsg: `Client Name did not show "${name}" after picking it`,
    });
    step(`Client "${name}" selected`);
  }

  /**
   * Walk the Client Name list (no search) and keep the first client that has
   * no herds and no Herd/Equine No, so a herd animal must ask for one.
   * @param {number} [maxClients]
   * @returns {Promise<string>} picked client's name
   */
  async selectClientWithoutHerd(maxClients = 12) {
    for (let i = 0; i < maxClients; i++) {
      await this.#tapComposeField(C.clientNameValue);
      const row = await ui.waitForTestId(TEST_IDS.searchPopup.row(i), 15000).catch(() => null);
      if (!row) {
        await ui.tapTestId(TEST_IDS.searchPopup.close).catch(() => {});
        break;
      }
      await row.click();
      await ui.waitForTestId(C.clientNameValue, 15000);
      await browser.pause(800);
      const hasPicker = (await $$(ui.testIdSelector(C.herdPicker))).length > 0;
      const herdNo = hasPicker ? 'herds on file' : await this.getHerdNo();
      const name = await this.getClientName();
      if (!herdNo) {
        console.log(`[compose] Client without Herd No: "${name}"`);
        step(`Client "${name}" selected (no Herd No on file)`);
        return name;
      }
      console.log(`[compose] Skipping "${name}" (Herd No: ${herdNo})`);
      step(`Client "${name}" has a Herd No — trying the next client`);
    }
    throw new Error(`No client without a Herd No in the first ${maxClients} clients`);
  }

  /** Picked client's name ('' when none). */
  async getClientName() {
    return this.#valueOf(C.clientNameValue);
  }

  /** Current Address field value ('' when empty). */
  async getAddress() {
    await ui.scrollToTestId(C.address, COMPOSE_AREA);
    const address = await this.#valueOf(C.address);
    step(address ? 'Address filled from the client' : 'Address is empty');
    return address;
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
    step('Tried typing in the Address field');
    await ui.dismissKeyboard({ x: 10, y: (await ui.usableArea(COMPOSE_AREA)).top + 12 });
    const editable = (await this.#valueOf(C.address)) !== before;
    step(editable ? 'Address field accepted typing' : 'Address field is read-only');
    return editable;
  }

  /**
   * Open "Animal Category/ Type" and pick the row whose label contains `text`
   * (e.g. "Horses - Horses", or "Dog" for a client's companion pet).
   * @param {string} text
   */
  async selectAnimal(text) {
    await this.#tapComposeField(C.animalCategoryValue);
    step('Animal Category/ Type tapped');
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
    step(`Animal "${text}" selected`);
  }

  /**
   * Selected Herd No / Equine No / Flock No ('' when none). Free-text field:
   * "-" means none. Herd picker (client has herds): the app preselects only
   * when there is exactly one herd, so an empty picker means none selected.
   */
  async getHerdNo() {
    const picker = (await $$(ui.testIdSelector(C.herdPicker)))[0];
    if (picker) {
      const label = String((await picker.getAttribute('label').catch(() => '')) || '').trim();
      return /^Select Herd No/i.test(label) ? '' : label;
    }
    const value = (await this.#valueOf(C.herdNo)).trim();
    return value === '-' ? '' : value;
  }

  /** Picked "Category - Type" ('' when none). */
  async getAnimal() {
    return this.#valueOf(C.animalCategoryValue);
  }

  /** Client's mobile number ('' when none). Read-only for an existing client. */
  async getMobile() {
    await ui.scrollToTestId(C.mobile, COMPOSE_AREA);
    return this.#valueOf(C.mobile).then(v => v.replace(/\D/g, ''));
  }

  // ---------------------------------------------------------------- tab 2 — Remedy Store only

  /** Placeholder of a TextInput testID ('' when not rendered). */
  async #placeholderOf(id) {
    const el = (await $$(ui.testIdSelector(id)))[0];
    if (!el) {
      return '';
    }
    return String(
      (await el.getAttribute(ui.isAndroid() ? 'hint' : 'placeholderValue').catch(() => '')) || '',
    ).trim();
  }

  /** Picked dispenser's name ('' when none). */
  async getDispenser() {
    return this.#valueOf(C.dispenserNameValue);
  }

  /** Picked branch's name ('' when none). */
  async getBranch() {
    return this.#valueOf(C.branchValue);
  }

  /**
   * Dispenser name → Dispenser Name search list → pick the row containing
   * `name` (the list filters case-insensitively), or the first row when blank.
   * A row tap selects and closes the list.
   * @param {string} [name]
   * @returns {Promise<string>} picked dispenser's name
   */
  async selectDispenser(name = '') {
    await this.#tapComposeField(C.dispenserNameValue);
    step('Dispenser name field tapped');
    const search = await ui.waitForTestId(TEST_IDS.searchPopup.search, 15000);
    step('Dispenser search list opened');
    let selector = ui.testIdSelector(TEST_IDS.searchPopup.row(0));
    if (name) {
      await search.setValue(name);
      step('Dispenser name typed in the search box');
      selector = this.#rowSelector('searchPopup.row.', name);
    }
    await ui.waitFor(selector, 15000, name ? `dispenser "${name}" in the Dispenser Name list` : 'a dispenser in the list');
    // Same KeyboardAwareScrollView as the client list: close the keyboard
    // first, or the first row tap only dismisses it.
    const header = await ui.rectOf(await ui.waitForTestId(TEST_IDS.searchPopup.close));
    await ui.dismissKeyboard({ x: header.x + header.width + 120, y: header.y + header.height / 2 });
    for (let attempt = 0; attempt < 3 && (await ui.isTestIdShown(TEST_IDS.searchPopup.close)); attempt++) {
      const row = await ui.firstDisplayed(selector);
      if (!row) {
        break;
      }
      await row.click();
      await browser.pause(800);
    }
    // Client Name is usually scrolled off screen by now, so wait for the list to close instead.
    await browser.waitUntil(async () => !(await ui.isTestIdShown(TEST_IDS.searchPopup.close)), {
      timeout: 15000,
      interval: 300,
      timeoutMsg: 'Dispenser Name list did not close after picking a dispenser',
    });
    let picked = '';
    await browser.waitUntil(
      async () => {
        picked = await this.getDispenser();
        return Boolean(picked) && (!name || picked.toLowerCase().includes(name.toLowerCase()));
      },
      { timeout: 8000, timeoutMsg: `Dispenser name did not show ${name ? `"${name}"` : 'a dispenser'} after picking it` },
    );
    console.log(`[compose] Dispenser: "${picked}"`);
    step(`Dispenser "${picked}" selected`);
    return picked;
  }

  /**
   * Branches load after the dispenser is picked (branch-list API).
   * 1 branch → the app selects it itself; 2+ → open the Branch picker, tap the
   * row containing `name` (or the first) and Save; 0 → the app says
   * "Not found any branch." and the run cannot continue.
   * @param {string} [name]
   * @returns {Promise<string>} selected branch's name
   */
  async selectBranch(name = '') {
    await ui.scrollToTestId(C.branchValue, COMPOSE_AREA);
    let placeholder = '';
    await browser.waitUntil(
      async () => {
        if (await this.getBranch()) {
          return true;
        }
        placeholder = await this.#placeholderOf(C.branchValue);
        return placeholder !== '' && !/loading/i.test(placeholder);
      },
      { timeout: 20000, interval: 500, timeoutMsg: 'Branches for the dispenser did not load' },
    );

    let branch = await this.getBranch();
    if (branch) {
      console.log(`[compose] Branch (only one, auto-selected): "${branch}"`);
      step(`Branch "${branch}" selected automatically (only one)`);
      return branch;
    }
    if (/no branches/i.test(placeholder)) {
      throw new Error(`Dispenser "${await this.getDispenser()}" has no branches — pick another (COMPOSE_DISPENSER_NAME)`);
    }

    await this.#tapComposeField(C.branchValue);
    step('Branch field tapped');
    await ui.waitForTestId(TEST_IDS.catPopup.row(0), 10000);
    const row = name
      ? await ui.waitFor(this.#rowSelector('catPopup.row.', name), 5000, `branch "${name}"`)
      : await ui.byTestId(TEST_IDS.catPopup.row(0));
    await row.click();
    await ui.tapTestId(TEST_IDS.catPopup.save);
    step('Branch Save tapped');
    await browser.waitUntil(async () => Boolean((branch = await this.getBranch())), {
      timeout: 8000,
      timeoutMsg: 'Branch did not show a value after Save',
    });
    console.log(`[compose] Branch: "${branch}"`);
    step(`Branch "${branch}" selected`);
    return branch;
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
    step('Medicine tab opened');
  }

  /**
   * Add Medicine → Drug Compendium → pick a drug → check Withdrawal Period,
   * Withdrawal Notes, Qty/Unit, Route, Dosage and Recommendation and fill any
   * the drug left empty (see #fillEmptyMedicineFields) → animal ID → Add.
   * @param {{ search?: string, quantity: string, animalId: string,
   *   fallbacks?: { withdrawalPeriod?: string, withdrawalNotes?: string,
   *     dosage?: string, recommendation?: string } }} medicine
   *   fallbacks override composeData texts typed into empty fields.
   */
  async addMedicine({ search = '', quantity, animalId, fallbacks = {} }) {
    const index = (await $$('-ios predicate string:name BEGINSWITH "compose.medicine."')).length;
    await ui.tapTestId(index === 0 ? C.addMedicine : C.addMoreMedicine);
    step(index === 0 ? 'Add Medicine tapped' : 'Add More Medicine tapped');

    const box = await ui.waitForTestId(TEST_IDS.compendium.search, 20000);
    step('Drug Compendium opened');
    if (search) {
      // The compendium searches on Return / end editing, not while typing.
      await box.setValue(`${search}\n`);
      step(`Drug search "${search}" entered`);
    }
    await ui.waitForTestId(TEST_IDS.compendium.row(0), 30000);
    step('Drug list loaded');
    await browser.pause(500);
    const M = TEST_IDS.addMedicine;
    // The list can re-render as results arrive (stale element), and a tap that
    // works can still report an error as the screen changes — so success is
    // "Add Medicine is open", not "click() resolved".
    await browser.waitUntil(
      async () => {
        if (await ui.isTestIdShown(M.productName)) {
          return true;
        }
        const drug = await ui.byTestId(TEST_IDS.compendium.row(0));
        if (drug) {
          await drug.click().catch(() => {});
        }
        return false;
      },
      { timeout: 30000, interval: 1000, timeoutMsg: 'Could not open Add Medicine from the compendium' },
    );
    await ui.waitForTestId(M.productName, 20000);
    step('First drug tapped — Add Medicine screen opened');
    ui.resetLayoutCache();
    await this.#fillEmptyMedicineFields({ quantity, ...fallbacks });
    await this.#typeInto(TEST_IDS.animalId.freeText, animalId, { coverIds: [M.submit] });
    step('Animal ID entered');
    await ui.dismissKeyboard({ x: 10, y: 120 });
    step('Keyboard hidden');
    // Practice details can still land late and blank a field — check once more.
    await this.#fillEmptyMedicineFields({ quantity, ...fallbacks }, { settle: false });
    // Re-fill can focus Dosage / Recommendation and leave the keyboard up; Add sits
    // in the fixed footer behind it and isDisplayed() stays false until dismissed.
    await ui.dismissKeyboard({ x: 10, y: 120 });
    await ui.tapTestId(M.submit);
    step('Add button tapped');

    await ui.waitForTestId(C.medicine(index), 20000);
    step(`Medicine #${index + 1} added to the script`);
    ui.resetLayoutCache();
  }

  /**
   * Add Medicine: fill every required field the chosen drug left empty, top
   * to bottom — Withdrawal Period, Withdrawal Notes, Qty, Unit, Route, Dosage,
   * Recommendation. Fields the drug already filled are left as they are.
   * Withdrawal fields use the first "Select" list entry (typed text if the list
   * is empty); Unit and Route use the first list entry.
   * @param {{ quantity: string, withdrawalPeriod?: string, withdrawalNotes?: string,
   *   dosage?: string, recommendation?: string }} values
   * @param {{ settle?: boolean }} [opts] settle: first wait for the drug's
   *   details to stop changing (see #readSettledMedicineFields)
   */
  async #fillEmptyMedicineFields(values, { settle = true } = {}) {
    const M = TEST_IDS.addMedicine;
    const d = { ...composeDefaults(), ...values };

    const current = settle ? await this.#readSettledMedicineFields() : await this.#readMedicineFields();
    const empty = Object.keys(current).filter((f) => !current[f].trim());
    if (!settle && !empty.length) {
      return;
    }
    console.log(
      `[compose] Add Medicine ${settle ? 'as opened' : 'before Add'}: ${JSON.stringify(current)}`,
    );
    if (settle) {
      step(
        empty.length
          ? `Medicine details checked — empty: ${empty.join(', ')}`
          : 'Medicine details checked — all fields filled by the drug',
      );
    } else {
      step(`Re-checked before Add — now empty: ${empty.join(', ')}`);
    }

    /** How to fill each field, in on-screen order; resolves to a Client-log line. */
    const typed = async (id, value, field) => {
      await this.#typeInto(id, value, MEDICINE_AREA);
      return `${field} entered`;
    };
    const fillers = {
      'Withdrawal Period': () =>
        this.#pickOrType(M.withdrawalPeriodSelect, M.withdrawalPeriod, d.withdrawalPeriod, 'Withdrawal Period'),
      'Withdrawal Notes': () =>
        this.#pickOrType(M.withdrawalNotesSelect, M.withdrawalNotes, d.withdrawalNotes, 'Withdrawal Notes'),
      Qty: () => typed(M.quantity, d.quantity, 'Qty'),
      Unit: () => this.#pickFirstFromList(M.unit, 'Unit'),
      Route: () => this.#pickFirstFromList(M.routeSelect, 'Route'),
      Dosage: () => typed(M.dosage, d.dosage, 'Dosage'),
      Recommendation: () => typed(M.recommendation, d.recommendation, 'Recommendation'),
    };
    const filled = [];
    for (const [field, fill] of Object.entries(fillers)) {
      if (empty.includes(field)) {
        step(await fill());
        filled.push(field);
      }
    }
    console.log(
      `[compose] Add Medicine: ${filled.length ? `filled empty ${filled.join(', ')}` : 'all fields prefilled by the drug'}`,
    );
  }

  /**
   * Current Add Medicine field values keyed by on-screen label
   * (iOS reports values of off-screen fields too, so no scrolling).
   * @returns {Promise<Record<string, string>>}
   */
  async #readMedicineFields() {
    const M = TEST_IDS.addMedicine;
    const unitLabel = (await this.#rawLabel(M.unit)).trim();
    return {
      'Withdrawal Period': await this.#valueOf(M.withdrawalPeriod),
      'Withdrawal Notes': await this.#valueOf(M.withdrawalNotes),
      Qty: await this.#valueOf(M.quantity),
      Unit: unitLabel === 'Select' ? '' : unitLabel,
      Route: await this.#valueOf(M.route),
      Dosage: await this.#valueOf(M.dosage),
      Recommendation: await this.#valueOf(M.recommendation),
    };
  }

  /**
   * After a drug is picked the app fills its compendium details, then may
   * replace them with the practice's saved details for this animal (a later
   * API call that can change route/unit and blank dosage). Read until two
   * reads in a row match, so we fill against the final state (max ~12s).
   * @returns {Promise<Record<string, string>>}
   */
  async #readSettledMedicineFields() {
    const deadline = Date.now() + 12000;
    let prev = null;
    let current = await this.#readMedicineFields();
    while (Date.now() < deadline) {
      await browser.pause(1500);
      prev = current;
      current = await this.#readMedicineFields();
      if (JSON.stringify(prev) === JSON.stringify(current)) {
        break;
      }
    }
    return current;
  }

  /** Label of a testID even when it is scrolled off screen ('' if missing). */
  async #rawLabel(id) {
    const el = (await $$(ui.testIdSelector(id)))[0];
    if (!el) {
      return '';
    }
    return String((await el.getAttribute(ui.isAndroid() ? 'text' : 'label').catch(() => '')) || '');
  }

  /** Scroll an Add Medicine control clear of the header / Animal ID footer and tap it. */
  async #tapMedicineControl(id) {
    const el = await ui.scrollToTestId(id, { ...MEDICINE_AREA, keepKeyboard: false });
    await el.click();
  }

  /**
   * Single-choice list (Unit, Route): open it and tap the first row, which
   * closes the popup and sets the value.
   * @param {string} openerId testID that opens the CatPopup
   * @param {string} what field name for errors and the Client log
   * @returns {Promise<string>} Client-log line describing what was done
   */
  async #pickFirstFromList(openerId, what) {
    await this.#tapMedicineControl(openerId);
    const row = await ui.waitForTestId(TEST_IDS.catPopup.row(0), 8000).catch(() => null);
    if (!row) {
      await ui.tapTestId(TEST_IDS.catPopup.backdrop, 3000).catch(() => {});
      throw new Error(`${what} list is empty — cannot pick a ${what}`);
    }
    await row.click();
    await this.#waitCatPopupClosed();
    return `${what} selected from the list`;
  }

  /**
   * Multi-select list (Withdrawal Period / Notes): tick the first row and Save.
   * If the list has no rows, close it and type `text` into the field instead.
   * @param {string} what field name for the Client log
   * @returns {Promise<string>} Client-log line describing what was done
   */
  async #pickOrType(selectId, fieldId, text, what) {
    await this.#tapMedicineControl(selectId);
    const row = await ui.waitForTestId(TEST_IDS.catPopup.row(0), 5000).catch(() => null);
    if (row) {
      await row.click();
      await ui.tapTestId(TEST_IDS.catPopup.save, 5000);
      await this.#waitCatPopupClosed();
      if (await this.#valueOf(fieldId)) {
        return `${what} selected from the list and saved`;
      }
    } else {
      await ui.tapTestId(TEST_IDS.catPopup.backdrop, 3000).catch(() => {});
      await this.#waitCatPopupClosed();
    }
    await this.#typeInto(fieldId, text, MEDICINE_AREA);
    return `${what} entered`;
  }

  async #waitCatPopupClosed() {
    await browser
      .waitUntil(async () => !(await ui.isTestIdShown(TEST_IDS.catPopup.save)), {
        timeout: 5000,
        interval: 200,
      })
      .catch(() => {});
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
    step('Signature screen opened');
    await this.#drawSignature();
    step('Signature drawn');
    await ui.tapTestId(S.confirm);
    step('Confirmation checkbox ticked');
    await ui.tapTestId(S.complete);
    step('Complete Script Now tapped');
  }

  /** Zig-zag stroke across the signature pad. */
  async #drawSignature() {
    const pad = (await $$(ui.testIdSelector(TEST_IDS.signature.pad)))[0];
    const r = await ui.rectOf(pad);
    const y = r.y + r.height / 2;
    const x0 = r.x + r.width * 0.15;
    const dx = (r.width * 0.7) / 6;
    let chain = browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(x0), y: Math.round(y) })
      .down();
    for (let i = 1; i <= 6; i++) {
      const dy = i % 2 ? -r.height * 0.2 : r.height * 0.2;
      chain = chain.move({ x: Math.round(x0 + dx * i), y: Math.round(y + dy), duration: 120 });
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
    step(`Success alert shown: "${message}"${match ? ` — RX NO: ${match[1]}` : ''}`);
    await ui.tapTestId(TEST_IDS.alert.ok);
    step('Success alert OK tapped');
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
    step(`App showed message: "${text}"`);
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
    step('Left Compose New Script');
  }
}

module.exports = new ComposeScriptPage();

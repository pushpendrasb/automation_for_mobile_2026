/**
 * Vet Practice New Request (NewPrescription.js).
 * Step 1: Vet Practice, Remedy Store to Dispense, Branch, Next
 * Step 2: Animal Category/ Type, identification, Treatment/Product Request, Submit Request
 */
const { ui } = require('./ui');
const { providerData } = require('../data/providerData');
const { requestTreatmentData, categoryByKey } = require('../data/animalCategories');
const RemedyStoreModalPage = require('./RemedyStoreModalPage');
const SelectVetPopupPage = require('./SelectVetPopupPage');
const SelectBranchPopupPage = require('./SelectBranchPopupPage');
const CatPopupPage = require('./CatPopupPage');

class VetPracticeFormPage {
  async assertStep1() {
    await ui.waitVisible(
      () => ui.byExactText(requestTreatmentData.labels.newRequest),
      20000,
      'New Request (Vet Practice) not displayed',
    );
    await ui.waitVisible(
      () => ui.byContainsText('New prescription request'),
      10000,
      'Vet Practice step 1 hero not displayed',
    );
  }

  /**
   * One subscribed vet → NewPrescription.js auto-fills the field. Skip popup.
   * Several vets → field stays "Select". Same flow as Remedy Store:
   * tap field → SelectVetPopup → row at VET_PRACTICE_INDEX → Save.
   * @param {string} [practiceName]
   * @param {number} [index]
   */
  async selectVetPractice(
    practiceName = providerData.vetPractice,
    index = providerData.vetPracticeIndex,
  ) {
    const name = String(practiceName || '').trim();
    if (await SelectVetPopupPage.isPracticeAlreadyOnForm(name)) {
      ui.log('Provider', 'Vet Practice already filled (one subscribed vet) — skip popup');
      return;
    }
    ui.log(
      'Provider',
      `Vet Practice popup name="${name || '(none)'}" row=${index}`,
    );
    await SelectVetPopupPage.openFromForm();
    await SelectVetPopupPage.selectRowAndSave(name, index);
  }

  /**
   * Index 0 + name → search then first card. Index > 0 → full list, no search.
   * Skip when the field already shows the store name.
   * @param {string} [storeName]
   * @param {number} [index]
   */
  async selectRemedyStore(
    storeName = providerData.remedyStore,
    index = providerData.remedyStoreIndex,
  ) {
    const name = String(storeName || '').trim();
    if (name && (await RemedyStoreModalPage.isStoreAlreadyOnForm(name))) {
      ui.log('Provider', `Remedy store already "${name}" — skip modal`);
      return;
    }
    ui.log(
      'Provider',
      `Remedy store search="${name || '(none)'}" card=${index}`,
    );
    await RemedyStoreModalPage.openFromForm();
    await RemedyStoreModalPage.searchSelectAndSave(name, index);
  }

  /**
   * After a store is chosen: tap **Select Branch** when several branches
   * exist, then pick `BRANCH_INDEX` (default 0) and Save — same pattern as
   * the store modal. One branch auto-fills on tap (no sheet).
   *
   * Never skip because "Select Branch" is missing from the iOS tree; RN
   * often hides that placeholder while the field is still empty.
   *
   * @param {number} [index]
   */
  async selectBranch(index = providerData.branchIndex) {
    const requested =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;
    ui.log('Provider', `Branch popup row=${requested}`);
    await this.#waitBranchIdle();
    await SelectBranchPopupPage.selectAndSave(requested);
  }

  /**
   * @deprecated Use {@link selectBranch} — kept for nearby / negative tests.
   * @param {number} [index]
   */
  async selectBranchFirstOrAutoSelected(index = providerData.branchIndex) {
    return this.selectBranch(index);
  }

  /**
   * Next sits in the absolute footer (height 52, paddingBottom safeArea+10).
   * Do not search inside the ScrollView.
   * Next without vet/branch stays on step 1 — fill those and retry once.
   */
  async clickNext() {
    ui.log('Request Treatment', 'Next (fixed footer)');
    await this.#waitBranchIdle();
    await this.#tapFooterCta();
    if (await ui.waitTrue(async () => !(await this.#stillOnStep1()), 1200)) {
      return;
    }
    if (await this.#branchPopupLikelyOpen()) {
      ui.log('Provider', 'Branch popup after Next — row + Save');
      await SelectBranchPopupPage.selectAndSave(providerData.branchIndex);
      await this.#tapFooterCta();
      if (await ui.waitTrue(async () => !(await this.#stillOnStep1()), 1000)) {
        return;
      }
    }
    if (await this.#stillOnStep1()) {
      ui.log('Provider', 'Still on step 1 after Next — retry practice/branch');
      await this.selectVetPractice();
      await this.selectBranch();
      await this.#waitBranchIdle();
      await this.#tapFooterCta();
      if (await this.#branchPopupLikelyOpen()) {
        await SelectBranchPopupPage.selectAndSave(providerData.branchIndex);
        await this.#tapFooterCta();
      }
      await ui.waitTrue(async () => !(await this.#stillOnStep1()), 1000);
    }
  }

  /**
   * Step 2 title is "Animal Category/ Type". Slash in NSPredicate is unsafe
   * — match "Animal Category" via $$ (no findElement throw spam).
   */
  async assertAnimalCategoryScreen() {
    await browser.waitUntil(
      async () =>
        Boolean(
          (await ui.firstCaptionContains('Animal Category')) ||
            (await ui.firstUsableContains('Animal Category')),
        ),
      {
        timeout: 12000,
        interval: 200,
        timeoutMsg: 'Animal Category/ Type screen not displayed',
      },
    );
  }

  /**
   * CatPopup.js: tap the category row (Horse = first), then Save.
   * Row labels are not in the iOS tree — do not wait for "Horse".
   */
  async selectAnimalCategory(categoryKey) {
    const cat = categoryByKey(categoryKey);
    const row = Number(cat.pickerRowIndex || 0);
    ui.log('Animal', `Category row ${row} (${cat.key})`);

    const field =
      (await ui.firstCaptionContains('Please select animal category')) ||
      (await ui.firstUsableContains('Please select animal category'));
    if (field) {
      await ui.press(field);
    } else {
      await ui.tapContains('Animal Category', 5000);
    }
    await ui.waitTrue(() => CatPopupPage.isOpen(), 1200);
    await CatPopupPage.selectRowAndSave(row);
  }

  /**
   * History field only — never Tag/ID (last run appended "demo t..." onto H003).
   * Dismiss keyboard first so this TextView is in the tree.
   */
  async fillTreatmentRequest(text = providerData.treatmentRequest) {
    ui.log('Request Treatment', `Treatment text: ${text}`);
    await this.#dismissKeyboardUntilGone();
    let field = await this.#treatmentField();
    if (!field) {
      await this.#nudgeFormUp();
      field = await this.#treatmentField();
    }
    if (!field) {
      throw new Error('Treatment request TextInput not found');
    }
    await field.click().catch(() => {});
    await browser.pause(150);
    try {
      await field.setValue(String(text));
    } catch {
      await ui.typeInto(field, text);
    }
    await this.#dismissKeyboardUntilGone();
  }

  /**
   * Unique substring from NewPrescription.js placeholder (not Name/Tag fields).
   */
  async #treatmentField() {
    if (ui.isAndroid()) {
      const edits = await $$(
        'android=new UiSelector().className("android.widget.EditText")',
      );
      return edits[edits.length - 1] || null;
    }
    const selectors = [
      '-ios predicate string:placeholderValue CONTAINS "product you are requesting"',
      '-ios predicate string:placeholderValue CONTAINS "Please enter the treatment"',
      '-ios predicate string:value CONTAINS "product you are requesting"',
    ];
    for (const sel of selectors) {
      const els = await $$(sel);
      if (els[0]) {
        return els[0];
      }
    }
    const views = await $$(
      '-ios predicate string:type == "XCUIElementTypeTextView"',
    );
    const { height } = await browser.getWindowSize();
    for (const el of views) {
      const size = await el.getSize().catch(() => null);
      if (size && size.height >= 50 && size.height < height * 0.45) {
        return el;
      }
    }
    return null;
  }

  async #nudgeFormUp() {
    const { width, height } = await browser.getWindowSize();
    await browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ duration: 0, x: width / 2, y: Math.round(height * 0.62) })
      .down()
      .pause(80)
      .move({ duration: 280, x: width / 2, y: Math.round(height * 0.42) })
      .up()
      .perform();
    await browser.releaseActions().catch(() => {});
    await browser.pause(200);
  }

  async clickSubmitRequest() {
    ui.log('Request Treatment', 'Submit Request');
    await this.#dismissKeyboardUntilGone();
    const btn =
      (await ui.firstCaption('Submit Request')) ||
      (await ui.firstUsableContains('Submit Request'));
    if (btn) {
      await ui.press(btn);
      return;
    }
    await this.#tapFooterCta();
  }

  /**
   * Keep tapping Done until the keyboard is down. Submit Request is behind it.
   */
  async #dismissKeyboardUntilGone() {
    for (let i = 0; i < 4; i += 1) {
      try {
        if (!(await browser.isKeyboardShown())) {
          return;
        }
      } catch {
        return;
      }
      await ui.dismissKeyboard();
    }
  }

  async #stillOnStep1() {
    if (await ui.firstCaptionContains('Animal Category')) {
      return false;
    }
    return Boolean(
      (await ui.firstCaptionContains('New prescription request')) ||
        (await ui.firstCaptionContains('Select your vet practice')),
    );
  }

  /**
   * footerWrap is absolute at the bottom. Button center ≈ height - 70.
   */
  async #tapFooterCta() {
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);
    const y = Math.round(height - 70);
    ui.log('Request Treatment', `Footer CTA at ${x},${y}`);
    await ui.pressAt(x, y);
  }

  /**
   * Next is a no-op while branches are fetching (NewPrescription.js).
   */
  async #waitBranchIdle() {
    const start = Date.now();
    while (Date.now() - start < 3000) {
      const loading =
        (await ui.firstCaptionContains('Loading branches')) ||
        (await ui.firstUsableContains('Loading branches'));
      if (!loading) {
        return;
      }
      await browser.pause(60);
    }
  }

  /**
   * Branch CatPopup after Next: still on step 1, Save footer instead of Next.
   */
  async #branchPopupLikelyOpen() {
    if (await ui.firstCaptionContains('Animal Category')) {
      return false;
    }
    return SelectBranchPopupPage.isOpen();
  }
}

module.exports = new VetPracticeFormPage();

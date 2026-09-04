/**
 * Vet Practice New Request (NewPrescription.js).
 * Every tap uses testID — no screen width/height.
 *
 * Step 1: Vet Practice, Remedy Store to Dispense, Branch, Next
 * Step 2: Animal Category/ Type, identification, Treatment/Product Request, Submit Request
 */
const { ui } = require('./ui');
const { providerData } = require('../data/providerData');
const { categoryByKey } = require('../data/animalCategories');
const { TEST_IDS } = require('../data/testIds');
const RemedyStoreModalPage = require('./RemedyStoreModalPage');
const SelectVetPopupPage = require('./SelectVetPopupPage');
const SelectBranchPopupPage = require('./SelectBranchPopupPage');

class VetPracticeFormPage {
  async assertStep1() {
    await browser.waitUntil(
      async () =>
        Boolean(await ui.firstByTestId(TEST_IDS.requestTreatment.vetPracticeField)),
      {
        timeout: 20000,
        interval: 200,
        timeoutMsg:
          'New Request (rt.vetPractice.field) not displayed — rebuild/reinstall the Vet Pal app',
      },
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
    ui.log(
      'Provider',
      `Vet Practice popup name="${name || '(none)'}" row=${index}`,
    );
    const requested =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;
    const picked = await ui.pickFromSheet({
      openId: TEST_IDS.requestTreatment.vetPracticeField,
      rowId: TEST_IDS.vetPracticePopup.row(requested),
      saveId: TEST_IDS.vetPracticePopup.save,
    });
    if (picked) {
      return;
    }
    if (await ui.firstByTestId(TEST_IDS.requestTreatment.vetPracticeField)) {
      ui.log('Provider', 'Vet Practice field present — popup did not open (auto-filled)');
      return;
    }
    await SelectVetPopupPage.openFromForm();
    await SelectVetPopupPage.selectRowAndSave(name, requested);
  }

  /**
   * Index 0 + name → search then first card. Index > 0 → full list, no search.
   * Skip when the field already shows the store name (modal does not open).
   * @param {string} [storeName]
   * @param {number} [index]
   */
  async selectRemedyStore(
    storeName = providerData.remedyStore,
    index = providerData.remedyStoreIndex,
  ) {
    const name = String(storeName || '').trim();
    const requested =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;
    ui.log(
      'Provider',
      `Remedy store search="${name || '(none)'}" card=${requested}`,
    );
    const picked = await ui.pickFromSheet({
      openId: TEST_IDS.requestTreatment.remedyStoreField,
      rowId: TEST_IDS.remedyStoreModal.card(requested),
      saveId: TEST_IDS.remedyStoreModal.save,
    });
    if (picked) {
      return;
    }
    if (requested === 0 && name) {
      await RemedyStoreModalPage.openFromForm();
      await RemedyStoreModalPage.searchSelectAndSave(name, requested);
      return;
    }
    if (await ui.firstByTestId(TEST_IDS.requestTreatment.remedyStoreField)) {
      ui.log('Provider', 'Remedy Store field present — modal did not open (already filled)');
      return;
    }
    throw new Error(
      'rt.remedyStore.field not found — rebuild/reinstall the Vet Pal app',
    );
  }

  /**
   * After a store is chosen: tap **Select Branch** when several branches
   * exist, then pick `BRANCH_INDEX` (default 0) and Save.
   * One branch auto-fills on tap (no sheet).
   * @param {number} [index]
   */
  async selectBranch(index = providerData.branchIndex) {
    const requested =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;
    ui.log('Provider', `Branch popup row=${requested}`);
    const picked = await ui.pickFromSheet({
      openId: TEST_IDS.requestTreatment.branchField,
      rowId: TEST_IDS.catPopup.row(requested),
      saveId: TEST_IDS.catPopup.save,
    });
    if (picked) {
      return;
    }
    if (await ui.firstByTestId(TEST_IDS.requestTreatment.branchField)) {
      ui.log('Provider', 'No Branch popup after tap — one branch auto-filled');
      return;
    }
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
   * Next is `rt.next` in the fixed footer.
   * Next without vet/branch stays on step 1 — fill those and retry once.
   */
  async clickNext() {
    ui.log('Request Treatment', 'Next (rt.next)');
    await ui.requireTapTestId(TEST_IDS.requestTreatment.next);
    if (
      await ui.waitTrue(
        () => ui.firstByTestId(TEST_IDS.requestTreatment.animalCategoryField),
        1500,
        80,
      )
    ) {
      return;
    }
    if (await this.#vetSelectStillShowing()) {
      ui.log('Provider', 'Vet Practice still Select — open popup then Next');
      await this.selectVetPractice();
      await ui.requireTapTestId(TEST_IDS.requestTreatment.next);
    }
  }

  /**
   * Step 2 title is "Animal Category/ Type". Wait for the field ID.
   */
  async assertAnimalCategoryScreen() {
    await browser.waitUntil(
      async () =>
        Boolean(await ui.firstByTestId(TEST_IDS.requestTreatment.animalCategoryField)),
      {
        timeout: 12000,
        interval: 200,
        timeoutMsg:
          'Animal Category field (rt.animalCategory.field) not displayed',
      },
    );
  }

  /**
   * CatPopup: tap the category row (Horse = first), then Save.
   * @param {string} categoryKey
   */
  async selectAnimalCategory(categoryKey) {
    const cat = categoryByKey(categoryKey);
    const row = Number(cat.pickerRowIndex || 0);
    ui.log('Animal', `Category row ${row} (${cat.key})`);
    await ui.requirePickFromSheet({
      openId: TEST_IDS.requestTreatment.animalCategoryField,
      rowId: TEST_IDS.catPopup.row(row),
      saveId: TEST_IDS.catPopup.save,
    });
  }

  /**
   * History field only — `rt.treatmentInput`. Never Tag/ID.
   * @param {string} [text]
   */
  async fillTreatmentRequest(text = providerData.treatmentRequest) {
    ui.log('Request Treatment', `Treatment text: ${text}`);
    const field = await ui.firstByTestId(TEST_IDS.requestTreatment.treatmentInput);
    if (!field) {
      throw new Error(
        'testID "rt.treatmentInput" not found — rebuild/reinstall the Vet Pal app',
      );
    }
    await field.click().catch(() => {});
    await browser.pause(80);
    try {
      await field.setValue(String(text));
    } catch {
      await ui.typeInto(field, text);
    }
    await ui.dismissKeyboardUntilGone();
  }

  /**
   * Footer Submit is behind the number pad if NO. OF ANIMALS still has focus.
   * Tap KeyboardToolbar Done until the keypad is gone, then tap `rt.submit`.
   */
  async clickSubmitRequest() {
    ui.log('Request Treatment', 'Submit Request (rt.submit)');
    if (await ui.isKeyboardVisible()) {
      await ui.dismissNumberPad();
    } else {
      await ui.tapKeyboardDone();
    }
    await browser.waitUntil(
      async () => !(await ui.isKeyboardVisible()),
      {
        timeout: 8000,
        interval: 150,
        timeoutMsg:
          'Keyboard still covering Submit Request — tap Done after NO. OF ANIMALS',
      },
    );
    await ui.requireTapTestId(TEST_IDS.requestTreatment.submit);
  }

  /**
   * Step 1 still showing — Next without a vet does not advance.
   * @returns {Promise<boolean>}
   */
  async #vetSelectStillShowing() {
    if (await ui.firstByTestId(TEST_IDS.requestTreatment.animalCategoryField)) {
      return false;
    }
    return Boolean(
      await ui.firstByTestId(TEST_IDS.requestTreatment.vetPracticeField),
    );
  }
}

module.exports = new VetPracticeFormPage();

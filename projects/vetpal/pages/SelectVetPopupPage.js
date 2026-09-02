/**
 * SelectVetPopup.js — tap by testID only (no screen width/height).
 *
 * App behaviour (NewPrescription.js):
 * - Exactly one subscribed vet → field auto-fills. This page still re-picks
 *   via `vetPopup.row.*` when the sheet is opened.
 * - Two or more vets → tap `rt.vetPractice.field`, row, then `vetPopup.save`.
 *
 * Save with no row selected is a no-op. Overlay above the sheet dismisses
 * with no selection — do not tap anything except the field / row / Save IDs.
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');

class SelectVetPopupPage {
  /**
   * Sheet is open when the Save control ID is in the tree.
   * @returns {Promise<boolean>}
   */
  async isOpen() {
    return Boolean(await ui.firstByTestId(TEST_IDS.vetPracticePopup.save));
  }

  /**
   * Open the sheet from the gray Vet Practice field.
   */
  async openFromForm() {
    if (await this.isOpen()) {
      return;
    }
    await ui.requireTapTestId(TEST_IDS.requestTreatment.vetPracticeField);
    const opened = await ui.waitTrue(
      () => ui.firstByTestId(TEST_IDS.vetPracticePopup.save),
      600,
      30,
    );
    if (!opened) {
      throw new Error(
        'Vet Practice popup did not open (vetPopup.save) — rebuild/reinstall the Vet Pal app',
      );
    }
  }

  /**
   * Tap row `index` then Save.
   * @param {string} [_practiceName] unused — rows are addressed by testID
   * @param {number} [index=0]
   */
  async selectRowAndSave(_practiceName, index = 0) {
    const requested =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;
    ui.log('VetPopup', `Tap vetPopup.row.${requested} then Save`);
    await ui.requirePickFromSheet({
      rowId: TEST_IDS.vetPracticePopup.row(requested),
      saveId: TEST_IDS.vetPracticePopup.save,
    });
  }
}

module.exports = new SelectVetPopupPage();

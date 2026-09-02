/**
 * Branch CatPopup — tap by testID only (no screen width/height).
 *
 * App behaviour (`NewPrescription.js` after a store is chosen):
 * - Exactly one branch → tap auto-fills; the sheet does not open.
 * - Two or more branches → tap `rt.branch.field`, `catPopup.row.*`, Save.
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');

class SelectBranchPopupPage {
  /**
   * Sheet is open when CatPopup Save is in the tree.
   * @returns {Promise<boolean>}
   */
  async isOpen() {
    return Boolean(await ui.firstByTestId(TEST_IDS.catPopup.save));
  }

  /**
   * Tap the Branch field, then pick `index` and Save when the sheet opens.
   * One-branch auto-fill: the sheet never opens; this returns after the tap.
   * @param {number} [index=0]
   */
  async selectAndSave(index = 0) {
    const requested =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;

    if (await this.isOpen()) {
      await this.#selectRowAndSave(requested);
      return;
    }

    const opened = await this.openFromForm();
    if (!opened) {
      ui.log(
        'BranchPopup',
        'No Branch popup after tap — one branch auto-filled (skip sheet)',
      );
      return;
    }

    ui.log('BranchPopup', `Sheet open — tap catPopup.row.${requested} then Save`);
    await this.#selectRowAndSave(requested);
  }

  /**
   * Tap `rt.branch.field`. Returns true when CatPopup Save appears.
   * @returns {Promise<boolean>}
   */
  async openFromForm() {
    if (await this.isOpen()) {
      return true;
    }
    await ui.requireTapTestId(TEST_IDS.requestTreatment.branchField);
    return ui.waitTrue(
      () => ui.firstByTestId(TEST_IDS.catPopup.save),
      400,
      30,
    );
  }

  /**
   * @param {number} index
   */
  async #selectRowAndSave(index) {
    await ui.requirePickFromSheet({
      rowId: TEST_IDS.catPopup.row(index),
      saveId: TEST_IDS.catPopup.save,
    });
  }
}

module.exports = new SelectBranchPopupPage();

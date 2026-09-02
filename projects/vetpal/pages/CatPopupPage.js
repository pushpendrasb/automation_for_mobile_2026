/**
 * CatPopup.js — Branch, Animal Category/Type, UNITS.
 * Tap `catPopup.row.${index}` then `catPopup.save`. No screen coordinates.
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');

class CatPopupPage {
  /**
   * Tap list row `index` (0 = first), then Save.
   * @param {number} [index=0]
   */
  async selectRowAndSave(index = 0) {
    const requested =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;
    ui.log('CatPopup', `Tap catPopup.row.${requested} then Save`);
    await ui.requirePickFromSheet({
      rowId: TEST_IDS.catPopup.row(requested),
      saveId: TEST_IDS.catPopup.save,
    });
  }

  /**
   * Sheet is open when the CatPopup Save ID is in the tree.
   * @returns {Promise<boolean>}
   */
  async isOpen() {
    return Boolean(await ui.firstByTestId(TEST_IDS.catPopup.save));
  }
}

module.exports = new CatPopupPage();

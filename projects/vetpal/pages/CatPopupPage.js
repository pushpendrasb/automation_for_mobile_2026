/**
 * CatPopup.js / SelectVetPopup.js — automation only (Vet Pal app is not changed).
 *
 * Used for Animal Category/ Type, Branch, and Vet Practice. Rows are
 * TouchableOpacity, so XCUITest often has no StaticText for the label.
 * Vet Practice: try name match, then 0-based index. Category/Branch: index.
 * Must tap a **row** then **Save**. Save with no row is a no-op.
 *
 * Layout: dismiss overlay, white sheet (title + list), footer Save.
 */
const { ui } = require('./ui');

/** CatPopup.js viewCellBG + title line (~46px). */
const ROW_HEIGHT = 46;

class CatPopupPage {
  /**
   * Tap list row `index` (0 = first), then Save by layout.
   * @param {number} [index=0]
   * @param {{ rowHeight?: number }} [opts]
   */
  async selectRowAndSave(index = 0, opts = {}) {
    const rowHeight =
      Number(opts.rowHeight) > 0 ? Number(opts.rowHeight) : ROW_HEIGHT;
    ui.log('CatPopup', `Tap row ${index} then Save (layout)`);
    await ui.tapSheetRowThenSave({ index, rowStride: rowHeight });
  }

  /**
   * CatPopup footer Save — one $$ (no location walk).
   */
  async isOpen() {
    return ui.saveExists();
  }
}

module.exports = new CatPopupPage();

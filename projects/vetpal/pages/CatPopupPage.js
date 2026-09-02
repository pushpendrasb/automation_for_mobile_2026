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
const { nameVariants } = require('../data/providerData');

/** CatPopup.js viewCellBG + title line (~46px). */
const ROW_HEIGHT = 46;
const LIST_HEIGHT = 350;
const FOOTER_HEIGHT = 89;
/** Title bottom → first row: separator marginTop 12 + 1px line + list marginTop 10. */
const LIST_GAP = 23;

class CatPopupPage {
  /**
   * Tap a row whose visible text contains `needle`, then Save.
   * SelectVetPopup has no search box — this is name-match, not type-to-filter.
   * @param {string} needle
   * @returns {Promise<boolean>} false when no matching text is in the tree
   */
  async selectMatchingTextAndSave(needle) {
    const variants = nameVariants(needle);
    const title = await this.#sheetTitle(['Vet Practice']);
    let minY = 0;
    if (title) {
      const loc = await title.getLocation();
      minY = loc.y;
    } else {
      const { height } = await browser.getWindowSize();
      minY = Math.round(height * 0.4);
    }
    for (const variant of variants) {
      const el =
        (await ui.firstCaptionContains(variant)) ||
        (await ui.firstUsableContains(variant));
      if (!el) {
        continue;
      }
      const loc = await el.getLocation().catch(() => null);
      if (!loc || loc.y < minY) {
        continue;
      }
      ui.log('CatPopup', `Tap name "${variant}" at y=${loc.y}`);
      await ui.tap(el);
      await browser.pause(60);
      await this.#tapSave();
      await ui.waitTrue(async () => !(await this.isOpen()), 1000);
      return true;
    }
    return false;
  }

  /**
   * Tap list row `index` (0 = first), then Save.
   * @param {number} [index=0]
   * @param {{ rowHeight?: number, listGap?: number, titles?: string[] }} [opts]
   *   SelectVetPopup rows are taller (title + address). Pass rowHeight ~60 and
   *   titles: ['Vet Practice'].
   */
  async selectRowAndSave(index = 0, opts = {}) {
    await this.#tapRow(index, opts);
    await browser.pause(60);
    await this.#tapSave();
    await ui.waitTrue(async () => !(await this.isOpen()), 1000);
  }

  /**
   * CatPopup footer Save on the lower band. Same signal as Branch / Vet sheets.
   */
  async isOpen() {
    const { height } = await browser.getWindowSize();
    const selector = ui.isAndroid()
      ? 'android=new UiSelector().text("Save")'
      : '-ios predicate string:label == "Save" OR name == "Save" OR value == "Save"';
    const els = await $$(selector);
    for (const el of els) {
      const loc = await el.getLocation().catch(() => null);
      if (loc && loc.y >= height * 0.68) {
        return true;
      }
    }
    return false;
  }

  /**
   * First row sits under the sheet title. Prefer title Y; else list from bottom.
   * @param {number} index
   * @param {{ rowHeight?: number, listGap?: number, titles?: string[] }} [opts]
   */
  async #tapRow(index, opts = {}) {
    const rowHeight =
      Number(opts.rowHeight) > 0 ? Number(opts.rowHeight) : ROW_HEIGHT;
    const listGap = Number.isFinite(Number(opts.listGap))
      ? Number(opts.listGap)
      : LIST_GAP;
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);
    const title = await this.#sheetTitle(opts.titles);
    let y;
    if (title) {
      const loc = await title.getLocation();
      const size = await title.getSize();
      const listTop = loc.y + size.height + listGap;
      y = Math.round(listTop + rowHeight * index + rowHeight / 2);
    } else {
      const listTop = height - FOOTER_HEIGHT - LIST_HEIGHT;
      y = Math.round(listTop + rowHeight * index + rowHeight / 2);
    }
    ui.log('CatPopup', `Tap row ${index} at ${x},${y}`);
    await ui.pressAt(x, y);
  }

  /**
   * Lowest on-screen title (popup, not the dimmed form label).
   * @param {string[]} [extraTitles]
   */
  async #sheetTitle(extraTitles = []) {
    const needles = [
      'Animal Category/ Type',
      'Animal Category',
      'Branch',
      'Vet Practice',
      ...(Array.isArray(extraTitles) ? extraTitles : []),
    ];
    let best = null;
    let bestY = -1;
    for (const text of needles) {
      const el =
        (await ui.firstCaption(text)) ||
        (await ui.firstCaptionContains(text)) ||
        (await ui.firstUsableContains(text));
      if (!el) {
        continue;
      }
      try {
        const loc = await el.getLocation();
        if (loc.y > bestY) {
          best = el;
          bestY = loc.y;
        }
      } catch {
        // ignore
      }
    }
    return best;
  }

  /**
   * Save is Text inside TouchableOpacity — tap the footer, not a name lookup.
   */
  async #tapSave() {
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);
    const y = Math.round(height - 62);
    ui.log('CatPopup', `Tap Save at ${x},${y}`);
    await ui.pressAt(x, y);
  }
}

module.exports = new CatPopupPage();

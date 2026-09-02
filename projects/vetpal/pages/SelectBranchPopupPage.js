/**
 * Branch CatPopup (`CatPopup.js` title **Branch**) — automation only.
 *
 * App behaviour (`NewPrescription.js` after a store is chosen):
 * - Branches still loading → field shows "Loading branches..."; tap is a toast.
 * - Exactly one branch → tap auto-fills; the sheet does not open.
 * - Two or more branches → field stays **Select Branch**. Tap the gray row
 *   under the green "Branch" title, pick a list row, then Save.
 *
 * There is no search box (unlike RemedyStoreModal). Selection matches the
 * store/practice pattern: open sheet → tap row at `BRANCH_INDEX` → Save.
 *
 * Rows are TouchableOpacity. Labels are often missing from XCUITest — tap
 * by layout. Save with no row selected is a no-op.
 *
 * Do not skip this step when "Select Branch" is missing from the iOS tree:
 * RN often hides that placeholder, but the field is still empty on screen.
 *
 * Do not CONTAINS-match "Branch" — that hits **Select Branch** (the field)
 * instead of the green TitleView, and the tap lands on the hint card.
 */
const { ui } = require('./ui');

/** CatPopup.js viewCellBG + title line (~46px including separator). */
const ROW_STRIDE = 46;

class SelectBranchPopupPage {
  /**
   * Sheet is open when the CatPopup footer Save is on the lower band.
   * Step 1's CTA is **Next**, so Save is unique to this (or another) sheet.
   * Modal titles often report isDisplayed=false on iOS — use Y, not displayed.
   */
  async isOpen() {
    return ui.saveExists();
  }

  /**
   * Tap **Select Branch** (or the gray row under the Branch title), then
   * pick `index` and Save when the sheet opens.
   *
   * Index 0 = first branch (default). Index 1 = second branch, and so on.
   * One-branch auto-fill: the sheet never opens; this returns after the tap.
   *
   * @param {number} [index=0] 0-based row in the Branch CatPopup
   */
  async selectAndSave(index = 0) {
    const requested =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;
    await this.#waitLoadingIdle();

    if (await this.isOpen()) {
      ui.log('BranchPopup', `Sheet already open — tap row ${requested}`);
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

    ui.log('BranchPopup', `Sheet open — tap row ${requested} then Save`);
    await this.#selectRowAndSave(requested);
  }

  /**
   * Tap the gray **Select Branch** row under the green "Branch" label —
   * not the TitleView itself and not the "Go to My Remedy Store" hint.
   * @returns {Promise<boolean>} true when the CatPopup opened
   */
  async openFromForm() {
    if (await this.isOpen()) {
      return true;
    }

    await this.#tapSelectField();
    if (await ui.waitTrue(() => ui.saveExists(), 600)) {
      return true;
    }
    await this.#tapSelectField();
    return ui.waitTrue(() => ui.saveExists(), 400);
  }

  /**
   * Gray placeholder / value row under TitleView. hitSlop={30} on the field.
   */
  async #tapSelectField() {
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);

    const formTitle = await this.#formTitleRect();
    if (formTitle) {
      const y = Math.round(formTitle.loc.y + formTitle.size.height + 4 + 26);
      ui.log('BranchPopup', `Tap gray field below Branch title at ${x},${y}`);
      await ui.pressAt(x, y);
      return;
    }

    const y = Math.round(height * 0.62);
    ui.log('BranchPopup', `Tap Branch field fallback at ${x},${y}`);
    await ui.pressAt(x, y);
  }

  /**
   * Green TitleView only (exact "Branch"). Prefer the highest match so a
   * dimmed form label wins over a sheet title if both are in the tree.
   */
  async #formTitleRect() {
    const rects = await this.#exactBranchRects();
    const upper = [...rects].sort((a, b) => a.loc.y - b.loc.y);
    return upper[0] || null;
  }

  /**
   * Exact label/name/value "Branch" — include not-displayed (RN modal).
   * @returns {Promise<Array<{ el: WebdriverIO.Element, loc: {x:number,y:number}, size: {width:number,height:number} }>>}
   */
  async #exactBranchRects() {
    const selector = ui.isAndroid()
      ? 'android=new UiSelector().text("Branch")'
      : '-ios predicate string:label == "Branch" OR name == "Branch" OR value == "Branch"';
    const els = await $$(selector);
    const out = [];
    for (const el of els) {
      const loc = await el.getLocation().catch(() => null);
      const size = await el.getSize().catch(() => null);
      if (!loc || !size || size.height < 1) {
        continue;
      }
      out.push({ el, loc, size });
    }
    return out;
  }

  /**
   * @param {number} index
   */
  async #selectRowAndSave(index) {
    ui.log('BranchPopup', `Tap row ${index} then Save (layout)`);
    await ui.tapSheetRowThenSave({ index, rowStride: ROW_STRIDE });
  }

  /**
   * Short settle after store Save — skip XCUITest "Loading branches" scans.
   */
  async #waitLoadingIdle() {
    await browser.pause(150);
  }
}

module.exports = new SelectBranchPopupPage();

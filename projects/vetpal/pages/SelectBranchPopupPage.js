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
/** Title bottom → first row: separator marginTop 12 + 1px line + list marginTop 10. */
const LIST_GAP = 23;

class SelectBranchPopupPage {
  /**
   * Sheet is open when the CatPopup footer Save is on the lower band.
   * Step 1's CTA is **Next**, so Save is unique to this (or another) sheet.
   * Modal titles often report isDisplayed=false on iOS — use Y, not displayed.
   */
  async isOpen() {
    return Boolean(await this.#footerSave());
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
    if (await ui.waitTrue(() => this.isOpen(), 1600)) {
      return true;
    }

    await this.#tapSelectFieldFallbacks();
    return ui.waitTrue(() => this.isOpen(), 1000);
  }

  /**
   * Gray placeholder / value row under TitleView. hitSlop={30} on the field.
   */
  async #tapSelectField() {
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);

    const placeholder = await this.#selectPlaceholder();
    if (placeholder) {
      const loc = await placeholder.getLocation();
      const size = await placeholder.getSize();
      const y = Math.round(loc.y + Math.min(size.height, 52) / 2);
      ui.log('BranchPopup', `Tap Select Branch placeholder at ${x},${y}`);
      await ui.pressAt(x, y);
      return;
    }

    const formTitle = await this.#formTitleRect();
    if (formTitle) {
      // formField: marginTop 4, minHeight 52 — center of the gray row
      const y = Math.round(formTitle.loc.y + formTitle.size.height + 4 + 26);
      ui.log('BranchPopup', `Tap gray field below Branch title at ${x},${y}`);
      await ui.pressAt(x, y);
      return;
    }

    const hint = await ui.firstCaptionContains('Go to My Remedy Store');
    if (hint) {
      const loc = await hint.getLocation();
      const y = Math.round(loc.y - 72);
      ui.log('BranchPopup', `Tap field above store hint at ${x},${y}`);
      await ui.pressAt(x, y);
      return;
    }

    const y = Math.round(height * 0.62);
    ui.log('BranchPopup', `Tap Branch field fallback at ${x},${y}`);
    await ui.pressAt(x, y);
  }

  /**
   * Extra taps if the first miss hit the title or the hint card.
   */
  async #tapSelectFieldFallbacks() {
    const { width } = await browser.getWindowSize();
    const x = Math.round(width / 2);
    const formTitle = await this.#formTitleRect();
    const ys = [];
    if (formTitle) {
      const top = formTitle.loc.y + formTitle.size.height;
      ys.push(Math.round(top + 20), Math.round(top + 36), Math.round(top + 50));
    }
    const hint = await ui.firstCaptionContains('Go to My Remedy Store');
    if (hint) {
      const loc = await hint.getLocation();
      ys.push(Math.round(loc.y - 90), Math.round(loc.y - 55));
    }
    for (const y of ys) {
      ui.log('BranchPopup', `Retry field tap at y=${y}`);
      await ui.pressAt(x, y);
      if (await ui.waitTrue(() => this.isOpen(), 400)) {
        return;
      }
    }
  }

  /**
   * Exact "Select Branch" on the field — not "Select" (Vet Practice) and
   * not "Select Dispense Store".
   */
  async #selectPlaceholder() {
    const selector = ui.isAndroid()
      ? 'android=new UiSelector().text("Select Branch")'
      : '-ios predicate string:label == "Select Branch" OR name == "Select Branch" OR value == "Select Branch"';
    const els = await $$(selector);
    for (const el of els) {
      const loc = await el.getLocation().catch(() => null);
      if (!loc) {
        continue;
      }
      return el;
    }
    return (
      (await ui.firstCaption('Select Branch')) ||
      (await ui.firstUsableContains('Select Branch'))
    );
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
   * Sheet title is the lowest exact "Branch" (below the form label).
   */
  async #popupTitleRect() {
    const { height } = await browser.getWindowSize();
    const rects = await this.#exactBranchRects();
    const lower = rects
      .filter(t => t.loc.y > height * 0.4)
      .sort((a, b) => b.loc.y - a.loc.y);
    return lower[0] || this.#formTitleRect();
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
    await this.#tapRow(index);
    await this.#saveAndWaitClosed();
  }

  async #saveAndWaitClosed() {
    await browser.pause(60);
    await this.#tapSave();
    if (await ui.waitTrue(async () => !(await this.isOpen()), 1200)) {
      return;
    }
    ui.log('BranchPopup', 'Retry row 0 + Save');
    await this.#tapRow(0);
    await browser.pause(60);
    await this.#tapSave();
    if (!(await ui.waitTrue(async () => !(await this.isOpen()), 1200))) {
      throw new Error(
        'Save did not close the Branch popup. A list row must be tapped before Save.',
      );
    }
  }

  /**
   * Prefer list geometry from the Save footer. The form also has a "Branch"
   * TitleView lower on the screen, so title-Y can point at the dimmed form.
   * CatPopup list is height 350 with marginBottom 10 above the footer.
   * @param {number} index
   */
  async #tapRow(index) {
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);
    const LIST_HEIGHT = 350;
    const LIST_MARGIN_BOTTOM = 10;
    const save = await this.#footerSave();
    let listTop;
    if (save) {
      const loc = await save.getLocation();
      listTop = loc.y - LIST_MARGIN_BOTTOM - LIST_HEIGHT;
    } else {
      const title = await this.#popupTitleRect();
      listTop = title
        ? title.loc.y + title.size.height + LIST_GAP
        : height - 89 - LIST_HEIGHT;
    }
    const y = Math.round(listTop + ROW_STRIDE * index + ROW_STRIDE / 2);
    ui.log('BranchPopup', `Tap branch row ${index} at ${x},${y}`);
    await ui.pressAt(x, y);
  }

  async #tapSave() {
    const { width, height } = await browser.getWindowSize();
    const save = await this.#footerSave();
    if (save) {
      ui.log('BranchPopup', 'Click Save');
      await ui.press(save);
      return;
    }
    const x = Math.round(width / 2);
    const y = Math.round(height - 62);
    ui.log('BranchPopup', `Press Save at ${x},${y}`);
    await ui.pressAt(x, y);
  }

  /**
   * Footer Save — RN modal text is often isDisplayed=false. Use Y on screen.
   */
  async #footerSave() {
    const { height } = await browser.getWindowSize();
    const selectors = ui.isAndroid()
      ? ['android=new UiSelector().text("Save")']
      : [
          '-ios predicate string:type == "XCUIElementTypeButton" AND (label == "Save" OR name == "Save")',
          '-ios predicate string:label == "Save" OR name == "Save" OR value == "Save"',
        ];
    for (const sel of selectors) {
      const els = await $$(sel);
      for (const el of els) {
        const loc = await el.getLocation().catch(() => null);
        const size = await el.getSize().catch(() => null);
        if (!loc || !size) {
          continue;
        }
        if (size.height >= height * 0.4 || loc.y < height * 0.68) {
          continue;
        }
        return el;
      }
    }
    return null;
  }

  /**
   * Next is a no-op while `isBranchListLoading` (NewPrescription.js).
   */
  async #waitLoadingIdle() {
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
}

module.exports = new SelectBranchPopupPage();

/**
 * SelectVetPopup.js — automation only (Vet Pal app is not changed).
 *
 * App behaviour (NewPrescription.js):
 * - Exactly one subscribed vet → field auto-fills full_name. Do not open this popup.
 * - Two or more vets → field stays "Select". Tap the field, pick a row, Save.
 *
 * There is no search box (unlike RemedyStoreModal). Open sheet → tap row → Save.
 * Save with no row selected is a no-op (`selectedServicesList` stays empty).
 *
 * Layout (unlike CatPopup): the white sheet sizes to the list. Overlay is
 * `flex:1` above it — a tap there closes the sheet with no selection.
 * Save sits *inside* the sheet (`bottomButtonsBG` height 55), not in a
 * separate 350px list + footer. Do not use `tapSheetRowThenSave` here.
 *
 * Rows: TouchableOpacity (title + address). Tap the row body, not overlay.
 */
const { ui } = require('./ui');
const { nameVariants } = require('../data/providerData');

/** Separator under the sheet title (marginTop 12 + 1px line). */
const LIST_GAP = 13;

/** Title line + address + 8px ItemSeparator (~60px). */
const ROW_STRIDE = 60;

class SelectVetPopupPage {
  /**
   * Sheet is open when a Save control exists (step 1 CTA is Next).
   */
  async isOpen() {
    return ui.saveExists();
  }

  /**
   * Skip only when the gray field already shows this practice name.
   * "Select" is often not a tappable XCUITest node — if it is in the tree,
   * the popup is still needed. Do not match the name anywhere else on screen.
   * @param {string} practiceName
   */
  async isPracticeAlreadyOnForm(practiceName) {
    if (await this.isOpen()) {
      return false;
    }
    if (await this.#selectPlaceholder()) {
      return false;
    }
    const name = String(practiceName || '').trim();
    if (!name) {
      return false;
    }
    const title = await this.#formTitleRect();
    const minY = title ? title.loc.y : 0;
    const { height } = await browser.getWindowSize();
    const maxY = Math.min(minY + 90, height * 0.5);
    for (const variant of nameVariants(name)) {
      const el =
        (await ui.firstCaptionContains(variant)) ||
        (await ui.firstUsableContains(variant));
      if (!el) {
        continue;
      }
      const loc = await el.getLocation().catch(() => null);
      if (loc && loc.y >= minY && loc.y <= maxY) {
        return true;
      }
    }
    return false;
  }

  /**
   * Tap the gray **Select** row under the green "Vet Practice" label.
   * Do not click the "Select" StaticText (not clickable). Tap the row body.
   */
  async openFromForm() {
    if (await this.isOpen()) {
      return;
    }

    await this.#tapSelectRow();
    if (await ui.waitTrue(() => this.isOpen(), 800)) {
      return;
    }
    await this.#tapSelectRowOffsets();
    if (!(await ui.waitTrue(() => this.isOpen(), 600))) {
      throw new Error('Vet Practice popup did not open');
    }
  }

  /**
   * formField is minHeight 52, marginTop 4 under TitleView.
   * Cap title height — XCUITest may report a tall container, and
   * title.bottom + 26 then misses the row (taps the hint or the store).
   */
  async #tapSelectRow() {
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);

    const placeholder = await this.#selectPlaceholder();
    if (placeholder) {
      const loc = await placeholder.getLocation();
      const size = await placeholder.getSize();
      // Text is not clickable — tap the row center under the label.
      const y = Math.round(loc.y + Math.max(size.height, 40) / 2 + 8);
      ui.log('VetPopup', `Tap Select row body at ${x},${y}`);
      await ui.pressAt(x, y);
      return;
    }

    const formTitle = await this.#formTitleRect();
    if (formTitle) {
      const titleH = Math.min(formTitle.size.height, 22);
      const y = Math.round(formTitle.loc.y + titleH + 4 + 26);
      ui.log('VetPopup', `Tap gray Select row below title at ${x},${y}`);
      await ui.pressAt(x, y);
      return;
    }

    const y = Math.round(height * 0.32);
    ui.log('VetPopup', `Tap Vet Practice field fallback at ${x},${y}`);
    await ui.pressAt(x, y);
  }

  /**
   * Extra Y offsets if the first tap hit the title or the hint card.
   */
  async #tapSelectRowOffsets() {
    const { width } = await browser.getWindowSize();
    const x = Math.round(width / 2);
    const formTitle = await this.#formTitleRect();
    if (!formTitle) {
      return;
    }
    const top = formTitle.loc.y + Math.min(formTitle.size.height, 22);
    for (const extra of [20, 36, 52, 68]) {
      const y = Math.round(top + extra);
      ui.log('VetPopup', `Retry Select row at y=${y}`);
      await ui.pressAt(x, y);
      if (await ui.waitTrue(() => this.isOpen(), 350)) {
        return;
      }
    }
  }

  /**
   * Exact "Select" on the practice field — not Select Branch / Select Dispense Store.
   */
  async #selectPlaceholder() {
    const selector = ui.isAndroid()
      ? 'android=new UiSelector().text("Select")'
      : '-ios predicate string:label == "Select" OR name == "Select" OR value == "Select"';
    const els = await $$(selector);
    for (const el of els) {
      const txt = String(
        (await el.getText().catch(() => '')) ||
          (await el.getAttribute('label').catch(() => '')) ||
          '',
      ).trim();
      if (!txt || txt !== 'Select') {
        continue;
      }
      const loc = await el.getLocation().catch(() => null);
      if (!loc || loc.y > 700) {
        continue;
      }
      return el;
    }
    return ui.firstCaption('Select');
  }

  /**
   * Smallest exact "Vet Practice" in the upper half (the TitleView label,
   * not a tall container).
   */
  async #formTitleRect() {
    const { height } = await browser.getWindowSize();
    const rects = await this.#exactVetPracticeRects();
    const upper = rects
      .filter(t => t.loc.y < height * 0.5 && t.size.height < 80)
      .sort((a, b) => a.size.height - b.size.height || a.loc.y - b.loc.y);
    return (
      upper[0] ||
      rects.filter(t => t.loc.y < height * 0.5).sort((a, b) => a.loc.y - b.loc.y)[0] ||
      null
    );
  }

  /**
   * Exact label/name/value "Vet Practice" — include not-displayed (RN modal).
   * @returns {Promise<Array<{ el: WebdriverIO.Element, loc: {x:number,y:number}, size: {width:number,height:number} }>>}
   */
  async #exactVetPracticeRects() {
    const selector = ui.isAndroid()
      ? 'android=new UiSelector().text("Vet Practice")'
      : '-ios predicate string:label == "Vet Practice" OR name == "Vet Practice" OR value == "Vet Practice"';
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
   * Sheet title — the lower exact "Vet Practice" (y > 35% of screen).
   * The form TitleView sits in the upper half and must not be used for row Y.
   */
  async #popupTitleRect() {
    const { height } = await browser.getWindowSize();
    const rects = await this.#exactVetPracticeRects();
    const lower = rects
      .filter(t => t.loc.y > height * 0.35 && t.size.height < 80)
      .sort((a, b) => b.loc.y - a.loc.y);
    return lower[0] || null;
  }

  /**
   * Tap the practice row (by index, or by name when index is 0), wait for
   * React `selectedList`, then tap **sheet** Save. Retry once if the field
   * is still "Select" (Save with no row is a no-op; overlay tap dismisses).
   * @param {string} [practiceName]
   * @param {number} [index=0]
   */
  async selectRowAndSave(practiceName, index = 0) {
    const requested =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;
    const name = String(practiceName || '').trim();

    await ui.waitTrue(() => this.isOpen(), 800);

    for (let attempt = 0; attempt < 2; attempt++) {
      if (!(await this.isOpen())) {
        ui.log('VetPopup', 'Sheet closed before row tap — reopen');
        await this.openFromForm();
      }
      await this.#tapPracticeRow(name, requested, attempt);
      await browser.pause(150);
      await this.#tapSheetSave();
      const filled = await ui.waitTrue(async () => {
        if (await this.isOpen()) {
          return false;
        }
        return !(await this.#selectPlaceholder());
      }, 900);
      if (filled) {
        return;
      }
      ui.log('VetPopup', `Row ${requested} did not stick — retry`);
    }
  }

  /**
   * Index > 0 always uses layout (name would hit a different row).
   * Index 0 may tap a visible name under the sheet title.
   * @param {string} name
   * @param {number} index
   * @param {number} [nudge=0] extra px down on retry
   */
  async #tapPracticeRow(name, index, nudge = 0) {
    const title = await this.#popupTitleRect();
    if (
      index === 0 &&
      name &&
      nudge === 0 &&
      (await this.#tapNamedRowBelowTitle(name, title))
    ) {
      return;
    }

    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);

    if (title) {
      const titleH = Math.min(title.size.height, 28);
      const listTop = title.loc.y + titleH + LIST_GAP;
      const rowY = Math.round(
        listTop + ROW_STRIDE * index + ROW_STRIDE / 2 + nudge * 16,
      );
      // Overlay is everything above the white sheet — never tap there.
      const minY = Math.round(title.loc.y + titleH + 8);
      const y = Math.max(rowY, minY);
      ui.log(
        'VetPopup',
        `Tap practice row ${index} at ${x},${y} (sheet title y=${Math.round(title.loc.y)})`,
      );
      await ui.pressAt(x, y);
      return;
    }

    // Sheet is pinned to the bottom; stay in the lower band (not overlay).
    const y = Math.round(height * 0.8 + ROW_STRIDE * index + nudge * 16);
    ui.log('VetPopup', `Tap practice row ${index} fallback at ${x},${y}`);
    await ui.pressAt(x, y);
  }

  /**
   * Practice names are often in the iOS tree on this sheet. Tap the row body
   * (StaticText itself is not the TouchableOpacity).
   * @param {string} name
   * @param {{ loc: { y: number }, size: { height: number } }|null} title
   * @returns {Promise<boolean>}
   */
  async #tapNamedRowBelowTitle(name, title) {
    const { width, height } = await browser.getWindowSize();
    const minY = title
      ? title.loc.y + Math.min(title.size.height, 28)
      : height * 0.4;
    const x = Math.round(width / 2);
    for (const variant of nameVariants(name)) {
      const el =
        (await ui.firstCaptionContains(variant)) ||
        (await ui.firstUsableContains(variant));
      if (!el) {
        continue;
      }
      const loc = await el.getLocation().catch(() => null);
      const size = await el.getSize().catch(() => null);
      if (!loc || loc.y < minY) {
        continue;
      }
      const y = Math.round(loc.y + Math.max(size ? size.height : 20, 20) / 2);
      ui.log('VetPopup', `Tap named practice "${variant}" at ${x},${y}`);
      await ui.pressAt(x, y);
      return true;
    }
    return false;
  }

  /**
   * Save on the sheet (below the popup title). Do not tap Next on the form.
   */
  async #tapSheetSave() {
    const title = await this.#popupTitleRect();
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);
    const minY = title ? title.loc.y : height * 0.5;

    const selector = ui.isAndroid()
      ? 'android=new UiSelector().text("Save")'
      : '-ios predicate string:label == "Save" OR name == "Save"';
    const els = await $$(selector);
    for (const el of els) {
      const loc = await el.getLocation().catch(() => null);
      const size = await el.getSize().catch(() => null);
      if (!loc || loc.y < minY) {
        continue;
      }
      const y = Math.round(loc.y + (size ? size.height / 2 : 20));
      ui.log('VetPopup', `Tap sheet Save at ${x},${y}`);
      await ui.pressAt(x, y);
      return;
    }

    if (await this.isOpen()) {
      const saveY = Math.round(height - 62);
      ui.log('VetPopup', `Tap sheet Save layout at ${x},${saveY}`);
      await ui.pressAt(x, saveY);
    }
  }
}

module.exports = new SelectVetPopupPage();

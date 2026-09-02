/**
 * SelectVetPopup.js — automation only (Vet Pal app is not changed).
 *
 * App behaviour (NewPrescription.js):
 * - Exactly one subscribed vet → field auto-fills full_name. Do not open this popup.
 * - Two or more vets → field stays "Select". Tap the field, pick a row, Save.
 *
 * There is no search box (unlike RemedyStoreModal). Selection is the same
 * pattern as the store modal: open sheet → tap row at index → Save.
 *
 * Rows are TouchableOpacity (title + address). Labels are often missing from
 * XCUITest. Tap by position. Save with no row selected is a no-op.
 *
 * Layout: dismiss overlay, white sheet (title + list), footer Save (height 55).
 */
const { ui } = require('./ui');
const { nameVariants } = require('../data/providerData');

/** Title line + address + 8px ItemSeparator (~60px). */
const ROW_STRIDE = 60;
/** Title bottom → first row: separator marginTop 12 + 1px line. */
const LIST_GAP = 13;

class SelectVetPopupPage {
  /**
   * Sheet is open when the footer Save sits on the lower band (step 1 CTA is
   * Next). Prefer Save over the form title so we don't wait on extra queries.
   */
  async isOpen() {
    return Boolean(await this.#footerSave());
  }

  /**
   * Skip only when the field already shows this practice name (one-vet auto-fill).
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
    for (const variant of nameVariants(name)) {
      if (
        (await ui.firstCaptionContains(variant)) ||
        (await ui.firstUsableContains(variant))
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Tap the gray Select (or filled value) **under** the green "Vet Practice"
   * label — not the hero subtitle and not the label itself.
   */
  async openFromForm() {
    if (await this.isOpen()) {
      return;
    }

    await this.#tapSelectField();
    if (await ui.waitTrue(() => this.isOpen(), 1600)) {
      return;
    }

    await this.#tapSelectFieldFallbacks();
    if (await ui.waitTrue(() => this.isOpen(), 1000)) {
      return;
    }
    throw new Error('Vet Practice popup did not open');
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
      ui.log('VetPopup', `Tap Select placeholder at ${x},${y}`);
      await ui.pressAt(x, y);
      return;
    }

    const formTitle = await this.#formTitleRect();
    if (formTitle) {
      // formField: marginTop 4, minHeight 52 — center of the gray row
      const y = Math.round(formTitle.loc.y + formTitle.size.height + 4 + 26);
      ui.log('VetPopup', `Tap gray field below title at ${x},${y}`);
      await ui.pressAt(x, y);
      return;
    }

    const hint = await ui.firstCaptionContains('Go to My Vet Practice');
    if (hint) {
      const loc = await hint.getLocation();
      const y = Math.round(loc.y - 72);
      ui.log('VetPopup', `Tap field above hint at ${x},${y}`);
      await ui.pressAt(x, y);
      return;
    }

    const y = Math.round(height * 0.32);
    ui.log('VetPopup', `Tap Vet Practice field fallback at ${x},${y}`);
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
    const hint = await ui.firstCaptionContains('Go to My Vet Practice');
    if (hint) {
      const loc = await hint.getLocation();
      ys.push(Math.round(loc.y - 90), Math.round(loc.y - 55));
    }
    for (const y of ys) {
      ui.log('VetPopup', `Retry field tap at y=${y}`);
      await ui.pressAt(x, y);
      if (await ui.waitTrue(() => this.isOpen(), 400)) {
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
   * Green TitleView only (exact). Ignore hero CONTAINS "vet practice".
   */
  async #formTitleRect() {
    const { height } = await browser.getWindowSize();
    const rects = await this.#exactVetPracticeRects();
    const upper = rects
      .filter(t => t.loc.y < height * 0.5)
      .sort((a, b) => a.loc.y - b.loc.y);
    return upper[0] || null;
  }

  async #popupTitleRect() {
    const { height } = await browser.getWindowSize();
    const rects = await this.#exactVetPracticeRects();
    const lower = rects
      .filter(t => t.loc.y > height * 0.35)
      .sort((a, b) => b.loc.y - a.loc.y);
    return lower[0] || null;
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
   * Tap list row then Save — same rules as Remedy Store.
   * Index 0 + name: tap matching row in the sheet if the label is in the tree.
   * Index > 0: tap that row on the full list (no name lookup).
   * @param {string} [practiceName]
   * @param {number} [index=0]
   */
  async selectRowAndSave(practiceName, index = 0) {
    const requested =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;
    const name = String(practiceName || '').trim();
    const useName = Boolean(name) && requested === 0;

    if (useName) {
      const matched = await this.#tapNamedRow(name);
      if (matched) {
        await this.#saveAndWaitClosed();
        return;
      }
      ui.log('VetPopup', `Name not in tree — tap row ${requested}`);
    } else if (name && requested > 0) {
      ui.log(
        'VetPopup',
        `Skip name (index ${requested}) so the full list stays in order`,
      );
    }

    await this.#tapRow(requested);
    await this.#saveAndWaitClosed();
  }

  async #saveAndWaitClosed() {
    await browser.pause(60);
    await this.#tapSave();
    if (await ui.waitTrue(async () => !(await this.isOpen()), 1200)) {
      return;
    }
    ui.log('VetPopup', 'Retry row 0 + Save');
    await this.#tapRow(0);
    await browser.pause(60);
    await this.#tapSave();
    if (!(await ui.waitTrue(async () => !(await this.isOpen()), 1200))) {
      throw new Error(
        'Save did not close the Vet Practice popup. A list row must be tapped before Save.',
      );
    }
  }

  /**
   * @param {string} needle
   * @returns {Promise<boolean>}
   */
  async #tapNamedRow(needle) {
    const sheet = await this.#popupTitleRect();
    const minY = sheet
      ? sheet.loc.y
      : Math.round((await browser.getWindowSize()).height * 0.4);
    for (const variant of nameVariants(needle)) {
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
      ui.log('VetPopup', `Tap name "${variant}" at y=${loc.y}`);
      await ui.press(el);
      return true;
    }
    return false;
  }

  /**
   * @param {number} index
   */
  async #tapRow(index) {
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);
    const title = await this.#popupTitleRect();
    let y;
    if (title) {
      const listTop = title.loc.y + title.size.height + LIST_GAP;
      y = Math.round(listTop + ROW_STRIDE * index + ROW_STRIDE / 2);
    } else {
      y = Math.round(height * 0.55 + ROW_STRIDE * index);
    }
    ui.log('VetPopup', `Tap practice row ${index} at ${x},${y}`);
    await ui.pressAt(x, y);
  }

  async #tapSave() {
    const { width, height } = await browser.getWindowSize();
    const save = await this.#footerSave();
    if (save) {
      ui.log('VetPopup', 'Click Save');
      await ui.press(save);
      return;
    }
    const x = Math.round(width / 2);
    const y = Math.round(height - 62);
    ui.log('VetPopup', `Press Save at ${x},${y}`);
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
}

module.exports = new SelectVetPopupPage();

/**
 * RemedyStoreModal.js — automation only (Vet Pal app is not changed).
 *
 * Card title/address are grouped inside TouchableOpacity, so XCUITest has
 * no StaticText/label for "Southwood Pharmacy". Do not look up the name.
 *
 * Flow:
 * - Index 0 + name → type Search (list shrinks to the match) → tap first card → Save.
 * - Index > 0 → do **not** search (search would leave only one card, so index 2
 *   taps empty space). Tap that card on the full list → Save.
 * Card text is not a reliable tap target (search field often has the same value).
 *
 * Layout:
 * - Sheet is 88% of screen; top 12% is a dismiss overlay (do not tap there).
 * - Search bar, then FlatList cards, then footer Save (height 56 + safe area).
 */
const { ui } = require('./ui');

/**
 * RemedyStoreModal.js: padding 14 + image 44 + padding 14 + marginBottom 12.
 * Address can add a few pixels; the tap stays on the card body.
 */
const CARD_STRIDE = 84;

class RemedyStoreModalPage {
  async #searchField() {
    if (ui.isAndroid()) {
      return ui.firstDisplayed(
        'android=new UiSelector().className("android.widget.EditText")',
      );
    }
    return ui.firstDisplayed(
      '-ios predicate string:placeholderValue CONTAINS "Search store name" OR value CONTAINS "Search store name"',
    );
  }

  async isOpen() {
    return ui.saveExists();
  }

  /**
   * True when the form already shows this store (modal not needed).
   * @param {string} storeName
   */
  async isStoreAlreadyOnForm(storeName) {
    if (await this.isOpen()) {
      return false;
    }
    const placeholder = await ui.firstCaptionContains('Select Dispense Store');
    if (placeholder) {
      return false;
    }
    return Boolean(
      (await ui.firstCaptionContains(storeName)) ||
        (await ui.firstUsableContains(storeName)),
    );
  }

  async openFromForm() {
    if (await this.isOpen()) {
      return;
    }

    const field =
      (await ui.firstCaptionContains('Select Dispense Store')) ||
      (await ui.firstUsableContains('Select Dispense Store'));
    if (field) {
      ui.log('RemedyStore', 'Tap Select Dispense Store field');
      await ui.press(field);
      if (await ui.waitTrue(() => this.isOpen(), 600)) {
        return;
      }
    }

    const { width, height } = await browser.getWindowSize();
    const cx = Math.round(width / 2);
    await ui.pressAt(cx, Math.round(height * 0.5));
    if (!(await ui.waitTrue(() => this.isOpen(), 400))) {
      throw new Error('Remedy Store modal did not open');
    }
  }

  /**
   * Select a store card then Save.
   * Search only when index is 0: typing a name filters to one card, so a
   * higher index (e.g. --store=2) would miss. Index > 0 uses the full list.
   * @param {string} [storeName]
   * @param {number} [index=0]
   */
  async searchSelectAndSave(storeName, index = 0) {
    const requested =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;
    const query = String(storeName || '').trim();
    const useSearch = Boolean(query) && requested === 0;
    const cardIndex = useSearch ? 0 : requested;

    if (useSearch) {
      await this.#typeSearch(query);
      await this.#hideKeyboardSafely();
      if (await this.#listIsEmpty()) {
        throw new Error(`No Remedy Store matching "${query}"`);
      }
    } else if (query && requested > 0) {
      ui.log(
        'RemedyStore',
        `Skip search (index ${requested}) so the full list stays in order`,
      );
    }

    await this.#tapCard(cardIndex);
    await browser.pause(50);
    await this.#tapSave();
    await browser.pause(120);
  }

  /**
   * RemedyStoreModal filters by name/address contains (case-insensitive).
   * @param {string} query
   */
  async #typeSearch(query) {
    const search = await this.#searchField();
    if (!search) {
      ui.log('RemedyStore', 'Search field missing — skip type');
      return;
    }
    const typed =
      (await search.getAttribute('value').catch(() => '')) || '';
    const token = query.split(/\s+/)[0] || query;
    if (String(typed).toLowerCase().includes(token.toLowerCase())) {
      ui.log('RemedyStore', `Search already "${typed}"`);
      return;
    }
    ui.log('RemedyStore', `Search "${query}"`);
    await search.click().catch(() => ui.tap(search));
    try {
      await search.setValue(query);
    } catch {
      await ui.typeInto(search, query);
    }
    await browser.pause(100);
  }

  /**
   * @returns {Promise<boolean>}
   */
  async #listIsEmpty() {
    return Boolean(
      (await ui.firstCaptionContains('No Remedy Store found')) ||
        (await ui.firstCaption('No Remedy Store found')),
    );
  }

  /**
   * FlatList cards sit under the search bar. Tap by position.
   * Cap search-field height: XCUITest sometimes reports a huge TextField.
   * @param {number} [index=0]
   */
  async #tapCard(index = 0) {
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);
    let firstCenterY;
    const search = await this.#searchField();
    if (search) {
      const loc = await search.getLocation();
      const size = await search.getSize();
      const searchH = size.height > 80 ? 50 : size.height;
      firstCenterY = loc.y + searchH + 12 + 36;
    } else {
      firstCenterY = height * 0.12 + 56 + 62 + 40;
    }
    const y = Math.round(firstCenterY + CARD_STRIDE * index);
    ui.log('RemedyStore', `Tap store card ${index} at ${x},${y}`);
    await ui.pressAt(x, y);
  }

  /**
   * Footer: height 56, marginBottom = safe-area (~34). Center of Save.
   */
  async #tapSave() {
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);
    const y = Math.round(height - 62);
    ui.log('RemedyStore', `Press Save at ${x},${y}`);
    await ui.pressAt(x, y);
  }

  /**
   * Never tap the top 12% overlay — that closes the sheet.
   */
  async #hideKeyboardSafely() {
    try {
      if (!(await browser.isKeyboardShown())) {
        return;
      }
    } catch {
      // continue
    }
    try {
      await browser.keys(['Return']);
      await browser.pause(50);
      if (!(await browser.isKeyboardShown().catch(() => true))) {
        return;
      }
    } catch {
      // fall through
    }
    const { width, height } = await browser.getWindowSize();
    const y = Math.round(height * 0.14 + 24);
    ui.log('RemedyStore', `Dismiss keyboard on sheet header at y=${y}`);
    await ui.pressAt(width / 2, y);
    await browser.pause(50);
  }
}

module.exports = new RemedyStoreModalPage();

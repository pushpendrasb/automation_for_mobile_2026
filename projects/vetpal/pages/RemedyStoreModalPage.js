/**
 * RemedyStoreModal.js — tap by testID only (no screen width/height).
 *
 * Flow:
 * - Index 0 + name → type `storeModal.search` → tap `storeModal.card.0` → Save.
 * - Index > 0 → do not search (search would leave only one card).
 *   Tap `storeModal.card.${index}` → `storeModal.save`.
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');

class RemedyStoreModalPage {
  /**
   * Sheet is open when Save ID is in the tree.
   * @returns {Promise<boolean>}
   */
  async isOpen() {
    return Boolean(await ui.firstByTestId(TEST_IDS.remedyStoreModal.save));
  }

  /**
   * Open the modal from `rt.remedyStore.field`.
   */
  async openFromForm() {
    if (await this.isOpen()) {
      return;
    }
    await ui.requireTapTestId(TEST_IDS.requestTreatment.remedyStoreField);
    const opened = await ui.waitTrue(
      () => ui.firstByTestId(TEST_IDS.remedyStoreModal.save),
      600,
      30,
    );
    if (!opened) {
      throw new Error(
        'Remedy Store modal did not open (storeModal.save) — rebuild/reinstall the Vet Pal app',
      );
    }
  }

  /**
   * Select a store card then Save.
   * Search only when index is 0: typing a name filters to one card.
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
      await ui.dismissKeyboard().catch(() => {});
    } else if (query && requested > 0) {
      ui.log(
        'RemedyStore',
        `Skip search (index ${requested}) so the full list stays in order`,
      );
    }

    await ui.requireTapTestId(TEST_IDS.remedyStoreModal.card(cardIndex));
    await browser.pause(40);
    await ui.requireTapTestId(TEST_IDS.remedyStoreModal.save);
  }

  /**
   * Type into `storeModal.search`.
   * @param {string} query
   */
  async #typeSearch(query) {
    const search = await ui.firstByTestId(TEST_IDS.remedyStoreModal.search);
    if (!search) {
      throw new Error(
        'testID "storeModal.search" not found — rebuild/reinstall the Vet Pal app',
      );
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
}

module.exports = new RemedyStoreModalPage();

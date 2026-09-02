/**
 * Nearby Remedy Store New Request (NewPrescriptionForRemedyStore.js).
 * Tap by testID only — `rt.nearby.search` and `rt.nearby.store.${index}`.
 */
const { ui } = require('./ui');
const { providerData } = require('../data/providerData');
const { requestTreatmentData } = require('../data/animalCategories');
const { TEST_IDS } = require('../data/testIds');
const VetPracticeFormPage = require('./VetPracticeFormPage');

class NearbyRemedyStorePage {
  async assertNearbyFlow() {
    await ui.waitVisible(
      () => ui.byExactText(requestTreatmentData.labels.newRequest),
      20000,
      'Nearby New Request not displayed',
    );
  }

  /**
   * Nearby list is inline cards. Type into search when index is 0, then tap
   * `rt.nearby.store.${index}`.
   * @param {string} [storeName]
   * @param {number} [index]
   */
  async selectNearbyRemedyStore(
    storeName = providerData.remedyStore,
    index = providerData.remedyStoreIndex,
  ) {
    const cardIndex =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;
    const name = String(storeName || '').trim();
    ui.log(
      'Provider',
      `Nearby store search="${name || '(none)'}" card=${cardIndex}`,
    );
    if (name && cardIndex === 0) {
      await this.#typeNearbySearch(name);
    } else if (name && cardIndex > 0) {
      ui.log(
        'Provider',
        `Nearby skip search (index ${cardIndex}) so the full list stays in order`,
      );
    }
    await ui.requireTapTestId(
      TEST_IDS.requestTreatment.nearbyStoreCard(cardIndex),
    );
  }

  /**
   * Type into `rt.nearby.search`.
   * @param {string} query
   */
  async #typeNearbySearch(query) {
    const search = await ui.firstByTestId(TEST_IDS.requestTreatment.nearbySearch);
    if (!search) {
      throw new Error(
        'testID "rt.nearby.search" not found — rebuild/reinstall the Vet Pal app',
      );
    }
    ui.log('Provider', `Nearby search "${query}"`);
    await search.click().catch(() => ui.tap(search));
    try {
      await search.setValue(query);
    } catch {
      await ui.typeInto(search, query);
    }
    await browser.pause(100);
    await ui.dismissKeyboard().catch(() => {});
  }

  /**
   * Same Branch CatPopup as Vet Practice — index from `BRANCH_INDEX` / `--branch`.
   * @param {number} [index]
   */
  async selectBranch(index = providerData.branchIndex) {
    await VetPracticeFormPage.selectBranch(index);
  }

  /**
   * @deprecated Use {@link selectBranch}.
   * @param {number} [index]
   */
  async selectBranchFirstOrAutoSelected(index = providerData.branchIndex) {
    return this.selectBranch(index);
  }

  async clickNext() {
    await VetPracticeFormPage.clickNext();
  }

  async assertAnimalCategoryScreen() {
    await VetPracticeFormPage.assertAnimalCategoryScreen();
  }

  async selectAnimalCategory(categoryKey) {
    await VetPracticeFormPage.selectAnimalCategory(categoryKey);
  }

  async assertStep3() {
    await ui.waitVisible(
      () => ui.byContainsText(requestTreatmentData.labels.step3),
      40000,
      'Nearby Step 3 (assessment WebView) not displayed',
    );
    await ui.screenshot('nearby-step3-webview');
  }
}

module.exports = new NearbyRemedyStorePage();

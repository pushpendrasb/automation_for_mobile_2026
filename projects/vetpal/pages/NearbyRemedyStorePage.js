/**
 * Nearby Remedy Store New Request (NewPrescriptionForRemedyStore.js).
 * Step 1 store + branch → Step 2 animal details → Step 3 assessment WebView.
 */
const { ui } = require('./ui');
const { providerData } = require('../data/providerData');
const { requestTreatmentData } = require('../data/animalCategories');
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
   * Nearby list is inline cards. Type REMEDY_STORE_NAME into Search, then tap
   * the matching card or card at REMEDY_STORE_INDEX.
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
    const card =
      name && cardIndex === 0
        ? (await ui.firstCaptionContains(name)) ||
          (await ui.firstUsableContains(name))
        : null;
    if (card) {
      await ui.tap(card);
      return;
    }
    ui.log('Provider', `Nearby name not in tree — tap card ${cardIndex}`);
    await this.#tapNearbyCard(cardIndex);
  }

  /**
   * NewPrescriptionForRemedyStore.js search placeholder "Search store name...".
   * @param {string} query
   */
  async #typeNearbySearch(query) {
    const search = ui.isAndroid()
      ? await ui.firstDisplayed(
          'android=new UiSelector().className("android.widget.EditText")',
        )
      : await ui.firstDisplayed(
          '-ios predicate string:placeholderValue CONTAINS "Search store name" OR value CONTAINS "Search store name"',
        );
    if (!search) {
      return;
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
   * pharmacyCard: padding 14 + logo 46 + padding 14 + marginBottom 12 ≈ 86.
   * First card sits under the step-1 search / list header.
   * @param {number} index
   */
  async #tapNearbyCard(index) {
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);
    const search =
      (await ui.firstCaptionContains('Search')) ||
      (await ui.firstUsableContains('Search store'));
    let firstCenterY;
    if (search) {
      const loc = await search.getLocation();
      const size = await search.getSize();
      firstCenterY = loc.y + size.height + 14 + 37;
    } else {
      firstCenterY = height * 0.38;
    }
    const y = Math.round(firstCenterY + 86 * index);
    ui.log('Provider', `Nearby card ${index} at ${x},${y}`);
    await ui.pressAt(x, y);
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

/**
 * Nearby Remedy Store New Request (`NewPrescriptionForRemedyStore.js`).
 *
 * Isolated from Vet Practice (`VetPracticeFormPage.js` / TC-VP-*). Do not
 * change Vet Practice selectRemedyStore (modal) or rt.branch.field from here.
 *
 * App flow:
 * - Choose a Provider → Nearby Remedy Store (`provider.nearby`)
 * - Step 1: inline pharmacy cards (`rt.nearby.search`, `rt.nearby.store.N`)
 * - After a card tap, `handlePharmacySelect` loads branches:
 *   one branch auto-fills; two or more opens CatPopup by itself
 *   (no `rt.branch.field` on this screen)
 * - Next → Animal Details (shared AnimalIdentificationPage)
 * - Next → Step 3 assessment (WebTreatmentFormPage, native XCUITest tree)
 */
const { ui } = require('./ui');
const { providerData } = require('../data/providerData');
const { TEST_IDS } = require('../data/testIds');
const VetPracticeFormPage = require('./VetPracticeFormPage');

class NearbyRemedyStorePage {
  /**
   * New Request header plus the Nearby search field.
   */
  async assertNearbyFlow() {
    await browser.waitUntil(
      async () =>
        Boolean(await ui.firstByTestId(TEST_IDS.requestTreatment.nearbySearch)),
      {
        timeout: 20000,
        interval: 250,
        timeoutMsg:
          'Nearby New Request (rt.nearby.search) not displayed — rebuild/reinstall the Vet Pal app',
      },
    );
    ui.log('Nearby', 'Select Remedy Store (inline cards)');
  }

  /**
   * Wait until subscribed pharmacy cards are in the tree (after `callGetPharmaList`).
   */
  async #waitForStoreCards() {
    await browser.waitUntil(
      async () =>
        Boolean(
          await ui.firstByTestId(TEST_IDS.requestTreatment.nearbyStoreCard(0)),
        ),
      {
        timeout: 25000,
        interval: 300,
        timeoutMsg:
          'Nearby store cards (rt.nearby.store.0) did not load — check pharmacy API / subscription',
      },
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

    await this.#waitForStoreCards();

    if (name && cardIndex === 0) {
      await this.#typeNearbySearch(name);
      const matched = await ui.waitTrue(
        () => ui.firstByTestId(TEST_IDS.requestTreatment.nearbyStoreCard(0)),
        2500,
        200,
      );
      if (!matched) {
        ui.log(
          'Provider',
          `Nearby search "${name}" matched no subscribed store — clear search and pick from the full list`,
        );
        await this.#clearNearbySearch();
        await this.#waitForStoreCards();
        if (await this.#tapStoreByName(name)) {
          return;
        }
      }
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
   * Tap a visible store name on an inline card (search filter missed it).
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  async #tapStoreByName(name) {
    const el =
      (await ui.firstCaptionContains(name)) ||
      (await ui.firstUsableContains(name));
    if (!el) {
      return false;
    }
    ui.log('Provider', `Nearby tap card by name "${name}"`);
    await el.click().catch(() => ui.press(el));
    return true;
  }

  /**
   * Empty `rt.nearby.search` so `handleSearch` restores `pharmacyList`.
   */
  async #clearNearbySearch() {
    const search = await ui.firstByTestId(TEST_IDS.requestTreatment.nearbySearch);
    if (!search) {
      return;
    }
    await search.click().catch(() => {});
    try {
      await search.setValue(' ');
      await search.setValue('');
    } catch {
      await search.clearValue().catch(() => {});
    }
    await ui.dismissKeyboard().catch(() => {});
  }

  /**
   * Type into `rt.nearby.search` (`handleSearch` filters `filteredPharmacyList`).
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
   * Label on the selected card (`Branch: Loading…` / name / Select Branch).
   * @returns {Promise<string>}
   */
  async #branchLineText() {
    const el = await ui.firstByTestId(TEST_IDS.requestTreatment.nearbyBranch);
    if (el) {
      return String(
        (await el.getText().catch(() => '')) ||
          (await el.getAttribute('label').catch(() => '')) ||
          '',
      ).trim();
    }
    const cap = await ui.firstCaptionContains('Branch:');
    if (cap) {
      return String(
        (await cap.getText().catch(() => '')) ||
          (await cap.getAttribute('label').catch(() => '')) ||
          '',
      ).trim();
    }
    return '';
  }

  /**
   * After the store card tap: wait for branch API, then pick CatPopup when
   * it auto-opens (`handlePharmacySelect` in NewPrescriptionForRemedyStore.js).
   * Do not tap `rt.branch.field` — that ID exists only on Vet Practice.
   * @param {number} [index]
   */
  async selectBranch(index = providerData.branchIndex) {
    const requested =
      Number.isFinite(Number(index)) && Number(index) >= 0 ? Number(index) : 0;
    ui.log('Provider', `Nearby branch row=${requested}`);

    await browser.waitUntil(
      async () => {
        if (await ui.firstByTestId(TEST_IDS.catPopup.save)) {
          return true;
        }
        const line = await this.#branchLineText();
        if (!line) {
          return false;
        }
        if (/Loading/i.test(line)) {
          return false;
        }
        return /Branch:/i.test(line);
      },
      {
        timeout: 15000,
        interval: 300,
        timeoutMsg:
          'Nearby branch list did not finish loading after store tap',
      },
    );

    if (await ui.firstByTestId(TEST_IDS.catPopup.save)) {
      ui.log('Provider', 'Nearby CatPopup Branch — pick row then Save');
      await ui.requirePickFromSheet({
        rowId: TEST_IDS.catPopup.row(requested),
        saveId: TEST_IDS.catPopup.save,
      });
      return;
    }

    const line = await this.#branchLineText();
    if (/Select Branch/i.test(line)) {
      ui.log('Provider', 'Nearby Branch still Select — tap line to open CatPopup');
      if (await ui.tapTestId(TEST_IDS.requestTreatment.nearbyBranch)) {
        if (
          await ui.waitTrue(
            () => ui.firstByTestId(TEST_IDS.catPopup.save),
            4000,
            200,
          )
        ) {
          await ui.requirePickFromSheet({
            rowId: TEST_IDS.catPopup.row(requested),
            saveId: TEST_IDS.catPopup.save,
          });
          return;
        }
      }
      throw new Error(
        'Nearby store has no branch selected (Select Branch). Check BRANCH_INDEX / store branches.',
      );
    }

    ui.log('Provider', `Nearby branch auto-filled: ${line || '(one branch)'}`);
  }

  /**
   * @deprecated Use {@link selectBranch}.
   * @param {number} [index]
   */
  async selectBranchFirstOrAutoSelected(index = providerData.branchIndex) {
    return this.selectBranch(index);
  }

  /**
   * Footer Next (`rt.next`). Does not retry Vet Practice fields.
   */
  async clickNext() {
    ui.log('Request Treatment', 'Nearby Next (rt.next)');
    await ui.dismissKeyboardUntilGone(2);
    await ui.requireTapTestId(TEST_IDS.requestTreatment.next);
  }

  async assertAnimalCategoryScreen() {
    await VetPracticeFormPage.assertAnimalCategoryScreen();
  }

  async selectAnimalCategory(categoryKey) {
    await VetPracticeFormPage.selectAnimalCategory(categoryKey);
  }

  /**
   * Step 3 chips plus the native assessment (Core Treatment Questions / Submit).
   * Do not use `$` CONTAINS "Step 3" — that matches the full-screen Application.
   */
  async assertStep3() {
    await browser.waitUntil(
      async () =>
        Boolean(
          (await ui.firstCaptionContains('Core Treatment')) ||
            (await ui.firstCaption('Submit')) ||
            (await ui.firstCaptionContains('must complete')),
        ),
      {
        timeout: 40000,
        interval: 400,
        timeoutMsg: 'Nearby Step 3 assessment form not displayed',
      },
    );
    await ui.screenshot('nearby-step3-webview');
  }
}

module.exports = new NearbyRemedyStorePage();

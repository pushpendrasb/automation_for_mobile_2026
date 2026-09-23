/**
 * Inline Animal Identification on New Request step 2.
 * Fills `animalId.${mode}.${key}.${index}` — no placeholders, no swipe.
 *
 * Default mode follows `getDefaultIdentificationMode` in the app:
 * Horse / Pig / Poultry → Group; Cattle / Sheep / Goat / Deer → Microchip/ID.
 * Override with `--mode=group` | `--mode=tags` (`ANIMAL_ID_MODE`).
 */
const { ui } = require('./ui');
const {
  categoryByKey,
  identificationFor,
  freeTextIdentificationFor,
} = require('../data/animalCategories');
const { providerData } = require('../data/providerData');
const { TEST_IDS } = require('../data/testIds');
const FreeTextAnimalIdentificationPage = require('./FreeTextAnimalIdentificationPage');

class AnimalIdentificationPage {
  /**
   * Type into a field by testID. Waits after category Save — identification
   * fields mount on the next React render, so a single snapshot is too early.
   * @param {string} id
   * @param {string} value
   */
  async fillByTestId(id, value) {
    await browser.waitUntil(
      async () => Boolean(await ui.firstByTestId(id)),
      {
        timeout: 8000,
        interval: 200,
        timeoutMsg: `testID "${id}" not found — rebuild/reinstall the Vet Pal app`,
      },
    );
    ui.log('Animal Identification', `Fill ${id}`);
    await ui.typeByTestId(id, value);
  }

  /**
   * True when Group fields are in the tree.
   * @returns {Promise<boolean>}
   */
  async #isGroupReady() {
    return Boolean(
      await ui.firstByTestId(TEST_IDS.animalId.field('group', 'groupName', 0)),
    );
  }

  /**
   * True when Microchip/ID fields are in the tree (horse Name or Tag/ID).
   * @returns {Promise<boolean>}
   */
  async #isTagsReady() {
    return Boolean(
      (await ui.firstByTestId(
        TEST_IDS.animalId.field('tags', 'tagNumber', 0),
      )) ||
        (await ui.firstByTestId(
          TEST_IDS.animalId.field('tags', 'animalName', 0),
        )),
    );
  }

  /**
   * Tap Microchip/ID or Group. testID first; caption if the app is older.
   * @param {'group'|'tags'} mode
   */
  async selectIdentificationMode(mode) {
    const wantedGroup = mode === 'group';
    if (wantedGroup ? await this.#isGroupReady() : await this.#isTagsReady()) {
      ui.log('Animal Identification', `Already on ${mode}`);
      return;
    }

    ui.log('Animal Identification', `Switch segment → ${mode}`);
    await ui.dismissKeyboardUntilGone(2);

    const id = wantedGroup
      ? TEST_IDS.animalId.modeGroup
      : TEST_IDS.animalId.modeTags;
    const tappedId = await ui.tapTestId(id);
    if (!tappedId) {
      const label = wantedGroup ? 'Group' : 'Microchip/ID';
      const el =
        (await ui.firstCaption(label)) ||
        (await ui.firstCaptionContains(label));
      if (!el) {
        throw new Error(
          `Identification segment "${label}" not found — rebuild/reinstall the Vet Pal app`,
        );
      }
      ui.log('Animal Identification', `Tap caption ${label}`);
      await el.click().catch(() => ui.press(el));
    }

    await browser.waitUntil(
      async () =>
        wantedGroup ? this.#isGroupReady() : this.#isTagsReady(),
      {
        timeout: 8000,
        interval: 200,
        timeoutMsg: `Did not switch to ${mode} identification`,
      },
    );
  }

  /**
   * Horse Tag/ID cards: Name N + Tag/ID N.
   * @param {{ names?: string[], tags?: string[] }} data
   */
  async fillHorseTags(data) {
    const names = data.names || [];
    const tags = data.tags || [];
    const count = Math.min(3, Math.max(names.length, tags.length));
    for (let i = 0; i < count; i += 1) {
      if (names[i]) {
        await this.fillByTestId(
          TEST_IDS.animalId.field('tags', 'animalName', i),
          names[i],
        );
      }
      if (tags[i]) {
        await this.fillByTestId(
          TEST_IDS.animalId.field('tags', 'tagNumber', i),
          tags[i],
        );
      }
    }
    ui.log('Animal Identification', `Filled ${count} horse name/tag entries`);
  }

  /**
   * Livestock Tag/ID slots: Tag/ID N only.
   * @param {{ tags?: string[] }} data
   */
  async fillLivestockTags(data) {
    const tags = data.tags || [];
    const count = Math.min(3, tags.length);
    for (let i = 0; i < count; i += 1) {
      await this.fillByTestId(
        TEST_IDS.animalId.field('tags', 'tagNumber', i),
        tags[i],
      );
    }
    ui.log('Animal Identification', `Filled ${count} livestock Tag/ID slots`);
  }

  /**
   * Poultry Microchip/ID: Tag/ID N + Age N (unit defaults to Days).
   * @param {{ tags?: string[], ages?: string[] }} data
   */
  async fillPoultryTags(data) {
    const tags = data.tags || [];
    const ages = data.ages || [];
    const count = Math.min(3, Math.max(tags.length, ages.length));
    for (let i = 0; i < count; i += 1) {
      if (tags[i]) {
        await this.fillByTestId(
          TEST_IDS.animalId.field('tags', 'tagNumber', i),
          tags[i],
        );
      }
      if (ages[i]) {
        await this.fillByTestId(
          TEST_IDS.animalId.field('tags', 'age', i),
          ages[i],
        );
      }
    }
    ui.log('Animal Identification', `Filled ${count} poultry tag/age entries`);
  }

  /**
   * Group name + animal count (+ poultry average age).
   * NO. OF ANIMALS uses a number-pad (no Return) — dismiss Done before
   * leaving this block, or Submit Request stays under the keypad.
   * @param {{ groupName: string, numberOfAnimals: string, averageAge?: string }} data
   * @param {{ poultry?: boolean }} [opts]
   */
  async fillGroup(data, { poultry } = {}) {
    await this.fillByTestId(
      TEST_IDS.animalId.field('group', 'groupName', 0),
      data.groupName,
    );
    await this.fillByTestId(
      TEST_IDS.animalId.field('group', 'number', 0),
      data.numberOfAnimals,
    );
    ui.log('Animal Identification', 'Dismiss number pad after NO. OF ANIMALS');
    await ui.dismissNumberPad();
    if (poultry) {
      await this.fillByTestId(
        TEST_IDS.animalId.field('group', 'age', 0),
        data.averageAge || '12',
      );
      await ui.dismissNumberPad();
    }
  }

  /**
   * Switch to Group or Microchip/ID (CLI `--mode`) then fill that mode.
   * Unchanged from before the Free Text UI existed — this is the OLD
   * Animal Identification automation (`SHOW_CURRENT_ANIMAL_IDENTIFICATION
   * === true`). Kept private; `fillAnimalIdentification` below decides
   * whether to call this or the Free Text flow.
   * @param {string} categoryKey
   * @param {object} [override]
   */
  async #fillExistingAnimalIdentification(categoryKey, override) {
    const cat = categoryByKey(categoryKey);
    const mode =
      (override && override.mode) ||
      providerData.identificationMode ||
      cat.defaultMode;
    const data = override || identificationFor(cat.key, mode);
    ui.log(
      'Animal Identification',
      `Fill ${cat.key} (${cat.layout}, ${data.mode}) by testID`,
    );

    await this.selectIdentificationMode(data.mode);

    if (data.mode === 'group') {
      await this.fillGroup(data, { poultry: cat.layout === 'poultry' });
    } else if (cat.layout === 'horse' && data.mode === 'tags') {
      await this.fillHorseTags(data);
    } else if (cat.layout === 'poultry' && data.mode === 'tags') {
      await this.fillPoultryTags(data);
    } else if (data.mode === 'tags') {
      await this.fillLivestockTags(data);
    } else {
      throw new Error(
        `No identification strategy for ${cat.key} layout=${cat.layout} mode=${data.mode}`,
      );
    }
    await ui.dismissKeyboardUntilGone();
    return data;
  }

  /**
   * Readable identification string for the OLD UI's fill payload, for the
   * result log (Category | Type | Mode | Identification | Age | Age Unit).
   * @param {object} cat
   * @param {object} data
   */
  #summarizeExisting(cat, data) {
    if (data.mode === 'group') {
      return {
        mode: 'Existing Identification',
        identification: `${data.groupName} (x${data.numberOfAnimals})`,
        age: cat.layout === 'poultry' ? data.averageAge || '12' : 'N/A',
        ageUnit: cat.layout === 'poultry' ? data.ageUnit || 'Days' : 'N/A',
      };
    }
    return {
      mode: 'Existing Identification',
      identification: (data.tags || []).filter(Boolean).join(', '),
      age: 'N/A',
      ageUnit: 'N/A',
    };
  }

  /**
   * True when the OLD Tags/Group UI is in the tree: mode-toggle testIDs,
   * the Group/Microchip field sets, or (older builds) their captions.
   * @returns {Promise<boolean>}
   */
  async #isExistingUiVisible() {
    if (
      await ui.anyTestIdExists([
        TEST_IDS.animalId.modeGroup,
        TEST_IDS.animalId.modeTags,
      ])
    ) {
      return true;
    }
    if ((await this.#isGroupReady()) || (await this.#isTagsReady())) {
      return true;
    }
    return Boolean(
      (await ui.firstCaption('Group')) || (await ui.firstCaption('Microchip/ID')),
    );
  }

  /**
   * Poll both UIs — fields mount async after category Save (see
   * `fillByTestId`'s comment), so a single snapshot is too early for either.
   * Old UI wins a simultaneous match since it is the established behaviour.
   * @returns {Promise<'existing'|'freeText'|'none'>}
   */
  async #detectIdentificationUiMode() {
    const timeout = 8000;
    const interval = 200;
    const start = Date.now();
    do {
      if (await this.#isExistingUiVisible()) {
        return 'existing';
      }
      if (await FreeTextAnimalIdentificationPage.isVisible()) {
        return 'freeText';
      }
      await browser.pause(interval);
    } while (Date.now() - start < timeout);
    return 'none';
  }

  /**
   * Public so a standalone test (e.g. the Free Text character-limit test)
   * can check which UI is live before deciding whether to run.
   * @returns {Promise<'existing'|'freeText'|'none'>}
   */
  async detectIdentificationUiMode() {
    return this.#detectIdentificationUiMode();
  }

  async #fillFreeTextAnimalIdentification(cat, data) {
    ui.log(
      'Animal Identification',
      `Fill ${cat.key} via Free Text UI: "${data.text}"`,
    );
    await FreeTextAnimalIdentificationPage.enterIdentification(data.text);
    if (cat.layout === 'poultry') {
      await FreeTextAnimalIdentificationPage.enterAge(data.age || '12');
      await FreeTextAnimalIdentificationPage.selectAgeUnit(data.ageUnit || 'Years');
    }
    return {
      mode: 'Free Text',
      identification: data.text,
      age: cat.layout === 'poultry' ? data.age || '12' : 'N/A',
      ageUnit: cat.layout === 'poultry' ? data.ageUnit || 'Years' : 'N/A',
    };
  }

  /**
   * Single entry point used by `RequestTreatmentFlow` for both Vet Practice
   * and Nearby Remedy Store. Detects which Animal Identification UI the app
   * is showing and dispatches — never reads `SHOW_CURRENT_ANIMAL_IDENTIFICATION`
   * directly, since the app is not modified for this suite and the flag is
   * not exposed to Appium.
   *
   * `existing UI visible` → old Tags/Group automation (unchanged).
   * `Free Text UI visible` → new single-field automation (+ Age/Age Unit
   * for Poultry only).
   *
   * @param {string} categoryKey
   * @param {object} [override] Old-UI override, forwarded as-is (unchanged
   * contract). Does not apply to the Free Text path — pass
   * `{ freeText: { text, age, ageUnit } }` for that instead.
   * @returns {Promise<{ mode: string, identification: string, age: string, ageUnit: string }>}
   */
  async fillAnimalIdentification(categoryKey, override) {
    const cat = categoryByKey(categoryKey);
    try {
      const uiMode = await this.#detectIdentificationUiMode();

      if (uiMode === 'existing') {
        const data = await this.#fillExistingAnimalIdentification(cat.key, override);
        return this.#summarizeExisting(cat, data);
      }

      if (uiMode === 'freeText') {
        const data =
          (override && override.freeText) || freeTextIdentificationFor(cat.key);
        return this.#fillFreeTextAnimalIdentification(cat, data);
      }

      throw new Error(
        'Neither the existing Tags/Group UI nor the Free Text UI was detected on the Animal Identification screen',
      );
    } catch (err) {
      await ui.screenshot(`animal-identification-failed-${cat.key}`).catch(() => {});
      const message = `Animal Identification failed.\nCategory: ${cat.pickerContains}\nType: ${cat.key}\n${err.message}`;
      ui.log('Animal Identification', message.replace(/\n/g, ' | '));
      throw new Error(message);
    }
  }
}

module.exports = new AnimalIdentificationPage();

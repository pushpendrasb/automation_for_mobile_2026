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
} = require('../data/animalCategories');
const { providerData } = require('../data/providerData');
const { TEST_IDS } = require('../data/testIds');

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
   * @param {string} categoryKey
   * @param {object} [override]
   */
  async fillAnimalIdentification(categoryKey, override) {
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
  }
}

module.exports = new AnimalIdentificationPage();

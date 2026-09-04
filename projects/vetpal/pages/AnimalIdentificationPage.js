/**
 * Inline Animal Identification on New Request step 2.
 * Fills `animalId.${mode}.${key}.${index}` — no placeholders, no swipe.
 *
 * Default mode follows `getDefaultIdentificationMode` in the app:
 * Horse / Pig / Poultry → Group; Cattle / Sheep / Goat / Deer → Microchip/ID.
 */
const { ui } = require('./ui');
const { categoryByKey } = require('../data/animalCategories');
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
   * Fill the mode the category actually opens in (Group vs Microchip/ID).
   * Horse tags (Name N + Microchip/ID N) only apply if `data.mode === 'tags'`.
   * @param {string} categoryKey
   * @param {object} [override]
   */
  async fillAnimalIdentification(categoryKey, override) {
    const cat = categoryByKey(categoryKey);
    const data = override || cat.identification;
    ui.log(
      'Animal Identification',
      `Fill ${cat.key} (${cat.layout}, ${data.mode}) by testID`,
    );

    if (data.mode === 'group') {
      await this.fillGroup(data, { poultry: cat.layout === 'poultry' });
    } else if (cat.layout === 'horse' && data.mode === 'tags') {
      await this.fillHorseTags(data);
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

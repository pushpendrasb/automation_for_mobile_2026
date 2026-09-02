/**
 * Inline Animal Identification on New Request step 2.
 * Fills `animalId.${mode}.${key}.${index}` — no placeholders, no swipe.
 */
const { ui } = require('./ui');
const { categoryByKey } = require('../data/animalCategories');
const { TEST_IDS } = require('../data/testIds');

class AnimalIdentificationPage {
  /**
   * Type into a field by testID.
   * @param {string} id
   * @param {string} value
   */
  async fillByTestId(id, value) {
    const el = await ui.firstByTestId(id);
    if (!el) {
      throw new Error(
        `testID "${id}" not found — rebuild/reinstall the Vet Pal app`,
      );
    }
    ui.log('Animal Identification', `Fill ${id}`);
    try {
      await el.setValue(String(value));
    } catch {
      await ui.typeInto(el, value);
    }
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
    if (poultry) {
      await this.fillByTestId(
        TEST_IDS.animalId.field('group', 'age', 0),
        data.averageAge || '12',
      );
    }
  }

  /**
   * Horse already opens in Tag/ID with Name/Tag cards visible — no mode tap.
   * Pig/Poultry already open in Group.
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

    if (cat.layout === 'horse' && data.mode === 'tags') {
      await this.fillHorseTags(data);
    } else if (cat.layout === 'poultry' && data.mode === 'group') {
      await this.fillGroup(data, { poultry: true });
    } else if (cat.layout === 'livestock' && data.mode === 'group') {
      await this.fillGroup(data, { poultry: false });
    } else if (cat.layout === 'livestock' && data.mode === 'tags') {
      await this.fillLivestockTags(data);
    } else if (cat.layout === 'poultry' && data.mode === 'tags') {
      await this.fillLivestockTags(data);
    } else {
      throw new Error(
        `No identification strategy for ${cat.key} layout=${cat.layout} mode=${data.mode}`,
      );
    }
    await ui.dismissKeyboard();
  }
}

module.exports = new AnimalIdentificationPage();

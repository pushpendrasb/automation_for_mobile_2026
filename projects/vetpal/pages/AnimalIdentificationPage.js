/**
 * Inline Animal Identification on New Request step 2.
 * Source: AnimalIdentificationExpandable.js
 *
 * Horse Tag/ID (default): four cards on screen — Name N + Tag/ID N.
 * Do not swipe looking for StaticText "Name 1" — that placeholder is only
 * on the TextInput. swipeUp scrolls the cards off-screen, then isDisplayed
 * is false and the wait fails.
 */
const { ui } = require('./ui');
const { categoryByKey } = require('../data/animalCategories');

class AnimalIdentificationPage {
  /**
   * Type into a TextInput by placeholder. No scroll, no isDisplayed wait.
   * @param {string} placeholder
   * @param {string} value
   */
  async fillByPlaceholder(placeholder, value) {
    const el = await this.#field(placeholder);
    if (!el) {
      throw new Error(`Field "${placeholder}" not found`);
    }
    ui.log('Animal Identification', `Fill "${placeholder}"`);
    try {
      await el.setValue(String(value));
    } catch {
      await ui.typeInto(el, value);
    }
  }

  /**
   * @param {string} placeholder
   */
  async #field(placeholder) {
    const e = ui.escape(placeholder);
    const selector = ui.isAndroid()
      ? `android=new UiSelector().className("android.widget.EditText").textContains("${e}")`
      : `-ios predicate string:placeholderValue CONTAINS "${e}" OR value CONTAINS "${e}"`;
    const els = await $$(selector);
    return els[0] || null;
  }

  async fillHorseTags(data) {
    const names = data.names || [];
    const tags = data.tags || [];
    const count = Math.min(3, Math.max(names.length, tags.length));
    for (let i = 0; i < count; i += 1) {
      if (names[i]) {
        await this.fillByPlaceholder(`Name ${i + 1}`, names[i]);
      }
      if (tags[i]) {
        await this.fillByPlaceholder(`Tag/ID ${i + 1}`, tags[i]);
      }
    }
    ui.log('Animal Identification', `Filled ${count} horse name/tag entries`);
  }

  async fillLivestockTags(data) {
    const tags = data.tags || [];
    const count = Math.min(3, tags.length);
    for (let i = 0; i < count; i += 1) {
      await this.fillByPlaceholder(`Tag/ID ${i + 1}`, tags[i]);
    }
    ui.log('Animal Identification', `Filled ${count} livestock Tag/ID slots`);
  }

  async fillGroup(data, { poultry } = {}) {
    await this.fillByPlaceholder('Group name', data.groupName);
    await this.fillByPlaceholder('Min 5', data.numberOfAnimals);
    if (poultry) {
      await this.fillByPlaceholder('Avg age', data.averageAge || '12');
    }
  }

  /**
   * Horse already opens in Tag/ID with Name/Tag cards visible — no mode tap,
   * no scroll. Pig/Poultry already open in Group.
   * @param {string} categoryKey
   * @param {object} [override]
   */
  async fillAnimalIdentification(categoryKey, override) {
    const cat = categoryByKey(categoryKey);
    const data = override || cat.identification;
    ui.log(
      'Animal Identification',
      `Fill ${cat.key} (${cat.layout}, ${data.mode}) — no swipe`,
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
    await browser.pause(200);
    try {
      if (await browser.isKeyboardShown()) {
        await ui.dismissKeyboard();
      }
    } catch {
      // ignore
    }
  }
}

module.exports = new AnimalIdentificationPage();

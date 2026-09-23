/**
 * New simplified Free Text Animal Identification UI — shown instead of the
 * Tags/Group cards (`AnimalIdentificationPage.js`) when the app's
 * `SHOW_CURRENT_ANIMAL_IDENTIFICATION` feature flag is false.
 *
 * We never read the flag from automation — we detect whichever UI is on
 * screen (see `AnimalIdentificationPage#detectIdentificationUiMode`).
 *
 * Verified against vetpal-animal-owner source (not guessed):
 * - src/Screens/Components/AnimalIdentificationSimple.js — free-text
 *   TextInput, Age TextInput and the Age Unit TouchableOpacity all render
 *   with NO testID/accessibilityLabel. Placeholders are exact-matched below.
 * - src/Screens/HomePage/NewPrescription.js:1433 /
 *   NewPrescriptionForRemedyStore.js:1451 — section label is exactly
 *   "Enter Animal ID (Tag No. / Microchip No.), Group Description and
 *   Quantity of Animals" when the flag is false.
 * - src/Screens/CustomPopup/simpleAnimalIdentificationUtils.js — Horse caps
 *   at 128 chars, everything else (including Poultry) at 256.
 * - Age Unit reuses the app's generic `CatPopup` (same component as Vet
 *   Practice / Branch / Animal Category), title "Age Unit", options from
 *   `AGE_UNIT_OPTIONS` in animalIdentificationUtils.js — see `selectAgeUnit`.
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');
const { AGE_UNIT_OPTIONS } = require('../data/animalCategories');

/** Exact RN placeholder (AnimalIdentificationSimple.js) — Horse + every other category. */
const PLACEHOLDER_HINT = 'Thoroughbred mare';
/** Exact section label (NewPrescription.js:1433) when the flag is false. */
const FIELD_LABEL_HINT =
  'Enter Animal ID (Tag No. / Microchip No.), Group Description and Quantity of Animals';
/** Exact placeholder on the Poultry Age field. */
const AGE_PLACEHOLDER_HINT = 'Avg age';
/** Exact caption above the Poultry Age Unit control. */
const AGE_UNIT_CAPTION = 'AGE UNIT';

class FreeTextAnimalIdentificationPage {
  /**
   * True when a "N/128" or "N/256" character counter is visible — the
   * steadiest signal for this UI since the old Tags/Group cards have no
   * counter at all.
   * @returns {Promise<boolean>}
   */
  async #hasCharCounter() {
    return Boolean(
      (await ui.firstCaptionContains('/128')) ||
        (await ui.firstCaptionContains('/256')),
    );
  }

  async #hasFieldLabel() {
    return Boolean(await ui.firstCaptionContains(FIELD_LABEL_HINT));
  }

  /**
   * True when the new UI is in the tree. Checked opportunistically against
   * the old UI in `AnimalIdentificationPage#detectIdentificationUiMode` —
   * order there decides ties, this only answers for itself.
   * @returns {Promise<boolean>}
   */
  async isVisible() {
    if (await ui.firstByTestId(TEST_IDS.animalId.freeText)) {
      return true;
    }
    if (await this.#hasCharCounter()) {
      return true;
    }
    if (await this.#hasFieldLabel()) {
      return true;
    }
    return Boolean(await this.#findFreeTextField());
  }

  /**
   * Locate the free-text TextInput: testID, then the long placeholder.
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #findFreeTextField() {
    const byId = await ui.firstByTestId(TEST_IDS.animalId.freeText);
    if (byId) {
      return byId;
    }
    const byPlaceholder = await ui.byPlaceholderContains(PLACEHOLDER_HINT);
    if (byPlaceholder && (await ui.isShown(byPlaceholder))) {
      return byPlaceholder;
    }
    return null;
  }

  async #requireFreeTextField() {
    const field = await this.#findFreeTextField();
    if (!field) {
      throw new Error(
        'Free Text Animal Identification field not found (no testID, no placeholder match) — add animalId.freeText or confirm the placeholder text',
      );
    }
    return field;
  }

  /**
   * Tap, clear, and set the field directly (no char-by-char typing — the
   * character-limit test needs 128–300 chars without slowing the suite).
   * @param {string} value
   */
  async enterIdentification(value) {
    const field = await this.#requireFreeTextField();
    ui.log('Animal Identification (Free Text)', `Fill "${value.slice(0, 40)}${value.length > 40 ? '…' : ''}"`);
    await ui.tap(field);
    await browser.pause(80);
    try {
      await field.clearValue();
    } catch {
      // some RN fields reject clearValue
    }
    try {
      await field.setValue(String(value));
    } catch {
      await ui.typeInto(field, value);
    }
    await ui.dismissKeyboardUntilGone(2);
  }

  /**
   * @returns {Promise<string>} current field value, for verifying fill / char-limit tests
   */
  async readIdentification() {
    const field = await this.#requireFreeTextField();
    return String(
      (await field.getText().catch(() => '')) ||
        (await field.getAttribute('value').catch(() => '')) ||
        '',
    );
  }

  /**
   * Horse: 128. Everything else, including Poultry: 256 (screenshots).
   * @param {string} categoryKey
   * @returns {number}
   */
  charLimitFor(categoryKey) {
    return String(categoryKey).toLowerCase() === 'horse' ? 128 : 256;
  }

  /**
   * Type more than the allowed limit and verify the field did not retain it.
   * @param {string} categoryKey
   * @returns {Promise<number>} the retained length, for the caller to log
   */
  async assertCharacterLimitEnforced(categoryKey) {
    const limit = this.charLimitFor(categoryKey);
    const overLimitValue = 'A'.repeat(limit + 40);
    await this.enterIdentification(overLimitValue);
    const actual = await this.readIdentification();
    ui.log(
      'Animal Identification (Free Text)',
      `Typed ${overLimitValue.length} chars, field retained ${actual.length} (limit ${limit})`,
    );
    if (actual.length > limit) {
      throw new Error(
        `Free Text field accepted ${actual.length} characters for "${categoryKey}" — expected the UI to cap input at ${limit}`,
      );
    }
    return actual.length;
  }

  /**
   * True only for Poultry — Age + Age Unit sit below the free-text field.
   * @returns {Promise<boolean>}
   */
  async hasAgeFields() {
    if (await ui.firstByTestId(TEST_IDS.animalId.age)) {
      return true;
    }
    if (await ui.firstByTestId(TEST_IDS.animalId.ageUnitField)) {
      return true;
    }
    return Boolean(await ui.firstCaptionContains(AGE_UNIT_CAPTION));
  }

  async #findAgeField() {
    const byId = await ui.firstByTestId(TEST_IDS.animalId.age);
    if (byId) {
      return byId;
    }
    const byPlaceholder = await ui.byPlaceholderContains(AGE_PLACEHOLDER_HINT);
    if (byPlaceholder && (await ui.isShown(byPlaceholder))) {
      return byPlaceholder;
    }
    return null;
  }

  /**
   * @param {string} value
   */
  async enterAge(value) {
    const field = await this.#findAgeField();
    if (!field) {
      throw new Error(
        'Poultry Age field not found (animalId.age / "Avg age" placeholder)',
      );
    }
    ui.log('Animal Identification (Free Text)', `Age = ${value}`);
    await ui.tap(field);
    await browser.pause(80);
    try {
      await field.clearValue();
    } catch {
      // ignore
    }
    try {
      await field.setValue(String(value));
    } catch {
      await ui.typeInto(field, value);
    }
    await ui.dismissNumberPad().catch(() => ui.dismissKeyboardUntilGone(2));
  }

  /**
   * "AGE UNIT" caption sits above a "Select" control
   * (`AnimalIdentificationSimple.js` — `ageUnitBtn`, no testID). The button's
   * own text is exactly "Select" until a unit is chosen (`ageUnit || 'Select'`).
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #findAgeUnitTrigger() {
    const byId = await ui.firstByTestId(TEST_IDS.animalId.ageUnitField);
    if (byId) {
      return byId;
    }
    return (await ui.firstCaption('Select')) || (await ui.firstCaptionContains('Select'));
  }

  /**
   * Tap the "Select" trigger, then pick `unit` from the app's shared
   * CatPopup (`AnimalIdentificationSimple.js` opens it with
   * `arrList={AGE_UNIT_OPTIONS}`, `title={'Age Unit'}` — the same component
   * used for Vet Practice / Branch / Animal Category). Selecting by the
   * option's fixed index in `AGE_UNIT_OPTIONS` (`catPopup.row(index)` +
   * `catPopup.save`) avoids matching on row label text entirely.
   * @param {string} unit e.g. "Years"
   */
  async selectAgeUnit(unit) {
    ui.log('Animal Identification (Free Text)', `Age Unit → ${unit}`);
    const index = AGE_UNIT_OPTIONS.findIndex(
      option => option.toLowerCase() === String(unit).trim().toLowerCase(),
    );
    if (index === -1) {
      throw new Error(
        `Unknown Age Unit "${unit}" — expected one of: ${AGE_UNIT_OPTIONS.join(', ')}`,
      );
    }

    const trigger = await this.#findAgeUnitTrigger();
    if (trigger) {
      await ui.tap(trigger);
    } else if (!(await ui.tapTestId(TEST_IDS.animalId.ageUnitField))) {
      throw new Error('Age Unit control ("AGE UNIT" / "Select") not found');
    }

    const opened = await ui.waitTrue(
      () => ui.firstByTestId(TEST_IDS.catPopup.save),
      4000,
      150,
    );
    if (!opened) {
      throw new Error(
        'Age Unit popup (CatPopup) did not open after tapping the "Select" trigger',
      );
    }

    await ui.requireTapTestId(TEST_IDS.catPopup.row(index));
    await ui.requireTapTestId(TEST_IDS.catPopup.save);
  }
}

module.exports = new FreeTextAnimalIdentificationPage();

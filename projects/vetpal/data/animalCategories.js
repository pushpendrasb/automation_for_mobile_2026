/**
 * Animal Identification Matrix — from Vet-Pal Animal Owner source, not invented.
 *
 * Sources:
 * - src/Screens/CustomPopup/animalIdentificationUtils.js
 *   CATEGORY.HORSE | LIVESTOCK | POULTRY, TAG_SLOT_COUNT=4, MIN_GROUP_ANIMAL_COUNT=5
 * - src/Screens/Components/AnimalIdentificationExpandable.js
 *   Horse tags: Name N + Tag/ID N
 *   Livestock tags: Tag/ID 1–4
 *   Poultry tags: Tag/ID + Age + Age unit
 *   Group (all): Group name + No. of animals (min 5)
 *   Poultry group extra: Average age + Age unit
 * - Defaults (`defaultsToGroupIdentification`): Pig, Poultry, and Horse/equine
 *   open in Group; Cattle/Sheep/Goat/Deer open in Microchip/ID (tags)
 *
 * Picker labels are API-built (`Horses - Horses`, `Pigs - Piglets`,
 * `Poultry - Layers`, …). Tests match the category token on the left of
 * " - " (`pickerContains`). Do not rely on `pickerRowIndex` for Poultry —
 * extra Pig/Cattle subtypes push it below the fold and steal that index.
 */

const { providerData } = require('./providerData');

const TAG_SLOT_COUNT = 4;
const MIN_GROUP_ANIMALS = 5;

/**
 * Verbatim copy of `AGE_UNIT_OPTIONS` in
 * vetpal-animal-owner/src/Screens/CustomPopup/animalIdentificationUtils.js.
 * Order is the CatPopup row index — Age Unit (old and new UI alike) is the
 * app's shared CatPopup component, so `catPopup.row(AGE_UNIT_OPTIONS.indexOf(unit))`
 * + `catPopup.save` selects a unit with no label-text matching needed.
 */
const AGE_UNIT_OPTIONS = [
  'Years',
  'Months',
  'Days',
  'Weeks',
  'Eggs',
  'Larvae',
  'Juvenile',
  'Parr/Fingerling',
  'Smolts',
  'Other',
];

/**
 * Ordered Request Treatment categories (prompt §4 / §12).
 * @type {Array<Record<string, unknown>>}
 */
const animalCategories = [
  {
    key: 'Horse',
    pickerContains: 'Horses',
    pickerRowIndex: 0,
    layout: 'horse',
    defaultMode: 'group',
    identification: {
      mode: 'group',
      groupName: 'HORSE-AUTO-GROUP',
      numberOfAnimals: String(MIN_GROUP_ANIMALS),
    },
    fields: {
      screen: 'New Request → Animal Details (inline AnimalIdentificationExpandable)',
      tagFields: [
        'Name 1–4 (required if Microchip/ID)',
        'Microchip/ID 1–4 (optional, no special chars)',
      ],
      groupFields: ['GROUP NAME', 'NO. OF ANIMALS (min 5)'],
      defaultMode: 'Group',
      multiple: 'Group has Add More; Microchip/ID has 4 name/tag slots',
      requiredTag: 'Group name + count ≥ 5',
    },
  },
  {
    key: 'Cattle',
    pickerContains: 'Cattle',
    pickerRowIndex: 1,
    layout: 'livestock',
    defaultMode: 'tags',
    identification: {
      mode: 'tags',
      tags: ['CATTLE-001', 'CATTLE-002', 'CATTLE-003'],
    },
    fields: {
      screen: 'New Request → Animal Details',
      tagFields: ['Tag/ID 1–4 (tag required)'],
      groupFields: ['GROUP NAME', 'NO. OF ANIMALS (min 5)'],
      defaultMode: 'Tag/ID',
      multiple: '4 tag slots; Group Add More',
      requiredTag: 'Tag number is required',
    },
  },
  {
    key: 'Sheep',
    pickerContains: 'Sheep',
    pickerRowIndex: 3,
    layout: 'livestock',
    defaultMode: 'tags',
    identification: {
      mode: 'tags',
      tags: ['SHEEP-001', 'SHEEP-002', 'SHEEP-003'],
    },
    fields: {
      screen: 'New Request → Animal Details',
      tagFields: ['Tag/ID 1–4 (tag required)'],
      groupFields: ['GROUP NAME', 'NO. OF ANIMALS (min 5)'],
      defaultMode: 'Tag/ID',
      multiple: '4 tag slots; Group Add More',
      requiredTag: 'Tag number is required',
    },
  },
  {
    key: 'Goat',
    pickerContains: 'Goat',
    pickerRowIndex: 4,
    layout: 'livestock',
    defaultMode: 'tags',
    identification: {
      mode: 'tags',
      tags: ['GOAT-001', 'GOAT-002', 'GOAT-003'],
    },
    fields: {
      screen: 'New Request → Animal Details',
      tagFields: ['Tag/ID 1–4 (tag required)'],
      groupFields: ['GROUP NAME', 'NO. OF ANIMALS (min 5)'],
      defaultMode: 'Tag/ID',
      multiple: '4 tag slots; Group Add More',
      requiredTag: 'Tag number is required',
    },
  },
  {
    key: 'Deer',
    pickerContains: 'Deer',
    pickerRowIndex: 5,
    layout: 'livestock',
    defaultMode: 'tags',
    identification: {
      mode: 'tags',
      tags: ['DEER-001', 'DEER-002', 'DEER-003'],
    },
    fields: {
      screen: 'New Request → Animal Details',
      tagFields: ['Tag/ID 1–4 (tag required)'],
      groupFields: ['GROUP NAME', 'NO. OF ANIMALS (min 5)'],
      defaultMode: 'Tag/ID',
      multiple: '4 tag slots; Group Add More',
      requiredTag: 'Tag number is required',
    },
  },
  {
    key: 'Pig',
    pickerContains: 'Pig',
    pickerRowIndex: 6,
    layout: 'livestock',
    defaultMode: 'group',
    identification: {
      mode: 'group',
      groupName: 'PIG-AUTO-GROUP',
      numberOfAnimals: String(MIN_GROUP_ANIMALS),
    },
    fields: {
      screen: 'New Request → Animal Details',
      tagFields: ['Tag/ID 1–4 if user switches to Tag/ID'],
      groupFields: ['GROUP NAME (required)', 'NO. OF ANIMALS (min 5)'],
      defaultMode: 'Group',
      multiple: 'Add More extra groups',
      requiredTag: 'Group name + count ≥ 5',
    },
  },
  {
    key: 'Poultry',
    pickerContains: 'Poultry',
    /**
     * 0-based `catPopup.row` index. Poultry subtypes are options 12–15 in the
     * popup (rows 11–14, starting with "Poultry - Chicken - Broiler"); row 13
     * is option 14. Below the fold, so the picker scrolls inside the popup first.
     */
    pickerRowIndex: 13,
    scrollToRow: true,
    layout: 'poultry',
    defaultMode: 'group',
    identification: {
      mode: 'group',
      groupName: 'POULTRY-AUTO-GROUP',
      numberOfAnimals: String(MIN_GROUP_ANIMALS),
      averageAge: '12',
      ageUnit: 'Days',
    },
    fields: {
      screen: 'New Request → Animal Details',
      tagFields: ['Tag/ID + Age + Age unit if Tag/ID mode'],
      groupFields: [
        'GROUP NAME',
        'NO. OF ANIMALS (min 5)',
        'AVERAGE AGE (required, > 0)',
        'AGE UNIT (required)',
      ],
      defaultMode: 'Group',
      multiple: 'Add More extra groups',
      requiredTag: 'Group name, count ≥ 5, average age, age unit',
    },
  },
];

const requestTreatmentData = {
  get provider() {
    return {
      vetPractice: providerData.vetPractice,
      remedyStore: providerData.remedyStore,
    };
  },
  get treatment() {
    return { request: providerData.treatmentRequest };
  },
  animals: animalCategories,
  tagSlotCount: TAG_SLOT_COUNT,
  minGroupAnimals: MIN_GROUP_ANIMALS,
  toasts: {
    selectVet: 'Please select a vet practice',
    selectRemedyStore: 'Please select Remedy Store',
    selectNearbyStore: 'Please select a Remedy Store',
    selectBranch: 'Please select Branch',
    selectCategory: 'Please select animal category / type',
    completeIdentification:
      'Please complete animal identification before submitting your request',
    enterTreatment: 'Please enter history or symptoms of animal',
    requestSent: 'Your request for advice has been sent',
  },
  labels: {
    requestTreatment: 'Request Treatment',
    requestVetAdvice: 'Request Vet Advice/Treatment',
    chooseProvider: 'Choose a Provider',
    vetPractice: 'Vet Practice',
    nearbyRemedyStore: 'Nearby Remedy Store',
    newRequest: 'New Request',
    next: 'Next',
    submitRequest: 'Submit Request',
    submitRequestNow: 'Submit Request Now',
    animalCategory: 'Animal Category/ Type',
    animalIdentification: 'Animal Identification',
    treatmentSection: 'Treatment/Product Request',
    tagMode: 'Tag/ID',
    groupMode: 'Group',
    addMore: 'Add More',
    branch: 'Branch',
    dispenseStore: 'Remedy Store to Dispense',
    step3: 'Step 3',
  },
};

function categoryByKey(key) {
  const found = animalCategories.find(
    c => c.key.toLowerCase() === String(key).toLowerCase(),
  );
  if (!found) {
    throw new Error(`Unknown animal category: ${key}`);
  }
  return found;
}

/**
 * CLI / env identification mode. Empty → category default.
 * @param {string} [raw]
 * @returns {'group'|'tags'|null}
 */
function normalizeIdentificationMode(raw) {
  const n = String(raw || '')
    .trim()
    .toLowerCase();
  if (!n) {
    return null;
  }
  if (n === 'group' || n === 'g') {
    return 'group';
  }
  if (
    n === 'tags' ||
    n === 'tag' ||
    n === 'microchip' ||
    n === 'microchip/id' ||
    n === 'id'
  ) {
    return 'tags';
  }
  throw new Error(
    `Unknown identification mode "${raw}". Use --mode=group or --mode=tags`,
  );
}

/**
 * Fill payload for Group or Microchip/ID. CLI `--mode` / `ANIMAL_ID_MODE`
 * overrides the category default.
 * @param {string} categoryKey
 * @param {string} [modeOverride]
 */
function identificationFor(categoryKey, modeOverride) {
  const cat = categoryByKey(categoryKey);
  const mode =
    normalizeIdentificationMode(modeOverride) || cat.defaultMode;
  const prefix = cat.key.toUpperCase();
  if (mode === 'group') {
    return {
      mode: 'group',
      groupName:
        cat.identification.groupName || `${prefix}-AUTO-GROUP`,
      numberOfAnimals:
        cat.identification.numberOfAnimals || String(MIN_GROUP_ANIMALS),
      averageAge: cat.identification.averageAge || '12',
      ageUnit: cat.identification.ageUnit || 'Days',
    };
  }
  return {
    mode: 'tags',
    names: cat.identification.names || [
      `${prefix}-AUTO-001`,
      `${prefix}-AUTO-002`,
      `${prefix}-AUTO-003`,
    ],
    tags: cat.identification.tags || [
      `${prefix.slice(0, 3)}-001`,
      `${prefix.slice(0, 3)}-002`,
      `${prefix.slice(0, 3)}-003`,
    ],
    ages: ['12', '12', '12'],
  };
}

/**
 * Character limit for the new Free Text Animal Identification field.
 * Horse: 128 (screenshot "0/128"). Everything else, including Poultry: 256
 * (screenshot "0/256"). Source: New Request screenshots, not app source —
 * this UI is not in the codebase excerpt the Identification Matrix above was
 * built from.
 * @param {string} categoryKey
 * @returns {number}
 */
function freeTextCharLimit(categoryKey) {
  const cat = categoryByKey(categoryKey);
  return cat.layout === 'horse' ? 128 : 256;
}

/**
 * Fill payload for the new Free Text Animal Identification UI
 * (`SHOW_CURRENT_ANIMAL_IDENTIFICATION === false`). One text value for every
 * category; Poultry additionally needs Age + Age Unit. Independent of
 * {@link identificationFor}, which stays the Group/Microchip payload for the
 * old UI.
 * @param {string} categoryKey
 * @param {{ text?: string, age?: string, ageUnit?: string }} [override]
 */
function freeTextIdentificationFor(categoryKey, override = {}) {
  const cat = categoryByKey(categoryKey);
  const text = override.text || `${cat.key}-Test-001`;
  if (cat.layout !== 'poultry') {
    return { text };
  }
  return {
    text,
    age: override.age || '12',
    ageUnit: override.ageUnit || 'Years',
  };
}

module.exports = {
  animalCategories,
  requestTreatmentData,
  categoryByKey,
  identificationFor,
  normalizeIdentificationMode,
  freeTextIdentificationFor,
  freeTextCharLimit,
  AGE_UNIT_OPTIONS,
  TAG_SLOT_COUNT,
  MIN_GROUP_ANIMALS,
};

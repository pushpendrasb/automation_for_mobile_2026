/**
 * Configurable provider data for Request Treatment.
 * Source of truth: projects/vetpal/.env — never hard-code in page objects.
 *
 * Names: typed into Remedy Store search, or matched on the Vet Practice list.
 * Indexes: which practice / store / branch row to tap (0 = first).
 */
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

/**
 * Parse a 0-based list index from env.
 * Missing or invalid values fall back to 0 (first row / first card).
 * @param {string} name env key
 * @param {number} [fallback=0]
 * @returns {number}
 */
function envIndex(name, fallback = 0) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') {
    return fallback;
  }
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Practice/store name variants (hyphen spacing differs on screen vs .env).
 * @param {string} name
 * @returns {string[]}
 */
function nameVariants(name) {
  const n = String(name || '').trim();
  if (!n) {
    return [];
  }
  return [
    ...new Set([n, n.replace(/\s*-\s*/g, ' - '), n.replace(/\s*-\s*/g, '-')]),
  ];
}

const providerData = {
  /**
   * Matched in SelectVetPopup when the label is in the iOS tree.
   * On-screen name may be "Dev Test Account - U" while .env has no spaces around "-".
   */
  get vetPractice() {
    return (
      process.env.VET_PRACTICE_NAME || 'Dev Test Account-U'
    ).trim();
  },

  /**
   * SelectVetPopup row when the name is not in the tree. 0 = first practice.
   * @returns {number}
   */
  get vetPracticeIndex() {
    return envIndex('VET_PRACTICE_INDEX', 0);
  },

  /**
   * Typed into RemedyStoreModal / Nearby "Search store name...".
   */
  get remedyStore() {
    return (process.env.REMEDY_STORE_NAME || 'Southwood Pharmacy').trim();
  },

  /**
   * Card to tap after search (or unfiltered list). 0 = first visible card.
   * @returns {number}
   */
  get remedyStoreIndex() {
    return envIndex('REMEDY_STORE_INDEX', 0);
  },

  /**
   * Branch CatPopup row when a store has several branches. 0 = first branch.
   * One branch auto-fills — the popup is skipped after tapping the field.
   * Override with `--branch=1` or `BRANCH_INDEX` in `.env`.
   * @returns {number}
   */
  get branchIndex() {
    return envIndex('BRANCH_INDEX', 0);
  },

  get treatmentRequest() {
    return (
      process.env.TREATMENT_REQUEST || 'demo treatment request'
    ).trim();
  },
};

module.exports = { providerData, nameVariants };

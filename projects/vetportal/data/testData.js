/**
 * Shared test data helpers. Prefer reading from process.env (.env).
 * VetPortal (vet user app) signs in with email + password.
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in projects/vetportal/.env.`,
    );
  }
  return value.trim();
}

const testData = {
  get email() {
    return requireEnv('TEST_USER');
  },
  get password() {
    return requireEnv('TEST_PASSWORD');
  },

  /** Well-formed email that has no account. */
  unknownEmail:
    process.env.VETPORTAL_UNKNOWN_EMAIL || 'no.such.vet.automation@example.com',
  /** Not an email — the app skips format validation and sends it to the API. */
  malformedEmail: process.env.VETPORTAL_MALFORMED_EMAIL || 'not-an-email',
  wrongPassword: process.env.VETPORTAL_WRONG_PASSWORD || 'WrongPass!NotMine999',

  /** src/Constants/Messages.js */
  emailBlankToast: 'Please enter email.',
  passwordBlankToast: 'Please enter password.',
  /** Shown when a practice-owner account signs in to the vet-assistant app. */
  practiceOwnerToast: 'Please login with vet assistant account.',
};

/**
 * Unique per run so reruns never hit "email already exists". Uses ".reg<ts>",
 * not "+reg<ts>": the app's email check (CommonMethod.isEmailAddressValidate)
 * only allows letters, digits, "_", "." and "-" before the @.
 */
function uniqueEmail(base) {
  const [local, domain] = String(base).split('@');
  return `${local}.reg${Date.now()}@${domain}`;
}

/**
 * Email the registration test types. REG_EMAIL_UNIQUE=false uses emailBase
 * exactly — that account must not already exist, or signup fails with
 * "email already exists".
 */
function registrationEmail() {
  const unique = String(process.env.REG_EMAIL_UNIQUE ?? 'true').trim().toLowerCase();
  return unique === 'false' ? registrationData.emailBase : uniqueEmail(registrationData.emailBase);
}

const registrationData = {
  firstName: process.env.REG_FIRST_NAME || 'Pushpendra',
  middleName: process.env.REG_MIDDLE_NAME || '',
  lastName: process.env.REG_LAST_NAME || 'Singh',
  /** Base address; the test registers registrationEmail() built from it. */
  emailBase: process.env.REG_EMAIL_BASE || 'pushpendra@appdesign.ie',
  get password() {
    return requireEnv('REG_PASSWORD');
  },
  /** +353 default country code; 9 digits starting with 8 (Signup.js validation). */
  get mobile() {
    return requireEnv('REG_MOBILE');
  },
  qualification: process.env.REG_QUALIFICATION || 'Bachelor of Veterinary Science',
  vetRegNo: process.env.REG_VET_REG_NO || '02/55',
  addressSearch: process.env.REG_ADDRESS_SEARCH || 'dublin',
  /** 0-based: the user asked for the second suggestion. */
  addressResultIndex: Number(process.env.REG_ADDRESS_RESULT_INDEX || 1),
  /** Used only if the picked place has no postal_code (e.g. "Dublin, Ireland"). D01 = Dublin 1. */
  fallbackEircode: process.env.REG_EIRCODE || 'D01 F5P2',

  successTitle: 'You have successfully created your account',
};

/**
 * Compose New Script → Veterinary Practice (Dispensing). Every value can be
 * overridden from .env or the dashboard run inputs.
 */
const composeData = {
  /** Existing client, picked from the Client Name search list. */
  clientName: process.env.COMPOSE_CLIENT_NAME || 'Adelina Amara',
  /**
   * Text contained in the "Animal Category/ Type" row to pick. Companion pets
   * appear as "Companion - <name>(<age>), Dog(<breed>)" — only if the vet's
   * practice offers the Companion category. "Horses - Horses" needs no Herd No.
   */
  animal: process.env.COMPOSE_ANIMAL || 'Horses - Horses',
  /** Client with no Herd No on file for the Herd No negative case; blank = auto-find one. */
  herdClientName: process.env.COMPOSE_HERD_CLIENT_NAME || '',
  /** Row that needs a Herd No (Cattle/Sheep/Goats/Deer) — for the negative case. */
  herdAnimal: process.env.COMPOSE_HERD_ANIMAL || 'Cattle - Dairy',
  /** Drug Compendium search; blank = first drug in the list. */
  medicineSearch: process.env.COMPOSE_MEDICINE_SEARCH || '',
  quantity: process.env.COMPOSE_QUANTITY || '1',
  animalId: process.env.COMPOSE_ANIMAL_ID || 'Automation test animal',

  /** ComposeNewScript.js / Messages.js toasts */
  clientBlankToast: 'Enter/select client name',
  herdNoToast: 'Please select or enter Herd No/Equine No/Flock No',
  noMedicineToast: 'Please add medicines or upload script',
  successMessage: 'Prescription created successfully',
};

module.exports = {
  testData,
  registrationData,
  composeData,
  uniqueEmail,
  registrationEmail,
  // Backwards-compatible names from the scaffold.
  testUser: process.env.TEST_USER || '',
  testPassword: process.env.TEST_PASSWORD || '',
};

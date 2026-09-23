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

module.exports = {
  testData,
  registrationData,
  uniqueEmail,
  registrationEmail,
  // Backwards-compatible names from the scaffold.
  testUser: process.env.TEST_USER || '',
  testPassword: process.env.TEST_PASSWORD || '',
};

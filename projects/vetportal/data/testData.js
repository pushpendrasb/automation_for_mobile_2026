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

module.exports = {
  testData,
  // Backwards-compatible names from the scaffold.
  testUser: process.env.TEST_USER || '',
  testPassword: process.env.TEST_PASSWORD || '',
};

/**
 * Vet-Pal Animal Owner — credentials and UI labels from project .env.
 * Sign In uses mobile number (+353 default), not email.
 */
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill values.`,
    );
  }
  return value.trim();
}

function homeIndicators() {
  const raw =
    process.env.VETPAL_HOME_INDICATORS ||
    'VETPAL,Request Treatment,My Appointments,Dispensed Prescriptions,My Practices';
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

const testData = {
  get mobileNumber() {
    return requireEnv('VETPAL_TEST_MOBILE');
  },
  get countryCode() {
    return (process.env.VETPAL_COUNTRY_CODE || '+353').trim();
  },
  get password() {
    return requireEnv('VETPAL_TEST_PASSWORD');
  },

  /** Invalid mobile (9 digits, IE format) for negative tests */
  invalidMobile: process.env.VETPAL_INVALID_MOBILE || '899999999',
  invalidPassword: process.env.VETPAL_INVALID_PASSWORD || 'WrongPass!999',
  wrongPassword: process.env.VETPAL_WRONG_PASSWORD || 'WrongPass!NotMine999',
  unknownMobile: process.env.VETPAL_UNKNOWN_MOBILE || '899999998',

  loginTab: 'Sign In',
  signUpTab: 'Sign Up',
  signInButton: process.env.VETPAL_SIGN_IN_BUTTON || 'Sign In Now',
  mobilePlaceholder: 'Mobile number',
  passwordPlaceholder: 'Password',
  welcomeHint: 'Welcome back — sign in to continue',

  mobileBlankToast:
    process.env.VETPAL_MOBILE_BLANK_TOAST || 'Please enter mobile number',
  passwordBlankToast:
    process.env.VETPAL_PASSWORD_BLANK_TOAST || 'Please enter password',

  /** Vet-Pal toasts use message text only (no "Error" title) */
  genericApiErrorFallback: 'Something went wrong',

  get homeIndicators() {
    return homeIndicators();
  },
};

module.exports = { testData };

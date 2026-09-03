/**
 * Sign Up inputs — edit this file (or set VETPAL_SIGNUP_* in .env).
 *
 * Screen: Login.js Sign Up tab.
 * Email is a real email field (not a name). Change `email` here to retry P02
 * if the number/email is already registered.
 */
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

function envOr(name, fallback) {
  const value = process.env[name];
  if (value == null || !String(value).trim()) {
    return fallback;
  }
  return String(value).trim();
}

const signUpData = {
  /** Positive P02 — change these when you want a new account. */
  email: envOr('VETPAL_SIGNUP_EMAIL', 'pushpendra@appdesign.ie'),
  countryCode: envOr('VETPAL_SIGNUP_COUNTRY_CODE', '+91'),
  mobileNumber: envOr('VETPAL_SIGNUP_MOBILE', '9664070794'),
  password: envOr('VETPAL_SIGNUP_PASSWORD', 'H12345678'),
  confirmPassword: envOr('VETPAL_SIGNUP_CONFIRM_PASSWORD', 'H12345678'),

  /** Negative fixtures */
  invalidEmail: envOr('VETPAL_SIGNUP_INVALID_EMAIL', 'not-an-email'),
  shortMobile: envOr('VETPAL_SIGNUP_SHORT_MOBILE', '96640'),
  mismatchConfirm: envOr('VETPAL_SIGNUP_MISMATCH_CONFIRM', 'H99999999'),

  signUpTab: 'Sign Up',
  signUpButton: 'Sign Up Now',
  createAccountHint: 'Create an account to get started',
  otpTitle: 'Enter OTP',
  /**
   * Pause on Enter OTP after Sign Up so WhatsApp can deliver the code and
   * you can type it on the device. Default 20s.
   */
  otpWaitMs: Number(envOr('VETPAL_SIGNUP_OTP_WAIT_MS', '20000')) || 20000,
  /**
   * 6-digit WhatsApp OTP. Leave blank to type it on the device during the wait.
   * If set, P02 enters it and taps Verify OTP.
   */
  otp: envOr('VETPAL_SIGNUP_OTP', ''),

  /**
   * Create Profile after login or Splash.js validateAuth when
   * is_profile_completed != '1'. Also used by VP-SP-P01 (splash script).
   */
  profile: {
    firstName: envOr('VETPAL_PROFILE_FIRST_NAME', 'Pushpendra'),
    lastName: envOr('VETPAL_PROFILE_LAST_NAME', 'Singh'),
    addressSearch: envOr('VETPAL_PROFILE_ADDRESS_SEARCH', 'Dublin'),
    county: envOr('VETPAL_PROFILE_COUNTY', 'Dublin'),
    country: envOr('VETPAL_PROFILE_COUNTRY', 'IRELAND'),
    /** Always typed into Eircode/Postcode — Place Picker left this empty. */
    postcode: envOr('VETPAL_PROFILE_POSTCODE', 'D02 AF30'),
    company: envOr('VETPAL_PROFILE_COMPANY', 'VetPal QA'),
    /**
     * CreateProfile AnimalCat keys to tick. Herd No only appears after at
     * least one of these is checked (Dairy, Beef/Suckler, Equine, …).
     * Comma-separated env: VETPAL_PROFILE_ANIMALS=dairy,beef
     */
    animals: envOr('VETPAL_PROFILE_ANIMALS', 'dairy,beef')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean),
    herdNo: envOr('VETPAL_PROFILE_HERD', 'H12345'),
  },

  emailBlankToast: 'Please enter email',
  passwordBlankToast: 'Please enter password',
  confirmBlankToast: 'Please enter confirm password',
  passwordMismatchToast: 'Password and confirm do not match',
  tncToast: 'Please accept terms and conditions',
  indiaLengthToast: 'India number should be 10 digits.',
};

module.exports = { signUpData };

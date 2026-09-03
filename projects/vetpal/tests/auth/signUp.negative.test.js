/**
 * Negative Sign Up (VP-SU-N01 … VP-SU-N06).
 * Client toasts from Login.js signUpHandler / phoneNumberUtils.
 */
const LoginPage = require('../../pages/LoginPage');
const SignUpPage = require('../../pages/SignUpPage');
const { signUpData } = require('../../data/signUpData');

describe('Vet-Pal Sign Up — Negative', () => {
  beforeEach(async () => {
    await LoginPage.resetAppToLoginScreen({ skipSignInTab: true });
    await SignUpPage.ensureSignUpMode();
  });

  it('VP-SU-N01: Empty form shows email blank toast', async () => {
    await SignUpPage.tapSignUpNow();
    await LoginPage.waitForToastContaining(signUpData.emailBlankToast, 12000);
    expect(await SignUpPage.isStillOnSignUp()).toBe(true);
  });

  it('VP-SU-N02: Email only + empty India mobile shows 10-digit toast', async () => {
    await SignUpPage.enterEmail(signUpData.email);
    await SignUpPage.selectCountryCode(signUpData.countryCode);
    await SignUpPage.tapSignUpNow();
    await LoginPage.waitForToastContaining(signUpData.indiaLengthToast, 12000);
    expect(await SignUpPage.isStillOnSignUp()).toBe(true);
  });

  it('VP-SU-N03: Email + mobile, empty password shows password toast', async () => {
    await SignUpPage.enterEmail(signUpData.email);
    await SignUpPage.selectCountryCode(signUpData.countryCode);
    await SignUpPage.enterMobile(signUpData.mobileNumber);
    await SignUpPage.tapSignUpNow();
    await LoginPage.waitForToastContaining(signUpData.passwordBlankToast, 12000);
    expect(await SignUpPage.isStillOnSignUp()).toBe(true);
  });

  it('VP-SU-N04: Password filled, confirm empty shows confirm toast', async () => {
    await SignUpPage.enterEmail(signUpData.email);
    await SignUpPage.selectCountryCode(signUpData.countryCode);
    await SignUpPage.enterMobile(signUpData.mobileNumber);
    await SignUpPage.enterPassword(signUpData.password);
    await SignUpPage.tapSignUpNow();
    await LoginPage.waitForToastContaining(signUpData.confirmBlankToast, 12000);
    expect(await SignUpPage.isStillOnSignUp()).toBe(true);
  });

  it('VP-SU-N05: Password and confirm do not match', async () => {
    await SignUpPage.enterEmail(signUpData.email);
    await SignUpPage.selectCountryCode(signUpData.countryCode);
    await SignUpPage.enterMobile(signUpData.mobileNumber);
    await SignUpPage.enterPassword(signUpData.password);
    await SignUpPage.enterConfirmPassword(signUpData.mismatchConfirm);
    await SignUpPage.dismissKeyboardThenTickTerms();
    await SignUpPage.tapSignUpNow();
    await LoginPage.waitForToastContaining(
      signUpData.passwordMismatchToast,
      12000,
    );
    expect(await SignUpPage.isStillOnSignUp()).toBe(true);
  });

  it('VP-SU-N06: Valid fields without T&C tick shows accept toast', async () => {
    await SignUpPage.enterEmail(signUpData.email);
    await SignUpPage.selectCountryCode(signUpData.countryCode);
    await SignUpPage.enterMobile(signUpData.mobileNumber);
    await SignUpPage.enterPassword(signUpData.password);
    await SignUpPage.enterConfirmPassword(signUpData.confirmPassword);
    await SignUpPage.tapSignUpNow();
    await LoginPage.waitForToastContaining(signUpData.tncToast, 12000);
    expect(await SignUpPage.isStillOnSignUp()).toBe(true);
  });
});

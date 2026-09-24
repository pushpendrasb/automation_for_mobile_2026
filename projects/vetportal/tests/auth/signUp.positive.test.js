/**
 * Positive Registration cases (VPO-SU-P01, VPO-SU-P02).
 * Registers a new vet user on the dev API, then signs in with the same email.
 * Email is unique each run unless REG_EMAIL_UNIQUE=false, which types
 * REG_EMAIL_BASE exactly (signup:exact). P02 signs in with that email even
 * when P01 is refused with "already registered", since the app then asks the
 * user to log in instead.
 */
const SignUpPage = require('../../pages/SignUpPage');
const LoginPage = require('../../pages/LoginPage');
const { registrationData: reg, registrationEmail } = require('../../data/testData');
const { seedSimulatorPhoto } = require('../../helpers/photos');
const { setTestExtras } = require('@mobile-automation/appium-core/utils/testContext');

describe('VetPortal Registration — Positive', () => {
  /** Email typed by P01 and used again by P02 (picked once per run). */
  let email = '';

  before(() => {
    // Fail in the first second, not after the photo step, if .env is incomplete.
    void reg.password;
    void reg.mobile;
    email = registrationEmail();
    seedSimulatorPhoto();
  });

  after(async () => {
    // Leave the app signed out so the next spec starts on Sign In
    // (a new vet lands on Join Vet Practice, which has no logout of its own).
    await LoginPage.resetAppToLoginScreen().catch((err) => {
      console.log(`[Registration] Could not return to Sign In: ${err.message}`);
    });
  });

  it('VPO-SU-P01: New vet registers with all details and a gallery profile photo', async () => {
    console.log(`[Registration] Email for this run: ${email}`);

    await SignUpPage.openFromLogin();
    await SignUpPage.addProfileImageFromGallery();

    await SignUpPage.fillPersonalDetails({
      firstName: reg.firstName,
      middleName: reg.middleName,
      lastName: reg.lastName,
      email,
      password: reg.password,
      mobile: reg.mobile,
      qualification: reg.qualification,
      vetRegNo: reg.vetRegNo,
    });

    const address = await SignUpPage.pickAddress(reg.addressSearch, reg.addressResultIndex);
    console.log(`[Registration] Address: ${address}`);
    const eircode = await SignUpPage.ensureEircode(reg.fallbackEircode);
    console.log(`[Registration] Eircode: ${eircode}`);

    await SignUpPage.checkAgreements();
    await SignUpPage.tapRegisterNow();

    const { success, message } = await SignUpPage.waitForRegistrationOutcome(reg.successTitle);
    setTestExtras({
      expectedError: `None — "${reg.successTitle}" alert`,
      actualError: success ? `None — ${message}` : message || 'No success alert or error message within 45s',
      pageContext: 'Registration',
      action: `Registered ${email} (${address}, ${eircode}), tapped Register Now`,
    });

    if (!success) {
      throw new Error(`Registration failed for ${email}. App said: "${message || 'nothing'}"`);
    }
    await SignUpPage.confirmSuccessAlert();
  });

  /**
   * Runs whether or not P01 created the account. The dev API only lets an
   * account in after its email link is clicked, so an unverified account
   * passes when the app asks to verify the email; a verified one passes when
   * it lands on Join Vet Practice or Home.
   */
  it('VPO-SU-P02: Registered email signs in (verify-email message or lands in the app)', async () => {
    console.log(`[Registration] Signing in with: ${email}`);
    // P01 may have stopped on the Registration form, so start from a clean Sign In.
    await LoginPage.resetAppToLoginScreen();
    await LoginPage.enterEmail(email);
    await LoginPage.enterPassword(reg.password);
    await LoginPage.tapSignIn();

    const { landed, message } = await LoginPage.waitForSignInOutcome(25000);
    const askedToVerify = !landed && Boolean(message) && message.includes(reg.verifyEmailToast);
    const screen = !landed
      ? null
      : (await LoginPage.isSubscribeVetsVisible())
        ? 'Join Vet Practice (no practice joined yet)'
        : 'Home';
    setTestExtras({
      expectedError: `"${reg.verifyEmailToast}" toast, or lands on Join Vet Practice / Home`,
      actualError: landed ? `None — ${screen}` : message || 'Still on Sign In after 25s, no message',
      pageContext: 'Sign In (registered email)',
      action: 'Signed in with the email typed in VPO-SU-P01',
    });

    if (!landed && !askedToVerify) {
      throw new Error(`Sign in with ${email} failed. App said: "${message || 'nothing'}"`);
    }
    console.log(
      `[Registration] Sign in with ${email} — ${landed ? screen : 'app asked to verify the email first'}`,
    );
  });
});

/**
 * Positive Registration case (VPO-SU-P01).
 * Registers a new vet user on the dev API. Email is unique each run unless
 * REG_EMAIL_UNIQUE=false, which types REG_EMAIL_BASE exactly.
 */
const SignUpPage = require('../../pages/SignUpPage');
const { registrationData: reg, registrationEmail } = require('../../data/testData');
const { seedSimulatorPhoto } = require('../../helpers/photos');
const { setTestExtras } = require('@mobile-automation/appium-core/utils/testContext');

describe('VetPortal Registration — Positive', () => {
  before(() => {
    // Fail in the first second, not after the photo step, if .env is incomplete.
    void reg.password;
    void reg.mobile;
    seedSimulatorPhoto();
  });

  it('VPO-SU-P01: New vet registers with all details and a gallery profile photo', async () => {
    const email = registrationEmail();
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
});

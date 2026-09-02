/**
 * Positive Sign-In cases (VP-SI-P01, VP-SI-P02).
 */
const LoginPage = require('../../pages/LoginPage');
const { testData } = require('../../data/testData');

describe('Vet-Pal Sign In — Positive', () => {
  beforeEach(async () => {
    // Skip terminate/relaunch when Sign In is already showing (e.g. P01 → P02).
    await LoginPage.resetAppToLoginScreen();
  });

  it('VP-SI-P01: Login screen shows mobile, password, and Sign In Now', async () => {
    await LoginPage.assertLoginFormVisible();
  });

  it('VP-SI-P02: Valid mobile + password navigate to owner Home', async () => {
    console.log(
      `Using test mobile from .env: ${testData.countryCode} ${testData.mobileNumber}`,
    );

    await LoginPage.enterMobile(testData.mobileNumber);
    await LoginPage.enterPassword(testData.password);
    await LoginPage.tapSignIn();

    const success = await LoginPage.isLoginSuccessful(25000);
    if (!success) {
      const loginError = await LoginPage.getVisibleLoginErrorMessage();
      if (loginError) {
        throw new Error(
          `Login rejected. Message: "${loginError}". ` +
            `Update VETPAL_TEST_MOBILE / VETPAL_TEST_PASSWORD in projects/vetpal/.env`,
        );
      }
    }
    expect(success).toBe(true);
  });
});

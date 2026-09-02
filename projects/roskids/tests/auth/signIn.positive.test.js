/**
 * Positive Sign-In cases (SI-P01, SI-P02).
 * Credentials: projects/roskids/.env — never hardcoded here.
 */
const LoginPage = require('../../pages/LoginPage');
const { testData } = require('../../data/testData');

describe('RosKids Sign In — Positive', () => {
  beforeEach(async () => {
    await LoginPage.resetAppToLoginScreen();
  });

  it('SI-P01: Login screen shows email, password, and Sign In controls', async () => {
    await LoginPage.assertLoginFormVisible();
  });

  it('SI-P02: Valid credentials navigate to MainDashBoard', async () => {
    console.log(`Using test email from .env: ${testData.email}`);

    await LoginPage.enterEmail(testData.email);
    await LoginPage.enterPassword(testData.password);
    await LoginPage.tapSignIn();
    await browser.pause(400);

    const success = await LoginPage.isLoginSuccessful(90000);
    if (!success) {
      const loginError = await LoginPage.getVisibleLoginErrorMessage();
      if (loginError) {
        throw new Error(
          `Login rejected by API. Toast: "${loginError}". ` +
            `Update ROS_KIDS_TEST_EMAIL / ROS_KIDS_TEST_PASSWORD in projects/roskids/.env ` +
            `with credentials that work on the app API environment.`,
        );
      }
    }
    expect(success).toBe(true);
  });
});

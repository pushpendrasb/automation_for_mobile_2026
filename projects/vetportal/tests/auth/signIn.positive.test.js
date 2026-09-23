/**
 * Positive Sign-In cases (VPO-SI-P01, VPO-SI-P02).
 */
const LoginPage = require('../../pages/LoginPage');
const { testData } = require('../../data/testData');

describe('VetPortal Sign In — Positive', () => {
  beforeEach(async () => {
    await LoginPage.resetAppToLoginScreen();
  });

  after(async () => {
    // Leave the app logged out so the next spec starts on Sign In.
    if (await LoginPage.isHomeVisible()) {
      await LoginPage.logoutFromHome();
    }
  });

  it('VPO-SI-P01: Login screen shows email, password, Sign In, Forgot Password and Register Now', async () => {
    await LoginPage.assertLoginFormVisible();
  });

  it('VPO-SI-P02: Valid email + password navigate past Sign In', async () => {
    console.log(`Using test user (dashboard input or .env): ${testData.email}`);

    await LoginPage.enterEmail(testData.email);
    await LoginPage.enterPassword(testData.password);
    await LoginPage.tapSignIn();

    const success = await LoginPage.isLoginSuccessful(25000);
    if (!success && (await LoginPage.isToastVisible(testData.practiceOwnerToast))) {
      throw new Error(
        `Login rejected: "${testData.practiceOwnerToast}". ` +
          'TEST_USER is a practice-owner account — use a vet assistant account in projects/vetportal/.env',
      );
    }
    expect(success).toBe(true);
  });
});

/**
 * Failure-report demo (VPO-SI-F01).
 *
 * The user means to sign in but types the wrong password by mistake. The goal
 * is "user reaches Home", so the app rejecting the password is reported as a
 * FAIL — with the app's own error message, the page/action, and a screenshot.
 *
 * Named .demo.js (not .test.js) so the full-suite run `npm run test:ios` skips it.
 * Run: npm run test:ios:signin:failure-demo
 */
const LoginPage = require('../../pages/LoginPage');
const { testData } = require('../../data/testData');
const { setTestExtras } = require('@mobile-automation/appium-core/utils/testContext');

describe('VetPortal Sign In — Failure report demo', () => {
  beforeEach(async () => {
    await LoginPage.resetAppToLoginScreen();
  });

  it('VPO-SI-F01: User signs in with a mistaken wrong password', async () => {
    console.log(`Signing in as ${testData.email} with a WRONG password (intentional mistake)`);

    await LoginPage.enterEmail(testData.email);
    await LoginPage.enterPassword(testData.wrongPassword);
    await LoginPage.tapSignIn();

    const { landed, message } = await LoginPage.waitForSignInOutcome(20000);
    const actual = landed
      ? 'Signed in and reached Home'
      : message || 'Stayed on Sign In (no error message shown)';

    setTestExtras({
      expectedError: 'None — the user should be signed in and reach Home',
      actualError: actual,
      pageContext: 'Sign In',
      action: `Entered ${testData.email} + wrong password, tapped Sign In`,
    });

    if (!landed) {
      throw new Error(
        `Sign In failed: wrong password entered for ${testData.email}. App said: "${actual}"`,
      );
    }
  });
});

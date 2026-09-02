/**
 * Negative Sign-In cases (SI-N01 … SI-N05).
 * Assert client validation toasts or API Error toast; never leave Sign In.
 */
const LoginPage = require('../../pages/LoginPage');
const { testData } = require('../../data/testData');

describe('RosKids Sign In — Negative', () => {
  beforeEach(async () => {
    await LoginPage.resetAppToLoginScreen();
  });

  it('SI-N01: Empty email and empty password show email blank toast', async () => {
    await LoginPage.tapSignInOnly();
    await LoginPage.waitForToastContaining(testData.emailBlankToast, 15000);
    expect(await LoginPage.isStillOnLoginScreen()).toBe(true);
  });

  it('SI-N02: Email filled and password empty show password blank toast', async () => {
    await LoginPage.enterEmail(testData.email);
    await LoginPage.tapSignIn();
    await LoginPage.waitForToastContaining(testData.passwordBlankToast, 15000);
    expect(await LoginPage.isStillOnLoginScreen()).toBe(true);
  });

  it('SI-N03: Invalid email and invalid password show Error toast', async () => {
    await LoginPage.enterEmail(testData.invalidEmail);
    await LoginPage.enterPassword(testData.invalidPassword);
    await LoginPage.tapSignIn();

    await LoginPage.waitForErrorIndication(30000);
    expect(await LoginPage.isStillOnLoginScreen()).toBe(true);
    expect(await LoginPage.isLoginSuccessful(3000)).toBe(false);
  });

  it('SI-N04: Valid email with wrong password shows Error toast', async () => {
    await LoginPage.enterEmail(testData.email);
    await LoginPage.enterPassword(testData.wrongPassword);
    await LoginPage.tapSignIn();

    await LoginPage.waitForErrorIndication(30000);
    expect(await LoginPage.isStillOnLoginScreen()).toBe(true);
    expect(await LoginPage.isLoginSuccessful(3000)).toBe(false);
  });

  it('SI-N05: Unknown email with any password shows Error toast', async () => {
    await LoginPage.enterEmail('unknown.user.roskids+e2e@example.com');
    await LoginPage.enterPassword(testData.invalidPassword);
    await LoginPage.tapSignIn();

    await LoginPage.waitForErrorIndication(30000);
    expect(await LoginPage.isStillOnLoginScreen()).toBe(true);
    expect(await LoginPage.isLoginSuccessful(3000)).toBe(false);
  });
});

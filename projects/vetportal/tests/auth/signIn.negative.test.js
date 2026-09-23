/**
 * Negative Sign-In cases (VPO-SI-N01 … VPO-SI-N05).
 * VetPortal signs in with email + password.
 */
const LoginPage = require('../../pages/LoginPage');
const { testData } = require('../../data/testData');

describe('VetPortal Sign In — Negative', () => {
  beforeEach(async () => {
    await LoginPage.resetAppToLoginScreen();
  });

  it('VPO-SI-N01: Empty email and empty password show email blank toast', async () => {
    await LoginPage.tapSignIn();
    await LoginPage.waitForToastContaining(testData.emailBlankToast, 15000);
    expect(await LoginPage.isOnLoginScreen()).toBe(true);
  });

  it('VPO-SI-N02: Email filled and password empty show password blank toast', async () => {
    await LoginPage.enterEmail(testData.email);
    await LoginPage.tapSignIn();
    await LoginPage.waitForToastContaining(testData.passwordBlankToast, 15000);
    expect(await LoginPage.isOnLoginScreen()).toBe(true);
  });

  it('VPO-SI-N03: Unregistered email with any password stays on Sign In', async () => {
    await LoginPage.enterEmail(testData.unknownEmail);
    await LoginPage.enterPassword(testData.wrongPassword);
    await LoginPage.tapSignIn();

    await LoginPage.waitForLoginRejected(20000);
    expect(await LoginPage.isOnLoginScreen()).toBe(true);
    expect(await LoginPage.isLandedAfterLogin()).toBe(false);
  });

  it('VPO-SI-N04: Registered email with wrong password stays on Sign In', async () => {
    await LoginPage.enterEmail(testData.email);
    await LoginPage.enterPassword(testData.wrongPassword);
    await LoginPage.tapSignIn();

    await LoginPage.waitForLoginRejected(20000);
    expect(await LoginPage.isOnLoginScreen()).toBe(true);
    expect(await LoginPage.isLandedAfterLogin()).toBe(false);
  });

  it('VPO-SI-N05: Malformed email with a password stays on Sign In', async () => {
    await LoginPage.enterEmail(testData.malformedEmail);
    await LoginPage.enterPassword(testData.wrongPassword);
    await LoginPage.tapSignIn();

    await LoginPage.waitForLoginRejected(20000);
    expect(await LoginPage.isOnLoginScreen()).toBe(true);
    expect(await LoginPage.isLandedAfterLogin()).toBe(false);
  });
});

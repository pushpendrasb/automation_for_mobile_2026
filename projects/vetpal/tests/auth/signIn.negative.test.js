/**
 * Negative Sign-In cases (VP-SI-N01 … VP-SI-N05).
 * Vet-Pal uses mobile number (+353), not email.
 */
const LoginPage = require('../../pages/LoginPage');
const { testData } = require('../../data/testData');

describe('Vet-Pal Sign In — Negative', () => {
  beforeEach(async () => {
    // Stay on Sign In without relaunch when the previous case already left us there.
    await LoginPage.resetAppToLoginScreen();
  });

  it('VP-SI-N01: Empty mobile and empty password show mobile blank toast', async () => {
    await LoginPage.clearLoginFields();
    await LoginPage.tapSignInOnly();
    await LoginPage.waitForToastContaining(testData.mobileBlankToast, 15000);
    expect(await LoginPage.isStillOnLoginScreen()).toBe(true);
  });

  it('VP-SI-N02: Mobile filled and password empty show password blank toast', async () => {
    await LoginPage.enterMobile(testData.mobileNumber);
    await LoginPage.tapSignIn();
    await LoginPage.waitForToastContaining(testData.passwordBlankToast, 15000);
    expect(await LoginPage.isStillOnLoginScreen()).toBe(true);
  });

  it('VP-SI-N03: Invalid mobile and invalid password stay on Sign In', async () => {
    await LoginPage.enterMobile(testData.invalidMobile);
    await LoginPage.enterPassword(testData.invalidPassword);
    await LoginPage.tapSignIn();

    await LoginPage.waitForLoginRejected(15000);
    expect(await LoginPage.isStillOnLoginScreen()).toBe(true);
    expect(await LoginPage.isHomeVisibleFast()).toBe(false);
  });

  it('VP-SI-N04: Valid mobile with wrong password stays on Sign In', async () => {
    await LoginPage.enterMobile(testData.mobileNumber);
    await LoginPage.enterPassword(testData.wrongPassword);
    await LoginPage.tapSignIn();

    await LoginPage.waitForLoginRejected(15000);
    expect(await LoginPage.isStillOnLoginScreen()).toBe(true);
    expect(await LoginPage.isHomeVisibleFast()).toBe(false);
  });

  it('VP-SI-N05: Unknown mobile with any password stays on Sign In', async () => {
    await LoginPage.enterMobile(testData.unknownMobile);
    await LoginPage.enterPassword(testData.invalidPassword);
    await LoginPage.tapSignIn();

    await LoginPage.waitForLoginRejected(15000);
    expect(await LoginPage.isStillOnLoginScreen()).toBe(true);
    expect(await LoginPage.isHomeVisibleFast()).toBe(false);
  });
});

/**
 * Appraisee IE — login negative cases (ViewController validation toasts).
 */
import LoginPage from '../../pages/LoginPage';
import { ensureLoggedOut } from '../../helpers/session';
import { testData } from '../../data/testData';

describe('AppraiseeIE — Login negative', () => {
  before(async () => {
    await ensureLoggedOut();
  });

  beforeEach(async () => {
    await ensureLoggedOut();
    await LoginPage.waitForLoginScreen(20000);
  });

  it('AP-SI-N01: Empty email shows Please enter E-mail', async () => {
    await LoginPage.clearLoginFields();
    await LoginPage.enterPassword('anyPass123');
    await LoginPage.tapLogin();
    await LoginPage.waitForToastContaining('Please enter E-mail');
    expect(await LoginPage.isLoginFormVisible()).toBe(true);
  });

  it('AP-SI-N02: Invalid email shows Enter a valid email address', async () => {
    await LoginPage.clearLoginFields();
    await LoginPage.enterEmail('not-an-email');
    await LoginPage.enterPassword('anyPass123');
    await LoginPage.tapLogin();
    await LoginPage.waitForToastContaining('valid email');
    expect(await LoginPage.isLoginFormVisible()).toBe(true);
  });

  it('AP-SI-N03: Empty password shows Please enter password', async () => {
    await LoginPage.clearLoginFields();
    await LoginPage.enterEmail(testData.email || 'qa@example.com');
    // Leave password empty
    await LoginPage.tapLogin();
    await LoginPage.waitForToastContaining('Please enter password');
    expect(await LoginPage.isLoginFormVisible()).toBe(true);
  });

  it('AP-SI-N04: Wrong password stays on login (or shows error toast)', async () => {
    await LoginPage.clearLoginFields();
    await LoginPage.enterEmail(testData.email || 'qa@example.com');
    await LoginPage.enterPassword('WrongPassword!999');
    await LoginPage.tapLogin();
    await browser.pause(2500);
    // Must not reach role screen
    const onLogin = await LoginPage.isLoginFormVisible();
    expect(onLogin).toBe(true);
  });
});

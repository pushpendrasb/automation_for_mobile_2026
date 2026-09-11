/**
 * Appraisee IE — password show / hide on ViewController.
 */
import LoginPage from '../../pages/LoginPage';
import { TEST_IDS } from '../../data/testIds';
import { ensureLoggedOut } from '../../helpers/session';

describe('AppraiseeIE — Password visibility', () => {
  before(async () => {
    await ensureLoggedOut();
  });

  it('AP-SI-P05: Password hide and unhide toggles secure entry', async () => {
    const sample = 'SecretHide123';
    await ensureLoggedOut();
    await LoginPage.waitForLoginScreen(20000);
    await LoginPage.enterPassword(sample);

    // Default: hidden (secure)
    expect(await LoginPage.isPasswordSecure()).toBe(true);

    // Unhide — field should expose plain text (type and/or value)
    await LoginPage.tapShowHidePassword();
    const afterShowSecure = await LoginPage.isPasswordSecure();
    let valueAfterShow = '';
    try {
      const field = await $(`~${TEST_IDS.login.password}`);
      valueAfterShow = (await field.getValue().catch(() => '')) || '';
    } catch {
      /* ignore */
    }
    expect(afterShowSecure === false || valueAfterShow === sample).toBe(true);

    // Hide again
    await LoginPage.tapShowHidePassword();
    expect(await LoginPage.isPasswordSecure()).toBe(true);
  });
});

/**
 * Appraisee IE — login positive cases.
 *
 * If already logged in on home: menu → SideMenuViewController → scroll LOGOUT →
 * confirm → then run login. Password hide/unhide and negative cases are separate specs.
 */
import LoginPage from '../../pages/LoginPage';
import UserRolePage from '../../pages/UserRolePage';
import HomePage from '../../pages/HomePage';
import SideMenuPage from '../../pages/SideMenuPage';
import SystemAlertsPage from '../../pages/SystemAlertsPage';
import { assertCredentialsConfigured, testData } from '../../data/testData';
import { ensureLoggedOut } from '../../helpers/session';
import { clientStep } from '../../helpers/clientLog';

describe('AppraiseeIE — Login', () => {
  before(async () => {
    // Home session → open side menu, scroll to LOGOUT if needed, logout
    await ensureLoggedOut();
  });

  it('AP-SI-P01: Login screen shows email, password, and Login', async () => {
    clientStep('Check login screen');
    await ensureLoggedOut();
    await LoginPage.assertLoginFormVisible();
  });

  it('AP-SI-P02: Valid email + password reaches user role screen', async () => {
    clientStep('Sign in with valid email and password');
    assertCredentialsConfigured();
    await ensureLoggedOut();
    console.log(`Using TEST_USER from .env: ${testData.email}`);

    await LoginPage.login(testData.email, testData.password);
    await SystemAlertsPage.tapNotNowIfVisible();

    const leftLogin = await LoginPage.isLoginFormGone(30000);
    expect(leftLogin).toBe(true);

    await UserRolePage.waitForRoleScreen(20000);
    await UserRolePage.assertRoleTableVisible();
  });

  it('AP-SI-P03: Select first role after login and open home', async () => {
    clientStep('Select first account role and open home');
    assertCredentialsConfigured();

    if (await LoginPage.isLoginFormVisible()) {
      await LoginPage.login(testData.email, testData.password);
    }

    // Not Now (if any) + tap cell 0 in the same fast loop
    await UserRolePage.dismissNotNowAndSelectRole(testData.roleIndex);

    const leftRoles = await UserRolePage.isRoleScreenGone(20000);
    expect(leftRoles).toBe(true);

    await HomePage.waitForHome(20000);
    // First login often auto-opens SideMenuViewController (LOGOUT may need scroll)
    if (await SideMenuPage.isOpen()) {
      console.log('[P03] Side menu auto-opened after login — OK');
    }
    await expect(HomePage.isDisplayed()).resolves.toBe(true);
  });

  it('AP-SI-P04: Side menu scroll to LOGOUT and return to login', async () => {
    clientStep('Logout from side menu and return to login');
    // After fresh login the side menu is often already open with LOGOUT off-screen
    if (!(await HomePage.isDisplayed()) && !(await SideMenuPage.isOpen())) {
      assertCredentialsConfigured();
      await ensureLoggedOut();
      await LoginPage.login(testData.email, testData.password);
      await UserRolePage.dismissNotNowAndSelectRole(testData.roleIndex);
      await HomePage.waitForHome(25000);
    }

    // Do not re-tap Menu if already open — scroll to LOGOUT → YES
    await HomePage.logoutViaSideMenu();
    await LoginPage.waitForLoginScreen(25000);
    await LoginPage.assertLoginFormVisible();
  });
});

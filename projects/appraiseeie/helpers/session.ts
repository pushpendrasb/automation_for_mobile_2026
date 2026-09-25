/**
 * Session helpers — login / logout for Appraisee IE auth and Create Appraisal flows.
 */
import LoginPage from '../pages/LoginPage';
import UserRolePage from '../pages/UserRolePage';
import HomePage from '../pages/HomePage';
import SystemAlertsPage from '../pages/SystemAlertsPage';
import { assertCredentialsConfigured, testData } from '../data/testData';
import { clientLog } from './clientLog';
import { byExactText } from './platform';

/**
 * Bring the app to the ViewController login form.
 * - Already on login → no-op
 * - On home → menu → scroll LOGOUT → YES
 * - On role picker → role-screen Logout → YES
 */
export async function ensureLoggedOut(): Promise<void> {
  await SystemAlertsPage.tapNotNowIfVisible();

  if (await LoginPage.isLoginFormVisible()) {
    clientLog('Already on the login screen');
    return;
  }

  if (await HomePage.isDisplayed()) {
    console.log('[Session] Already on home — opening side menu to logout');
    clientLog('Session is logged in — logging out first');
    await HomePage.logoutViaSideMenu();
    await LoginPage.waitForLoginScreen(25000);
    return;
  }

  if (await UserRolePage.isDisplayed()) {
    console.log('[Session] On LoginUserRoleVC — tapping Logout');
    clientLog('On role picker — logging out to reach login');
    try {
      const logout = await $('~login_user_role_logout_button');
      if (await logout.isDisplayed().catch(() => false)) {
        await logout.click();
      } else {
        const byName = await $('~Logout');
        await byName.click();
      }
      const yes = await $(byExactText('YES'));
      await yes.waitForDisplayed({ timeout: 8000 });
      await yes.click();
      clientLog('Logged out from role picker');
      await LoginPage.waitForLoginScreen(25000);
      return;
    } catch (err) {
      console.log(`[Session] Role logout failed: ${String(err)}`);
    }
  }

  try {
    await LoginPage.waitForLoginScreen(8000);
  } catch {
    throw new Error(
      'Could not reach login screen. Logout from home (menu → LOGOUT) or reinstall the app.'
    );
  }
}

/**
 * Ensure we are past login + role picker and on home / TradeIn.
 * Used by Create Appraisal and other post-auth flows.
 */
export async function ensureLoggedIn(): Promise<void> {
  assertCredentialsConfigured();
  await SystemAlertsPage.tapNotNowIfVisible();

  if (await HomePage.isDisplayed()) {
    clientLog('Already on home — ready for Create Appraisal');
    return;
  }

  if (await UserRolePage.isDisplayed()) {
    clientLog('On role picker — selecting role');
    await UserRolePage.dismissNotNowAndSelectRole(testData.roleIndex);
    await HomePage.waitForHome(25000);
    return;
  }

  if (await LoginPage.isLoginFormVisible()) {
    clientLog('On login — signing in');
    await LoginPage.login(testData.email, testData.password);
    await SystemAlertsPage.tapNotNowIfVisible();
    await UserRolePage.dismissNotNowAndSelectRole(testData.roleIndex);
    await HomePage.waitForHome(25000);
    return;
  }

  await ensureLoggedOut();
  await LoginPage.login(testData.email, testData.password);
  await SystemAlertsPage.tapNotNowIfVisible();
  await UserRolePage.dismissNotNowAndSelectRole(testData.roleIndex);
  await HomePage.waitForHome(25000);
}

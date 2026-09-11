/**
 * Session helpers — ensure a clean login screen before auth tests.
 * If already on home, opens SideMenuViewController, scrolls to LOGOUT, logs out.
 */
import LoginPage from '../pages/LoginPage';
import UserRolePage from '../pages/UserRolePage';
import HomePage from '../pages/HomePage';
import SystemAlertsPage from '../pages/SystemAlertsPage';
import { clientLog } from './clientLog';

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
      const yes = await $(
        '-ios predicate string:label == "YES" OR name == "YES"'
      );
      await yes.waitForDisplayed({ timeout: 8000 });
      await yes.click();
      clientLog('Logged out from role picker');
      await LoginPage.waitForLoginScreen(25000);
      return;
    } catch (err) {
      console.log(`[Session] Role logout failed: ${String(err)}`);
    }
  }

  // Last resort: if login appears soon
  try {
    await LoginPage.waitForLoginScreen(8000);
  } catch {
    throw new Error(
      'Could not reach login screen. Logout from home (menu → LOGOUT) or reinstall the app.'
    );
  }
}

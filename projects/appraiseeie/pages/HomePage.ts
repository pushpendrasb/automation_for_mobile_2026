/**
 * Home / main app after selecting a role on LoginUserRoleVC.
 *
 * After first login the app often auto-opens SideMenuViewController —
 * do not tap Menu again (that would close it). Scroll to LOGOUT if needed.
 *
 * IDs are set in Objective-C/C++ viewDidLoad (not storyboard).
 */
import { TEST_IDS } from '../data/testIds';
import { clientLog } from '../helpers/clientLog';
import SideMenuPage from './SideMenuPage';

export class HomePage {
  private id(value: string): string {
    return `~${value}`;
  }

  private homeSelectors(): string[] {
    return [
      this.id(TEST_IDS.home.screen),
      this.id(TEST_IDS.home.menuButton),
      '-ios class chain:**/XCUIElementTypeSearchField',
      '-ios predicate string:type == "XCUIElementTypeSearchField"',
      '-ios predicate string:label CONTAINS[c] "historical appraisal"',
    ];
  }

  private menuSelectors(): string[] {
    return [
      this.id(TEST_IDS.home.menuButton),
      '~Menu',
      '-ios predicate string:label == "Menu" OR name == "Menu"',
    ];
  }

  /**
   * Wait until home is visible after role selection.
   * Also accepts auto-opened side menu as “reached home”.
   */
  async waitForHome(timeoutMs = 30000): Promise<void> {
    clientLog('Waiting for the home screen');
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
      if (await SideMenuPage.isOpen()) {
        clientLog('Home reached (side menu opened)');
        return;
      }

      for (const sel of this.homeSelectors()) {
        try {
          const el = await $(sel);
          if (
            (await el.isExisting().catch(() => false)) &&
            (await el.isDisplayed().catch(() => false))
          ) {
            clientLog('Home screen is ready');
            return;
          }
        } catch (err) {
          lastError = err;
        }
      }
      await browser.pause(300);
    }

    throw new Error(
      `Home screen not found after ${timeoutMs}ms. Tried: ${this.homeSelectors().join(' | ')}. Last error: ${String(lastError)}`
    );
  }

  /**
   * Whether home or auto-opened side menu is showing.
   */
  async isDisplayed(): Promise<boolean> {
    if (await SideMenuPage.isOpen()) return true;
    for (const sel of this.homeSelectors()) {
      try {
        const el = await $(sel);
        if (await el.isDisplayed()) return true;
      } catch {
        /* try next */
      }
    }
    return false;
  }

  /**
   * Ensure SideMenuViewController is open.
   * If already open (first-login auto-open), do not tap Menu again.
   */
  async openSideMenu(): Promise<void> {
    if (await SideMenuPage.isOpen()) {
      console.log('[Home] Side menu already open — skip menu tap');
      clientLog('Side menu is already open');
      return;
    }

    clientLog('Opening the side menu');
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      for (const sel of this.menuSelectors()) {
        try {
          const el = await $(sel);
          if (await el.isDisplayed().catch(() => false)) {
            await el.click();
            await SideMenuPage.waitForOpen(8000);
            clientLog('Side menu is open');
            return;
          }
        } catch {
          /* next */
        }
      }
      await browser.pause(200);
    }
    throw new Error('home_menu_button / Menu not found on home screen');
  }

  /**
   * From home (menu may already be open): scroll to LOGOUT → YES → login.
   */
  async logoutViaSideMenu(): Promise<void> {
    await this.openSideMenu();
    await SideMenuPage.logout();
  }
}

export default new HomePage();

/**
 * Left drawer — SideMenuViewController.
 *
 * After first login the menu often auto-opens. LOGOUT is the last row and is
 * usually clipped under the footer — we must swipe the table until it is
 * fully on screen, then tap it.
 */
import { TEST_IDS } from '../data/testIds';
import { clientLog } from '../helpers/clientLog';

export class SideMenuPage {
  private id(value: string): string {
    return `~${value}`;
  }

  private logoutSelectors(): string[] {
    return [
      this.id(TEST_IDS.sideMenu.logout),
      '~LOGOUT',
      '-ios predicate string:label == "LOGOUT" OR name == "LOGOUT"',
      '-ios class chain:**/XCUIElementTypeCell[`label == "LOGOUT" OR name == "LOGOUT"`]',
    ];
  }

  private openSelectors(): string[] {
    return [
      this.id(TEST_IDS.sideMenu.screen),
      this.id(TEST_IDS.sideMenu.table),
      '~CREATE NEW APPRAISAL',
      '~HOW TO USE',
      '~SETTINGS',
      '~SWITCH ACCOUNT',
      '-ios predicate string:label == "CREATE NEW APPRAISAL"',
      '-ios predicate string:label == "HOW TO USE"',
    ];
  }

  /**
   * True when SideMenuViewController drawer content is on screen.
   */
  async isOpen(): Promise<boolean> {
    for (const sel of this.openSelectors()) {
      try {
        const el = await $(sel);
        if (await el.isDisplayed().catch(() => false)) return true;
      } catch {
        /* next */
      }
    }
    return false;
  }

  /**
   * Wait until side menu is visible.
   */
  async waitForOpen(timeoutMs = 12000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isOpen()) return;
      await browser.pause(200);
    }
    throw new Error('Side menu (SideMenuViewController) did not open');
  }

  /**
   * Find LOGOUT element if it exists in the tree (may be clipped / off-screen).
   */
  private async findLogoutElement() {
    for (const sel of this.logoutSelectors()) {
      try {
        const el = await $(sel);
        if (await el.isExisting().catch(() => false)) {
          return el;
        }
      } catch {
        /* next */
      }
    }
    return null;
  }

  /**
   * LOGOUT must be fully above the footer (not just partially visible).
   * Partial cells at the bottom made isDisplayed() true and skipped scrolling before.
   */
  async isLogoutFullyVisible(): Promise<boolean> {
    const el = await this.findLogoutElement();
    if (!el) return false;

    try {
      if (!(await el.isDisplayed().catch(() => false))) return false;
      const loc = await el.getLocation();
      const size = await el.getSize();
      const { height } = await browser.getWindowSize();
      // Footer has logo + "Version …" — keep row above ~120pt from bottom
      const bottomLimit = height - 120;
      const topOk = loc.y >= 60;
      const bottomOk = loc.y + size.height <= bottomLimit;
      const tallEnough = size.height >= 20;
      return topOk && bottomOk && tallEnough;
    } catch {
      return false;
    }
  }

  /**
   * Resolve the side-menu UITableView (or any table) to scroll.
   */
  private async findMenuTable() {
    const selectors = [
      this.id(TEST_IDS.sideMenu.table),
      '-ios class chain:**/XCUIElementTypeTable',
      '-ios predicate string:type == "XCUIElementTypeTable"',
    ];
    for (const sel of selectors) {
      try {
        const el = await $(sel);
        if (await el.isDisplayed().catch(() => false)) {
          return el;
        }
      } catch {
        /* next */
      }
    }
    return null;
  }

  /**
   * Perform one upward finger swipe on the side-menu table (reveals rows below).
   */
  async swipeMenuUpOnce(): Promise<void> {
    const { width, height } = await browser.getWindowSize();
    let x = Math.floor(width * 0.3);
    let fromY = Math.floor(height * 0.72);
    let toY = Math.floor(height * 0.38);

    const table = await this.findMenuTable();
    if (table) {
      try {
        const loc = await table.getLocation();
        const size = await table.getSize();
        if (size.height > 80) {
          x = Math.round(loc.x + size.width * 0.5);
          fromY = Math.round(loc.y + size.height * 0.78);
          toY = Math.round(loc.y + size.height * 0.22);
        }
      } catch {
        /* use screen defaults */
      }
    }

    console.log(
      `[SideMenu] Swipe up on menu x=${x} fromY=${fromY} → toY=${toY}`
    );

    // 1) W3C pointer actions (most reliable on real devices)
    try {
      await browser
        .action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ duration: 0, x, y: fromY })
        .down({ button: 0 })
        .pause(120)
        .move({ duration: 550, x, y: toY })
        .up({ button: 0 })
        .perform();
      await browser.releaseActions().catch(() => undefined);
      return;
    } catch (err) {
      console.log(`[SideMenu] W3C swipe failed: ${String(err)}`);
    }

    // 2) Appium drag
    try {
      await browser.execute('mobile: dragFromToForDuration', {
        duration: 0.55,
        fromX: x,
        fromY,
        toX: x,
        toY,
      });
      return;
    } catch (err) {
      console.log(`[SideMenu] dragFromToForDuration failed: ${String(err)}`);
    }

    // 3) Scroll by name
    try {
      await browser.execute('mobile: scroll', {
        direction: 'down',
        name: 'LOGOUT',
      });
      return;
    } catch {
      /* fall through */
    }

    // 4) Screen swipe
    try {
      await browser.execute('mobile: swipe', {
        direction: 'up',
        velocity: 800,
      });
    } catch {
      await browser
        .execute('mobile: swipeGesture', {
          direction: 'up',
          percent: 0.7,
        })
        .catch(() => undefined);
    }
  }

  /**
   * Always scroll the side menu until LOGOUT is fully visible (not clipped).
   */
  async scrollUntilLogoutVisible(maxSwipes = 12): Promise<void> {
    // If HOW TO USE is on screen, LOGOUT is usually just below — force swipe(s)
    const howToUse = await $('~HOW TO USE').catch(() => null);
    const howVisible =
      howToUse && (await howToUse.isDisplayed().catch(() => false));

    if (howVisible || !(await this.isLogoutFullyVisible())) {
      console.log('[SideMenu] Scrolling side menu to reveal LOGOUT…');
      clientLog('Scrolling the side menu to find Logout');
    }

    for (let i = 0; i < maxSwipes; i++) {
      if (await this.isLogoutFullyVisible()) {
        console.log(`[SideMenu] LOGOUT fully visible after ${i} swipe(s)`);
        clientLog('Logout is visible in the side menu');
        return;
      }
      await this.swipeMenuUpOnce();
      await browser.pause(400);
    }

    // Last chance: element in tree but clipped — still try to proceed
    if (await this.findLogoutElement()) {
      console.log(
        '[SideMenu] LOGOUT in tree but may be clipped — will attempt click'
      );
      return;
    }

    throw new Error('LOGOUT not found in side menu after scrolling');
  }

  /**
   * Tap LOGOUT (scroll first — required after first-login auto-open).
   */
  async tapLogout(): Promise<void> {
    await this.scrollUntilLogoutVisible();

    for (const sel of this.logoutSelectors()) {
      try {
        const el = await $(sel);
        if (await el.isExisting().catch(() => false)) {
          // Prefer click; if clipped, scrollIntoView via tap after one more swipe
          if (!(await this.isLogoutFullyVisible())) {
            await this.swipeMenuUpOnce();
            await browser.pause(300);
          }
          await el.click();
          console.log(`[SideMenu] Tapped LOGOUT via ${sel}`);
          clientLog('Logout has been tapped');
          return;
        }
      } catch {
        /* next */
      }
    }
    throw new Error('Could not tap side_menu_logout / LOGOUT');
  }

  /**
   * Confirm logout alert (YES).
   */
  async confirmLogoutYes(): Promise<void> {
    const yes = await $(
      '-ios predicate string:label == "YES" OR name == "YES"'
    );
    await yes.waitForDisplayed({ timeout: 8000 });
    await yes.click();
    clientLog('Logout confirmed (YES)');
  }

  /**
   * Full logout: wait for menu → scroll to LOGOUT → tap → YES.
   */
  async logout(): Promise<void> {
    await this.waitForOpen();
    console.log('[SideMenu] Starting logout — will scroll to LOGOUT');
    clientLog('Logging out from the side menu');
    await this.tapLogout();
    await this.confirmLogoutYes();
  }
}

export default new SideMenuPage();

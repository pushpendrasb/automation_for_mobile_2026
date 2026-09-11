/**
 * Post-login user role picker — LoginUserRoleVC.
 *
 * After login (+ optional Not Now), tap index 0 quickly and go home.
 * IDs are set in LoginUserRoleVC.m only (not storyboard).
 */
import { TEST_IDS, userRoleCellId } from '../data/testIds';
import SystemAlertsPage from './SystemAlertsPage';

export class UserRolePage {
  private id(value: string): string {
    return `~${value}`;
  }

  private screenSelectors(): string[] {
    return [
      this.id(TEST_IDS.userRole.screen),
      this.id(TEST_IDS.userRole.logout),
      '~Logout',
      '-ios predicate string:label CONTAINS[c] "choose one of the below accounts"',
      '-ios predicate string:label CONTAINS[c] "Hi there"',
    ];
  }

  private tableSelectors(): string[] {
    return [
      this.id(TEST_IDS.userRole.table),
      '-ios class chain:**/XCUIElementTypeTable',
    ];
  }

  private cellSelectors(index: number): string[] {
    return [
      this.id(userRoleCellId(index)),
      `-ios class chain:**/XCUIElementTypeCell[${index + 1}]`,
    ];
  }

  /**
   * True when the first role cell (or given index) is on screen.
   */
  async isRoleCellVisible(index = 0): Promise<boolean> {
    for (const sel of this.cellSelectors(index)) {
      try {
        const el = await $(sel);
        if (
          (await el.isExisting().catch(() => false)) &&
          (await el.isDisplayed().catch(() => false))
        ) {
          return true;
        }
      } catch {
        /* next */
      }
    }
    const cells = await $$(`-ios class chain:**/XCUIElementTypeCell`).catch(
      () => []
    );
    if (cells.length > index) {
      return cells[index].isDisplayed().catch(() => false);
    }
    return false;
  }

  /**
   * Return the first selector that is displayed within the timeout budget.
   */
  private async findDisplayed(selectors: string[], timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
      for (const sel of selectors) {
        try {
          const el = await $(sel);
          const exists = await el.isExisting().catch(() => false);
          if (!exists) continue;
          const shown = await el.isDisplayed().catch(() => false);
          if (shown) return el;
        } catch (err) {
          lastError = err;
        }
      }
      await browser.pause(200);
    }

    throw new Error(
      `Role screen control not found after ${timeoutMs}ms. Tried: ${selectors.join(' | ')}. Last error: ${String(lastError)}`
    );
  }

  /**
   * Wait for LoginUserRoleVC (role list) after a successful login.
   */
  async waitForRoleScreen(timeoutMs = 20000): Promise<void> {
    await this.findDisplayed(this.screenSelectors(), timeoutMs);
  }

  /**
   * Assert role table / first cell is visible.
   */
  async assertRoleTableVisible(): Promise<void> {
    await this.waitForRoleScreen(15000);
    await this.findDisplayed(
      [this.id(userRoleCellId(0)), ...this.tableSelectors()],
      10000
    );
  }

  /**
   * After login: dismiss Not Now if it appears, then tap role cell ASAP.
   * Does not wait the full Not Now timeout if the role list is already ready.
   */
  async dismissNotNowAndSelectRole(index: number, timeoutMs = 25000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let dismissedNotNow = false;

    while (Date.now() < deadline) {
      // 1) Clear Save Password sheet quickly if present
      if (!dismissedNotNow) {
        dismissedNotNow = await SystemAlertsPage.tapNotNowIfVisible();
      }

      // 2) Tap first cell as soon as it is visible
      if (await this.tryClickRoleAtIndex(index)) {
        return;
      }

      await browser.pause(150);
    }

    throw new Error(
      `Could not tap role cell at index ${index} after login/Not Now. Expected ~${userRoleCellId(index)}.`
    );
  }

  /**
   * One attempt to click the role row; returns true if clicked.
   */
  private async tryClickRoleAtIndex(index: number): Promise<boolean> {
    const byId = this.id(userRoleCellId(index));
    try {
      const cell = await $(byId);
      if (await cell.isDisplayed().catch(() => false)) {
        await cell.click();
        return true;
      }
    } catch {
      /* fall through */
    }

    const cells = await $$(`-ios class chain:**/XCUIElementTypeCell`).catch(
      () => []
    );
    if (cells.length > index) {
      const shown = await cells[index].isDisplayed().catch(() => false);
      if (shown) {
        await cells[index].click();
        return true;
      }
    }

    try {
      const all = await $$(
        `-ios predicate string:type == "XCUIElementTypeCell" AND label CONTAINS[c] "ROLE"`
      );
      if (
        all.length > index &&
        (await all[index].isDisplayed().catch(() => false))
      ) {
        await all[index].click();
        return true;
      }
    } catch {
      /* ignore */
    }

    return false;
  }

  /**
   * Tap a dealer/role row by zero-based index (0 = first card).
   */
  async selectRoleAtIndex(index: number): Promise<void> {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      // Clear Not Now if it still covers the list
      await SystemAlertsPage.tapNotNowIfVisible();
      if (await this.tryClickRoleAtIndex(index)) {
        return;
      }
      await browser.pause(150);
    }

    throw new Error(
      `Could not tap role cell at index ${index}. Expected ~${userRoleCellId(index)} on LoginUserRoleVC.`
    );
  }

  /**
   * True when the role screen is showing.
   */
  async isDisplayed(): Promise<boolean> {
    for (const sel of this.screenSelectors()) {
      try {
        const screen = await $(sel);
        if (await screen.isDisplayed()) return true;
      } catch {
        /* try next */
      }
    }
    return false;
  }

  /**
   * True when LoginUserRoleVC is no longer visible (navigated to home).
   */
  async isRoleScreenGone(timeoutMs = 20000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!(await this.isDisplayed())) return true;
      await browser.pause(250);
    }
    return false;
  }
}

export default new UserRolePage();

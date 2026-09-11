/**
 * Optional iOS system / password sheets that can appear after login.
 * If the popup is missing, methods return immediately (no failure).
 */
export class SystemAlertsPage {
  /**
   * Labels for the dismiss control on Save Password / similar sheets.
   */
  private notNowSelectors(): string[] {
    return [
      '~Not Now',
      '-ios predicate string:label == "Not Now" OR name == "Not Now"',
      '-ios class chain:**/XCUIElementTypeButton[`label == "Not Now" OR name == "Not Now"`]',
    ];
  }

  /**
   * Quick check — does Not Now exist right now?
   */
  async isNotNowVisible(): Promise<boolean> {
    for (const sel of this.notNowSelectors()) {
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
    return false;
  }

  /**
   * Tap Not Now once if visible. No waiting.
   */
  async tapNotNowIfVisible(): Promise<boolean> {
    for (const sel of this.notNowSelectors()) {
      try {
        const el = await $(sel);
        if (
          !(await el.isExisting().catch(() => false)) ||
          !(await el.isDisplayed().catch(() => false))
        ) {
          continue;
        }
        await el.click();
        console.log('[SystemAlerts] Tapped "Not Now"');
        await browser.pause(200);
        return true;
      } catch {
        /* next */
      }
    }
    return false;
  }

  /**
   * Poll briefly for "Not Now". Stops early if `shouldStop` returns true
   * (e.g. role cell already visible) so we do not burn the full timeout.
   *
   * @returns true when Not Now was tapped
   */
  async dismissNotNowIfPresent(
    timeoutMs = 2500,
    shouldStop?: () => Promise<boolean>
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (shouldStop && (await shouldStop().catch(() => false))) {
        return false;
      }
      if (await this.tapNotNowIfVisible()) {
        return true;
      }
      await browser.pause(150);
    }

    return false;
  }
}

export default new SystemAlertsPage();

/**
 * Shared Appium helpers for VetPortal (iOS XCUITest + Android UiAutomator2).
 * React Native `testID` → iOS accessibilityIdentifier (`name`), Android resource-id.
 */
class Ui {
  isAndroid() {
    return String(browser.capabilities.platformName || '').toLowerCase() === 'android';
  }

  escape(text) {
    return String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  testIdSelector(id) {
    const e = this.escape(id);
    if (this.isAndroid()) {
      return `android=new UiSelector().resourceId("${e}")`;
    }
    return `-ios predicate string:name == "${e}"`;
  }

  exactTextSelector(text) {
    const e = this.escape(text);
    if (this.isAndroid()) {
      return `android=new UiSelector().text("${e}")`;
    }
    return `-ios predicate string:label == "${e}" OR name == "${e}"`;
  }

  containsTextSelector(text) {
    const e = this.escape(text);
    if (this.isAndroid()) {
      return `android=new UiSelector().textContains("${e}")`;
    }
    return `-ios predicate string:label CONTAINS[c] "${e}" OR name CONTAINS[c] "${e}"`;
  }

  /**
   * First displayed match, or null. `$$` = one Appium round-trip when nothing matches.
   * @param {string} selector
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async firstDisplayed(selector) {
    try {
      const els = await $$(selector);
      for (const el of els) {
        if (await el.isDisplayed().catch(() => false)) {
          return el;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  async byTestId(id) {
    return this.firstDisplayed(this.testIdSelector(id));
  }

  async isTestIdShown(id) {
    return Boolean(await this.byTestId(id));
  }

  async waitFor(selector, timeout = 15000, what = selector) {
    let el = null;
    await browser.waitUntil(
      async () => {
        el = await this.firstDisplayed(selector);
        return Boolean(el);
      },
      { timeout, interval: 300, timeoutMsg: `${what} not displayed after ${timeout}ms` },
    );
    return el;
  }

  async waitForTestId(id, timeout = 15000) {
    return this.waitFor(this.testIdSelector(id), timeout, `testID "${id}"`);
  }

  async tapTestId(id, timeout = 15000) {
    const el = await this.waitForTestId(id, timeout);
    await el.click();
  }

  /**
   * The area of the screen a field can be typed into: below `topId` (e.g. the
   * header's back button) and above both the keyboard and any fixed overlay in
   * `coverIds` (e.g. the bottom "Register Now" bar). iOS reports a field hidden
   * behind those as "displayed", so isDisplayed() alone is not enough.
   * @returns {Promise<{ top: number, bottom: number, width: number }>}
   */
  async usableArea({ topId, coverIds = [] } = {}) {
    const { width, height } = await browser.getWindowSize();
    let top = Math.round(height * 0.1);
    let bottom = height;

    if (topId) {
      const header = await this.byTestId(topId);
      if (header) {
        const [loc, size] = await Promise.all([header.getLocation(), header.getSize()]);
        top = Math.round(loc.y + size.height + 8);
      }
    }
    // Close the keyboard first: its "Done / Next" accessory bar sits above the
    // keyboard frame, and a drag that starts on it does not scroll the form.
    await this.dismissKeyboard({ x: 10, y: top + 12 });
    if (await this.isKeyboardShown()) {
      const kb = await $$('-ios class chain:**/XCUIElementTypeKeyboard');
      if (kb.length) {
        // Leave room for the accessory bar + "Next" bubble above the keys.
        bottom = Math.min(bottom, Math.round((await kb[0].getLocation()).y) - 130);
      }
    }
    for (const id of coverIds) {
      const cover = await this.byTestId(id);
      if (cover) {
        bottom = Math.min(bottom, Math.round((await cover.getLocation()).y));
      }
    }
    return { top, bottom, width };
  }

  /**
   * Scroll until the testID sits fully inside the usable area, then return it.
   * Field below the area (e.g. under the keyboard / Register Now) → drag content up;
   * above it (under the header) → drag content down. Small, slow drags so the
   * form does not fling past the field.
   * @param {string} id
   * @param {{ topId?: string, coverIds?: string[], maxSwipes?: number }} [opts]
   */
  async scrollToTestId(id, { topId, coverIds = [], maxSwipes = 15 } = {}) {
    for (let i = 0; i <= maxSwipes; i++) {
      const area = await this.usableArea({ topId, coverIds });
      // Use $$ without a displayed filter: iOS still reports frames of off-screen fields.
      const el = (await $$(this.testIdSelector(id)))[0];
      let rect = null;
      if (el && (await el.isExisting().catch(() => false))) {
        const [loc, size] = await Promise.all([el.getLocation(), el.getSize()]);
        rect = { top: loc.y, bottom: loc.y + size.height };
      }

      if (rect && rect.top >= area.top && rect.bottom <= area.bottom) {
        return el;
      }
      if (i === maxSwipes) {
        break;
      }

      const room = area.bottom - area.top;
      const maxDrag = Math.max(60, Math.round(room * 0.75));
      if (!rect || rect.bottom > area.bottom) {
        // Not rendered yet (Android) or below the area → reveal content further down.
        const needed = rect ? rect.bottom - area.bottom + 60 : maxDrag;
        await this.#drag(area, -Math.min(needed, maxDrag));
      } else {
        const needed = area.top - rect.top + 60;
        await this.#drag(area, Math.min(needed, maxDrag));
      }
      console.log(
        `[scroll] ${id}: ${rect ? `at y=${Math.round(rect.top)}–${Math.round(rect.bottom)}` : 'not rendered'}, ` +
          `clear area y=${area.top}–${area.bottom} → drag ${i + 1}/${maxSwipes}`,
      );
    }
    throw new Error(`Could not scroll testID "${id}" clear of the header / keyboard / bottom button`);
  }

  /**
   * Slow drag inside the usable area, along the blank left margin.
   * Negative dy moves content up (reveals what is below).
   */
  async #drag(area, dy) {
    // Blank left margin (inputs start ~24pt in): a drag that starts on a
    // TextInput barely scrolls the form.
    const x = 10;
    const fromY = dy < 0 ? area.bottom - 20 : area.top + 20;
    const toY = fromY + dy;
    await browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x, y: fromY })
      .down()
      .pause(150)
      .move({ x, y: toY, duration: 700 })
      .pause(250)
      .up()
      .perform();
    await browser.pause(400);
  }

  /**
   * Wait until an element stops moving (screen push/slide animation finished),
   * so a tap lands where the element really is.
   */
  async waitForStable(el, timeout = 3000) {
    const deadline = Date.now() + timeout;
    let last = null;
    while (Date.now() < deadline) {
      const loc = await el.getLocation().catch(() => null);
      const key = loc ? `${Math.round(loc.x)},${Math.round(loc.y)}` : null;
      if (key && key === last) {
        return;
      }
      last = key;
      await browser.pause(250);
    }
  }

  /** Save the current accessibility tree next to the report — for diagnosing "element not found". */
  async dumpPageSource(name) {
    try {
      const fs = require('fs');
      const path = require('path');
      const project = require('../project.config');
      const file = path.join(project.reportsDir, `${name}-${Date.now()}-source.xml`);
      fs.mkdirSync(project.reportsDir, { recursive: true });
      fs.writeFileSync(file, await browser.getPageSource());
      console.log(`[debug] Page source saved: ${file}`);
    } catch (err) {
      console.log(`[debug] Could not save page source: ${err.message}`);
    }
  }

  /**
   * iOS: tap the keyboard accessory "Done" if exposed, else tap `blankPoint` —
   * an empty spot in the form (RN keyboardShouldPersistTaps="handled" closes the
   * keyboard on a tap that no control handles). Never `mobile: hideKeyboard`:
   * on this app it fails and takes the WDA session down with it.
   * Android: hideKeyboard.
   * @param {{ x: number, y: number }} [blankPoint]
   */
  async dismissKeyboard(blankPoint) {
    if (!(await this.isKeyboardShown())) {
      return;
    }
    if (this.isAndroid()) {
      await browser.hideKeyboard().catch(() => {});
    } else {
      const done = await this.firstDisplayed('-ios predicate string:label == "Done" OR name == "Done"');
      if (done) {
        await done.click().catch(() => {});
      } else if (blankPoint) {
        await this.tapAt(blankPoint.x, blankPoint.y);
      }
    }
    await browser.pause(500);
  }

  async tapAt(x, y) {
    await browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(x), y: Math.round(y) })
      .down()
      .pause(80)
      .up()
      .perform();
  }

  async isKeyboardShown() {
    try {
      return await browser.isKeyboardShown();
    } catch {
      return false;
    }
  }
}

module.exports = { ui: new Ui() };

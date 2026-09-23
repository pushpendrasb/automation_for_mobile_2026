/**
 * Shared Appium helpers for VetPortal (iOS XCUITest + Android UiAutomator2).
 * React Native `testID` → iOS accessibilityIdentifier (`name`), Android resource-id.
 */
class Ui {
  /**
   * Fixed geometry of the current screen (window size, header bottom, bottom
   * bars), keyed by the topId/coverIds used to measure it. These do not move
   * while the form scrolls, so measuring them before every field only costs
   * Appium round-trips. Clear with resetLayoutCache() when a new screen opens.
   * @type {Map<string, { top: number, bottom: number, width: number }>}
   */
  #layout = new Map();

  /** Forget cached screen geometry (call after navigating to another screen). */
  resetLayoutCache() {
    this.#layout.clear();
  }

  /**
   * Element frame in one Appium call (getLocation() + getSize() are two).
   * @param {WebdriverIO.Element} el
   * @returns {Promise<{ x: number, y: number, width: number, height: number }>}
   */
  async rectOf(el) {
    return browser.getElementRect(el.elementId);
  }

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
   * Header bottom / bottom-bar top / window width for this screen, measured
   * once and cached. Not cached if the header or a bar was not found yet
   * (screen still loading), so a half-rendered screen is re-measured.
   * @returns {Promise<{ top: number, bottom: number, width: number }>}
   */
  async #staticArea({ topId, coverIds }) {
    const key = `${topId || ''}|${coverIds.join(',')}`;
    const cached = this.#layout.get(key);
    if (cached) {
      return cached;
    }
    const { width, height } = await browser.getWindowSize();
    let top = Math.round(height * 0.1);
    let bottom = height;
    let complete = true;

    if (topId) {
      const header = await this.byTestId(topId);
      if (header) {
        const r = await this.rectOf(header);
        top = Math.round(r.y + r.height + 8);
      } else {
        complete = false;
      }
    }
    for (const id of coverIds) {
      const cover = await this.byTestId(id);
      if (cover) {
        bottom = Math.min(bottom, Math.round((await this.rectOf(cover)).y));
      } else {
        complete = false;
      }
    }
    const area = { top, bottom, width };
    if (complete) {
      this.#layout.set(key, area);
    }
    return area;
  }

  /**
   * iOS keyboard top edge (y). Measured every time, not cached: the height
   * differs per keyboard type (e.g. the mobile field's number pad is taller
   * than the letters keyboard).
   * @returns {Promise<number|null>} null when the keyboard frame is not exposed
   */
  async #keyboardTopY() {
    const kb = await $$('-ios class chain:**/XCUIElementTypeKeyboard');
    if (!kb.length) {
      return null;
    }
    return Math.round((await this.rectOf(kb[0])).y);
  }

  /**
   * The area of the screen a field can be typed into: below `topId` (e.g. the
   * header's back button) and above both the keyboard and any fixed overlay in
   * `coverIds` (e.g. the bottom "Register Now" bar). iOS reports a field hidden
   * behind those as "displayed", so isDisplayed() alone is not enough.
   *
   * keepKeyboard: iOS only — measure above an open keyboard instead of closing
   * it. Closing costs ~2s per field, and is only needed before a drag (a drag
   * that starts on the keyboard's accessory bar does not scroll the form).
   *
   * typeLimit (only with keepKeyboard + keyboard up): lowest y a field's
   * centre may sit at and still be typed into — the tap that focuses it must
   * not land on the keys. 50pt above the reported keyboard top, because the
   * reported frame leaves out the suggestion bar above the keys.
   * @param {{ topId?: string, coverIds?: string[], keepKeyboard?: boolean }} [opts]
   * @returns {Promise<{ top: number, bottom: number, width: number, keyboardShown: boolean, typeLimit: number|null }>}
   */
  async usableArea({ topId, coverIds = [], keepKeyboard = false } = {}) {
    const base = await this.#staticArea({ topId, coverIds });
    let bottom = base.bottom;
    let typeLimit = null;
    let keyboardShown = await this.isKeyboardShown();

    if (keyboardShown && !(keepKeyboard && !this.isAndroid())) {
      await this.dismissKeyboard({ x: 10, y: base.top + 12 });
      keyboardShown = await this.isKeyboardShown();
    }
    if (keyboardShown && !this.isAndroid()) {
      const kbTop = await this.#keyboardTopY();
      if (kbTop != null) {
        // Leave room for the accessory bar + "Next" bubble above the keys.
        bottom = Math.min(bottom, kbTop - 130);
        if (keepKeyboard) {
          typeLimit = kbTop - 50;
        }
      }
    }
    return { ...base, bottom, keyboardShown, typeLimit };
  }

  /**
   * Scroll until the testID sits fully inside the usable area, then return it.
   * Field below the area (e.g. under the keyboard / Register Now) → drag content up;
   * above it (under the header) → drag content down. Drags end with a hold so
   * the form does not fling past the field.
   *
   * Fast path: if the field is already clear of an open keyboard it is returned
   * without closing the keyboard or scrolling. The keyboard is only closed when
   * a drag is actually needed. Pass keepKeyboard: false to always close it
   * first (e.g. when retrying after typing did not reach the field).
   * @param {string} id
   * @param {{ topId?: string, coverIds?: string[], maxSwipes?: number, keepKeyboard?: boolean }} [opts]
   */
  async scrollToTestId(id, { topId, coverIds = [], maxSwipes = 15, keepKeyboard = true } = {}) {
    for (let i = 0; i <= maxSwipes; ) {
      const area = await this.usableArea({ topId, coverIds, keepKeyboard });
      // Use $$ without a displayed filter: iOS still reports frames of off-screen fields.
      const el = (await $$(this.testIdSelector(id)))[0];
      let rect = null;
      if (el) {
        const r = await this.rectOf(el).catch(() => null);
        rect = r ? { top: r.y, bottom: r.y + r.height } : null;
      }

      const clear =
        rect &&
        rect.top >= area.top &&
        (area.typeLimit != null
          ? (rect.top + rect.bottom) / 2 <= area.typeLimit
          : rect.bottom <= area.bottom);
      if (clear) {
        return el;
      }
      if (area.keyboardShown && keepKeyboard) {
        // Not clear of the keyboard — close it and re-measure before dragging.
        keepKeyboard = false;
        continue;
      }
      if (i === maxSwipes) {
        break;
      }
      i++;

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
          `clear area y=${area.top}–${area.bottom} → drag ${i}/${maxSwipes}`,
      );
    }
    throw new Error(`Could not scroll testID "${id}" clear of the header / keyboard / bottom button`);
  }

  /**
   * Drag inside the usable area, along the blank left margin.
   * Negative dy moves content up (reveals what is below). The hold before
   * lifting the finger stops iOS momentum, so the move itself can be quick.
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
      .pause(100)
      .move({ x, y: toY, duration: 400 })
      .pause(200)
      .up()
      .perform();
    await browser.pause(200);
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
    await this.#waitKeyboardGone();
  }

  /**
   * Poll until the keyboard is down (max 1s), then give its slide-out
   * animation a moment so field positions measured next are final.
   */
  async #waitKeyboardGone(timeout = 1000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline && (await this.isKeyboardShown())) {
      await browser.pause(100);
    }
    await browser.pause(150);
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

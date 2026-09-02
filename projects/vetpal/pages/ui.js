/**
 * Shared Appium helpers for Vet-Pal (iOS XCUITest + Android UiAutomator2).
 * No testIDs on Request Treatment screens — selectors use visible text /
 * placeholderValue. XPath is a last resort.
 */
const path = require('path');
const fs = require('fs');

class Ui {
  isAndroid() {
    const name = String(browser.capabilities.platformName || '').toLowerCase();
    return name === 'android';
  }

  escape(text) {
    return String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  async isShown(el) {
    try {
      return (await el.isExisting()) && (await el.isDisplayed());
    } catch {
      return false;
    }
  }

  async byExactText(text) {
    const label = this.escape(text);
    if (this.isAndroid()) {
      return $(`android=new UiSelector().text("${label}")`);
    }
    return $(
      `-ios predicate string:label == "${label}" OR name == "${label}"`,
    );
  }

  async byContainsText(text) {
    const label = this.escape(text);
    if (this.isAndroid()) {
      return $(`android=new UiSelector().textContains("${label}")`);
    }
    return $(
      `-ios predicate string:label CONTAINS[c] "${label}" OR name CONTAINS[c] "${label}"`,
    );
  }

  async allByContainsText(text) {
    const label = this.escape(text);
    if (this.isAndroid()) {
      return $$(`android=new UiSelector().textContains("${label}")`);
    }
    return $$(
      `-ios predicate string:label CONTAINS[c] "${label}" OR name CONTAINS[c] "${label}"`,
    );
  }

  async byPlaceholder(placeholder) {
    const label = this.escape(placeholder);
    if (this.isAndroid()) {
      return $(
        `android=new UiSelector().text("${label}")`,
      );
    }
    return $(
      `-ios predicate string:placeholderValue == "${label}" OR value == "${label}"`,
    );
  }

  async waitVisible(finder, timeout = 20000, timeoutMsg) {
    let last;
    await browser.waitUntil(
      async () => {
        last = typeof finder === 'function' ? await finder() : finder;
        return this.isShown(last);
      },
      {
        timeout,
        interval: 400,
        timeoutMsg: timeoutMsg || 'Element not visible',
      },
    );
    return last;
  }

  async tap(el) {
    try {
      const loc = await el.getLocation();
      const size = await el.getSize();
      await this.tapAt(loc.x + size.width / 2, loc.y + size.height / 2);
    } catch {
      await el.click();
    }
  }

  /**
   * First displayed match. Uses `$$` once (no findElement error round-trip).
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

  /**
   * Poll until `check` is true. Returns false on timeout (does not throw).
   * Use after opening/closing RN sheets so the next popup starts as soon as
   * this one is ready — not after a fixed sleep.
   * @param {() => Promise<boolean>} check
   * @param {number} [timeout=1600] max wait in ms
   * @param {number} [interval=40] poll interval in ms
   * @returns {Promise<boolean>}
   */
  async waitTrue(check, timeout = 1600, interval = 40) {
    const start = Date.now();
    if (await check()) {
      return true;
    }
    while (Date.now() - start < timeout) {
      await browser.pause(interval);
      if (await check()) {
        return true;
      }
    }
    return false;
  }

  async anyDisplayed(selector) {
    return Boolean(await this.firstDisplayed(selector));
  }

  /**
   * Finger tap at screen coordinates. Same path as LoginPage (mobile: tap).
   * @param {number} x
   * @param {number} y
   */
  async tapAt(x, y) {
    const px = Math.round(x);
    const py = Math.round(y);
    try {
      await browser.execute('mobile: tap', { x: px, y: py });
      return;
    } catch {
      await this.pressAt(px, py);
    }
  }

  /**
   * Touch down/up — RN TouchableOpacity inside react-native-modal often
   * ignores `mobile: tap` coordinates.
   * @param {number} x
   * @param {number} y
   */
  async pressAt(x, y) {
    const px = Math.round(x);
    const py = Math.round(y);
    await browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ duration: 0, x: px, y: py })
      .down()
      .pause(40)
      .up()
      .perform();
    await browser.releaseActions().catch(() => {});
  }

  /**
   * Press an element's center (click, then W3C touch).
   * @param {WebdriverIO.Element} el
   */
  async press(el) {
    const loc = await el.getLocation();
    const size = await el.getSize();
    const x = loc.x + size.width / 2;
    const y = loc.y + size.height / 2;
    try {
      await el.click();
    } catch {
      // fall through
    }
    try {
      await browser.execute('mobile: tap', {
        elementId: el.elementId,
        x: Math.round(size.width / 2),
        y: Math.round(size.height / 2),
      });
    } catch {
      await this.pressAt(x, y);
    }
  }

  /**
   * NSPredicate strings cannot include `/` — WDA treats it as a path and the
   * first match becomes the full-screen Application (rect 0,0 × window).
   * @param {string} text
   */
  iosQueryText(text) {
    const trimmed = String(text).trim();
    if (trimmed.includes('/')) {
      return trimmed.split('/')[0].trim();
    }
    return trimmed;
  }

  /**
   * Skip Application / Window nodes. XCUITest CONTAINS often returns those
   * first (full device rect, e.g. 430×932) instead of the visible caption.
   * @param {WebdriverIO.Element} el
   */
  async isUsableCaption(el) {
    if (!(await this.isShown(el))) {
      return false;
    }
    try {
      const size = await el.getSize();
      const { width, height } = await browser.getWindowSize();
      if (size.width >= width * 0.85 && size.height >= height * 0.5) {
        return false;
      }
      if (size.width < 4 || size.height < 4) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Visible XCUIElementTypeStaticText / TextView with this exact label.
   * Home.js uses ` {item.title}` (leading space), so "Request" and " Request"
   * are both tried. Picks the top-left match (first dashboard tile).
   * @param {string} text
   */
  async firstCaption(text) {
    const variants = [text, ` ${text}`];
    const found = [];
    for (const variant of variants) {
      const e = this.escape(variant);
      try {
        const els = this.isAndroid()
          ? await $$(
              `android=new UiSelector().className("android.widget.TextView").text("${e}")`,
            )
          : await $$(
              `-ios predicate string:type == "XCUIElementTypeStaticText" AND (label == "${e}" OR name == "${e}" OR value == "${e}")`,
            );
        found.push(...els);
      } catch {
        // ignore
      }
    }
    return this.#topLeftUsable(found);
  }

  /**
   * Visible StaticText whose label contains `text` (slash-safe on iOS).
   * @param {string} text
   */
  async firstCaptionContains(text) {
    const query = this.iosQueryText(text);
    const e = this.escape(query);
    let els = [];
    try {
      els = this.isAndroid()
        ? await $$(
            `android=new UiSelector().className("android.widget.TextView").textContains("${e}")`,
          )
        : await $$(
            `-ios predicate string:type == "XCUIElementTypeStaticText" AND (label CONTAINS[c] "${e}" OR name CONTAINS[c] "${e}")`,
          );
    } catch {
      els = [];
    }
    return this.#topLeftUsable(els);
  }

  /**
   * Visible node whose label/name contains `text`, excluding the full-screen
   * Application. Used when RN groups Text inside TouchableOpacity (no StaticText).
   * @param {string} text
   */
  async firstUsableContains(text) {
    const query = this.iosQueryText(text);
    const e = this.escape(query);
    let els = [];
    try {
      els = this.isAndroid()
        ? await $$(`android=new UiSelector().textContains("${e}")`)
        : await $$(
            `-ios predicate string:(label CONTAINS[c] "${e}" OR name CONTAINS[c] "${e}") AND type != XCUIElementTypeApplication AND type != XCUIElementTypeWindow`,
          );
    } catch {
      els = [];
    }
    return this.#topLeftUsable(els);
  }

  /**
   * True when a real caption (not the full-screen Application) shows any string.
   * @param {string[]} texts
   */
  async anyTextVisible(texts) {
    const needles = (texts || []).map(t => String(t).trim()).filter(Boolean);
    for (const text of needles) {
      if (await this.firstCaption(text)) {
        return true;
      }
      if (await this.firstCaptionContains(text)) {
        return true;
      }
      if (await this.firstUsableContains(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Tap Home first tile (Request / Treatment) using Home.js layout only.
   *
   * Tile labels are not in the iOS tree (TouchableOpacity groups them).
   * Do not enumerate Image/Button nodes — that is what made the tap slow.
   *
   * Home.js: itemWidth = SCREEN_WIDTH/2 - 10, itemHeight = itemWidth * 1.16,
   * header 64, FlatList paddingTop 10, left column.
   */
  async tapDashboardTile() {
    await this.tapFirstDashboardTileByGrid();
  }

  /**
   * @param {number} [yFactor=0.40] Position inside the tile (illustration, not caption)
   */
  async tapFirstDashboardTileByGrid(yFactor = 0.4) {
    const { width, height } = await browser.getWindowSize();
    const tileW = width / 2.0 - 10;
    const tileH = tileW * 1.16;
    const originY = Math.round(Math.min(height * 0.145, 136));
    const x = Math.round(10 + tileW / 2);
    const y = Math.round(originY + tileH * yFactor);
    this.log('UI', `Tap Request Treatment tile at ${x},${y}`);
    await this.tapAt(x, y);
  }

  /**
   * Pending Prescriptions bottom CTA — full-width bar (MyPrescriptions.js).
   */
  async tapRequestVetAdviceButton() {
    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width / 2);
    const y = Math.round(height * 0.93);
    this.log('UI', `Tap Request Vet Advice/Treatment at ${x},${y}`);
    await this.tapAt(x, y);
  }

  /**
   * Choose a Provider option card (Pressable). Title is grouped with subtitle,
   * so exact "Vet Practice" is not in the tree. Prefer CONTAINS on a non-fullscreen
   * node; otherwise tap below the "Choose a Provider" header.
   * @param {string} title "Vet Practice" | "Nearby Remedy Store"
   */
  async tapProviderOption(title) {
    const { width, height } = await browser.getWindowSize();
    const card = await this.firstUsableContains(title);
    if (card) {
      const loc = await card.getLocation();
      const size = await card.getSize();
      const isCard =
        size.width < width * 0.95 && size.height < height * 0.35;
      if (isCard) {
        this.log(
          'UI',
          `Tap provider "${title}" ${Math.round(size.width)}x${Math.round(size.height)} @ ${Math.round(loc.x)},${Math.round(loc.y)}`,
        );
        await this.tapAt(loc.x + size.width / 2, loc.y + size.height / 2);
        return;
      }
    }

    const header = await this.firstDisplayed(
      this.isAndroid()
        ? 'android=new UiSelector().text("Choose a Provider")'
        : '-ios predicate string:label == "Choose a Provider" OR name == "Choose a Provider"',
    );
    if (!header) {
      throw new Error(`Provider option "${title}" not found`);
    }
    const loc = await header.getLocation();
    const size = await header.getSize();
    const x = Math.round(width / 2);
    const belowHeader = loc.y + size.height;
    const y = Math.round(
      title === 'Nearby Remedy Store' ? belowHeader + 175 : belowHeader + 95,
    );
    this.log('UI', `Tap provider "${title}" below header at ${x},${y}`);
    await this.tapAt(x, y);
  }

  /**
   * Pending Prescriptions header (MyPrescriptions.js) — one snapshot.
   */
  pendingPrescriptionsSelector() {
    if (this.isAndroid()) {
      return 'android=new UiSelector().textContains("Pending Prescriptions")';
    }
    return '-ios predicate string:label == "Pending Prescriptions" OR name == "Pending Prescriptions"';
  }

  /**
   * Dismiss iOS permission / SpringBoard alerts that block dashboard taps
   * (Home.js calls messaging().requestPermission() on mount).
   */
  async dismissSystemAlerts() {
    if (this.isAndroid()) {
      return;
    }
    const labels = ['Don’t Allow', "Don't Allow", 'Allow', 'OK', 'Close'];
    for (const label of labels) {
      try {
        const els = await $$(
          `-ios predicate string:label == "${this.escape(label)}" OR name == "${this.escape(label)}"`,
        );
        for (const el of els) {
          if (await this.isShown(el)) {
            this.log('UI', `Dismissing system alert via "${label}"`);
            await el.click().catch(() => this.tap(el));
            await browser.pause(250);
            return;
          }
        }
      } catch {
        // no alert
      }
    }
  }

  /**
   * Top-left displayed caption that is not the full-screen Application node.
   * @param {WebdriverIO.ElementArray|WebdriverIO.Element[]} els
   */
  async #topLeftUsable(els) {
    let best = null;
    let bestKey = Number.POSITIVE_INFINITY;
    for (const el of els || []) {
      if (!(await this.isUsableCaption(el))) {
        continue;
      }
      try {
        const loc = await el.getLocation();
        const key = loc.y * 10000 + loc.x;
        if (key < bestKey) {
          best = el;
          bestKey = key;
        }
      } catch {
        // ignore
      }
    }
    return best;
  }

  async tapText(text, timeout = 15000) {
    const el = await this.waitVisible(
      () => this.byExactText(text),
      timeout,
      `"${text}" not visible`,
    );
    await this.tap(el);
  }

  async tapContains(text, timeout = 15000) {
    let el = null;
    await browser.waitUntil(
      async () => {
        el =
          (await this.firstCaption(text)) ||
          (await this.firstCaptionContains(text)) ||
          (await this.firstUsableContains(text));
        return Boolean(el);
      },
      {
        timeout,
        interval: 300,
        timeoutMsg: `Text containing "${text}" not visible`,
      },
    );
    const loc = await el.getLocation();
    const size = await el.getSize();
    this.log(
      'UI',
      `tapContains "${text}" ${Math.round(size.width)}x${Math.round(size.height)} @ ${Math.round(loc.x)},${Math.round(loc.y)}`,
    );
    await this.tapAt(loc.x + size.width / 2, loc.y + size.height / 2);
  }

  async typeInto(el, text) {
    await this.tap(el);
    await browser.pause(120);
    const value = String(text);
    if (this.isAndroid()) {
      await el.clearValue().catch(() => {});
      await el.addValue(value);
      return;
    }
    try {
      await browser.execute('mobile: type', { text: value });
    } catch {
      for (const ch of value) {
        await browser.keys([ch]);
        await browser.pause(8);
      }
    }
    await browser.pause(80);
  }

  /**
   * KeyboardToolbar.Done (App.js) — blue "Done" on the bar above the keyboard.
   * Tap the lowest on-screen "Done", then the trailing accessory strip until
   * the keyboard is actually gone. Do not tap mid-screen (that refocuses a field).
   */
  async dismissKeyboard() {
    if (this.isAndroid()) {
      try {
        await browser.hideKeyboard();
      } catch {
        // ignore
      }
      return;
    }

    try {
      if (!(await browser.isKeyboardShown())) {
        return;
      }
    } catch {
      // continue
    }

    try {
      await browser.execute('mobile: hideKeyboard');
      await browser.pause(200);
      if (!(await browser.isKeyboardShown().catch(() => false))) {
        return;
      }
    } catch {
      // fall through
    }

    const done = await this.#lowestDone();
    if (done) {
      this.log('UI', 'Tap keyboard Done');
      const loc = await done.getLocation();
      const size = await done.getSize();
      await this.pressAt(loc.x + size.width / 2, loc.y + size.height / 2);
      await browser.pause(250);
      if (!(await browser.isKeyboardShown().catch(() => false))) {
        return;
      }
    }

    const { width, height } = await browser.getWindowSize();
    const x = Math.round(width - 24);
    for (const fromBottom of [358, 392, 330, 420]) {
      if (!(await browser.isKeyboardShown().catch(() => false))) {
        return;
      }
      const y = Math.round(height - fromBottom);
      this.log('UI', `Tap Done accessory at ${x},${y}`);
      await this.pressAt(x, y);
      await browser.pause(220);
    }
  }

  /**
   * KeyboardToolbar Done sits lowest on the screen (above the keys).
   */
  async #lowestDone() {
    const selectors = [
      '-ios class chain:**/XCUIElementTypeButton[`name == "Done" OR label == "Done"`]',
      '-ios predicate string:name == "Done" OR label == "Done"',
    ];
    let best = null;
    let bestY = -1;
    for (const sel of selectors) {
      let els = [];
      try {
        els = await $$(sel);
      } catch {
        els = [];
      }
      for (const el of els) {
        try {
          const loc = await el.getLocation();
          const size = await el.getSize();
          if (size.height > 80) {
            continue;
          }
          if (loc.y > bestY) {
            best = el;
            bestY = loc.y;
          }
        } catch {
          // ignore
        }
      }
      if (best) {
        return best;
      }
    }
    return null;
  }

  async scrollToText(text) {
    const label = this.escape(text);
    if (this.isAndroid()) {
      try {
        await $(
          `android=new UiScrollable(new UiSelector().scrollable(true)).scrollTextIntoView("${label}")`,
        );
        return;
      } catch {
        // fall through
      }
    }
    for (let i = 0; i < 6; i += 1) {
      if (await this.firstCaptionContains(text)) {
        return;
      }
      await this.swipeUp();
    }
  }

  async swipeUp() {
    const { width, height } = await browser.getWindowSize();
    const startY = Math.round(height * 0.72);
    const endY = Math.round(height * 0.28);
    const x = Math.round(width / 2);
    if (this.isAndroid()) {
      await browser.performActions([
        {
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x, y: startY },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerMove', duration: 400, x, y: endY },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ]);
      await browser.releaseActions();
      return;
    }
    await browser.execute('mobile: swipe', {
      direction: 'up',
      velocity: 400,
    });
  }

  async waitForToastContaining(text, timeout = 15000) {
    const needle = String(text);
    await browser.waitUntil(
      async () => {
        const el = await this.byContainsText(needle);
        return this.isShown(el);
      },
      {
        timeout,
        interval: 400,
        timeoutMsg: `Expected toast/text containing: ${needle}`,
      },
    );
  }

  async isTextVisible(text) {
    const exact = await this.byExactText(text);
    if (await this.isShown(exact)) {
      return true;
    }
    const partial = await this.byContainsText(text);
    return this.isShown(partial);
  }

  /**
   * Step screenshot under projects/vetpal/screenshots/.
   * @param {string} step
   */
  async screenshot(step) {
    const project = require('../project.config');
    if (!fs.existsSync(project.screenshotsDir)) {
      fs.mkdirSync(project.screenshotsDir, { recursive: true });
    }
    const safe = String(step).replace(/[^a-z0-9-_]+/gi, '_').slice(0, 80);
    const file = path.join(
      project.screenshotsDir,
      `rt_${safe}_${Date.now()}.png`,
    );
    await browser.saveScreenshot(file);
    console.log(`[Screenshot] ${step} → ${file}`);
    return file;
  }

  log(scope, message) {
    console.log(`[${scope}] ${message}`);
  }
}

module.exports = { Ui, ui: new Ui() };

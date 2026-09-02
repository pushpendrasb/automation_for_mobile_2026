/**
 * Shared Appium helpers for Vet-Pal (iOS XCUITest + Android UiAutomator2).
 * Every tap/type goes through React Native `testID` (data/testIds.js).
 * Do not tap by screen width/height — rebuild the app if an ID is missing.
 */
const path = require('path');
const fs = require('fs');
const { TEST_IDS } = require('../data/testIds');

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
      await el.click();
    } catch {
      await this.press(el);
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
   * React Native `testID` → iOS accessibilityIdentifier (`name`), Android resource-id.
   * @param {string} id
   */
  testIdSelector(id) {
    const e = this.escape(id);
    if (this.isAndroid()) {
      return `android=new UiSelector().resourceId("${e}")`;
    }
    return `-ios predicate string:name == "${e}" OR label == "${e}"`;
  }

  /**
   * True if any of the IDs exist. One `$$` — no isDisplayed walk.
   * @param {string[]} ids
   * @returns {Promise<boolean>}
   */
  async anyTestIdExists(ids) {
    if (!ids.length) {
      return false;
    }
    if (this.isAndroid()) {
      for (const id of ids) {
        if (await this.firstByTestId(id)) {
          return true;
        }
      }
      return false;
    }
    const parts = ids.map(id => {
      const e = this.escape(id);
      return `name == "${e}" OR label == "${e}"`;
    });
    try {
      const els = await $$(`-ios predicate string:${parts.join(' OR ')}`);
      return els.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * First match for a `testID`. Does not require `isDisplayed` — RN modals
   * often report Save/rows as not displayed while they are tappable.
   * @param {string} id
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async firstByTestId(id) {
    try {
      const els = await $$(this.testIdSelector(id));
      return els[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Tap by `testID`. One snapshot + click on the real control (no layout).
   * Returns false when the ID is missing (older app build).
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async tapTestId(id) {
    const el = await this.firstByTestId(id);
    if (!el) {
      return false;
    }
    this.log('UI', `Tap testID ${id}`);
    try {
      await el.click();
    } catch {
      await this.press(el);
    }
    return true;
  }

  /**
   * Tap by `testID`. Throws when the ID is missing (older app build).
   * @param {string} id
   */
  async requireTapTestId(id) {
    if (!(await this.tapTestId(id))) {
      throw new Error(
        `testID "${id}" not found — rebuild/reinstall the Vet Pal app`,
      );
    }
  }

  /**
   * Open a sheet by field ID, tap a row, tap Save, wait for the sheet to leave.
   * One Appium find per step. Returns false if any ID is missing.
   * @param {{ openId?: string, rowId: string, saveId: string }} ids
   * @returns {Promise<boolean>}
   */
  async pickFromSheet({ openId, rowId, saveId }) {
    const sheetOpen = async () => Boolean(await this.firstByTestId(saveId));

    if (!(await sheetOpen())) {
      if (!openId || !(await this.tapTestId(openId))) {
        return false;
      }
      if (!(await this.waitTrue(sheetOpen, 400, 30))) {
        return false;
      }
    }

    if (!(await this.tapTestId(rowId))) {
      return false;
    }
    await browser.pause(40);
    if (!(await this.tapTestId(saveId))) {
      return false;
    }
    return this.waitTrue(
      async () => !(await this.firstByTestId(saveId)),
      400,
      30,
    );
  }

  /**
   * Same as {@link pickFromSheet} but throws when IDs are missing.
   * @param {{ openId?: string, rowId: string, saveId: string }} ids
   */
  async requirePickFromSheet(ids) {
    if (!(await this.pickFromSheet(ids))) {
      throw new Error(
        `Sheet pick failed (${ids.openId || '-'} → ${ids.rowId} → ${ids.saveId}) — rebuild/reinstall the Vet Pal app`,
      );
    }
  }

  /**
   * True when a popup Save control is in the tree (testID, not Y position).
   * @returns {Promise<boolean>}
   */
  async saveExists() {
    return Boolean(
      (await this.firstByTestId(TEST_IDS.vetPracticePopup.save)) ||
        (await this.firstByTestId(TEST_IDS.catPopup.save)) ||
        (await this.firstByTestId(TEST_IDS.remedyStoreModal.save)),
    );
  }

  /**
   * Poll until `check` is true. Returns false on timeout (does not throw).
   * @param {() => Promise<boolean>} check
   * @param {number} [timeout=600]
   * @param {number} [interval=40]
   * @returns {Promise<boolean>}
   */
  async waitTrue(check, timeout = 600, interval = 40) {
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
   * Touch the center of a *found* element. Not for screen-fraction taps.
   * Prefer {@link tapTestId} / {@link tap}.
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
   * Pointer down/up at an element's own center (from getLocation/getSize).
   * Not a getWindowSize / screen-percentage tap.
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
   * Press an element's center with one touch (no click + tap combo).
   * @param {WebdriverIO.Element} el
   */
  async press(el) {
    const loc = await el.getLocation();
    const size = await el.getSize();
    await this.pressAt(loc.x + size.width / 2, loc.y + size.height / 2);
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
   * Skip Application / Window-sized nodes. XCUITest CONTAINS often returns
   * those first instead of the visible caption. Uses the element's own size,
   * not the device window.
   * @param {WebdriverIO.Element} el
   */
  async isUsableCaption(el) {
    if (!(await this.isShown(el))) {
      return false;
    }
    try {
      const size = await el.getSize();
      if (size.width < 4 || size.height < 4) {
        return false;
      }
      if (size.width > 380 && size.height > 400) {
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
   * Pending Prescriptions bottom CTA (`pending.requestAdvice`).
   */
  async tapRequestVetAdviceButton() {
    await this.requireTapTestId(TEST_IDS.pending.requestAdvice);
  }

  /**
   * Choose a Provider option card (`provider.vetPractice` / `provider.nearby`).
   * @param {string} title "Vet Practice" | "Nearby Remedy Store"
   */
  async tapProviderOption(title) {
    const nearby = /nearby/i.test(String(title));
    const id = nearby
      ? TEST_IDS.provider.nearby
      : TEST_IDS.provider.vetPractice;
    await this.requireTapTestId(id);
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
    await el.click().catch(() => this.press(el));
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
   * Dismiss the iOS keyboard after Treatment Request (multiline).
   * Never call `mobile: hideKeyboard` (WDA retries ~12s). Never press Return
   * — this field is multiline, so Return inserts a newline and the keyboard stays.
   * Tap KeyboardToolbar Done; if it is not in the tree, tap just above the
   * keyboard element on the Done side (the accessory bar, not the screen size).
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

    if (await this.tapTestId(TEST_IDS.keyboard.done)) {
      await browser.pause(150);
      return;
    }

    const doneLabel = await this.#firstDoneLabel();
    if (doneLabel) {
      this.log('UI', 'Tap keyboard Done label');
      await doneLabel.click().catch(() => this.press(doneLabel));
      await browser.pause(150);
      return;
    }

    await this.#tapDoneAboveKeyboard();
  }

  /**
   * KeyboardToolbar "Done" text when the testID is not in the snapshot.
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #firstDoneLabel() {
    const selectors = [
      `-ios predicate string:name == "${TEST_IDS.keyboard.done}" OR label == "${TEST_IDS.keyboard.done}"`,
      '-ios predicate string:label == "Done" OR name == "Done"',
      '-ios class chain:**/XCUIElementTypeStaticText[`label == "Done"`]',
    ];
    for (const sel of selectors) {
      try {
        const els = await $$(sel);
        if (els[0]) {
          return els[0];
        }
      } catch {
        // next selector
      }
    }
    return null;
  }

  /**
   * Accessory bar sits on top of XCUIElementTypeKeyboard. Done is the right
   * control on that bar (KeyboardToolbar.Done). Uses the keyboard element's
   * own rect — not getWindowSize.
   */
  async #tapDoneAboveKeyboard() {
    let keyboard = null;
    try {
      const els = await $$(
        '-ios class chain:**/XCUIElementTypeKeyboard',
      );
      keyboard = els[0] || null;
    } catch {
      keyboard = null;
    }
    if (!keyboard) {
      return;
    }
    try {
      const loc = await keyboard.getLocation();
      const size = await keyboard.getSize();
      const x = loc.x + size.width - 36;
      const y = loc.y - 22;
      this.log('UI', `Tap Done above keyboard at ${Math.round(x)},${Math.round(y)}`);
      await this.pressAt(x, y);
      await browser.pause(150);
    } catch {
      // ignore
    }
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
    try {
      await browser.execute('mobile: swipe', {
        direction: 'up',
        velocity: 400,
      });
    } catch {
      await browser.execute('mobile: swipeGesture', {
        direction: 'up',
        percent: 0.75,
      });
    }
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

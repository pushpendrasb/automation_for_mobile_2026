/**
 * Login once, then open every Home tile and side-menu screen.
 *
 * After each tile: leave that screen (header IcnBack / rt.back) and wait
 * for `home.tile.0` before the next tile. Pending / Dispensed open the
 * first list card, scroll details, then back. Appointments taps each top
 * tab and Book an Appointment. Request Treatment also submits Vet Practice
 * + Nearby (Horse), then opens a new list row before Home.
 *
 * Lists are scrolled on the FlatList/ScrollView node. A window swipe
 * often only moves the list to the top (green header / footer CTA).
 * Coordinates always come from that element's getElementRect (or the list
 * box), never getWindowSize — so SE and Pro Max use the same logic.
 *
 * Never taps Delete Account, Mail Us, Clear All, password update, or Logout OK.
 *
 * Locators: shipped IDs (`home.tile.*`, `home.menu`, `pending.requestAdvice`,
 * `rt.back`, …) plus captions and the header back image. `pending.back` is
 * defined in testIds but not on MyPrescriptions.js — IcnBack has no testID.
 *
 * Source screens: Home.js, SideMenu.js, MyProfile.js, MyPrescriptions.js.
 */
const { ui } = require('./ui');
const HomePage = require('./HomePage');
const LoginPage = require('./LoginPage');
const { testData } = require('../data/testData');
const { TEST_IDS } = require('../data/testIds');
const { NEVER_TAP, HOME_TILES, MENU_ITEMS, WALK_ANIMAL_CATEGORY } = require('../data/screenWalk');

class ScreenWalkPage {
  /**
   * Sign in if needed and land on the dashboard.
   * Requires `home.tile.0` — Login also shows "VETPAL", so caption-only
   * Home checks are not enough.
   */
  async loginToHome() {
    await HomePage.waitForHomeOrLogin();
    if (await HomePage.isHomeVisible()) {
      ui.log('ScreenWalk', 'Already on dashboard');
      return;
    }
    if (await LoginPage.isOnLoginScreenFast()) {
      ui.log('ScreenWalk', 'Signing in');
      await LoginPage.ensureSignInMode();
      await LoginPage.enterMobile(testData.mobileNumber);
      await LoginPage.enterPassword(testData.password);
      await LoginPage.tapSignIn();
      await browser.waitUntil(async () => HomePage.isHomeVisible(), {
        timeout: 25000,
        interval: 250,
        timeoutMsg:
          'home.tile.0 not visible after Sign In — check .env credentials',
      });
    } else {
      await HomePage.goHomeFresh();
    }
    await ui.tapTestId(TEST_IDS.subscribe.skip).catch(() => {});
    await this.returnToHome();
    if (!(await HomePage.isHomeVisible())) {
      throw new Error('Home dashboard not visible after login');
    }
    ui.log('ScreenWalk', 'On Home after login');
  }

  /**
   * Every `home.tile.N` control is in the tree.
   */
  async assertHomeTilesPresent() {
    for (const tile of HOME_TILES) {
      const id = TEST_IDS.home.tile(tile.index);
      if (!(await ui.firstByTestId(id))) {
        throw new Error(
          `Home tile ${id} (${tile.name}) missing on the installed app`,
        );
      }
    }
    ui.log('ScreenWalk', 'All 8 Home tiles present');
    await this.verifyScroll('Home');
  }

  /**
   * Scroll the list down (more rows) then back to the top.
   * Uses the FlatList/ScrollView node so the green header does not eat the swipe.
   * @param {string} label
   */
  async verifyScroll(label) {
    const before = await this.#scrollFingerprint();
    const usedList = await ui.scrollList('down');
    await browser.pause(350);
    const afterDown = await this.#scrollFingerprint();
    await ui.scrollList('up');
    await browser.pause(350);
    const moved = Boolean(before) && before !== afterDown;
    ui.log(
      'ScreenWalk',
      moved
        ? `Scroll works on ${label}${usedList ? ' (list)' : ''}`
        : `Scroll attempted on ${label}${usedList ? ' (list, may be short)' : ' (no list node — window swipe)'}`,
    );
  }

  /**
   * Open one dashboard tile from Home, walk it, then return to Home
   * so the next tile can tap `home.tile.N`.
   * @param {typeof HOME_TILES[number]} tile
   */
  async visitHomeTile(tile) {
    await this.ensureOnHome();
    const id = TEST_IDS.home.tile(tile.index);
    ui.log('ScreenWalk', `Tile ${tile.index} ${tile.name}`);
    if (!(await ui.tapTestId(id))) {
      await this.ensureOnHome();
      if (!(await ui.tapTestId(id))) {
        throw new Error(`Could not tap ${id} — Home tiles not visible`);
      }
    }
    await browser.pause(400);

    if (tile.kind === 'toast') {
      const toastSeen = await ui.anyTextVisible([
        tile.toast,
        'Coming Soon...',
        'Coming Soon',
      ]);
      if (!(await HomePage.isHomeVisible())) {
        throw new Error(`${tile.name} should stay on Home (no Reports screen)`);
      }
      ui.log(
        'ScreenWalk',
        toastSeen
          ? `${tile.name} toast visible`
          : `${tile.name} stayed on Home (Coming Soon toast is not in the XCUITest tree)`,
      );
      return;
    }

    await this.#waitForTitle(tile.title, 8000);
    await this.#dismissBanner();
    await this.verifyScroll(tile.name);

    if (tile.index === 0) {
      await this.#walkPendingAndMakePrescriptions();
      await this.ensureOnHome();
      return;
    }
    if (tile.index === 1) {
      await this.#openFirstRowAndCheckDetails({
        detailTitles: ['Prescription', 'Request Details', 'Product Details'],
        listTitles: ['Dispensed Prescriptions'],
        rowHints: ['Rx', 'Dispensed', 'Created', 'Pending Acceptance'],
        emptyHints: [
          'No dispensed prescriptions yet',
          'You do not have any',
        ],
      });
      await this.ensureOnHome();
      return;
    }
    if (tile.index === 2) {
      await this.#walkAppointmentTabs(tile.tabs);
      await this.ensureOnHome();
      return;
    }
    if (tile.index === 4) {
      await this.#walkRemedyStoreTabs(tile.tabs);
      await this.ensureOnHome();
      return;
    }
    if (tile.index === 5) {
      await this.#walkMyPractices();
      await this.ensureOnHome();
      return;
    }
    if (tile.index === 6) {
      await this.#walkMessages();
      await this.ensureOnHome();
      return;
    }

    if (tile.tabs) {
      await this.#tapVisibleTabs(tile.tabs);
    }

    if (tile.kind === 'profile') {
      await this.#checkProfileSkipDeleteThenEdit();
    }

    await this.ensureOnHome();
  }

  /**
   * Header bell → My Notifications. Does not tap Clear All.
   */
  async visitNotifications() {
    await this.ensureOnHome();
    ui.log('ScreenWalk', 'Notifications');
    const bell = await this.#rightHeaderButton();
    if (!bell) {
      throw new Error('Notifications bell not found in the Home header');
    }
    await bell.click();
    await this.#waitForTitle('My Notifications', 8000);
    await this.verifyScroll('My Notifications');
    if (await ui.anyTextVisible(['Clear All'])) {
      ui.log('ScreenWalk', 'Clear All visible — skip (destructive)');
    }
    await this.ensureOnHome();
  }

  /**
   * Side menu: Profile, Contact Us, About Us, Tell a Friend, Change Password,
   * Logout (Cancel). Never Delete Account (that lives on My Profile).
   */
  async visitSideMenuScreens() {
    for (const item of MENU_ITEMS) {
      await this.ensureOnHome();
      ui.log('ScreenWalk', `Menu ${item.name}`);
      await this.#openDrawer();

      if (item.kind === 'logoutCancel') {
        if (!(await ui.tapTestId(TEST_IDS.menu.logout))) {
          throw new Error('menu.logout not found');
        }
        await browser.pause(300);
        if (
          !(await ui.tapTestId(TEST_IDS.alert.cancel)) &&
          !(await this.#tapCaption('CANCEL'))
        ) {
          throw new Error('Could not Cancel logout — refusing to confirm Logout');
        }
        await this.ensureOnHome();
        continue;
      }

      if (item.kind === 'share') {
        if (!(await ui.tapTestId(TEST_IDS.menu.item(item.id)))) {
          await this.#tapCaption(item.name);
        }
        await browser.pause(800);
        if (!(await this.#dismissShareSheet())) {
          throw new Error('Could not dismiss Tell a Friend share sheet');
        }
        await this.ensureOnHome();
        continue;
      }

      if (item.kind === 'password') {
        if (!(await ui.tapTestId(TEST_IDS.menu.item(item.id)))) {
          await this.#tapCaption(item.name);
        }
        await this.#waitForTitle('Change Password', 5000);
        if (!(await this.#tapButtonNamed('Cancel'))) {
          throw new Error('Could not Cancel Change Password');
        }
        await this.ensureOnHome();
        continue;
      }

      if (!(await ui.tapTestId(TEST_IDS.menu.item(item.id)))) {
        await this.#tapCaption(item.name);
      }
      await this.#waitForTitle(item.title, 8000, {
        extraText: item.title === 'My Profile' ? ['Account holder'] : [],
      });
      if (item.title === 'Contact Us') {
        ui.log('ScreenWalk', 'Mail Us visible — skip (opens Mail)');
      }
      if (item.title === 'My Profile') {
        await this.#assertDeleteAccountVisibleAndSkip();
      }
      await this.ensureOnHome();
    }
  }

  /**
   * Leave the current screen and wait until `home.tile.0` is visible.
   * Used after every tile so the next `home.tile.N` tap is on the dashboard.
   */
  async ensureOnHome() {
    await this.returnToHome();
    if (await HomePage.isHomeVisible()) {
      return;
    }
    await this.returnToHome();
    await browser.waitUntil(async () => HomePage.isHomeVisible(), {
      timeout: 8000,
      interval: 250,
      timeoutMsg:
        'Could not return to Home (home.tile.0) — still on an inner list/form',
    });
  }

  /**
   * Back / close overlays until `home.tile.0` is visible.
   *
   * Device log: after Nearby, XCUITest has the title at x=56,y=72 and
   * **no Buttons or Images**. IcnBack is not in the tree — tap left of
   * that title. Do not swipe-down (that only scrolls the list to the top).
   */
  async returnToHome() {
    await ui.ensureNativeContext();
    for (let i = 0; i < 8; i += 1) {
      if (await ui.firstByTestId(TEST_IDS.login.mobile)) {
        return;
      }
      if (await ui.tapTestId(TEST_IDS.subscribe.skip)) {
        await browser.pause(250);
        continue;
      }
      if (await this.#isIdDisplayed(TEST_IDS.menu.logout)) {
        ui.log('ScreenWalk', 'Drawer open — tap Home row');
        await ui.tapTestId(TEST_IDS.menu.item(1));
        await browser.pause(300);
        continue;
      }
      if (await HomePage.isHomeVisible()) {
        return;
      }

      if (await ui.tapTestId(TEST_IDS.provider.close)) {
        await browser.pause(250);
        continue;
      }
      if (await ui.tapTestId(TEST_IDS.alert.cancel)) {
        await browser.pause(200);
        continue;
      }
      if (await this.#isIdDisplayed(TEST_IDS.menu.item(1))) {
        await ui.tapTestId(TEST_IDS.menu.item(1));
        await browser.pause(250);
        continue;
      }

      const wentBack =
        (await ui.tapTestId(TEST_IDS.requestTreatment.back)) ||
        (await ui.tapTestId(TEST_IDS.pending.back)) ||
        (await this.#tapHeaderBack());
      if (wentBack) {
        await browser.pause(400);
        continue;
      }

      if (await ui.tapTestId(TEST_IDS.home.menu)) {
        await browser.pause(250);
        if (await ui.tapTestId(TEST_IDS.menu.item(1))) {
          await browser.pause(250);
        }
      }
    }
    if (await HomePage.isHomeVisible()) {
      return;
    }
    ui.log('ScreenWalk', 'returnToHome finished without home.tile.0');
  }

  /**
   * Pending list scroll + Request Details, Store Request scripts scroll,
   * then Vet Practice and Nearby prescriptions (Horse).
   */
  async #walkPendingAndMakePrescriptions() {
    await this.verifyScroll('Practice Request Status');
    await this.#openFirstRowAndCheckDetails({
      detailTitles: ['Request Details', 'Product Details'],
      listTitles: ['Pending Prescriptions'],
      rowHints: ['Rx', 'Created', 'Pending Acceptance', 'Pending acceptance'],
      emptyHints: ['No Prescription Yet', 'You do not have any'],
    });

    if (
      (await this.#tapTab('Store Request scripts')) ||
      (await this.#tapTabSlot(1, 2, 'Pending Prescriptions', [0.6, 0.4]))
    ) {
      await this.verifyScroll('Store Request scripts');
    }
    if (
      !(await this.#tapTab('Practice Request Status'))
    ) {
      await this.#tapTabSlot(0, 2, 'Pending Prescriptions', [0.6, 0.4]);
    }

    const RequestTreatmentFlow = require('./RequestTreatmentFlow');
    ui.log(
      'ScreenWalk',
      `Vet Practice prescription (${WALK_ANIMAL_CATEGORY}) from Pending`,
    );
    await RequestTreatmentFlow.requestTreatmentWithVetPractice(
      WALK_ANIMAL_CATEGORY,
      { fromPending: true },
    );
    await browser.waitUntil(
      async () => HomePage.isPendingPrescriptionsVisible(),
      {
        timeout: 20000,
        interval: 300,
        timeoutMsg: 'Pending Prescriptions not back after Vet Practice submit',
      },
    );

    ui.log(
      'ScreenWalk',
      `Nearby Remedy Store prescription (${WALK_ANIMAL_CATEGORY}) from Pending`,
    );
    await RequestTreatmentFlow.requestTreatmentWithNearbyRemedyStore(
      WALK_ANIMAL_CATEGORY,
      { fromPending: true },
    );
    await ui.ensureNativeContext();
    await browser.waitUntil(
      async () =>
        (await HomePage.isPendingPrescriptionsVisible()) ||
        Boolean(await ui.firstByTestId(TEST_IDS.pending.requestAdvice)),
      {
        timeout: 20000,
        interval: 300,
        timeoutMsg: 'Pending Prescriptions not back after Nearby submit',
      },
    );
    ui.log(
      'ScreenWalk',
      'Both prescriptions on Pending list — open a row, scroll, then Home',
    );
    await this.verifyScroll('Pending after both prescriptions');
    await this.#openFirstRowAndCheckDetails({
      detailTitles: ['Request Details', 'Product Details'],
      listTitles: ['Pending Prescriptions'],
      rowHints: ['Rx', 'Created', 'Pending Acceptance', 'Pending acceptance'],
      emptyHints: ['No Prescription Yet', 'You do not have any'],
    });
  }

  async #walkAppointmentTabs(tabs) {
    const labels = tabs || [];
    await this.#dismissBanner();
    for (let i = 0; i < labels.length; i += 1) {
      const label = labels[i];
      const tapped =
        (await this.#tapTab(label)) ||
        (await this.#tapTabSlot(i, labels.length, 'My Appointments'));
      if (!tapped) {
        throw new Error(
          `My Appointments top tab "${label}" not found — must tap Pending / Confirmed / Completed`,
        );
      }
      await this.verifyScroll(`Appointments ${label}`);
      await this.#openFirstRowAndCheckDetails({
        detailTitles: ['Appointment Details'],
        listTitles: ['My Appointments'],
        rowHints: ['Farm', 'Clinic', 'Visit', 'Consultation'],
        emptyHints: ['No appointment', 'No Appointments', 'No pending'],
      });
    }
    if (await this.#tapBookAppointment()) {
      await browser.pause(600);
      await this.#tapHeaderBack();
      await this.#waitForTitle('My Appointments', 8000).catch(() => {});
    }
  }

  async #walkRemedyStoreTabs(tabs) {
    const labels = tabs || [];
    await this.#dismissBanner();
    for (let i = 0; i < labels.length; i += 1) {
      const label = labels[i];
      const tapped =
        (await this.#tapTab(label)) ||
        (await this.#tapTabSlot(i, labels.length, 'My Remedy Store'));
      if (!tapped) {
        throw new Error(`My Remedy Store top tab "${label}" not found`);
      }
      await this.verifyScroll(`Remedy Store ${label}`);
    }
  }

  async #walkMyPractices() {
    await this.verifyScroll('My Vet Practice');
    const opened = await this.#openFirstRowAndCheckDetails({
      detailTitles: ['Vet Details'],
      listTitles: ['My Vet Practice'],
      rowHints: ['Subscribed'],
      emptyHints: ['No vet', 'No practice'],
    });
    if (!opened) {
      ui.log('ScreenWalk', 'No subscribed practice row to open');
    }
  }

  /**
   * Open an existing thread, or add a chat via My Vet Practice → Chat.
   */
  async #walkMessages() {
    await this.verifyScroll('My Messages');
    if (await ui.anyTextVisible(['No Messages'])) {
      ui.log('ScreenWalk', 'No messages — start chat from a subscribed practice');
      const add = await this.#rightHeaderButton();
      if (add) {
        await add.click();
      }
      await this.#waitForTitle('My Vet Practice', 8000);
      const row =
        (await ui.firstUsableContains('Subscribed')) ||
        (await ui.firstCaptionContains('Subscribed'));
      if (!row) {
        ui.log('ScreenWalk', 'No subscribed practice to start a chat');
        return;
      }
      await row.click().catch(() => ui.tap(row));
      await this.#waitForTitle('Vet Details', 8000);
      await this.verifyScroll('Vet Details');
      if (!(await this.#tapCaption('Chat')) && !(await this.#tapButtonNamed('Chat'))) {
        ui.log('ScreenWalk', 'Chat button not found on Vet Details');
        return;
      }
      await browser.pause(800);
      await this.#sendChatMessage('Automation walk message');
      await this.verifyScroll('Chat');
      return;
    }

    const thread =
      (await ui.firstUsableContains('Last Message')) ||
      (await ui.firstCaptionContains('Last Message'));
    if (thread) {
      await thread.click().catch(() => ui.tap(thread));
      await browser.pause(600);
      await this.verifyScroll('Chat');
      await this.#sendChatMessage('Automation walk message');
    }
  }

  /**
   * Type and send one chat line when the composer is present.
   * @param {string} text
   */
  async #sendChatMessage(text) {
    const typed = await ui.firstDisplayed(
      ui.isAndroid()
        ? 'android=new UiSelector().text("Send message")'
        : `-ios predicate string:placeholderValue == "Send message" OR value == "Send message"`,
    );
    if (!typed) {
      ui.log('ScreenWalk', 'Chat composer not found — skip send');
      return;
    }
    ui.log('ScreenWalk', 'Sending chat message');
    try {
      await typed.click();
      await typed.setValue(text);
    } catch {
      ui.log('ScreenWalk', 'Could not type chat message — skip send');
      return;
    }
    await this.#tapButtonNamed('Send');
    await browser.pause(400);
  }

  /**
   * Tap a prescription / appointment / practice row. ProductDetails.js
   * header is "Request Details" (pending) or "Prescription" (dispensed).
   * Swipe the details ScrollView up and down, then IcnBack to the list.
   * @param {{ detailTitles: string[], listTitles?: string[], rowHints: string[], emptyHints: string[] }} opts
   * @returns {Promise<boolean>}
   */
  async #openFirstRowAndCheckDetails(opts) {
    const { detailTitles, rowHints, emptyHints } = opts;
    const listTitles = opts.listTitles || [];
    if (await ui.anyTextVisible(emptyHints)) {
      ui.log('ScreenWalk', `Empty list (${emptyHints[0]}) — skip details`);
      return false;
    }
    const list = await this.#contentFrame();
    let tapped = false;
    for (const hint of rowHints) {
      const el =
        (await ui.firstUsableContains(hint)) ||
        (await ui.firstCaptionContains(hint)) ||
        (await ui.firstCaption(hint));
      if (!el) {
        continue;
      }
      const r = await ui.rect(el);
      if (list && r && r.y < list.y) {
        continue;
      }
      ui.log('ScreenWalk', `Open row via "${hint}"`);
      await el.click().catch(() => ui.tap(el));
      tapped = true;
      break;
    }
    if (!tapped) {
      tapped = await this.#tapFirstListCard();
    }
    if (!tapped) {
      ui.log('ScreenWalk', `No tappable row for ${detailTitles[0]}`);
      return false;
    }
    const opened = await ui.waitTrue(
      () => this.#isOnDetails(detailTitles, listTitles),
      6000,
      200,
    );
    if (!opened) {
      ui.log('ScreenWalk', `Row tap did not open ${detailTitles[0]}`);
      return false;
    }
    ui.log(
      'ScreenWalk',
      `Opened Product Details (${detailTitles[0]}) — swipe up/down`,
    );
    await this.verifyScroll(detailTitles[0]);
    await this.#leaveDetailsToList(detailTitles, listTitles);
    return true;
  }

  /**
   * True when the green header shows a details title and the list title is gone.
   * Avoids matching "Prescription" inside "Dispensed Prescriptions".
   * @param {string[]} detailTitles
   * @param {string[]} listTitles
   * @returns {Promise<boolean>}
   */
  async #isOnDetails(detailTitles, listTitles) {
    const detailHeader = await this.#firstHeaderTitle(detailTitles);
    if (!detailHeader) {
      return false;
    }
    if (await this.#firstHeaderTitle(listTitles)) {
      return false;
    }
    return true;
  }

  /**
   * True when the list header or Pending CTA is back.
   * @param {string[]} listTitles
   * @returns {Promise<boolean>}
   */
  async #isOnList(listTitles) {
    if (await this.#firstHeaderTitle(listTitles)) {
      return true;
    }
    if (await ui.firstByTestId(TEST_IDS.pending.requestAdvice)) {
      return true;
    }
    return false;
  }

  /**
   * ProductDetails IcnBack is left of the header title (y ~72). Do not tap
   * a body label after swipe (last miss was @16,165).
   * @param {string[]} detailTitles
   * @param {string[]} listTitles
   */
  async #leaveDetailsToList(detailTitles, listTitles) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (await this.#isOnList(listTitles)) {
        ui.log('ScreenWalk', `Back on list after ${detailTitles[0]}`);
        await browser.pause(300);
        return;
      }
      const titleEl = await this.#firstHeaderTitle(detailTitles);
      let tapped = false;
      if (titleEl) {
        tapped = await this.#tapLeftOfElement(
          titleEl,
          `details IcnBack try ${attempt}`,
        );
      }
      if (!tapped) {
        tapped =
          (await ui.tapTestId(TEST_IDS.pending.back)) ||
          (await this.#tapHeaderBack());
      }
      if (!tapped) {
        ui.log('ScreenWalk', `No back target on ${detailTitles[0]} try ${attempt}`);
      }
      await browser.pause(500);
    }
    if (await this.#isOnList(listTitles)) {
      ui.log('ScreenWalk', `Back on list after ${detailTitles[0]}`);
      await browser.pause(300);
      return;
    }
    throw new Error(`Could not leave ${detailTitles[0]} back to the list`);
  }

  /**
   * The list ScrollView's own box on this device. All “where is the header”
   * / “where is a row” checks use this — not a 390×844 screen.
   * @returns {Promise<{ el: WebdriverIO.Element, x: number, y: number, w: number, h: number }|null>}
   */
  async #contentFrame() {
    const el = await ui.firstScrollable();
    if (!el) {
      return null;
    }
    const r = await ui.rect(el);
    if (!r) {
      return null;
    }
    return { el, ...r };
  }

  /**
   * Caption sits in the green header (above the list), on any phone size.
   * @param {{ x: number, y: number, w: number, h: number }} r
   * @param {{ y: number }|null} list
   */
  #isHeaderRect(r, list) {
    if (!r || r.y < 16) {
      return false;
    }
    if (list) {
      return r.y + r.h <= list.y + 4;
    }
    return r.y < 130;
  }

  /**
   * Caption sits inside the list / details scroll area.
   * @param {{ x: number, y: number, w: number, h: number }} r
   * @param {{ y: number, h: number }|null} list
   */
  #isListRect(r, list) {
    if (!r || !list) {
      return false;
    }
    return r.y >= list.y && r.y <= list.y + list.h;
  }

  /**
   * Green header title (above the list), not a scrolled body caption.
   * @param {string[]} titles
   * @returns {Promise<WebdriverIO.Element|null>}
   */
  async #firstHeaderTitle(titles) {
    const wanted = (titles || [])
      .map(t => String(t).trim())
      .filter(Boolean);
    if (!wanted.length) {
      return null;
    }
    const list = await this.#contentFrame();
    let els = [];
    try {
      els = ui.isAndroid()
        ? await $$(
            'android=new UiSelector().className("android.widget.TextView")',
          )
        : await $$(
            '-ios predicate string:type == "XCUIElementTypeStaticText"',
          );
    } catch {
      els = [];
    }
    for (const el of els || []) {
      const r = await ui.rect(el);
      if (!this.#isHeaderRect(r, list)) {
        continue;
      }
      const text = String((await el.getText().catch(() => '')) || '').trim();
      if (wanted.includes(text)) {
        return el;
      }
    }
    return null;
  }

  /**
   * IcnBack sits between the left safe edge and the title. Use the title's
   * own x — half way — so SE and Pro Max both hit the icon.
   * @param {WebdriverIO.Element} el
   * @param {string} label
   * @returns {Promise<boolean>}
   */
  async #tapLeftOfElement(el, label) {
    const r = await ui.rect(el);
    if (!r) {
      return false;
    }
    const x = Math.round(Math.max(12, r.x / 2));
    const y = Math.round(r.y + r.h / 2);
    ui.log('ScreenWalk', `${label} @ ${x},${y} (left of title x=${Math.round(r.x)})`);
    await ui.tapAt(x, y);
    await browser.pause(400);
    return true;
  }

  /**
   * First prescription / appointment card sits just under the list top.
   * @returns {Promise<boolean>}
   */
  async #tapFirstListCard() {
    const list = await this.#contentFrame();
    if (!list || list.h < 80) {
      return false;
    }
    const x = Math.round(list.x + list.w / 2);
    const y = Math.round(list.y + list.h * 0.18);
    ui.log('ScreenWalk', `Tap first list card @ ${x},${y} (list h=${Math.round(list.h)})`);
    await ui.tapAt(x, y);
    await browser.pause(500);
    return true;
  }

  /**
   * Footer CTA on My Appointments (`Book an Appointment`) has no testID.
   * @returns {Promise<boolean>}
   */
  async #tapBookAppointment() {
    if (
      (await this.#tapCaption('Book an Appointment')) ||
      (await this.#tapTab('Book an Appointment'))
    ) {
      return true;
    }
    const list = await this.#contentFrame();
    if (!list) {
      return false;
    }
    const x = Math.round(list.x + list.w / 2);
    const y = Math.round(list.y + list.h * 0.92);
    ui.log('ScreenWalk', `Book an Appointment footer @ ${x},${y}`);
    await ui.tapAt(x, y);
    await browser.pause(500);
    return true;
  }

  /**
   * Fingerprint of captions in the list band — used to see if a swipe moved content.
   */
  async #scrollFingerprint() {
    const list = await this.#contentFrame();
    const selector = ui.isAndroid()
      ? 'android=new UiSelector().className("android.widget.TextView")'
      : '-ios predicate string:type == "XCUIElementTypeStaticText"';
    let els = [];
    try {
      els = await $$(selector);
    } catch {
      return '';
    }
    if (!els || els.length < 1) {
      return '';
    }
    const parts = [];
    const max = Math.min(els.length, 10);
    for (let i = 0; i < max; i += 1) {
      const el = els[i];
      const r = await ui.rect(el);
      if (!this.#isListRect(r, list)) {
        continue;
      }
      const text = await el.getText().catch(() => '');
      parts.push(`${Math.round(r.y)}:${String(text).slice(0, 24)}`);
    }
    return parts.join('|');
  }

  /**
   * Pending Prescriptions → Request Advice → Choose a Provider → close.
   * Unused by the deep walk (prescriptions run instead).
   */
  async #peekChooseProvider() {
    if (!(await ui.firstByTestId(TEST_IDS.pending.requestAdvice))) {
      return;
    }
    ui.log('ScreenWalk', 'Peek Choose a Provider');
    await ui.tapTestId(TEST_IDS.pending.requestAdvice);
    await browser.pause(400);
    const opened =
      (await ui.firstByTestId(TEST_IDS.provider.nearby)) ||
      (await ui.firstByTestId(TEST_IDS.provider.vetPractice));
    if (!opened) {
      ui.log('ScreenWalk', 'Choose a Provider did not appear — continue');
      return;
    }
    await ui.tapTestId(TEST_IDS.provider.close);
    await browser.pause(200);
  }

  /**
   * Confirm Delete Account is on My Profile, then open Edit Profile and back.
   */
  async #checkProfileSkipDeleteThenEdit() {
    await this.#assertDeleteAccountVisibleAndSkip();
    const opened = await this.#tapCaption('Edit Profile').catch(() => false);
    if (!opened) {
      ui.log('ScreenWalk', 'Edit Profile button not found — skip');
      return;
    }
    await this.#waitForTitle('Edit Profile', 8000);
    const backed = await this.#tapHeaderBack();
    if (!backed) {
      throw new Error('Could not leave Edit Profile');
    }
    await this.#waitForTitle('My Profile', 8000);
  }

  /**
   * Scroll until Delete Account is visible, then skip the tap.
   */
  async #assertDeleteAccountVisibleAndSkip() {
    for (let i = 0; i < 6; i += 1) {
      if (await ui.anyTextVisible(['Delete Account'])) {
        ui.log('ScreenWalk', 'Delete Account visible — skip tap');
        return;
      }
      await ui.swipeUp();
    }
    ui.log('ScreenWalk', 'Delete Account not on this profile view — skip');
  }

  /**
   * Push / in-app banner sits on the green header and hides TabPills
   * (live log: tabs not in the XCUITest tree while "Prescription Request" shows).
   * Swipe the banner up using its own rect.
   * @returns {Promise<boolean>}
   */
  async #dismissBanner() {
    const needles = [
      'Prescription Request',
      'Please action soon',
      'Awaiting',
    ];
    for (const needle of needles) {
      const el =
        (await ui.firstCaptionContains(needle)) ||
        (await ui.firstUsableContains(needle));
      if (!el) {
        continue;
      }
      const r = await ui.rect(el);
      if (!r || r.y > 200) {
        continue;
      }
      const x = Math.round(r.x + r.w / 2);
      const y = Math.round(r.y + r.h / 2);
      ui.log('ScreenWalk', `Dismiss banner "${needle}" @ ${x},${y}`);
      try {
        await browser.execute('mobile: dragFromToForDuration', {
          duration: 0.25,
          fromX: x,
          fromY: y,
          toX: x,
          toY: Math.max(8, y - r.h * 2),
        });
      } catch {
        await ui.tapAt(x, y);
      }
      await browser.pause(400);
      return true;
    }
    return false;
  }

  /**
   * TabPills are not in the XCUITest tree (same as IcnBack). Tap the
   * equal slot between the header title and the list ScrollView.
   * @param {number} index
   * @param {number} count
   * @param {string} title
   * @param {number[]} [weights]
   * @returns {Promise<boolean>}
   */
  async #tapTabSlot(index, count, title, weights) {
    const titleEl = await ui.firstCaption(title);
    const list = await this.#contentFrame();
    if (!titleEl || !list || count < 1) {
      return false;
    }
    const t = await ui.rect(titleEl);
    if (!t) {
      return false;
    }
    const gapTop = t.y + t.h;
    const gapBot = list.y;
    const y =
      gapBot - gapTop >= 24
        ? Math.round((gapTop + gapBot) / 2)
        : Math.round(list.y - Math.min(22, list.h * 0.04));
    let x;
    if (weights && weights.length === count) {
      let start = 0;
      for (let i = 0; i < index; i += 1) {
        start += weights[i];
      }
      x = Math.round(list.x + list.w * (start + weights[index] / 2));
    } else {
      x = Math.round(list.x + (list.w / count) * (index + 0.5));
    }
    ui.log(
      'ScreenWalk',
      `Tab slot ${index + 1}/${count} under "${title}" @ ${x},${y}`,
    );
    await ui.tapAt(x, y);
    await browser.pause(400);
    return true;
  }

  /**
   * Top segmented tabs (TabPill) often have no XCUITest name/label.
   * @param {string} label
   * @returns {Promise<boolean>}
   */
  async #tapTab(label) {
    const e = ui.escape(label);
    const el =
      (await ui.firstDisplayed(
        ui.isAndroid()
          ? `android=new UiSelector().text("${e}")`
          : `-ios predicate string:(label == "${e}" OR name == "${e}") AND type != XCUIElementTypeApplication AND type != XCUIElementTypeWindow`,
      )) ||
      (await ui.firstCaption(label)) ||
      (await ui.firstUsableContains(label));
    if (!el) {
      ui.log('ScreenWalk', `Tab "${label}" not visible`);
      return false;
    }
    const r = await ui.rect(el);
    ui.log(
      'ScreenWalk',
      r
        ? `Tab ${label} @ ${Math.round(r.x)},${Math.round(r.y)}`
        : `Tab ${label}`,
    );
    await el.click().catch(() => ui.tap(el));
    await browser.pause(400);
    return true;
  }

  async #tapVisibleTabs(labels) {
    for (const label of labels) {
      await this.#tapTab(label);
    }
  }

  async #openDrawer() {
    if (await this.#isIdDisplayed(TEST_IDS.menu.logout)) {
      return;
    }
    if (!(await ui.tapTestId(TEST_IDS.home.menu))) {
      throw new Error('home.menu not found — cannot open side drawer');
    }
    const opened = await browser.waitUntil(
      async () => this.#isIdDisplayed(TEST_IDS.menu.logout),
      {
        timeout: 4000,
        interval: 150,
        timeoutMsg: 'Side menu did not open after home.menu',
      },
    ).catch(() => false);
    if (opened || (await this.#isIdDisplayed(TEST_IDS.menu.logout))) {
      return;
    }
    await ui.tapTestId(TEST_IDS.home.menu);
    await browser.waitUntil(
      async () => this.#isIdDisplayed(TEST_IDS.menu.logout),
      {
        timeout: 4000,
        interval: 150,
        timeoutMsg: 'Side menu did not open after home.menu',
      },
    );
  }

  /**
   * @param {string} title
   * @param {number} timeout
   * @param {{ extraIds?: string[], extraText?: string[] }} [opts]
   */
  async #waitForTitle(title, timeout, opts = {}) {
    const extraIds = opts.extraIds || [];
    const extraText = opts.extraText || [];
    await browser.waitUntil(
      async () => {
        if (await ui.anyTextVisible([title, ...extraText])) {
          return true;
        }
        for (const id of extraIds) {
          if (await this.#isIdDisplayed(id)) {
            return true;
          }
        }
        return false;
      },
      {
        timeout,
        interval: 200,
        timeoutMsg: `Screen "${title}" did not appear`,
      },
    );
    ui.log('ScreenWalk', `Opened ${title}`);
  }

  /**
   * True when the testID exists and reports displayed (hidden drawer rows
   * stay in the XCUITest tree).
   * @param {string} id
   */
  async #isIdDisplayed(id) {
    const el = await ui.firstByTestId(id);
    if (!el) {
      return false;
    }
    return el.isDisplayed().catch(() => true);
  }

  /**
   * Tap a button by its accessible name (Cancel on Change Password is not
   * always XCUIElementTypeStaticText).
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  async #tapButtonNamed(name) {
    const e = ui.escape(name);
    const el = await ui.firstDisplayed(
      ui.isAndroid()
        ? `android=new UiSelector().text("${e}")`
        : `-ios predicate string:(label == "${e}" OR name == "${e}" OR value == "${e}") AND type != XCUIElementTypeApplication AND type != XCUIElementTypeWindow`,
    );
    if (el) {
      ui.log('ScreenWalk', `Tap button "${name}"`);
      await el.click().catch(() => ui.tap(el));
      return true;
    }
    let buttons = [];
    try {
      buttons = ui.isAndroid()
        ? await $$('android=new UiSelector().clickable(true)')
        : await $$('-ios class chain:**/XCUIElementTypeButton');
    } catch {
      return false;
    }
    for (const button of buttons || []) {
      if (!buttons.length) {
        break;
      }
      const label =
        (await button.getAttribute('label').catch(() => '')) ||
        (await button.getText().catch(() => '')) ||
        '';
      if (String(label).trim().toLowerCase() !== name.toLowerCase()) {
        continue;
      }
      ui.log('ScreenWalk', `Tap button "${name}" (attribute)`);
      await button.click().catch(() => ui.tap(button));
      return true;
    }
    return false;
  }

  /**
   * Tap visible caption. Refuses NEVER_TAP labels (Delete Account, Mail Us, …).
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  async #tapCaption(text) {
    if (NEVER_TAP.some(skip => skip.toLowerCase() === String(text).toLowerCase())) {
      throw new Error(`Screen walk must not tap "${text}"`);
    }
    const el =
      (await ui.firstCaption(text)) || (await ui.firstUsableContains(text));
    if (!el) {
      return false;
    }
    ui.log('ScreenWalk', `Tap "${text}"`);
    await el.click().catch(() => ui.tap(el));
    return true;
  }

  /**
   * iOS/Android share sheet (Tell a Friend). Do not treat a list scroll
   * as a share dismiss.
   * @returns {Promise<boolean>}
   */
  async #isShareSheetVisible() {
    return ui.anyTextVisible([
      'AirDrop',
      'Copy',
      'Add to Notes',
      'Reminders',
      'Share',
    ]);
  }

  async #dismissShareSheet() {
    const labels = ['Close', 'Cancel', 'Done'];
    for (const label of labels) {
      const e = ui.escape(label);
      const selector = ui.isAndroid()
        ? `android=new UiSelector().text("${e}")`
        : `-ios predicate string:type == "XCUIElementTypeButton" AND (label == "${e}" OR name == "${e}")`;
      const el = await ui.firstDisplayed(selector);
      if (!el) {
        continue;
      }
      ui.log('ScreenWalk', `Dismiss share via "${label}"`);
      await el.click().catch(() => ui.tap(el));
      await browser.pause(300);
      return true;
    }

    let buttons = [];
    try {
      buttons = ui.isAndroid()
        ? await $$('android=new UiSelector().clickable(true)')
        : await $$('-ios class chain:**/XCUIElementTypeButton');
    } catch {
      buttons = [];
    }
    const list = await this.#contentFrame();
    let rightmost = null;
    for (const el of buttons || []) {
      const r = await ui.rect(el);
      if (!r) {
        continue;
      }
      if (!this.#isHeaderRect(r, list) || r.w > 44 || r.h > 44) {
        continue;
      }
      if (!rightmost || r.x > rightmost.x) {
        rightmost = { el, x: r.x };
      }
    }
    if (rightmost) {
      ui.log('ScreenWalk', 'Dismiss share via top-right close');
      await rightmost.el.click().catch(() => ui.tap(rightmost.el));
      await browser.pause(300);
      return true;
    }

    if (await this.#isShareSheetVisible()) {
      try {
        await browser.execute('mobile: swipe', { direction: 'down' });
        await browser.pause(300);
        ui.log('ScreenWalk', 'Dismiss share via swipe down');
        return true;
      } catch {
        // ignore
      }
    }
    return false;
  }

  /**
   * Rightmost small control in the Home header (notifications bell).
   */
  async #rightHeaderButton() {
    const buttons = await this.#headerControls();
    if (buttons.length < 1) {
      return null;
    }
    return buttons[buttons.length - 1].el;
  }

  /**
   * Leftmost small control in the green header (back / hamburger).
   */
  async #tapTopLeftHeaderControl() {
    return this.#tapHeaderBack();
  }

  /**
   * Pending / Appointments / Practices use IcnBack (Image, no testID).
   * Prefer the leftmost header control with x under ~90.
   * @returns {Promise<boolean>}
   */
  async #tapHeaderBack() {
    if (await this.#tapLeftOfHeaderTitle()) {
      return true;
    }
    const controls = await this.#headerControls();
    const back = controls[0];
    if (back) {
      ui.log(
        'ScreenWalk',
        `Header back at x=${Math.round(back.x)} y=${Math.round(back.y)}`,
      );
      await back.el.click().catch(() => ui.tap(back.el));
      return true;
    }
    return false;
  }

  /**
   * IcnBack is a 48×48 SVG with no testID and no XCUITest Image/Button.
   * Live Pending header title was `{ x: 56, y: 72, width: 320, height: 30 }`.
   * Tap just left of that caption (same Y) to hit the back hit-box.
   * @returns {Promise<boolean>}
   */
  async #tapLeftOfHeaderTitle() {
    const list = await this.#contentFrame();
    let els = [];
    try {
      els = ui.isAndroid()
        ? await $$(
            'android=new UiSelector().className("android.widget.TextView")',
          )
        : await $$(
            '-ios predicate string:type == "XCUIElementTypeStaticText"',
          );
    } catch {
      els = [];
    }
    let best = null;
    for (const el of els || []) {
      const r = await ui.rect(el);
      if (!this.#isHeaderRect(r, list)) {
        continue;
      }
      if (r.w < 40 || r.h > 80) {
        continue;
      }
      const text = String((await el.getText().catch(() => '')) || '').trim();
      if (/^VETPAL$/i.test(text)) {
        continue;
      }
      if (!best || r.x < best.x) {
        best = { el, ...r };
      }
    }
    if (!best) {
      return false;
    }
    const x = Math.round(Math.max(12, best.x / 2));
    const y = Math.round(best.y + best.h / 2);
    ui.log('ScreenWalk', `Header back left of title @ ${x},${y}`);
    await ui.tapAt(x, y);
    return true;
  }

  /**
   * Small header-band controls, left-to-right.
   * Buttons plus Images — IcnBack / notification bell are SVGs, not Buttons.
   */
  async #headerControls() {
    const list = await this.#contentFrame();
    const found = [];
    const selectors = ui.isAndroid()
      ? ['android=new UiSelector().clickable(true)']
      : [
          '-ios class chain:**/XCUIElementTypeButton',
          '-ios class chain:**/XCUIElementTypeImage',
        ];
    for (const selector of selectors) {
      let els = [];
      try {
        els = await $$(selector);
      } catch {
        els = [];
      }
      for (const el of els || []) {
        const r = await ui.rect(el);
        if (!this.#isHeaderRect(r, list)) {
          continue;
        }
        if (r.w > 80 || r.h > 80) {
          continue;
        }
        found.push({ el, x: r.x, y: r.y });
      }
    }
    found.sort((a, b) => a.x - b.x || a.y - b.y);
    return found;
  }
}

module.exports = new ScreenWalkPage();

/**
 * Book Service flow Page Object (week list → steps 1–6 → terms → summary → pay).
 * Button taps use testIDs from the React Native app (data/testIds.js).
 * Visible labels are only a fallback when an older build has no id yet.
 */
const LoginPage = require('./LoginPage');
const { testData } = require('../data/testData');
const { TEST_IDS, choiceId } = require('../data/testIds');
const { byTestId } = require('../helpers/elements');
const {
  SlotSelectionHelper,
  REQUIRED_MINUTES,
} = require('../helpers/slotSelection');

class BookServicePage {
  constructor() {
    this.slots = new SlotSelectionHelper();
  }

  async #isShown(el) {
    try {
      return (await el.isExisting()) && (await el.isDisplayed());
    } catch {
      return false;
    }
  }

  async #tap(el) {
    try {
      const loc = await el.getLocation();
      const size = await el.getSize();
      await browser.execute('mobile: tap', {
        x: Math.round(loc.x + size.width / 2),
        y: Math.round(loc.y + size.height / 2),
      });
    } catch {
      await el.click();
    }
  }

  /**
   * Tap a testID. Falls back to an exact visible label when the id is missing.
   * @param {string} id
   * @param {string} [fallbackLabel]
   */
  async #tapId(id, fallbackLabel) {
    const el = byTestId(id);
    if (await this.#isShown(el)) {
      this.logStep('Tap', id);
      await this.#tap(el);
      return;
    }
    if (fallbackLabel) {
      const byLabel = await this.#lowestByLabel(fallbackLabel);
      if (byLabel) {
        this.logStep('Tap', `${id} missing — using label "${fallbackLabel}"`);
        await this.#tap(byLabel);
        return;
      }
    }
    this.fail('Tap', `testID "${id}" is not on screen. Rebuild the RosKids app.`);
  }

  /** Scroll until a testID is visible, then tap it. */
  async #scrollAndTapId(id, fallbackLabel) {
    for (let i = 0; i < 3; i++) {
      try {
        await browser.execute('mobile: swipe', { direction: 'down' });
      } catch {
        break;
      }
      await browser.pause(200);
    }
    for (let i = 0; i < 8; i++) {
      const el = byTestId(id);
      if (await this.#isShown(el)) {
        this.logStep('Tap', id);
        await this.#tap(el);
        return;
      }
      await browser.execute('mobile: swipe', { direction: 'up' });
      await browser.pause(250);
    }
    await this.#tapId(id, fallbackLabel);
  }

  async #byLabel(label) {
    return $(
      `-ios predicate string:label == "${label}" OR name == "${label}"`,
    );
  }

  async #byLabelContains(snippet) {
    const escaped = String(snippet).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return $(
      `-ios predicate string:label CONTAINS "${escaped}" OR name CONTAINS "${escaped}"`,
    );
  }

  /** Lowest visible element matching exact label (form footer vs dialog). */
  async #lowestByLabel(label) {
    const candidates = await $$(
      `-ios predicate string:label == "${label}" OR name == "${label}"`,
    );
    let best = null;
    let maxY = -1;
    for (const el of candidates) {
      if (!(await this.#isShown(el))) {
        continue;
      }
      const loc = await el.getLocation().catch(() => null);
      if (loc && loc.y > maxY) {
        maxY = loc.y;
        best = el;
      }
    }
    return best;
  }

  logStep(step, message) {
    console.log(`[BookService][${step}] ${message}`);
  }

  fail(step, message) {
    throw new Error(`Book Service automation failed at ${step}:\n${message}`);
  }

  async isHomeDashboardVisible() {
    const myChildren = await this.#byLabel(testData.dashboardTileMyChildren);
    const bookService = await this.#byLabel(testData.dashboardTileBookService);
    const brand = await this.#byLabelContains('RAY OF SUNSHINE');
    return (
      (await this.#isShown(myChildren)) ||
      (await this.#isShown(bookService)) ||
      (await this.#isShown(brand))
    );
  }

  /**
   * Reach MainDashBoard: skip Sign In if session already restored to Home.
   */
  async ensureOnHome() {
    this.logStep('Home', 'Checking if already on MainDashBoard or need Sign In');

    await browser.waitUntil(
      async () => {
        if (await this.isHomeDashboardVisible()) {
          return true;
        }
        return Boolean(await LoginPage.resolveEmailField());
      },
      {
        timeout: 60000,
        interval: 1000,
        timeoutMsg:
          'Neither MainDashBoard nor Sign In appeared after app launch',
      },
    );

    if (await this.isHomeDashboardVisible()) {
      this.logStep(
        'Home',
        'Already on MainDashBoard (saved session) — skipping Sign In',
      );
      return;
    }

    this.logStep('Login', `Signing in as ${testData.email}`);
    await LoginPage.enterEmail(testData.email);
    await LoginPage.enterPassword(testData.password);
    await LoginPage.tapSignIn();
    const ok = await LoginPage.isLoginSuccessful(90000);
    if (!ok) {
      const err = await LoginPage.getVisibleLoginErrorMessage();
      this.fail(
        'Login',
        err ||
          'Did not reach MainDashBoard. Fix ROS_KIDS_TEST_EMAIL/PASSWORD in projects/roskids/.env',
      );
    }
    this.logStep('Login', 'Reached MainDashBoard');
  }

  /** @deprecated use ensureOnHome */
  async loginToHome() {
    return this.ensureOnHome();
  }

  async openBookService() {
    this.logStep('Open', 'Waiting for Book A Service tile on home');
    await browser.waitUntil(async () => this.isHomeDashboardVisible(), {
      timeout: 30000,
      timeoutMsg: 'MainDashBoard not visible before opening Book A Service',
    });

    // Scroll home grid if Book A Service is below the fold
    let tile = byTestId(TEST_IDS.home.bookService);
    if (!(await this.#isShown(tile))) {
      tile = await this.#byLabel(testData.dashboardTileBookService);
    }
    for (let i = 0; i < 4 && !(await this.#isShown(tile)); i++) {
      await browser.execute('mobile: swipe', { direction: 'up' });
      await browser.pause(300);
      tile = byTestId(TEST_IDS.home.bookService);
      if (!(await this.#isShown(tile))) {
        tile = await this.#byLabel(testData.dashboardTileBookService);
      }
    }

    await browser.waitUntil(async () => this.#isShown(tile), {
      timeout: 20000,
      timeoutMsg: 'Book A Service tile not found on home',
    });

    this.logStep('Open', 'Tapping Book A Service');
    await this.#tap(tile);
    // If text node did not forward tap, try a slightly lower tap (icon+label card)
    await browser.pause(800);
    const weekTitle = await this.#byLabel('Select Week to Book Service');
    const stillHome = await this.isHomeDashboardVisible();
    if (stillHome && !(await this.#isShown(weekTitle))) {
      this.logStep('Open', 'Retry tap on Book A Service card');
      const loc = await tile.getLocation();
      const size = await tile.getSize();
      await browser.execute('mobile: tap', {
        x: Math.round(loc.x + size.width / 2),
        y: Math.round(loc.y - 30), // icon area above label
      });
    }

    await browser.waitUntil(
      async () => {
        const week = await this.#byLabel('Select Week to Book Service');
        const header = await this.#byLabel('Book A Service');
        const step1 = await this.#byLabelContains('Step 1:');
        // Left home when Book A Service header/week list shows and My Children gone
        const myChildren = await this.#byLabel(testData.dashboardTileMyChildren);
        const leftHome = !(await this.#isShown(myChildren));
        return (
          (await this.#isShown(week)) ||
          ((await this.#isShown(header)) && leftHome) ||
          (await this.#isShown(step1))
        );
      },
      {
        timeout: 45000,
        timeoutMsg:
          'Book Service screen did not open after tapping Book A Service',
      },
    );
    this.logStep('Open', 'Book Service screen visible');
  }

  async selectFirstWeek() {
    this.logStep('Week', 'Selecting first available week');
    await browser.waitUntil(
      async () => {
        const empty = await this.#byLabel('No Service Available');
        if (await this.#isShown(empty)) {
          this.fail('Week selection', 'No Service Available for booking');
        }
        if (await this.#isShown(byTestId(TEST_IDS.book.week(0)))) {
          return true;
        }
        const cells = await $$(
          '-ios predicate string:label CONTAINS "Close On" OR name CONTAINS "Close On"',
        );
        return cells.length > 0;
      },
      { timeout: 60000, timeoutMsg: 'No bookable weeks loaded' },
    );

    const week = byTestId(TEST_IDS.book.week(0));
    if (await this.#isShown(week)) {
      await this.#tap(week);
    } else {
      const cells = await $$(
        '-ios predicate string:label CONTAINS "Close On" OR name CONTAINS "Close On"',
      );
      await this.#tap(cells[0]);
    }
    await this.waitForStep(1);
    this.logStep('Week', 'Navigated to Step 1');
  }

  async waitForStep(stepNumber, timeout = 30000) {
    const label = `Step ${stepNumber}:`;
    await browser.waitUntil(
      async () => {
        const byLabel = await this.#byLabelContains(label);
        return this.#isShown(byLabel);
      },
      {
        timeout,
        interval: 500,
        timeoutMsg: `Expected Step ${stepNumber} not displayed`,
      },
    );
    this.logStep(`Step ${stepNumber}`, 'Visible');
  }

  async tapNext(fromStep) {
    this.logStep(`Step ${fromStep}`, 'Tapping Next');
    await this.#tapId(TEST_IDS.book.next, 'Next');
  }

  /**
   * Tap a Yes/No row by its testID prefix (`book-step2-allergy` → `…-no`).
   * @param {string} prefix
   * @param {'yes'|'no'} choice
   */
  async tapChoice(prefix, choice) {
    const label = choice === 'yes' ? 'Yes' : 'No';
    await this.#scrollAndTapId(choiceId(prefix, choice), label);
  }

  /**
   * Tap Yes/No radio/checkbox by visible label.
   * Prefer the option near the current step question when multiple exist.
   */
  async tapYesNo(choice /* 'yes' | 'no' */, contextHint) {
    const label = choice === 'yes' ? 'Yes' : 'No';
    if (contextHint) {
      await this.scrollToText(contextHint);
    }
    const els = await $$(
      `-ios predicate string:label == "${label}" OR name == "${label}"`,
    );
    if (!els.length) {
      this.fail('Yes/No', `${label} option not found`);
    }
    // Prefer first visible in viewport after scroll
    for (const el of els) {
      if (await this.#isShown(el)) {
        await this.#tap(el);
        return;
      }
    }
    this.fail('Yes/No', `${label} option not tappable`);
  }

  async selectFirstChild() {
    this.logStep('Step 1', 'Opening child selector');
    const dropdown = byTestId(TEST_IDS.book.step1.child);
    await browser.waitUntil(
      async () =>
        (await this.#isShown(dropdown)) ||
        (await this.#isShown(await this.#byLabel('Select your child'))),
      {
        timeout: 20000,
        timeoutMsg: 'Child dropdown not found',
      },
    );
    if (await this.#isShown(dropdown)) {
      await this.#tap(dropdown);
    } else {
      await this.#tap(await this.#byLabel('Select your child'));
    }

    await browser.waitUntil(
      async () => {
        const title = await this.#byLabelContains('Select Child');
        return this.#isShown(title);
      },
      { timeout: 20000, timeoutMsg: 'Child list modal did not open' },
    );

    const firstChild = byTestId(TEST_IDS.book.child.option(0));
    if (await this.#isShown(firstChild)) {
      await this.#tap(firstChild);
    } else {
      const texts = await $$('-ios class chain:**/XCUIElementTypeStaticText');
      for (const el of texts) {
        const name = (await el.getAttribute('label').catch(() => '')) || '';
        if (
          name &&
          name !== 'Select Child Name' &&
          name !== 'Done' &&
          name !== 'Close' &&
          name !== '•' &&
          !name.startsWith('Select')
        ) {
          await this.#tap(el);
          break;
        }
      }
    }

    const doneBtn = byTestId(TEST_IDS.book.child.done);
    await browser.waitUntil(
      async () =>
        (await this.#isShown(doneBtn)) ||
        (await this.#isShown(await this.#byLabel('Done'))),
      {
        timeout: 10000,
        timeoutMsg: 'Child modal Done not found',
      },
    );
    if (await this.#isShown(doneBtn)) {
      await this.#tap(doneBtn);
    } else {
      await this.#tap(await this.#byLabel('Done'));
    }
    await browser.pause(600);
    await this.#ensureStep1RequiredFields();
    this.logStep('Step 1', 'Child selected');
  }

  async #ensureStep1RequiredFields() {
    const location = byTestId(TEST_IDS.book.step1.location);
    const locationPh = await this.#byLabel('Select School Your Child Location');
    if ((await this.#isShown(location)) || (await this.#isShown(locationPh))) {
      this.logStep('Step 1', 'Selecting ROS Location (first option)');
      if (await this.#isShown(location)) {
        await this.#tap(location);
      } else {
        await this.#tap(locationPh);
      }
      await this.#pickFirstFromCommonPicker('Select Ros Location');
    }

    const school = byTestId(TEST_IDS.book.step1.school);
    const schoolPh = await this.#byLabel('Select School Your Child Attends');
    if ((await this.#isShown(school)) || (await this.#isShown(schoolPh))) {
      this.logStep('Step 1', 'Selecting school (first option)');
      if (await this.#isShown(school)) {
        await this.#tap(school);
      } else {
        await this.#tap(schoolPh);
      }
      await this.#pickFirstFromCommonPicker();
    }
  }

  async #pickFirstFromCommonPicker(titleHint) {
    await browser.pause(500);
    if (titleHint) {
      await browser.waitUntil(
        async () => this.#isShown(await this.#byLabelContains(titleHint)),
        { timeout: 10000, timeoutMsg: `Picker "${titleHint}" not shown` },
      );
    }
    const firstOption = byTestId(TEST_IDS.book.picker.option(0));
    if (await this.#isShown(firstOption)) {
      await this.#tap(firstOption);
    } else {
      const rows = await $$('-ios class chain:**/XCUIElementTypeCell');
      if (rows.length > 0) {
        await this.#tap(rows[0]);
      } else {
      const texts = await $$('-ios class chain:**/XCUIElementTypeStaticText');
      for (const el of texts) {
        const label = (await el.getAttribute('label').catch(() => '')) || '';
        if (
          label &&
          !/select|close|done|cancel/i.test(label) &&
          label.length > 2
        ) {
          await this.#tap(el);
          break;
        }
      }
      }
    }
    const done = byTestId(TEST_IDS.book.picker.done);
    if (await this.#isShown(done)) {
      await this.#tap(done);
    } else {
      const doneLabel = await this.#byLabel('Done');
      if (await this.#isShown(doneLabel)) {
        await this.#tap(doneLabel);
      }
    }
    await browser.pause(400);
  }

  /**
   * Step 3 Breakfast Club — Yes, then ~2 hours of morning slots (screenshots).
   */
  async completeMorningSlots() {
    this.logStep('Step 3', 'Selecting Yes for breakfast club');
    await this.tapChoice(TEST_IDS.book.step3.morning, 'yes');
    await browser.pause(400);
    await this.#openSlotDialog(
      TEST_IDS.book.step3.selectSlot,
      TEST_IDS.book.step3.updateSlot,
      'Step 3',
    );

    const results = await this.slots.selectTwoHoursForAllWeekdays(
      REQUIRED_MINUTES,
    );
    this.logStep(
      'Step 3',
      `Slot selection finished: ${JSON.stringify(
        results.map(r => ({
          day: r.day,
          status: r.status,
          mins: r.totalMinutes,
        })),
      )}`,
    );

    await this.#waitForSlotDialogToClose('Step 3');
    this.logStep('Step 3', 'Slots reflected on Step 3');
  }

  /**
   * Open Select Slot, or Update when times are already filled.
   * @param {string} selectId
   * @param {string} updateId
   * @param {string} stepLabel
   */
  async #openSlotDialog(selectId, updateId, stepLabel) {
    const selectBtn = byTestId(selectId);
    const updateBtn = byTestId(updateId);
    let openBtn = selectBtn;
    await browser.waitUntil(
      async () => {
        if (await this.#isShown(updateBtn)) {
          openBtn = updateBtn;
          return true;
        }
        if (await this.#isShown(selectBtn)) {
          openBtn = selectBtn;
          return true;
        }
        const byLabel = await this.#byLabel('Select Slot');
        const updateLabel = await this.#byLabel('Update');
        if (await this.#isShown(updateLabel)) {
          openBtn = updateLabel;
          return true;
        }
        if (await this.#isShown(byLabel)) {
          openBtn = byLabel;
          return true;
        }
        return false;
      },
      {
        timeout: 15000,
        timeoutMsg: `${stepLabel}: Select Slot / Update button not found`,
      },
    );
    this.logStep(stepLabel, 'Opening slot dialog');
    await this.#tap(openBtn);
  }

  /**
   * Step 5 Afterschool Club — Yes, then afternoon slots (screenshots show times).
   */
  async completeAfternoonSlots() {
    this.logStep('Step 5', 'Selecting Yes for afterschool club');
    await this.tapChoice(TEST_IDS.book.step5.afternoon, 'yes');
    await browser.pause(400);
    await this.#openSlotDialog(
      TEST_IDS.book.step5.selectSlot,
      TEST_IDS.book.step5.updateSlot,
      'Step 5',
    );

    const results = await this.slots.selectTwoHoursForAllWeekdays(
      REQUIRED_MINUTES,
    );
    this.logStep(
      'Step 5',
      `Slot selection finished: ${JSON.stringify(
        results.map(r => ({
          day: r.day,
          status: r.status,
          mins: r.totalMinutes,
        })),
      )}`,
    );
    await this.#waitForSlotDialogToClose('Step 5');
    this.logStep('Step 5', 'Slots reflected on Step 5');
  }

  async #waitForSlotDialogToClose(stepLabel) {
    await browser.waitUntil(
      async () => {
        const slotNext = byTestId(TEST_IDS.book.slot.next);
        if (await this.#isShown(slotNext)) {
          return false;
        }
        const available = await this.#byLabel('Available');
        const selected = await this.#byLabelContains('Selected Slots');
        return !(await this.#isShown(available)) || (await this.#isShown(selected));
      },
      {
        timeout: 60000,
        interval: 1000,
        timeoutMsg: `${stepLabel}: slot dialog did not close after Done`,
      },
    );
  }

  /** Step 4 Morning Transport — both answers No, matching the screenshot. */
  async confirmMorningTransportNo() {
    this.logStep('Step 4', 'Confirming morning transport = No');
    await this.tapChoice(TEST_IDS.book.step4.homeTransport, 'no');
    await this.tapChoice(TEST_IDS.book.step4.dropSchool, 'no');
    await this.tapChoice(TEST_IDS.book.step4.arklowTransport, 'no');
    await this.tapChoice(TEST_IDS.book.step4.arklowDrop, 'no');
  }

  /** Step 6 Afternoon Transport — both answers No, matching the screenshot. */
  async confirmAfternoonTransportNo() {
    this.logStep('Step 6', 'Confirming afternoon transport = No');
    await this.tapChoice(TEST_IDS.book.step6.afternoonTransport, 'no');
    await this.tapChoice(TEST_IDS.book.step6.arklow, 'no');
  }

  /** Step 2 Allergy — No, matching the screenshot. */
  async confirmAllergyNo() {
    this.logStep('Step 2', 'Selecting No for allergies');
    await this.tapChoice(TEST_IDS.book.step2.allergy, 'no');
  }

  async completeStep7Terms() {
    this.logStep('Step 7', 'Ensuring transport No + both consents');
    try {
      await this.tapYesNo(
        'no',
        'Do you require transport to another afterschool activity?',
      );
    } catch {
      this.logStep('Step 7', 'Transport No control not found — continuing');
    }

    await this.#scrollAndTapId(
      TEST_IDS.book.step7.detailsChecked,
      'Yes. I have entered all details correctly',
    );
    await this.#scrollAndTapId(
      TEST_IDS.book.step7.consent,
      'I agree to the privacy policy',
    );

    this.logStep('Step 7', 'Both term checkboxes tapped');
  }

  async scrollToText(snippet) {
    for (let i = 0; i < 8; i++) {
      const el = await this.#byLabelContains(snippet);
      if (await this.#isShown(el)) {
        return el;
      }
      await browser.execute('mobile: swipe', { direction: 'up' });
      await browser.pause(300);
    }
    return null;
  }

  async #tapCheckboxNearText(snippet) {
    const text = await this.#byLabelContains(snippet);
    if (!(await this.#isShown(text))) {
      this.fail('Step 7', `Could not find text: ${snippet}`);
    }
    const loc = await text.getLocation();
    await browser.execute('mobile: tap', {
      x: Math.max(20, Math.round(loc.x - 40)),
      y: Math.round(loc.y + 10),
    });
  }

  async acceptSummaryTermsAndSubmit() {
    this.logStep('Summary', 'Waiting for summary');
    await browser.waitUntil(
      async () => {
        const byText = await this.#byLabelContains('Booking Summary');
        return this.#isShown(byText);
      },
      { timeout: 45000, timeoutMsg: 'Summary page not displayed' },
    );

    await this.#scrollAndTapId(TEST_IDS.book.summary.terms, 'I Accept the');
    this.logStep('Summary', 'Accepted Terms');
    await this.#tapId(TEST_IDS.book.summary.submit, 'Submit');
    this.logStep('Summary', 'Submit tapped');
  }

  async declineAddAnotherChildAndContinue() {
    this.logStep('Popup', 'Waiting for add-another-child popup');
    await browser.waitUntil(
      async () => {
        const text = await this.#byLabelContains('another child');
        return this.#isShown(text);
      },
      {
        timeout: 60000,
        timeoutMsg: 'Add another child popup did not appear after Submit',
      },
    );

    await this.#tapId(TEST_IDS.book.anotherChildNo, 'No');
    this.logStep('Popup', 'Tapped No on add-another-child');

    await browser.waitUntil(
      async () =>
        (await this.#isShown(byTestId(TEST_IDS.book.warningContinue))) ||
        (await this.#isShown(await this.#byLabel('Continue'))),
      {
        timeout: 20000,
        timeoutMsg: 'Data Loss Warning Continue not shown',
      },
    );
    await this.#tapId(TEST_IDS.book.warningContinue, 'Continue');
    this.logStep('Popup', 'Tapped Continue');
  }

  async payNowAndVerifyGateway() {
    this.logStep('Payment', 'Waiting for Payment Summary');
    await browser.waitUntil(
      async () => {
        const pay = await this.#byLabel('Pay Now');
        const title = await this.#byLabel('Payment Summary');
        return (await this.#isShown(pay)) || (await this.#isShown(title));
      },
      {
        timeout: 90000,
        timeoutMsg: 'Payment Summary / Pay Now not displayed',
      },
    );

    await this.#tapId(TEST_IDS.book.payNow, 'Pay Now');
    this.logStep('Payment', 'Pay Now tapped');

    await browser.waitUntil(
      async () => {
        const title = await this.#byLabel('Payment Gateway');
        const web = await $('-ios class chain:**/XCUIElementTypeWebView');
        return (await this.#isShown(title)) || (await this.#isShown(web));
      },
      {
        timeout: 60000,
        timeoutMsg: 'Payment gateway did not open',
      },
    );

    console.log('Payment gateway opened successfully');
    this.logStep('Payment', 'Gateway loaded');
  }

  async assertBookingSuccessIfPresent(timeout = 120000) {
    try {
      await browser.waitUntil(
        async () => this.#isShown(await this.#byLabel('Thank you!')),
        { timeout, interval: 2000 },
      );
      this.logStep('Success', 'Thank you! confirmation visible');
      console.log('Book Service automation completed successfully');
      return true;
    } catch {
      this.logStep(
        'Success',
        'Confirmation not reached (gateway may require manual auth). Stopping after gateway as configured.',
      );
      console.log(
        'Book Service automation stopped at payment gateway (no fake payment). Payment gateway opened successfully',
      );
      return false;
    }
  }
}

module.exports = new BookServicePage();

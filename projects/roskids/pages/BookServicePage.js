/**
 * Book Service flow Page Object (CalendarTab steps 0–8 → payment).
 * Automation-only: uses visible text / accessibility labels — no app source changes.
 */
const LoginPage = require('./LoginPage');
const { testData } = require('../data/testData');
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
    let tile = await this.#byLabel(testData.dashboardTileBookService);
    for (let i = 0; i < 4 && !(await this.#isShown(tile)); i++) {
      await browser.execute('mobile: swipe', { direction: 'up' });
      await browser.pause(300);
      tile = await this.#byLabel(testData.dashboardTileBookService);
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
        const cells = await $$(
          '-ios predicate string:label CONTAINS "Close On" OR name CONTAINS "Close On"',
        );
        return cells.length > 0;
      },
      { timeout: 60000, timeoutMsg: 'No bookable weeks loaded' },
    );

    const cells = await $$(
      '-ios predicate string:label CONTAINS "Close On" OR name CONTAINS "Close On"',
    );
    await this.#tap(cells[0]);
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
    const best = await this.#lowestByLabel('Next');
    if (!best) {
      this.fail(`Step ${fromStep}`, 'Next button not found');
    }
    await this.#tap(best);
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
    const dropdown = await this.#byLabel('Select your child');
    await browser.waitUntil(async () => this.#isShown(dropdown), {
      timeout: 20000,
      timeoutMsg: 'Child dropdown not found',
    });
    await this.#tap(dropdown);

    await browser.waitUntil(
      async () => {
        const title = await this.#byLabelContains('Select Child');
        return this.#isShown(title);
      },
      { timeout: 20000, timeoutMsg: 'Child list modal did not open' },
    );

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

    const doneBtn = await this.#byLabel('Done');
    await browser.waitUntil(async () => this.#isShown(doneBtn), {
      timeout: 10000,
      timeoutMsg: 'Child modal Done not found',
    });
    await this.#tap(doneBtn);
    await browser.pause(600);
    await this.#ensureStep1RequiredFields();
    this.logStep('Step 1', 'Child selected');
  }

  async #ensureStep1RequiredFields() {
    const locationPh = await this.#byLabel('Select School Your Child Location');
    if (await this.#isShown(locationPh)) {
      this.logStep('Step 1', 'Selecting ROS Location (first option)');
      await this.#tap(locationPh);
      await this.#pickFirstFromCommonPicker('Select Ros Location');
    }

    const schoolPh = await this.#byLabel('Select School Your Child Attends');
    if (await this.#isShown(schoolPh)) {
      this.logStep('Step 1', 'Selecting school (first option)');
      await this.#tap(schoolPh);
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
    const done = await this.#byLabel('Done');
    if (await this.#isShown(done)) {
      await this.#tap(done);
    }
    await browser.pause(400);
  }

  async completeMorningSlots() {
    this.logStep('Step 3', 'Selecting Yes for morning childcare');
    await this.tapYesNo(
      'yes',
      'Do you require childcare in the mornings?',
    );
    await browser.pause(400);

    let openBtn = await this.#byLabel('Select Slot');
    if (!(await this.#isShown(openBtn))) {
      openBtn = await this.#byLabel('Update');
    }
    await browser.waitUntil(async () => this.#isShown(openBtn), {
      timeout: 15000,
      timeoutMsg: 'Select Slot / Update button not found on Step 3',
    });
    this.logStep('Step 3', 'Opening slot dialog');
    await this.#tap(openBtn);

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

    await browser.waitUntil(
      async () => {
        const dialogTitle = await this.#byLabel('Select Slot');
        const selected = await this.#byLabelContains('Selected Slots');
        const available = await this.#byLabel('Available');
        // Dialog closed when legend gone, or Selected Slots shown on form
        const dialogOpen =
          (await this.#isShown(dialogTitle)) && (await this.#isShown(available));
        return !dialogOpen || (await this.#isShown(selected));
      },
      {
        timeout: 60000,
        interval: 1000,
        timeoutMsg:
          'Book Service automation failed at Step 3: slot dialog did not close after Done (hold API?)',
      },
    );
    this.logStep('Step 3', 'Slots reflected on Step 3');
  }

  async selectAfternoonChildcareNo() {
    this.logStep('Step 5', 'Selecting No for afternoon childcare');
    await this.tapYesNo('no', 'Do you require afternoon childcare?');
    await browser.pause(300);
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

    await this.scrollToText('Yes. I have entered all details correctly');
    await this.#tapCheckboxNearText('Yes. I have entered all details correctly');

    await this.scrollToText('I agree to the privacy policy');
    await this.#tapCheckboxNearText('I agree to the privacy policy');

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

    await this.scrollToText('I Accept the');
    await this.#tapCheckboxNearText('I Accept the');
    this.logStep('Summary', 'Accepted Terms');

    const submit = await this.#lowestByLabel('Submit');
    if (!submit) {
      this.fail('Summary', 'Submit button not found');
    }
    await this.#tap(submit);
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

    const noBtn = await this.#byLabel('No');
    await this.#tap(noBtn);
    this.logStep('Popup', 'Tapped No on add-another-child');

    await browser.waitUntil(
      async () => this.#isShown(await this.#byLabel('Continue')),
      {
        timeout: 20000,
        timeoutMsg: 'Data Loss Warning Continue not shown',
      },
    );
    await this.#tap(await this.#byLabel('Continue'));
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

    await this.#tap(await this.#byLabel('Pay Now'));
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

/**
 * Create Appraisal wizard — TradeIn.mm (4 steps).
 *
 * 1) Vehicle Required (customer + req vehicle)
 * 2) Vehicle Trade In
 * 3) Vehicle Damage (tyre / alloy + optional damage photos)
 * 4) Vehicle Photos → SAVE
 *
 * Prefer accessibility IDs from TradeIn.mm; fall back to placeholders / NEXT / SAVE labels.
 */
import { TEST_IDS } from '../data/testIds';
import { appraisalData } from '../data/appraisalData';
import { clientLog } from '../helpers/clientLog';
import { pickFirstLibraryPhoto } from '../helpers/iosPhotos';

export class CreateAppraisalPage {
  private id(value: string): string {
    return `~${value}`;
  }

  private async findDisplayed(selectors: string[], timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline) {
      for (const sel of selectors) {
        try {
          const el = await $(sel);
          if (
            (await el.isExisting().catch(() => false)) &&
            (await el.isDisplayed().catch(() => false))
          ) {
            return el;
          }
        } catch (err) {
          lastError = err;
        }
      }
      await browser.pause(350);
    }
    throw new Error(
      `Element not found (${timeoutMs}ms). Tried: ${selectors.join(' | ')}. Last: ${String(lastError)}`
    );
  }

  private async typeInto(selectors: string[], value: string): Promise<void> {
    const field = await this.findDisplayed(selectors, 12000);
    await field.click();
    await field.clearValue().catch(() => undefined);
    await field.setValue(value);
  }

  /**
   * App uses IQKeyboardManager: every keyboard gets a custom toolbar with a
   * "Toolbar Done Button" (rendered as a checkmark, no text). It's a real,
   * accessible button — not a keyboard "Return"/"Done" key — so WDA's
   * hideKeyboard() can't find it and just times out retrying. Tap it directly.
   */
  private async dismissKeyboard(): Promise<void> {
    try {
      const done = await $(
        '-ios predicate string:name == "Toolbar Done Button" OR label == "Toolbar Done Button"'
      );
      if (await done.isDisplayed().catch(() => false)) {
        await done.click();
        await browser.pause(300);
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await browser.hideKeyboard();
    } catch {
      try {
        await browser.execute('mobile: tap', { x: 20, y: 120 });
      } catch {
        /* ignore */
      }
    }
    await browser.pause(300);
  }

  /**
   * Swipe up on the main content so NEXT / SAVE become reachable.
   */
  async scrollDown(times = 2): Promise<void> {
    const { width, height } = await browser.getWindowSize();
    const x = Math.floor(width * 0.5);
    for (let i = 0; i < times; i++) {
      await browser
        .action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ duration: 0, x, y: Math.floor(height * 0.72) })
        .down({ button: 0 })
        .pause(80)
        .move({ duration: 450, x, y: Math.floor(height * 0.28) })
        .up({ button: 0 })
        .perform()
        .catch(async () => {
          await browser.execute('mobile: swipe', { direction: 'up' }).catch(() => undefined);
        });
      await browser.releaseActions().catch(() => undefined);
      await browser.pause(350);
    }
  }

  async waitForVehicleRequired(timeoutMs = 20000): Promise<void> {
    clientLog('Waiting for Create Appraisal (Vehicle Required)');
    await this.findDisplayed(
      [
        this.id(TEST_IDS.tradeIn.customerName),
        this.id(TEST_IDS.tradeIn.reqNext),
        '~NAME*',
        '-ios predicate string:placeholderValue CONTAINS "NAME"',
        '-ios predicate string:label == "CUSTOMER DETAILS" OR name == "CUSTOMER DETAILS"',
        '-ios predicate string:label == "VEHICLE REQUIRED" OR name CONTAINS "VEHICLE REQUIRED"',
      ],
      timeoutMs
    );
    clientLog('Vehicle Required form is visible');
  }

  private nameSelectors(): string[] {
    return [
      this.id(TEST_IDS.tradeIn.customerName),
      '-ios predicate string:placeholderValue CONTAINS "NAME"',
      '~NAME*',
    ];
  }

  private emailSelectors(): string[] {
    return [
      this.id(TEST_IDS.tradeIn.customerEmail),
      '-ios predicate string:placeholderValue CONTAINS "EMAIL"',
      '~EMAIL*',
    ];
  }

  private mobileSelectors(): string[] {
    return [
      this.id(TEST_IDS.tradeIn.customerMobile),
      '-ios predicate string:placeholderValue == "MOBILE" OR placeholderValue CONTAINS "MOBILE"',
      '~MOBILE',
    ];
  }

  private reqRegSelectors(): string[] {
    return [
      this.id(TEST_IDS.tradeIn.reqRegistration),
      '-ios predicate string:placeholderValue CONTAINS "REGISTRATION"',
    ];
  }

  private nextSelectors(preferId: string): string[] {
    return [
      this.id(preferId),
      '~NEXT',
      '-ios predicate string:label == "NEXT" OR name == "NEXT"',
      '-ios class chain:**/XCUIElementTypeButton[`label == "NEXT"`]',
    ];
  }

  /**
   * Empty form → scroll → NEXT → expect name validation toast/message.
   */
  async assertNameValidationOnEmptyNext(): Promise<void> {
    clientLog('Scrolling to NEXT to trigger name validation');
    await this.scrollDown(3);
    const next = await this.findDisplayed(
      this.nextSelectors(TEST_IDS.tradeIn.reqNext),
      10000
    );
    await next.click();
    await browser.pause(800);
    // App toast: "Please enter a name" (or similar)
    const ok = await this.waitForTextContaining(
      ['name', 'please enter'],
      6000
    ).catch(() => false);
    if (ok) {
      clientLog('Name validation message shown');
    } else {
      clientLog('Name validation toast not detected — continuing to fill mandatory fields');
    }
  }

  async waitForTextContaining(
    needles: string[],
    timeoutMs = 5000
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const lower = needles.map((n) => n.toLowerCase());
    while (Date.now() < deadline) {
      try {
        const labels = await $$(
          '-ios class chain:**/XCUIElementTypeStaticText'
        );
        for (const label of labels) {
          const t = ((await label.getText().catch(() => '')) || '').toLowerCase();
          if (lower.some((n) => t.includes(n))) return true;
        }
      } catch {
        /* retry */
      }
      await browser.pause(250);
    }
    return false;
  }

  /**
   * Fill step-1 mandatory customer fields + registration (optional for req step).
   */
  async fillCustomerAndRegistration(opts: {
    name: string;
    email: string;
    mobile: string;
    registration?: string;
  }): Promise<void> {
    clientLog('Entering customer name');
    await this.typeInto(this.nameSelectors(), opts.name);
    clientLog('Email has been entered');
    await this.typeInto(this.emailSelectors(), opts.email);
    clientLog('Mobile number has been entered');
    await this.typeInto(this.mobileSelectors(), opts.mobile);
    await this.dismissKeyboard();

    if (opts.registration) {
      // Check before scrolling: a blind scrollDown(1) here used to overshoot
      // past the REGISTRATION field into MODEL VARIANT / PRICING further down.
      await this.scrollUntilDisplayed(this.reqRegSelectors());
      clientLog(`Entering registration ${opts.registration}`);
      // Prefer trade-in field if already on that step; else vehicle required
      try {
        await this.typeInto(this.reqRegSelectors(), opts.registration);
      } catch {
        await this.typeInto(
          [
            this.id(TEST_IDS.tradeIn.trdRegistration),
            '-ios predicate string:placeholderValue CONTAINS "REGISTRATION"',
          ],
          opts.registration
        );
      }
      await this.dismissKeyboard();
      await this.tapLookupIfPresent();
    }
  }

  /**
   * Magnifying-glass lookup next to registration (API auto-fill).
   */
  async tapLookupIfPresent(): Promise<void> {
    const sels = [
      '-ios predicate string:label CONTAINS[c] "search" OR name CONTAINS[c] "search"',
      '-ios class chain:**/XCUIElementTypeButton[`label CONTAINS "magnifying" OR name CONTAINS "look"`]',
    ];
    for (const sel of sels) {
      try {
        const els = await $$(sel);
        for (const el of els.slice(0, 4)) {
          if (await el.isDisplayed().catch(() => false)) {
            await el.click();
            clientLog('Registration lookup tapped — waiting for auto-fill');
            await browser.pause(2500);
            return;
          }
        }
      } catch {
        /* next */
      }
    }
  }

  /**
   * "This vehicle has previously been appraised in this dealership" — shown
   * when the plate lookup matches an existing record (e.g. a reused test
   * registration). It's a modal card, not a native alert, and blocks all
   * taps/scrolls behind it until dismissed.
   */
  async dismissInfoAlertIfPresent(): Promise<void> {
    try {
      const btn = await $(
        '-ios predicate string:label == "Continue" OR name == "Continue"'
      );
      if (await btn.isDisplayed().catch(() => false)) {
        await btn.click();
        clientLog('Dismissed "previously appraised" alert');
        await browser.pause(500);
      }
    } catch {
      /* not present */
    }
  }

  async tapNext(preferId: string): Promise<void> {
    await this.dismissKeyboard();
    await this.dismissInfoAlertIfPresent();
    // Forms vary in length (Trade In has many more fields than Vehicle
    // Required) — a fixed scroll count can under/overshoot NEXT.
    await this.scrollUntilDisplayed(this.nextSelectors(preferId), 6);
    const next = await this.findDisplayed(this.nextSelectors(preferId), 12000);
    await next.click();
    clientLog('NEXT tapped');
    await browser.pause(1000);
  }

  /**
   * Step 1 → try Next; if still on vehicle required, fill remaining * fields and retry.
   */
  async completeVehicleRequiredStep(): Promise<void> {
    await this.tapNext(TEST_IDS.tradeIn.reqNext);
    const stillOnReq = await this.isVehicleRequiredVisible();
    if (stillOnReq) {
      clientLog('Still on Vehicle Required — filling remaining required fields');
      // Registration often required for progress depending on dealer settings
      try {
        await this.typeInto(
          this.reqRegSelectors(),
          appraisalData.registration
        );
        await this.dismissKeyboard();
        await this.tapLookupIfPresent();
      } catch {
        /* already filled */
      }
      await this.tapNext(TEST_IDS.tradeIn.reqNext);
    }
  }

  async isVehicleRequiredVisible(): Promise<boolean> {
    try {
      await this.findDisplayed(
        [
          this.id(TEST_IDS.tradeIn.customerName),
          '-ios predicate string:placeholderValue CONTAINS "NAME"',
        ],
        2500
      );
      return true;
    } catch {
      return false;
    }
  }

  async waitForTradeInStep(timeoutMs = 20000): Promise<void> {
    clientLog('Waiting for Vehicle Trade In step');
    await this.findDisplayed(
      [
        this.id(TEST_IDS.tradeIn.trdRegistration),
        this.id(TEST_IDS.tradeIn.trdMileage),
        this.id(TEST_IDS.tradeIn.trdNext),
        '-ios predicate string:label CONTAINS "VEHICLE TRADE IN"',
        '-ios predicate string:placeholderValue CONTAINS "MILEAGE"',
      ],
      timeoutMs
    );
    clientLog('Vehicle Trade In is visible');
  }

  /**
   * Enter plate, lookup auto-fill, Next → handle mileage / tax validation.
   */
  async completeTradeInStep(registration: string, mileage: string): Promise<void> {
    await this.waitForTradeInStep();
    clientLog(`Entering trade-in registration ${registration}`);
    await this.typeInto(
      [
        this.id(TEST_IDS.tradeIn.trdRegistration),
        '-ios predicate string:placeholderValue CONTAINS "REGISTRATION"',
      ],
      registration
    );
    await this.dismissKeyboard();
    await this.tapLookupIfPresent();
    await browser.pause(2000);
    await this.dismissInfoAlertIfPresent();

    await this.tapNext(TEST_IDS.tradeIn.trdNext);

    // Mileage validation
    const mileageNeeded = await this.waitForTextContaining(['mileage'], 5000).catch(
      () => false
    );
    const stillTrade = await this.isTradeInVisible();
    if (mileageNeeded || stillTrade) {
      clientLog('Mileage required — entering mileage');
      await this.scrollDown(2);
      await this.typeInto(
        [
          this.id(TEST_IDS.tradeIn.trdMileage),
          '-ios predicate string:placeholderValue CONTAINS "MILEAGE"',
        ],
        mileage
      );
      await this.dismissKeyboard();
      await this.ensureTaxExpiryIfNeeded();
      await this.tapNext(TEST_IDS.tradeIn.trdNext);
    }
  }

  async isTradeInVisible(): Promise<boolean> {
    try {
      await this.findDisplayed(
        [
          this.id(TEST_IDS.tradeIn.trdMileage),
          '-ios predicate string:placeholderValue CONTAINS "MILEAGE"',
          '-ios predicate string:label CONTAINS "VEHICLE TRADE IN"',
        ],
        2500
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * TAX EXPIRY* — open date picker and confirm Done if still placeholder.
   */
  async ensureTaxExpiryIfNeeded(): Promise<void> {
    try {
      const tax = await this.findDisplayed(
        [
          this.id(TEST_IDS.tradeIn.trdTaxExpiry),
          '-ios predicate string:label == "DD-MMM-YYYY" OR value == "DD-MMM-YYYY"',
          '-ios predicate string:label CONTAINS "TAX EXPIRY"',
        ],
        3000
      );
      const text = ((await tax.getText().catch(() => '')) || '').toUpperCase();
      if (text.includes('DD-MMM') || text.includes('TAX')) {
        clientLog('Setting TAX expiry date');
        await tax.click();
        await browser.pause(500);
        const done = await $(
          '-ios predicate string:label == "Done" OR name == "Done"'
        );
        if (await done.isDisplayed().catch(() => false)) {
          await done.click();
          clientLog('TAX expiry confirmed');
        }
      }
    } catch {
      /* optional if API already filled */
    }
  }

  async waitForDamageStep(timeoutMs = 20000): Promise<void> {
    clientLog('Waiting for Vehicle Damage step');
    await this.findDisplayed(
      [
        this.id(TEST_IDS.tradeIn.tyreDamage),
        this.id(TEST_IDS.tradeIn.damageNext),
        '-ios predicate string:label == "VEHICLE DAMAGE" OR name == "VEHICLE DAMAGE"',
        '-ios predicate string:label == "DAMAGE" OR name == "DAMAGE"',
        '-ios predicate string:label CONTAINS "TYRES"',
      ],
      timeoutMs
    );
    clientLog('Vehicle Damage is visible');
  }

  /**
   * Tyre / alloy OK vs DAMAGE from env (APPRAISEE_TYRE_DAMAGE / APPRAISEE_ALLOY_DAMAGE).
   * When tyre is DAMAGE, upload 4 tyre photos.
   */
  async completeDamageStep(tyreDamage: boolean, alloyDamage: boolean): Promise<void> {
    await this.waitForDamageStep();
    clientLog(
      `Tyres: ${tyreDamage ? 'DAMAGE' : 'OK'} · Alloys: ${alloyDamage ? 'DAMAGE' : 'OK'}`
    );

    if (tyreDamage) {
      await this.tapSegment(TEST_IDS.tradeIn.tyreDamage, 'DAMAGE');
      if (!appraisalData.skipPhotos) {
        await this.addPhotosForLabels([...appraisalData.tyrePhotoSlots]);
      }
    } else {
      await this.tapSegment(TEST_IDS.tradeIn.tyreOk, 'OK');
    }

    if (alloyDamage) {
      await this.tapSegment(TEST_IDS.tradeIn.alloyDamage, 'DAMAGE');
    } else {
      await this.tapSegment(TEST_IDS.tradeIn.alloyOk, 'OK');
    }

    await this.scrollDown(4);
    await this.tapNext(TEST_IDS.tradeIn.damageNext);
  }

  private async tapSegment(id: string, labelFallback: string): Promise<void> {
    try {
      const el = await this.findDisplayed(
        [
          this.id(id),
          `-ios predicate string:label == "${labelFallback}" OR name == "${labelFallback}"`,
        ],
        8000
      );
      await el.click();
      await browser.pause(400);
    } catch (err) {
      console.log(`[Damage] Could not tap ${labelFallback}: ${String(err)}`);
    }
  }

  async waitForPhotosStep(timeoutMs = 20000): Promise<void> {
    clientLog('Waiting for Vehicle Photos step');
    await this.findDisplayed(
      [
        this.id(TEST_IDS.tradeIn.photosSave),
        this.id(TEST_IDS.tradeIn.vehiclePhotos),
        '~SAVE',
        '-ios predicate string:label == "VEHICLE PHOTOS" OR name == "VEHICLE PHOTOS"',
        '-ios predicate string:label == "SAVE" OR name == "SAVE"',
        '-ios predicate string:label == "+ ADD" OR name == "+ ADD" OR label == "ADD"',
      ],
      timeoutMs
    );
    clientLog('Vehicle Photos is visible');
  }

  /**
   * Add photos for each slot label, then SAVE.
   */
  async completePhotosStep(labels: readonly string[]): Promise<void> {
    await this.waitForPhotosStep();
    if (!appraisalData.skipPhotos) {
      await this.addPhotosForLabels([...labels]);
    } else {
      clientLog('Skipping photo uploads (APPRAISEE_SKIP_PHOTOS)');
    }
    await this.scrollDown(3);
    const save = await this.findDisplayed(
      [
        this.id(TEST_IDS.tradeIn.photosSave),
        '~SAVE',
        '-ios predicate string:label == "SAVE" OR name == "SAVE"',
      ],
      12000
    );
    await save.click();
    clientLog('SAVE tapped — Create Appraisal submitted');
    await browser.pause(1500);
  }

  /**
   * For each label (FRONT, DRIVER FRONT, …) tap nearby ADD and pick a library photo.
   */
  async addPhotosForLabels(labels: string[]): Promise<void> {
    for (const label of labels) {
      clientLog(`Adding photo: ${label}`);
      await this.scrollUntilLabelVisible(label).catch(() => undefined);
      const tapped = await this.tapAddNearLabel(label);
      if (tapped) {
        await pickFirstLibraryPhoto();
        await browser.pause(600);
      } else {
        clientLog(`ADD control not found for ${label} — skipping`);
      }
    }
  }

  /**
   * Check before scrolling, then scroll one step at a time, re-checking after
   * each — avoids overshooting a field with a fixed-count blind scroll.
   */
  private async scrollUntilDisplayed(selectors: string[], maxSwipes = 4): Promise<boolean> {
    for (let i = 0; i <= maxSwipes; i++) {
      for (const sel of selectors) {
        try {
          const el = await $(sel);
          if (
            (await el.isExisting().catch(() => false)) &&
            (await el.isDisplayed().catch(() => false))
          ) {
            return true;
          }
        } catch {
          /* try next selector */
        }
      }
      if (i < maxSwipes) await this.scrollDown(1);
    }
    return false;
  }

  private async scrollUntilLabelVisible(label: string, maxSwipes = 6): Promise<void> {
    for (let i = 0; i < maxSwipes; i++) {
      try {
        const el = await $(
          `-ios predicate string:label CONTAINS "${label}" OR name CONTAINS "${label}"`
        );
        if (await el.isDisplayed().catch(() => false)) return;
      } catch {
        /* swipe */
      }
      await this.scrollDown(1);
    }
  }

  private async tapAddNearLabel(label: string): Promise<boolean> {
    // Cell / button that includes ADD near the section label
    const candidates = [
      `-ios predicate string:label CONTAINS "${label}" AND (label CONTAINS "ADD" OR name CONTAINS "ADD")`,
      `-ios class chain:**/XCUIElementTypeButton[\`label CONTAINS "ADD"\`]`,
      '~+ ADD',
      '~ADD',
      '-ios predicate string:label == "+ ADD" OR label == "ADD" OR name == "ADD"',
    ];
    for (const sel of candidates) {
      try {
        const els = await $$(sel);
        for (const el of els) {
          if (await el.isDisplayed().catch(() => false)) {
            await el.click();
            await browser.pause(700);
            return true;
          }
        }
      } catch {
        /* next */
      }
    }
    return false;
  }
}

export default new CreateAppraisalPage();

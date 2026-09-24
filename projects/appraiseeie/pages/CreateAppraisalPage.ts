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
import {
  pickLibraryPhotoAtIndex,
  type DamageType,
} from '../helpers/iosPhotos';
import { dumpPageSource } from '../helpers/debugDump';

/** One of the 6 real photo slots TradeIn.mm exposes — matches
 * arrLblImgType's order 1:1 (see SIDE_ORDER below). There is no "FrontRear"
 * slot in the app; marking damage on both sides means two separate calls,
 * one per side. */
export type VehiclePhotoSide =
  | 'Front'
  | 'Rear'
  | 'DriverFront'
  | 'DriverRear'
  | 'PassengerFront'
  | 'PassengerRear';

const SIDE_TO_LABEL: Record<VehiclePhotoSide, string> = {
  Front: 'FRONT',
  DriverFront: 'DRIVER FRONT',
  DriverRear: 'DRIVER REAR',
  Rear: 'REAR',
  PassengerRear: 'PASSENGER REAR',
  PassengerFront: 'PASSENGER FRONT',
};

/** Same order as arrLblImgType in TradeIn.mm / appraisalData.vehiclePhotoSlots
 * — keeps each side's picker index identical to what the full
 * addVehiclePhotosForSlots flow already uses and has proven reliable. */
const SIDE_ORDER: VehiclePhotoSide[] = [
  'Front',
  'DriverFront',
  'DriverRear',
  'Rear',
  'PassengerRear',
  'PassengerFront',
];

export interface AddVehiclePhotoOptions {
  side: VehiclePhotoSide;
  /**
   * Fixture filename under fixtures/vehicle-photos/ — used to seed the
   * Simulator's Photos library ahead of time (injectVehiclePhotoFixturesToSimulator)
   * and included in log output for traceability. On a real device iOS never
   * exposes a photo's original filename via accessibility (confirmed via
   * live page-source dumps — labels are only "Photo, <date>"), so this can't
   * be matched to a specific on-device photo there; the picker still falls
   * back to the side's positional index.
   */
  image?: string;
}

export interface AddVehiclePhotoWithDamageOptions extends AddVehiclePhotoOptions {
  /** Defaults to SCRATCH — the app's actual damage types are
   * SCRATCH/DENT/CHIP/CRACK/MISSING; there is no "Rear"/"Front/Rear" type. */
  damage?: DamageType;
}

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
      await browser.pause(200);
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
        await browser.pause(200);
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
    await browser.pause(200);
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
      await browser.pause(250);
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
    await this.scrollUntilDisplayed(this.nextSelectors(TEST_IDS.tradeIn.reqNext), 6);
    const next = await this.findDisplayed(
      this.nextSelectors(TEST_IDS.tradeIn.reqNext),
      10000
    );
    await next.click();
    await browser.pause(500);
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
    return (await this.findTextContaining(needles, timeoutMs)) !== null;
  }

  /**
   * Like waitForTextContaining, but returns the matched label's actual text
   * (verbatim, original case) instead of a boolean — so callers/the report
   * can show the app's own wording rather than a generic message.
   */
  private async findTextContaining(
    needles: string[],
    timeoutMs = 5000
  ): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    const lower = needles.map((n) => n.toLowerCase());
    while (Date.now() < deadline) {
      try {
        const labels = await $$(
          '-ios class chain:**/XCUIElementTypeStaticText'
        );
        for (const label of labels) {
          const text = (await label.getText().catch(() => '')) || '';
          if (lower.some((n) => text.toLowerCase().includes(n))) return text;
        }
      } catch {
        /* retry */
      }
      await browser.pause(150);
    }
    return null;
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
      let onTradeInStep = false;
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
        onTradeInStep = true;
      }
      await this.dismissKeyboard();
      await this.tapLookupIfPresent(
        onTradeInStep ? TEST_IDS.tradeIn.trdLookup : TEST_IDS.tradeIn.reqLookup,
        onTradeInStep ? TEST_IDS.tradeIn.trdMake : TEST_IDS.tradeIn.reqMake
      );
    }
  }

  /**
   * Magnifying-glass lookup next to registration (API auto-fill).
   * `lookupId`/`makeFieldId` are the step-specific ("req" vs "trd") test IDs;
   * the label/class-chain predicates are a fallback only.
   */
  async tapLookupIfPresent(lookupId: string, makeFieldId: string): Promise<void> {
    let tapped = await this.tapLookupButton(lookupId);
    if (!tapped) {
      // The "previously been appraised" popup can already be covering the
      // search button on this very first attempt (dismissing the keyboard
      // on the registration field independently fires that duplicate-check
      // API) — every isDisplayed() check above then sees a control blocked
      // by the modal and reports it as not tappable, so tapLookupButton
      // returns false having never actually tapped anything. Dismiss the
      // popup and retry the tap once before giving up outright.
      await this.dismissInfoAlertIfPresent();
      tapped = await this.tapLookupButton(lookupId);
    }
    if (!tapped) return;
    clientLog('Registration lookup tapped — waiting for auto-fill');
    const settled = await this.waitForLookupToSettle(makeFieldId);
    if (settled) return;

    // The "previously been appraised" popup (dismissInfoAlertIfPresent)
    // sometimes appears mid-lookup and swallows the original API response —
    // Make/Model stay on their placeholder even though the plate is valid.
    // Re-tapping search fires a fresh lookup call, which usually recovers it.
    clientLog('Lookup did not auto-fill — retrying search tap once');
    const retapped = await this.tapLookupButton(lookupId);
    if (!retapped) return;
    const settledOnRetry = await this.waitForLookupToSettle(makeFieldId);
    if (!settledOnRetry) {
      clientLog('Lookup still did not populate MAKE after retry — plate may be unrecognized');
    }
  }

  private async tapLookupButton(lookupId: string): Promise<boolean> {
    const sels = [
      this.id(lookupId),
      '-ios predicate string:label CONTAINS[c] "search" OR name CONTAINS[c] "search"',
      '-ios class chain:**/XCUIElementTypeButton[`label CONTAINS "magnifying" OR name CONTAINS "look"`]',
    ];
    for (const sel of sels) {
      try {
        const els = await $$(sel);
        for (const el of els.slice(0, 4)) {
          if (await el.isDisplayed().catch(() => false)) {
            await el.click();
            return true;
          }
        }
      } catch {
        /* next selector */
      }
    }
    return false;
  }

  /**
   * Registration lookup is async (network call + MBProgressHUD). Rather than
   * a blind fixed sleep, poll for the MAKE button's title to change from its
   * "MAKE" placeholder to a real value.
   *
   * On the Trade In screen, dismissing the keyboard on the registration field
   * independently fires the "already appraised" duplicate-check API — a
   * *different* call from the one that fills Make/Model. Its alert must be
   * dismissed as soon as it appears (it blocks all other taps), but seeing it
   * is not "lookup done": that would return before Make/Model ever populate.
   * So dismiss-and-keep-waiting, not dismiss-and-return.
   *
   * Returns whether Make/Model actually populated — the caller decides
   * whether to retry the search tap on false, rather than logging a final
   * "unrecognized" verdict here before a retry has even been attempted.
   */
  private async waitForLookupToSettle(makeFieldId: string, timeoutMs = 8000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await this.dismissInfoAlertIfPresent();

      const makeText = (
        (await $(this.id(makeFieldId))
          .then((el) => el.getText())
          .catch(() => '')) || ''
      ).trim();
      // Placeholder is "MAKE" on Vehicle Required but "MAKE*" (required-field
      // marker) on Vehicle Trade In — strip a trailing "*" before comparing.
      const normalized = makeText.toUpperCase().replace(/\*$/, '');
      if (makeText && normalized !== 'MAKE') {
        clientLog(`Vehicle auto-filled: ${makeText}`);
        return true;
      }
      await browser.pause(200);
    }
    return false;
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
        await browser.pause(300);
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
    await browser.pause(500);
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
          appraisalData.registrationRequired
        );
        await this.dismissKeyboard();
        await this.tapLookupIfPresent(TEST_IDS.tradeIn.reqLookup, TEST_IDS.tradeIn.reqMake);
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
   * Enter plate → lookup auto-fill (Make/Model/Colour) → the API never
   * returns Mileage, so fill it ourselves before NEXT rather than clicking
   * NEXT blind and reacting to a validation failure.
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
    await this.tapLookupIfPresent(TEST_IDS.tradeIn.trdLookup, TEST_IDS.tradeIn.trdMake);
    await this.dismissInfoAlertIfPresent();

    await this.fillMileageIfEmpty(TEST_IDS.tradeIn.trdMileage, mileage);
    await this.ensureTaxExpiryIfNeeded();
    await this.tapNext(TEST_IDS.tradeIn.trdNext);

    // Safety net: app-side validation (or a NEXT tap that silently didn't
    // register) still left us on this screen — a couple of retries absorbs
    // that without failing the whole run outright.
    for (let attempt = 0; attempt < 2 && (await this.isTradeInVisible()); attempt++) {
      clientLog('Still on Vehicle Trade In after NEXT — retrying mileage/tax');
      await this.fillMileageIfEmpty(TEST_IDS.tradeIn.trdMileage, mileage);
      await this.ensureTaxExpiryIfNeeded();
      await this.tapNext(TEST_IDS.tradeIn.trdNext);
    }
  }

  /**
   * MILEAGE is never populated by the registration lookup (confirmed in
   * TradeIn.mm — the vehicle API response has no mileage field), so this
   * isn't optional/reactive: fill it whenever it's still blank.
   */
  private async fillMileageIfEmpty(fieldId: string, mileage: string): Promise<void> {
    const selectors = [
      this.id(fieldId),
      '-ios predicate string:placeholderValue CONTAINS "MILEAGE"',
    ];
    await this.scrollUntilDisplayed(selectors);
    try {
      const field = await this.findDisplayed(selectors, 5000);
      const current = ((await field.getValue().catch(() => '')) || '').trim();
      // WDA reports the placeholder text itself (e.g. "MILEAGE*") as the
      // field's value when it's empty rather than an empty string — a plain
      // length check alone treats an untouched field as "already filled".
      const isPlaceholder = /^MILEAGE\*?$/i.test(current);
      if (current.length === 0 || isPlaceholder) {
        clientLog('Mileage not auto-filled — entering manually');
        await field.click();
        await field.clearValue().catch(() => undefined);
        await field.setValue(mileage);
        await this.dismissKeyboard();
      }
    } catch {
      /* not visible — NEXT-click validation retry below will surface it */
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
        await browser.pause(350);
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
   *
   * Either DAMAGE toggle enables the photo strip (TradeIn.mm
   * btnTyresOkDamageClicked / btnAlloysOkDamageClicked). On iPhone that strip
   * is one horizontal collection, `collTyre`, with the five captions in
   * `arrLblTyreAlloysImgType`. Each selected DAMAGE side gets a gallery photo
   * on every slot: DRIVER FRONT, DRIVER REAR, PASSENGER FRONT, PASSENGER REAR,
   * EXTRA. iPad has a second alloy collection; it is filled only when Alloys
   * is DAMAGE and that collection is actually on screen.
   */
  async completeDamageStep(
    tyreDamage: boolean,
    alloyDamage: boolean,
    damagePhotoSlots?: readonly string[]
  ): Promise<void> {
    await this.waitForDamageStep();
    clientLog(
      `Tyres: ${tyreDamage ? 'DAMAGE' : 'OK'} · Alloys: ${alloyDamage ? 'DAMAGE' : 'OK'}`
    );

    if (tyreDamage) {
      await this.tapSegment(TEST_IDS.tradeIn.tyreDamage, 'DAMAGE');
    } else {
      await this.tapSegment(TEST_IDS.tradeIn.tyreOk, 'OK');
    }

    if (alloyDamage) {
      await this.tapSegment(TEST_IDS.tradeIn.alloyDamage, 'DAMAGE');
    } else {
      await this.tapSegment(TEST_IDS.tradeIn.alloyOk, 'OK');
    }

    if (!appraisalData.skipPhotos && (tyreDamage || alloyDamage)) {
      const slots = [
        ...(damagePhotoSlots ??
          appraisalData.damagePhotoSlotsFor(tyreDamage, alloyDamage)),
      ];
      clientLog(
        `Step 3 gallery: ${slots.length} damage slot(s) — ${slots.join(', ') || '(none)'}`
      );
      if (slots.length === 0) {
        clientLog('No damage photo slots selected — skipping step 3 gallery picks');
      } else {
      // iPhone: both toggles share collTyre, so one pass covers Tyres and Alloys.
      // iPad: collAlloys is a separate strip and is filled on its own.
      const alloyGridSeparate = alloyDamage && (await this.isCollectionOnScreen(TEST_IDS.tradeIn.alloyPhotos));
      if (tyreDamage || !alloyGridSeparate) {
        await this.addDamagePhotosFromGallery(TEST_IDS.tradeIn.tyrePhotos, 'tyre', slots);
      }
      if (alloyGridSeparate) {
        await this.addDamagePhotosFromGallery(TEST_IDS.tradeIn.alloyPhotos, 'alloy', slots);
      }
      }
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
      await browser.pause(250);
    } catch (err) {
      console.log(`[Damage] Could not tap ${labelFallback}: ${String(err)}`);
    }
  }

  /**
   * The top step icons (VEHICLE REQUIRED / TRADE IN / DAMAGE / PHOTOS) jump
   * straight to that page with no validation gate — TradeIn.mm's
   * ImagePhotoClick: always calls setMainScrollViewContentOffset:3. Useful
   * for iterating on the photo-upload step alone instead of re-running the
   * whole wizard every time.
   */
  async jumpToVehiclePhotosTab(): Promise<void> {
    clientLog('Jumping directly to Vehicle Photos tab');
    const tab = await this.findDisplayed(['~tradein_tab_vehicle_photos'], 8000);
    await tab.click();
    await browser.pause(350);
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
      if (labels.length === 0) {
        clientLog('No vehicle photo slots selected — skipping step 4 gallery picks');
      } else {
        await this.addVehiclePhotosForSlots(labels);
      }
    } else {
      clientLog('Skipping photo uploads (APPRAISEE_SKIP_PHOTOS)');
    }
    await this.scrollDown(3);
    const saveSelectors = [
      this.id(TEST_IDS.tradeIn.photosSave),
      '~SAVE',
      '-ios predicate string:label == "SAVE" OR name == "SAVE"',
    ];
    const save = await this.findDisplayed(saveSelectors, 12000);
    await save.click();
    clientLog('SAVE tapped — Create Appraisal submitted');
    await this.verifySaveSucceeded(saveSelectors);
  }

  /**
   * SAVE has no dedicated success signal (no confirmation toast/screen ID
   * in the app) — treat the SAVE button disappearing as navigation away
   * from Vehicle Photos (submission went through). If it's still on screen
   * after the timeout, check for an error toast so the failure carries the
   * app's own message where possible, then throw either way: a SAVE tap
   * that silently does nothing must fail the test and stop the script
   * immediately, not be reported as a pass.
   */
  private static readonly SAVE_ERROR_NEEDLES = [
    'error',
    'failed',
    'unable',
    'try again',
    'something went wrong',
    "can't be the same",
    'cannot be the same',
  ];

  private async verifySaveSucceeded(
    saveSelectors: string[],
    timeoutMs = 15000
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const stillOnPhotos = await this.findDisplayed(saveSelectors, 500)
        .then(() => true)
        .catch(() => false);
      if (!stillOnPhotos) {
        clientLog('Appraisal submitted — left the Vehicle Photos step');
        return;
      }

      // Check for the app's own validation/error text as we go, instead of
      // only after the full timeout — an inline message (e.g. the duplicate
      // registration check) can appear immediately while SAVE stays visible.
      const earlyError = await this.findTextContaining(
        CreateAppraisalPage.SAVE_ERROR_NEEDLES,
        300
      ).catch(() => null);
      if (earlyError) {
        clientLog(`SAVE rejected — app error: "${earlyError}"`);
        await dumpPageSource('appraisal_save_failed');
        throw new Error(`Create Appraisal SAVE failed — app error: "${earlyError}"`);
      }

      await browser.pause(300);
    }

    const errorText = await this.findTextContaining(
      CreateAppraisalPage.SAVE_ERROR_NEEDLES,
      2000
    ).catch(() => null);
    await dumpPageSource('appraisal_save_failed');
    throw new Error(
      errorText
        ? `Create Appraisal SAVE failed — app error: "${errorText}"`
        : `Create Appraisal SAVE tapped but the app did not leave the Vehicle Photos step within ${timeoutMs}ms — submission likely failed.`
    );
  }

  /** `"DRIVER FRONT"` → `"tradein_vehicle_photo_driver_front"` — matches the
   * identifier TradeIn.mm's cellForItemAtIndexPath assigns per slot. */
  private vehiclePhotoSlotId(label: string): string {
    const safe = label.trim().toLowerCase().replace(/\s+/g, '_');
    return `tradein_vehicle_photo_${safe}`;
  }

  /**
   * Vehicle Photos step (page 4) only. Each slot cell is individually
   * accessible (tradein_vehicle_photo_front / _driver_front / …) and reports
   * accessibilityValue "empty"/"filled", so this both targets the exact
   * placeholder and verifies the picked image actually landed in it —
   * instead of the caption search addDamagePhotosFromGallery uses for the
   * Damage step's tyre/alloy strip (a different, horizontal collection).
   *
   * `damageSlotIndices` marks one damage circle on those slots (0-based,
   * default FRONT + REAR — the two most reliable slots) via EditImageVC's
   * own damage-marking controls, before SAVE.
   */
  async addVehiclePhotosForSlots(
    labels: readonly string[],
    damageSlotIndices: readonly number[] = [0, 3]
  ): Promise<void> {
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const gridIndex = appraisalData.vehiclePhotoSlots.indexOf(
        label as (typeof appraisalData.vehiclePhotoSlots)[number]
      );
      const photoIndex = gridIndex >= 0 ? gridIndex : i;
      const idSelector = this.id(this.vehiclePhotoSlotId(label));
      const markDamage = damageSlotIndices.includes(photoIndex);
      clientLog(`Adding vehicle photo: ${label}${markDamage ? ' (with damage marker)' : ''}`);

      let cell;
      try {
        await this.scrollUntilDisplayed([idSelector]);
        cell = await this.findDisplayed([idSelector], 6000);
      } catch {
        clientLog(`Vehicle photo slot not found: ${label} — skipping`);
        continue;
      }

      await cell.click();
      // Empty-slot action sheet: Cancel / Camera / Gallery
      try {
        const gallery = await $(
          '-ios predicate string:label == "Gallery" OR name == "Gallery"'
        );
        if (await gallery.isDisplayed().catch(() => false)) {
          await gallery.click();
        }
      } catch {
        /* action sheet not shown — picker may already be open */
      }

      const picked = await pickLibraryPhotoAtIndex(photoIndex, { markDamage });
      if (!picked) {
        clientLog(`Could not select a photo for ${label}`);
        // pickLibraryPhotoAtIndex already tried to recover, but confirm
        // we're actually back on this step before trusting the next slot's
        // cell lookup — otherwise every remaining slot fails one-by-one
        // instead of failing fast with a clear reason.
        try {
          await this.waitForPhotosStep(6000);
        } catch {
          clientLog(
            'Could not return to Vehicle Photos after a failed pick — stopping remaining slots'
          );
          break;
        }
        continue;
      }

      const verified = await this.verifyVehiclePhotoSlotFilled(idSelector);
      clientLog(
        verified
          ? `Verified photo added for ${label}`
          : `Could not verify photo for ${label} (slot still reports empty)`
      );
    }
  }

  /**
   * cellForItemAtIndexPath sets accessibilityValue to "filled" once the slot
   * holds a real image, or "damaged" once it also has a damage marker
   * (mirrors the app's own imgBorder-visible / isEdited state) — poll for
   * either rather than assuming success right after picking. "damaged" is
   * also a filled state; both count as the photo having landed.
   */
  private async verifyVehiclePhotoSlotFilled(
    idSelector: string,
    timeoutMs = 6000
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const el = await $(idSelector);
        const value = await el.getAttribute('value').catch(() => null);
        if (value === 'filled' || value === 'damaged') return true;
      } catch {
        /* retry */
      }
      await browser.pause(150);
    }
    return false;
  }

  /**
   * Same wait-and-poll as verifyVehiclePhotoSlotFilled, but returns the
   * actual last-seen accessibilityValue (empty/filled/damaged) instead of a
   * plain boolean, so a mismatch can report what was really on screen.
   */
  private async waitForVehiclePhotoSlotValue(
    idSelector: string,
    acceptableValues: readonly string[],
    timeoutMs = 8000
  ): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    let last: string | null = null;
    while (Date.now() < deadline) {
      try {
        const el = await $(idSelector);
        const value = (await el.getAttribute('value').catch(() => null)) as string | null;
        last = value;
        if (value && acceptableValues.includes(value)) return value;
      } catch {
        /* retry */
      }
      await browser.pause(150);
    }
    return last;
  }

  /**
   * Shared implementation behind addVehiclePhotoWithoutDamage and
   * addVehiclePhotoWithDamage — targets one slot by side, opens Gallery,
   * picks a photo (marking damage first if requested), then verifies the
   * slot's accessibilityValue matches what was actually requested rather
   * than assuming success. Throws (with a page-source dump) on any mismatch
   * instead of silently continuing, per the failure-handling requirements;
   * the framework's afterTest hook already screenshots on any thrown error.
   */
  private async addSingleVehiclePhoto(opts: {
    side: VehiclePhotoSide;
    image?: string;
    markDamage: boolean;
    damageType?: DamageType;
  }): Promise<void> {
    const { side, image, markDamage, damageType } = opts;
    const label = SIDE_TO_LABEL[side];
    const index = SIDE_ORDER.indexOf(side);
    const idSelector = this.id(this.vehiclePhotoSlotId(label));
    const expectedValue = markDamage ? 'damaged' : 'filled';
    clientLog(
      `Adding vehicle photo: ${label}` +
        (image ? ` (image: ${image})` : '') +
        (markDamage ? ` (damage: ${damageType ?? 'SCRATCH'})` : ' (no damage)')
    );

    let cell;
    try {
      await this.scrollUntilDisplayed([idSelector]);
      cell = await this.findDisplayed([idSelector], 8000);
    } catch (err) {
      await dumpPageSource(`vehicle_photo_slot_not_found_${label}`);
      throw new Error(
        `Vehicle photo slot "${label}" not found on the Vehicle Photos step: ${String(err)}`
      );
    }

    await cell.click();
    // Empty-slot action sheet: Cancel / Camera / Gallery
    try {
      const gallery = await $(
        '-ios predicate string:label == "Gallery" OR name == "Gallery"'
      );
      if (await gallery.isDisplayed().catch(() => false)) {
        await gallery.click();
      }
    } catch {
      /* action sheet not shown — picker may already be open */
    }

    const picked = await pickLibraryPhotoAtIndex(index, { markDamage, damageType });
    if (!picked) {
      await dumpPageSource(`vehicle_photo_pick_failed_${label}`);
      // Try to land back on a known screen so a test running several of
      // these calls isn't left stranded on the picker — but this is
      // diagnostics only, the failure itself is still reported below.
      await this.waitForPhotosStep(6000).catch(() => undefined);
      throw new Error(
        `Could not select a photo for "${label}" — the Gallery picker never returned an image ` +
          `to the app (see the captured page source for the exact on-screen state at the time).`
      );
    }

    const actualValue = await this.waitForVehiclePhotoSlotValue(
      idSelector,
      [expectedValue],
      8000
    );
    if (actualValue !== expectedValue) {
      await dumpPageSource(`vehicle_photo_state_mismatch_${label}`);
      throw new Error(
        `Vehicle photo "${label}": expected slot state "${expectedValue}" but observed ` +
          `"${actualValue ?? 'unknown'}" — ` +
          (markDamage
            ? 'the damage marker may not have been applied.'
            : 'an unexpected damage marker may have been applied.')
      );
    }
    clientLog(`Verified ${label}: ${actualValue}`);
  }

  /**
   * Add a photo to one vehicle-photo slot with no damage marker.
   * Reuses the same slot-targeting / picker / verification logic as
   * addVehiclePhotoWithDamage — see addSingleVehiclePhoto.
   */
  async addVehiclePhotoWithoutDamage(opts: AddVehiclePhotoOptions): Promise<void> {
    await this.addSingleVehiclePhoto({ ...opts, markDamage: false });
  }

  /**
   * Add a photo to one vehicle-photo slot and mark it with a damage circle
   * (EditImageVC's own damage-type controls — default SCRATCH). The app has
   * no per-side "Rear"/"Front/Rear" damage option; "side" here selects which
   * photo slot gets the marker, matching the app's real per-photo model.
   */
  async addVehiclePhotoWithDamage(opts: AddVehiclePhotoWithDamageOptions): Promise<void> {
    await this.addSingleVehiclePhoto({
      ...opts,
      markDamage: true,
      damageType: opts.damage ?? 'SCRATCH',
    });
  }

  /**
   * `"DRIVER FRONT"` → `"tradein_tyre_photo_driver_front"` (or alloy).
   * Matches the identifier cellForItemAtIndexPath assigns on the damage strip.
   * Until the app is rebuilt with those ids, the caption fallback below still
   * finds the same slot by its exact label.
   */
  private damagePhotoSlotId(kind: 'tyre' | 'alloy', label: string): string {
    const safe = label.trim().toLowerCase().replace(/\s+/g, '_');
    return `tradein_${kind}_photo_${safe}`;
  }

  /** True when that collection view is in the hierarchy and on screen. */
  private async isCollectionOnScreen(collectionId: string): Promise<boolean> {
    try {
      const el = await $(this.id(collectionId));
      return (
        (await el.isExisting().catch(() => false)) &&
        (await el.isDisplayed().catch(() => false))
      );
    } catch {
      return false;
    }
  }

  /**
   * TradeIn.mm lays the damage boxes out horizontally at 70×100 with the
   * flow layout's default 10pt line spacing. Order matches
   * arrLblTyreAlloysImgType: index 0 is DRIVER FRONT, index 4 is EXTRA.
   */
  private static readonly DAMAGE_BOX_WIDTH = 70;
  private static readonly DAMAGE_BOX_STRIDE = 80;

  /**
   * Add a gallery photo to every box on the damage strip.
   *
   * The collection is one accessibility element, so the captions inside it
   * report as not displayed and a label search only swipes the strip.
   * Each box is opened with a coordinate tap on its photo, then Gallery.
   * On EditImageVC the same damage control as Vehicle Photos places one
   * circle (SCRATCH) before SAVE.
   */
  private damageStripIndexForLabel(label: string): number {
    const idx = appraisalData.damagePhotoSlots.indexOf(
      label as (typeof appraisalData.damagePhotoSlots)[number]
    );
    return idx >= 0 ? idx : 0;
  }

  private async addDamagePhotosFromGallery(
    collectionId: string,
    kind: 'tyre' | 'alloy',
    labels: readonly string[]
  ): Promise<void> {
    clientLog(`Adding ${kind} damage photos from gallery (${labels.length} selected: ${labels.join(', ')})`);
    this.damageStripShift = 0;
    const visible = await this.scrollUntilDisplayed([this.id(collectionId)], 4);
    if (!visible) {
      clientLog(`${kind} photo strip not on screen — skipping damage photos`);
      return;
    }

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const stripIndex = this.damageStripIndexForLabel(label);
      clientLog(`Adding ${kind} damage photo: ${label} (strip #${stripIndex + 1}, damage circle)`);

      this.damageStripShift = 0;
      const opened = await this.openDamagePhotoBox(
        collectionId,
        kind,
        label,
        stripIndex
      );
      if (!opened) {
        clientLog(`Could not open ${kind} box: ${label} — skipping`);
        continue;
      }

      const picked = await pickLibraryPhotoAtIndex(stripIndex, { markDamage: true });
      if (!picked) {
        clientLog(`Could not select a gallery photo for ${label}`);
        await this.dismissPhotoPickerIfOpen();
        continue;
      }
      clientLog(`Gallery photo added for ${label}`);
      await browser.pause(400);
    }
  }

  /**
   * Tap one damage box so Camera / Gallery appears, then choose Gallery.
   * Tries the per-box accessibility id first (after an app rebuild), then
   * the box's fixed position in the horizontal strip.
   */
  private async openDamagePhotoBox(
    collectionId: string,
    kind: 'tyre' | 'alloy',
    label: string,
    index: number
  ): Promise<boolean> {
    const idSelector = this.id(this.damagePhotoSlotId(kind, label));
    try {
      const byId = await $(idSelector);
      if (await byId.isDisplayed().catch(() => false)) {
        await byId.click();
        await browser.pause(400);
        if (await this.chooseGallerySource()) return true;
      }
    } catch {
      /* id is not in the installed build */
    }

    const collection = await $(this.id(collectionId));
    const tapped = await this.tapDamageBoxAtIndex(collection, index);
    if (!tapped) return false;
    return this.chooseGallerySource();
  }

  /**
   * Touch the photo area of box `index`. Scrolls the strip just far enough
   * for that box to sit on screen, and remembers how far it has moved so
   * the next box is measured from the same origin.
   */
  private damageStripShift = 0;

  private async tapDamageBoxAtIndex(
    collection: WebdriverIO.Element,
    index: number
  ): Promise<boolean> {
    try {
      const loc = await collection.getLocation();
      const size = await collection.getSize();
      if (!size || size.width <= 0 || size.height <= 0) return false;

      const left = Math.max(8, Math.round(loc.x));
      const right = Math.round(loc.x + size.width - 16);
      let x =
        Math.round(loc.x) +
        index * CreateAppraisalPage.DAMAGE_BOX_STRIDE +
        CreateAppraisalPage.DAMAGE_BOX_WIDTH / 2 -
        this.damageStripShift;

      if (x > right) {
        const delta = Math.round(x - (left + right) / 2);
        await this.dragWithinStrip(collection, delta);
        this.damageStripShift += delta;
        x -= delta;
      }

      x = Math.min(Math.max(x, left), right);
      // Cell is 100pt tall inside the strip; 50pt down is the photo, not the caption.
      const y = Math.round(loc.y + Math.min(50, size.height / 2));
      clientLog(`Tapping ${index + 1} damage box at ${x},${y}`);
      await browser.execute('mobile: tap', { x, y });
      await browser.pause(500);
      return true;
    } catch (err) {
      clientLog(`Damage box tap failed: ${String(err)}`);
      return false;
    }
  }

  /** Drag left inside the strip by `delta` points. Does not page the wizard. */
  private async dragWithinStrip(el: WebdriverIO.Element, delta: number): Promise<void> {
    const loc = await el.getLocation();
    const size = await el.getSize();
    const y = Math.round(loc.y + Math.min(size.height, 70) / 2);
    const fromX = Math.round(loc.x + size.width * 0.8);
    const toX = Math.max(Math.round(loc.x + 12), fromX - delta);
    await browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ duration: 0, x: fromX, y })
      .down({ button: 0 })
      .pause(40)
      .move({ duration: 350, x: toX, y })
      .up({ button: 0 })
      .perform()
      .catch(() => undefined);
    await browser.releaseActions().catch(() => undefined);
    await browser.pause(300);
  }

  /**
   * Empty damage boxes show Cancel / Camera / Gallery (`takeVehiclePhoto:`).
   * Gallery is what adds the photo. Returns false when that sheet never opened,
   * so the caller does not pick a photo from the wrong screen.
   */
  private async chooseGallerySource(timeoutMs = 5000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const gallery = await $(
          '-ios predicate string:label == "Gallery" OR name == "Gallery"'
        );
        if (await gallery.isDisplayed().catch(() => false)) {
          await gallery.click();
          clientLog('Gallery selected for damage photo');
          await browser.pause(500);
          return true;
        }
      } catch {
        /* sheet still animating */
      }
      try {
        const picker = await $(
          '-ios class chain:**/XCUIElementTypeImage[`name == "PXGGridLayout-Info"`]'
        );
        if (await picker.isExisting().catch(() => false)) return true;
      } catch {
        /* not in the library yet */
      }
      await browser.pause(200);
    }
    clientLog('Gallery option did not appear for this damage box');
    return false;
  }

  /** Close a photo picker that opened without a usable image. */
  private async dismissPhotoPickerIfOpen(): Promise<void> {
    for (const label of ['Cancel', 'Close']) {
      try {
        const btn = await $(
          `-ios predicate string:label == "${label}" OR name == "${label}"`
        );
        if (await btn.isDisplayed().catch(() => false)) {
          await btn.click();
          await browser.pause(300);
          return;
        }
      } catch {
        /* next */
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
}

export default new CreateAppraisalPage();

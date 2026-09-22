/**
 * iOS photo helpers for Create Appraisal image upload steps.
 *
 * Strategy:
 * 1. On Simulator, deterministically seed fixtures/vehicle-photos/*.jpg (one
 *    distinctly-labelled image per vehicle-photo slot) via simctl before the
 *    run, so each slot can be filled with a known, different image.
 * 2. On a real device there is no CLI/API to seed the Photos library — Apple
 *    doesn't expose one (confirmed: no `simctl`-equivalent under
 *    `xcrun devicectl`). Real-device runs fall back to picking whatever
 *    photos already exist in the library, one distinct positional thumbnail
 *    per slot (see pickLibraryPhotoAtIndex) — the library just needs at
 *    least as many photos as slots, added once, manually, ahead of time.
 * 3. Set APPRAISEE_SKIP_PHOTOS=true to skip uploads while debugging other steps.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { clientLog } from './clientLog';

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'appraisal-sample.png');
const VEHICLE_PHOTO_FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'vehicle-photos');

/**
 * Best-effort: add the sample PNG to the booted iOS Simulator Photos library.
 * No-op on real devices (push manually or use an existing library photo).
 */
export function injectSamplePhotoToSimulator(): void {
  if (!fs.existsSync(FIXTURE)) {
    console.log('[Photos] Fixture missing:', FIXTURE);
    return;
  }
  try {
    const udid = (process.env.IOS_DEVICE_UDID || '').trim();
    const target = udid || 'booted';
    execSync(`xcrun simctl addmedia ${target} "${FIXTURE}"`, {
      stdio: 'ignore',
    });
    console.log('[Photos] Injected sample image into simulator:', target);
  } catch (err) {
    console.log(`[Photos] simctl addmedia skipped: ${String(err)}`);
  }
}

/**
 * Best-effort: add every fixtures/vehicle-photos/*.jpg to the booted iOS
 * Simulator Photos library, so each vehicle-photo slot can pick a distinct,
 * recognisable image instead of reusing whatever happens to be first.
 * No-op on real devices — same simctl-only limitation as injectSamplePhotoToSimulator.
 */
export function injectVehiclePhotoFixturesToSimulator(): void {
  if (!fs.existsSync(VEHICLE_PHOTO_FIXTURES_DIR)) {
    console.log('[Photos] Vehicle photo fixtures dir missing:', VEHICLE_PHOTO_FIXTURES_DIR);
    return;
  }
  const udid = (process.env.IOS_DEVICE_UDID || '').trim();
  const target = udid || 'booted';
  const files = fs
    .readdirSync(VEHICLE_PHOTO_FIXTURES_DIR)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .sort();
  for (const file of files) {
    const full = path.join(VEHICLE_PHOTO_FIXTURES_DIR, file);
    try {
      execSync(`xcrun simctl addmedia ${target} "${full}"`, { stdio: 'ignore' });
      console.log('[Photos] Injected vehicle-photo fixture into simulator:', file);
    } catch (err) {
      console.log(`[Photos] simctl addmedia skipped for ${file}: ${String(err)}`);
    }
  }
}

/**
 * An iCloud-optimized library ("Optimize iPhone Storage") keeps only a
 * thumbnail on-device — tapping a photo not yet downloaded shows a blocking
 * "Downloading from iCloud…" dialog with a Cancel button. Wait it out rather
 * than timing out on the screen that appears only once it's done.
 */
async function waitForICloudDownload(timeoutMs = 45000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let sawDialog = false;
  while (Date.now() < deadline) {
    try {
      const dialog = await $(
        '-ios predicate string:label CONTAINS[c] "Downloading from iCloud" OR name CONTAINS[c] "Downloading from iCloud"'
      );
      if (await dialog.isDisplayed().catch(() => false)) {
        sawDialog = true;
        await browser.pause(500);
        continue;
      }
    } catch {
      /* not (or no longer) present */
    }
    if (sawDialog) clientLog('iCloud photo download finished');
    return;
  }
  clientLog('iCloud download did not finish within timeout — photo may be unusable');
}

/**
 * After tapping ADD on a photo slot, pick a library image by its positional
 * index in the grid (0 = first/most recent) and confirm. Handles common iOS
 * permission / picker sheets, then the app's mandatory EditImageVC screen
 * (TradeIn.mm presents this after *every* picked image, vehicle or damage —
 * TOCropViewController is dead/commented-out code, so there is no crop step;
 * EditImageVC's own "SAVE" button — tagged `edit_image_save_button` in
 * EditImageVC.m — is what actually commits the image and returns to TradeIn).
 */
export type DamageType = 'SCRATCH' | 'DENT' | 'CHIP' | 'CRACK' | 'MISSING';

export async function pickLibraryPhotoAtIndex(
  index: number,
  opts: { markDamage?: boolean; damageType?: DamageType } = {}
): Promise<boolean> {
  clientLog(`Selecting library photo #${index + 1}`);

  // Allow camera / photos permission sheets
  for (const label of ['Allow Access to All Photos', 'Allow Full Access', 'OK', 'Allow']) {
    try {
      const btn = await $(
        `-ios predicate string:label == "${label}" OR name == "${label}"`
      );
      if (await btn.isDisplayed().catch(() => false)) {
        await btn.click();
        await browser.pause(300);
      }
    } catch {
      /* continue */
    }
  }

  // Prefer Photo Library / Recents / Gallery over Camera
  for (const label of [
    'Photo Library',
    'Choose Existing',
    'Recents',
    'All Photos',
    'Gallery',
  ]) {
    try {
      const btn = await $(
        `-ios predicate string:label == "${label}" OR name == "${label}"`
      );
      if (await btn.isDisplayed().catch(() => false)) {
        await btn.click();
        await browser.pause(500);
        break;
      }
    } catch {
      /* continue */
    }
  }

  // Nth thumbnail in the picker grid. Apple's modern Photos picker
  // ("PhotosUI"/PXG) reports every real thumbnail's `visible` attribute as
  // false even though it's genuinely on-screen and tappable — WDA's
  // isDisplayed() check silently excludes all of them. Match by name/label
  // instead of filtering on visibility, and prefer real photos over
  // screenshots (this device's library mixes in screenshots taken while
  // testing this very automation).
  const grids = [
    '-ios class chain:**/XCUIElementTypeImage[`name == "PXGGridLayout-Info"`]',
    '-ios class chain:**/XCUIElementTypeImage[`visible == 1`]',
    '-ios class chain:**/XCUIElementTypeCell[`visible == 1`]',
  ];
  let tapped = false;
  for (const sel of grids) {
    try {
      const items = await $$(sel);
      if (items.length === 0) continue;
      // Click as soon as the target is found instead of first checking every
      // candidate's label — each extra round-trip to WDA widens the window
      // for the collection view to reflow/recycle the cell underneath the
      // element handle we're about to tap, which was landing taps on the
      // wrong photo (or nothing) for every slot after the first.
      let nonScreenshotSeen = 0;
      let fallback = items[Math.min(index, items.length - 1)];
      let target: typeof fallback | undefined;
      for (const item of items.slice(0, 40)) {
        const label = (await item.getAttribute('label').catch(() => '')) || '';
        if (/screenshot/i.test(label)) continue;
        if (nonScreenshotSeen === index) {
          target = item;
          break;
        }
        nonScreenshotSeen++;
      }
      const item = target ?? fallback;
      // WDA's element.click() on these PXG cells (visible="false" in the
      // accessibility tree despite being genuinely on-screen) sometimes
      // registers with the OS as a no-op — no "Downloading from iCloud"
      // dialog, no selection, nothing — while an identical click on a
      // different index works. A raw coordinate tap goes through the same
      // path as a real finger touch and doesn't hit whatever gesture-
      // recognizer quirk the accessibility-activation path does.
      let tappedViaCoords = false;
      try {
        const [location, size] = await Promise.all([item.getLocation(), item.getSize()]);
        if (size && size.width > 0 && size.height > 0) {
          const x = Math.round(location.x + size.width / 2);
          const y = Math.round(location.y + size.height / 2);
          await browser.execute('mobile: tap', { x, y });
          tappedViaCoords = true;
        }
      } catch {
        /* fall through to element.click() below */
      }
      if (!tappedViaCoords) {
        await item.click();
      }
      await browser.pause(350);
      // iCloud-optimized libraries keep only a thumbnail on-device — tapping
      // one not yet downloaded shows a blocking "Downloading from iCloud…"
      // dialog. Without waiting for it, the picker never returns the image
      // and EditImageVC never appears.
      await waitForICloudDownload();
      // Defensive: some picker configurations still show a Choose/Use/Done
      // confirmation before returning to the app (allowsEditing=NO here
      // normally skips this, but older iOS/picker variants may not).
      for (const done of ['Choose', 'Use Photo', 'Done', 'Use']) {
        try {
          const c = await $(
            `-ios predicate string:label == "${done}" OR name == "${done}"`
          );
          if (await c.isDisplayed().catch(() => false)) {
            await c.click();
            await browser.pause(300);
            break;
          }
        } catch {
          /* next */
        }
      }
      tapped = true;
      break;
    } catch {
      /* try next selector */
    }
  }

  if (!tapped) {
    try {
      const cancel = await $(
        '-ios predicate string:label == "Cancel" OR name == "Cancel"'
      );
      if (await cancel.isDisplayed().catch(() => false)) await cancel.click();
    } catch {
      /* ignore */
    }
    clientLog('Could not pick a photo — ensure the device Photos library has an image');
    return false;
  }

  return confirmEditImageScreen(opts.markDamage, opts.damageType);
}

/** Backward-compatible alias: always picks the first/most-recent photo. */
export async function pickFirstLibraryPhoto(): Promise<boolean> {
  return pickLibraryPhotoAtIndex(0);
}

const DAMAGE_TYPE_TO_ID: Record<DamageType, string> = {
  SCRATCH: 'edit_image_damage_scratch',
  DENT: 'edit_image_damage_dent',
  CHIP: 'edit_image_damage_chip',
  CRACK: 'edit_image_damage_crack',
  MISSING: 'edit_image_damage_missing',
};

/**
 * EditImageVC's own damage-marking controls (btnDamage/btnScratch/…, all
 * real IBOutlets — tagged directly in EditImageVC.m). Tapping a damage type
 * while no existing circle is selected calls addAnnotationWithImage:, which
 * places the marker at the image's center automatically — no drag gesture
 * needed. The app caps annotations at 2 per photo; this adds one.
 */
async function markDamageOnPhoto(
  damageType: DamageType = 'SCRATCH',
  timeoutMs = 15000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  const typeId = DAMAGE_TYPE_TO_ID[damageType];
  while (Date.now() < deadline) {
    try {
      const damageBtn = await $('~edit_image_damage_button');
      if (await damageBtn.isDisplayed().catch(() => false)) {
        await damageBtn.click();
        await browser.pause(300);
        const typeBtn = await $(`~${typeId}`);
        if (await typeBtn.isDisplayed().catch(() => false)) {
          await typeBtn.click();
          clientLog(`Damage marker (${damageType}) added`);
          await browser.pause(300);
          return true;
        }
        return false;
      }
    } catch {
      /* retry */
    }
    await browser.pause(200);
  }
  clientLog('Damage controls not found on EditImageVC — continuing without marking damage');
  return false;
}

/**
 * Wait for and confirm the app's mandatory EditImageVC screen, which appears
 * after every picked image regardless of vehicle vs. damage photo. With no
 * damage circles added, its SAVE action just commits the original image.
 */
async function confirmEditImageScreen(
  markDamage = false,
  damageType: DamageType = 'SCRATCH',
  timeoutMs = 20000
): Promise<boolean> {
  if (markDamage) {
    await markDamageOnPhoto(damageType);
  }
  const deadline = Date.now() + timeoutMs;
  const saveSelectors = [
    '~edit_image_save_button',
    '-ios predicate string:label == "SAVE" OR name == "SAVE" OR label == "Save" OR name == "Save"',
  ];
  while (Date.now() < deadline) {
    for (const sel of saveSelectors) {
      try {
        const btn = await $(sel);
        if (await btn.isDisplayed().catch(() => false)) {
          await btn.click();
          clientLog('Photo confirmed (EditImageVC SAVE)');
          await browser.pause(300);
          return true;
        }
      } catch {
        /* try next selector */
      }
    }
    await browser.pause(200);
  }
  clientLog('EditImageVC SAVE button not found — image may not have been committed');
  await recoverFromStuckPicker();
  return false;
}

/**
 * Best-effort recovery when the picker never returned to the app within the
 * timeout — seen on a real device whose Photos library has non-photo
 * interstitial cards mixed into the grid; tapping one of those doesn't
 * select a real image, so EditImageVC never appears and the picker is left
 * open. Without this, one bad thumbnail strands every later slot too, since
 * none of them can find their cell on a screen that isn't Vehicle Photos.
 *
 * Only dismisses via an explicitly labelled Cancel/Close/Done — no blind
 * coordinate tap. A blind tap at a guessed "close button" position risked
 * hitting a real Cancel control on a screen that was still legitimately
 * mid-selection (later slots take longer as picker/library state grows),
 * turning a slow-but-working pick into a forced failure.
 */
async function recoverFromStuckPicker(): Promise<void> {
  const candidates = [
    '-ios predicate string:label == "Cancel" OR name == "Cancel"',
    '-ios predicate string:label == "Close" OR name == "Close"',
    '-ios predicate string:label == "Done" OR name == "Done"',
  ];
  for (const sel of candidates) {
    try {
      const btn = await $(sel);
      if (await btn.isDisplayed().catch(() => false)) {
        await btn.click();
        clientLog('Recovered by dismissing an unexpected picker/extension screen');
        await browser.pause(300);
        return;
      }
    } catch {
      /* next */
    }
  }
}

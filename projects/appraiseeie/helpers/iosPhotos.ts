/**
 * iOS photo helpers for Create Appraisal image upload steps.
 *
 * Strategy:
 * 1. Prefer tapping an existing photo in the system picker (device already has photos).
 * 2. On Simulator, optionally inject fixtures/appraisal-sample.png via simctl before the run.
 * 3. Set APPRAISEE_SKIP_PHOTOS=true to skip uploads while debugging other steps.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { clientLog } from './clientLog';

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'appraisal-sample.png');

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
 * After tapping ADD on a photo slot, pick the first library image and confirm.
 * Handles common iOS permission / picker sheets.
 */
export async function pickFirstLibraryPhoto(): Promise<boolean> {
  clientLog('Selecting a photo from the library');

  // Allow camera / photos permission sheets
  for (const label of ['Allow Access to All Photos', 'Allow Full Access', 'OK', 'Allow']) {
    try {
      const btn = await $(
        `-ios predicate string:label == "${label}" OR name == "${label}"`
      );
      if (await btn.isDisplayed().catch(() => false)) {
        await btn.click();
        await browser.pause(500);
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
        await browser.pause(800);
        break;
      }
    } catch {
      /* continue */
    }
  }

  // First thumbnail in the picker
  const grids = [
    '-ios class chain:**/XCUIElementTypeImage[`visible == 1`]',
    '-ios class chain:**/XCUIElementTypeCell[`visible == 1`]',
  ];
  for (const sel of grids) {
    try {
      const items = await $$(sel);
      for (const item of items.slice(0, 8)) {
        if (await item.isDisplayed().catch(() => false)) {
          await item.click();
          await browser.pause(600);
          // Confirm Choose / Use / Done / Save on crop screen
          for (const done of ['Choose', 'Use Photo', 'Done', 'Save', 'Use']) {
            try {
              const c = await $(
                `-ios predicate string:label == "${done}" OR name == "${done}"`
              );
              if (await c.isDisplayed().catch(() => false)) {
                await c.click();
                await browser.pause(500);
                break;
              }
            } catch {
              /* next */
            }
          }
          clientLog('Photo selected');
          return true;
        }
      }
    } catch {
      /* try next selector */
    }
  }

  // Dismiss if picker failed
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

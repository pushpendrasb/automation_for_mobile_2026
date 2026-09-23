/**
 * Gallery helpers for the profile-image step (react-native-image-crop-picker).
 *
 * iOS flow: Photos permission alert → QBImagePicker album list → photo grid →
 *           TOCropViewController ("Choose").
 * Android flow: system photo picker → uCrop (check-mark "Crop").
 *
 * Simulator: fixtures/profile-photo.jpg is added to the Photos library with
 * `xcrun simctl addmedia`. Real devices: the library must already hold a photo.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { ui } = require('../pages/ui');

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'profile-photo.jpg');

/** Best-effort: seed the simulator Photos library. No-op on real devices / Android. */
function seedSimulatorPhoto() {
  if (!fs.existsSync(FIXTURE)) {
    console.log('[Photos] Fixture missing:', FIXTURE);
    return;
  }
  const target = process.env.IOS_DEVICE_UDID || 'booted';
  try {
    execSync(`xcrun simctl addmedia ${target} "${FIXTURE}"`, { stdio: 'ignore' });
    console.log('[Photos] Added profile photo to simulator:', target);
  } catch (err) {
    console.log(`[Photos] simctl addmedia skipped (real device?): ${err.message}`);
  }
}

async function tapFirstShown(labels, timeout = 0) {
  const deadline = Date.now() + timeout;
  do {
    for (const label of labels) {
      const el = await ui.firstDisplayed(ui.exactTextSelector(label));
      if (el) {
        await el.click();
        await browser.pause(400);
        return label;
      }
    }
    if (timeout) {
      await browser.pause(300);
    }
  } while (Date.now() < deadline);
  return null;
}

/** Tap an element by its centre coordinates — PhotosUI cells often report visible=false. */
async function tapCentre(el) {
  const [loc, size] = await Promise.all([el.getLocation(), el.getSize()]);
  await browser.execute('mobile: tap', {
    x: Math.round(loc.x + size.width / 2),
    y: Math.round(loc.y + size.height / 2),
  });
}

async function pickFromGalleryIos() {
  // Photos permission (first run only) — wording differs by iOS version.
  await tapFirstShown(
    ['Allow Full Access', 'Allow Access to All Photos', 'Allow', 'OK'],
    3000,
  );

  // QBImagePicker album list → open the camera roll.
  const album = await tapFirstShown(['Recents', 'All Photos', 'Camera Roll'], 10000);
  if (!album) {
    throw new Error('Photo album list did not appear (Recents / All Photos / Camera Roll)');
  }

  // Photo grid → newest photo is last (QBImagePicker sorts oldest first).
  let cells = [];
  await browser.waitUntil(
    async () => {
      cells = await $$('-ios class chain:**/XCUIElementTypeCollectionView/XCUIElementTypeCell');
      return cells.length > 0;
    },
    { timeout: 10000, interval: 500, timeoutMsg: 'No photos in the library — add one to the device first' },
  );
  await tapCentre(cells[cells.length - 1]);

  // TOCropViewController.
  const chose = await tapFirstShown(['Choose', 'Done'], 10000);
  if (!chose) {
    throw new Error('Crop screen "Choose" button did not appear');
  }
}

async function pickFromGalleryAndroid() {
  await tapFirstShown(['Allow', 'ALLOW', 'Allow all'], 3000);
  const photo = await ui.waitFor(
    'android=new UiSelector().className("android.widget.ImageView").clickable(true)',
    15000,
    'first gallery photo',
  );
  await photo.click();
  // uCrop confirm (menu item content-desc "Crop").
  const crop = await ui.waitFor('~Crop', 15000, 'uCrop "Crop" button');
  await crop.click();
}

/**
 * Picks a photo after "Photos Library" was chosen in the action sheet.
 */
async function pickFromGallery() {
  if (ui.isAndroid()) {
    await pickFromGalleryAndroid();
  } else {
    await pickFromGalleryIos();
  }
}

module.exports = { seedSimulatorPhoto, pickFromGallery, tapFirstShown };

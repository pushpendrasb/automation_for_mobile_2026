/**
 * Ask target platform first, then only the relevant app id fields.
 * Order: platform → iOS bundle ID (if needed) → Android package (if needed).
 */
const { ask, askChoice } = require('./prompt');

/**
 * @typedef {'iOS'|'Android'|'Both'} TargetPlatform
 * @typedef {{
 *   platform: TargetPlatform,
 *   iosBundleId: string,
 *   androidPackage: string,
 * }} PlatformAppIds
 */

/**
 * @param {string} projectIdSlug  e.g. appraiseeie
 * @param {{
 *   platform?: TargetPlatform,
 *   iosBundleId?: string,
 *   androidPackage?: string,
 *   defaultBundle?: string,
 *   skipFilledPrompts?: boolean,
 * }} [opts]
 * @returns {Promise<PlatformAppIds>}
 */
async function askPlatformAndAppIds(projectIdSlug, opts = {}) {
  const fallback = opts.defaultBundle || `ie.${String(projectIdSlug || 'app').replace(/-/g, '')}`;
  const skipFilled = Boolean(opts.skipFilledPrompts);

  console.log('\n=== Platforms ===');
  /** @type {TargetPlatform} */
  let platform = opts.platform || 'Both';
  if (!opts.platform) {
    platform = /** @type {TargetPlatform} */ (
      await askChoice('Which platform(s) will you run?', ['iOS', 'Android', 'Both'], 2)
    );
  } else {
    console.log(`  Platform: ${platform}`);
  }

  let iosBundleId = opts.iosBundleId || '';
  let androidPackage = opts.androidPackage || '';

  if (platform === 'iOS' || platform === 'Both') {
    console.log('\n=== iOS app id ===');
    if (skipFilled && iosBundleId) {
      console.log(`  iOS bundle ID: ${iosBundleId}`);
    } else {
      iosBundleId = await ask('iOS bundle ID', iosBundleId || fallback);
    }
  }

  if (platform === 'Android' || platform === 'Both') {
    console.log('\n=== Android app id ===');
    if (skipFilled && androidPackage) {
      console.log(`  Android app package: ${androidPackage}`);
    } else {
      const androidDefault = androidPackage || iosBundleId || fallback;
      androidPackage = await ask('Android app package', androidDefault);
    }
  }

  // Keep both keys filled so templates / .env always have usable defaults.
  if (!iosBundleId) iosBundleId = androidPackage || fallback;
  if (!androidPackage) androidPackage = iosBundleId || fallback;

  return { platform, iosBundleId, androidPackage };
}

module.exports = { askPlatformAndAppIds };

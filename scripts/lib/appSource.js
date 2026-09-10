/**
 * Ask for the under-test app source location (local path and/or git URL).
 * Used later when writing automation scripts against that codebase.
 */
const fs = require('fs');
const path = require('path');
const { ask } = require('./prompt');

/**
 * @typedef {{ appSourcePath: string, appSourceRepoUrl: string }} AppSourceLinks
 */

/**
 * Prompt for app project path + optional repo URL.
 * @param {{
 *   appSourcePath?: string,
 *   appSourceRepoUrl?: string,
 *   skipFilledPrompts?: boolean,
 * }} [opts]
 * @returns {Promise<AppSourceLinks>}
 */
async function askAppSourceLinks(opts = {}) {
  console.log('\n=== App source (for writing scripts) ===');
  console.log('  Point at the real app repo so you (or Cursor) can open screens / locators.');
  console.log('  Examples:');
  console.log('    Local:  /Users/you/Documents/Working_Project/AppraiseeIE/appraisee-iphone-app');
  console.log('    Git:    https://github.com/org/appraisee-iphone-app.git');

  let appSourcePath = opts.appSourcePath || '';
  let appSourceRepoUrl = opts.appSourceRepoUrl || '';

  if (opts.skipFilledPrompts && appSourcePath) {
    console.log(`  Local app path: ${appSourcePath}`);
  } else {
    appSourcePath = await ask(
      'Local path to the app project (Xcode / Android / RN folder)',
      appSourcePath,
    );
  }

  if (appSourcePath) {
    const resolved = path.resolve(appSourcePath);
    if (!fs.existsSync(resolved)) {
      console.warn(
        `  Warning: path does not exist yet: ${resolved}\n` +
          '  You can fix APP_SOURCE_PATH in .env later.',
      );
    } else {
      appSourcePath = resolved;
      console.log(`  ✓ Found: ${appSourcePath}`);
    }
  }

  if (opts.skipFilledPrompts && appSourceRepoUrl) {
    console.log(`  App git/repo URL: ${appSourceRepoUrl}`);
  } else {
    appSourceRepoUrl = await ask(
      'App git / GitHub URL (optional)',
      appSourceRepoUrl,
    );
  }

  return {
    appSourcePath: String(appSourcePath || '').trim(),
    appSourceRepoUrl: String(appSourceRepoUrl || '').trim(),
  };
}

module.exports = { askAppSourceLinks };

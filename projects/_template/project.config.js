const path = require('path');

/**
 * Per-app project metadata used by WDIO config + HTML reports.
 * Replace placeholders when scaffolding via `npm run new-project`.
 */
const rootDir = __dirname;

module.exports = {
  projectId: '__PROJECT_ID__',
  displayName: '__PROJECT_NAME__',
  rootDir,

  /** Local path to the app under test (from .env APP_SOURCE_PATH). */
  appSourcePath: process.env.APP_SOURCE_PATH || '',
  /** Git/GitHub URL of the app under test (from .env APP_SOURCE_REPO_URL). */
  appSourceRepoUrl: process.env.APP_SOURCE_REPO_URL || '',

  catalogPath: path.join(rootDir, 'catalog', 'testCasesCatalog.js'),
  reportsDir: path.join(rootDir, 'reports'),
  screenshotsDir: path.join(rootDir, 'screenshots'),
  reportBaseName: '__REPORT_BASE__',
  junitFile: '__PROJECT_ID__-junit.xml',

  specs: ['./tests/**/*.test.js'],
  mochaTimeout: 600000,

  defaults: {
    ios: { bundleId: '__BUNDLE_ID__' },
    android: { appPackage: '__ANDROID_PACKAGE__' },
  },
};

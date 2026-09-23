const path = require('path');

/**
 * Per-app project metadata used by WDIO config + HTML reports.
 * Replace placeholders when scaffolding via `npm run new-project`.
 */
const rootDir = __dirname;

module.exports = {
  projectId: 'vetportal',
  displayName: 'VetPortal',
  rootDir,

  /** Local path to the app under test (from .env APP_SOURCE_PATH). */
  appSourcePath: process.env.APP_SOURCE_PATH || '',
  /** Git/GitHub URL of the app under test (from .env APP_SOURCE_REPO_URL). */
  appSourceRepoUrl: process.env.APP_SOURCE_REPO_URL || '',

  catalogPath: path.join(rootDir, 'catalog', 'testCasesCatalog.js'),
  reportsDir: path.join(rootDir, 'reports'),
  screenshotsDir: path.join(rootDir, 'screenshots'),
  reportBaseName: 'vetportal-report',
  junitFile: 'vetportal-junit.xml',

  specs: ['./tests/**/*.test.js'],
  mochaTimeout: 600000,

  defaults: {
    ios: { bundleId: 'ie.vetpal.vet' },
    android: { appPackage: 'ie.vetpal.vet' },
  },
};

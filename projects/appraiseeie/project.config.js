const path = require('path');

/**
 * Per-app project metadata used by WDIO config + HTML reports.
 * Specs are TypeScript; WDIO loads them via tsx.
 */
const rootDir = __dirname;

module.exports = {
  projectId: 'appraiseeie',
  displayName: 'AppraiseeIE',
  rootDir,

  /** Local path to the app under test (from .env APP_SOURCE_PATH). */
  appSourcePath: process.env.APP_SOURCE_PATH || '',
  /** Git/GitHub URL of the app under test (from .env APP_SOURCE_REPO_URL). */
  appSourceRepoUrl: process.env.APP_SOURCE_REPO_URL || '',
  scriptLanguage: 'typescript',

  catalogPath: path.join(rootDir, 'catalog', 'testCasesCatalog.js'),
  reportsDir: path.join(rootDir, 'reports'),
  screenshotsDir: path.join(rootDir, 'screenshots'),
  reportBaseName: 'appraiseeie-report',
  junitFile: 'appraiseeie-junit.xml',

  specs: ['./tests/**/*.test.ts'],
  mochaTimeout: 600000,

  defaults: {
    ios: { bundleId: 'ie.appraisee.app' },
    android: { appPackage: 'com.vehicleappraisalmanager' },
  },
};

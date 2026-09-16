const path = require('path');

/**
 * Per-app project metadata used by WDIO config + HTML reports.
 * Specs are TypeScript; WDIO loads them via tsx.
 */
const rootDir = __dirname;

module.exports = {
  projectId: 'zonk',
  displayName: 'Zonk',
  rootDir,
  scriptLanguage: 'typescript',

  /** Local path to the app under test (from .env APP_SOURCE_PATH). */
  appSourcePath: process.env.APP_SOURCE_PATH || '',
  /** Git/GitHub URL of the app under test (from .env APP_SOURCE_REPO_URL). */
  appSourceRepoUrl: process.env.APP_SOURCE_REPO_URL || '',

  catalogPath: path.join(rootDir, 'catalog', 'testCasesCatalog.js'),
  reportsDir: path.join(rootDir, 'reports'),
  screenshotsDir: path.join(rootDir, 'screenshots'),
  reportBaseName: 'zonk-report',
  junitFile: 'zonk-junit.xml',

  specs: ['./tests/**/*.test.ts'],
  mochaTimeout: 600000,

  defaults: {
    ios: { bundleId: 'com.zonk.mobile' },
    android: { appPackage: 'com.zonk.mobile' },
  },
};

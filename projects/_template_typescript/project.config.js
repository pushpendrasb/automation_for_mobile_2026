const path = require('path');

/**
 * Per-app project metadata used by WDIO config + HTML reports.
 * Specs are TypeScript; WDIO loads them via tsx.
 */
const rootDir = __dirname;

module.exports = {
  projectId: '__PROJECT_ID__',
  displayName: '__PROJECT_NAME__',
  rootDir,
  scriptLanguage: 'typescript',

  catalogPath: path.join(rootDir, 'catalog', 'testCasesCatalog.js'),
  reportsDir: path.join(rootDir, 'reports'),
  screenshotsDir: path.join(rootDir, 'screenshots'),
  reportBaseName: '__REPORT_BASE__',
  junitFile: '__PROJECT_ID__-junit.xml',

  specs: ['./tests/**/*.test.ts'],
  mochaTimeout: 600000,

  defaults: {
    ios: { bundleId: '__BUNDLE_ID__' },
    android: { appPackage: '__ANDROID_PACKAGE__' },
  },
};

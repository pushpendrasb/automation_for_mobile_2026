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
    // teamId is the org's Apple Developer Team ID (not secret — same as what
    // developer.apple.com shows under Membership details). Committing it here
    // means `npm run setup` on any Mac defaults to it instead of asking every
    // teammate to retype it; a new Mac still needs its own Xcode Development
    // signing certificate for this team before WebDriverAgent will build.
    ios: { bundleId: 'ie.appraisee.app', teamId: '994MZ4U48X' },
    android: { appPackage: 'com.vehicleappraisalmanager' },
  },
};

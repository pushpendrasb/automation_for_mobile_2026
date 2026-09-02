const path = require('path');

const rootDir = __dirname;

module.exports = {
  projectId: 'roskids',
  displayName: 'RosKids',
  rootDir,

  catalogPath: path.join(rootDir, 'catalog', 'testCasesCatalog.js'),
  reportsDir: path.join(rootDir, 'reports'),
  screenshotsDir: path.join(rootDir, 'screenshots'),
  reportBaseName: 'roskids-report',
  junitFile: 'roskids-junit.xml',

  specs: ['./tests/**/*.test.js'],
  mochaTimeout: 600000,

  defaults: {
    ios: { bundleId: 'ie.myroskids' },
    android: { appPackage: 'ie.myroskids' },
  },
};

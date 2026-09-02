const path = require('path');

const rootDir = __dirname;

module.exports = {
  projectId: 'vetpal',
  displayName: 'Vet-Pal Animal Owner',
  rootDir,

  catalogPath: path.join(rootDir, 'catalog', 'testCasesCatalog.js'),
  reportsDir: path.join(rootDir, 'reports'),
  screenshotsDir: path.join(rootDir, 'screenshots'),
  reportBaseName: 'vetpal-report',
  junitFile: 'vetpal-junit.xml',

  specs: ['./tests/**/*.test.js'],
  mochaTimeout: 600000,

  // Update after you confirm bundle/package from the app repo or .env
  defaults: {
    ios: { bundleId: 'ie.vetpal' },
    android: { appPackage: 'ie.vetpal' },
  },
};

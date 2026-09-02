/**
 * Builds a WebdriverIO config for a given platform + project definition.
 * Expects the project wdio.*.conf.js to load dotenv before calling this.
 */
const path = require('path');
const { buildIosCapabilities } = require('./ios.config');
const { buildAndroidCapabilities } = require('./android.config');
const { buildReporterHooks } = require('../hooks/reporterHooks');

/**
 * @param {'ios'|'android'} platform
 * @param {import('../projectTypes').ProjectConfig} project
 */
function createWdioConfig(platform, project) {
  process.env.AUTOMATION_PROJECT_ROOT = project.rootDir;

  const caps =
    platform === 'ios'
      ? buildIosCapabilities()
      : buildAndroidCapabilities();

  const specs = project.specs.map(spec =>
    path.isAbsolute(spec) ? spec : path.join(project.rootDir, spec),
  );

  const hooks = buildReporterHooks(
    platform === 'ios' ? 'iOS' : 'Android',
    project,
  );

  return {
    runner: 'local',
    specs,
    maxInstances: 1,
    capabilities: [caps],
    logLevel: 'info',
    bail: 0,
    waitforTimeout: 15000,
    connectionRetryTimeout: 180000,
    connectionRetryCount: 2,
    framework: 'mocha',
    reporters: [
      'spec',
      [
        'junit',
        {
          outputDir: project.reportsDir,
          outputFileFormat() {
            return project.junitFile || 'automation-junit.xml';
          },
        },
      ],
    ],
    mochaOpts: {
      ui: 'bdd',
      timeout: project.mochaTimeout || 600000,
    },
    hostname: process.env.APPIUM_HOST || '127.0.0.1',
    port: Number(process.env.APPIUM_PORT || 4723),
    path: '/',
    services: [],
    ...hooks,
  };
}

module.exports = { createWdioConfig };

/**
 * Shared WDIO hooks — screenshots + project-aware HTML/JSON reports.
 *
 * Process split (WebdriverIO local runner):
 * - `onPrepare` / `onComplete` run in the launcher
 * - `beforeSession` / `afterTest` run in the worker
 * Test rows are appended to JSONL in the worker so `onComplete` can render
 * the strong HTML report even though memory is not shared.
 */
const path = require('path');
const fs = require('fs');
const { createTestReport } = require('../utils/testReport');
const { buildPlatformMeta, fromSessionCaps } = require('../utils/deviceInfo');

/**
 * @param {'iOS'|'Android'} platformName
 * @param {import('../projectTypes').ProjectConfig} project
 */
function buildReporterHooks(platformName, project) {
  const catalog = require(project.catalogPath);
  const testReport = createTestReport(catalog, {
    displayName: project.displayName,
    reportBaseName: project.reportBaseName,
    reportsDir: project.reportsDir,
  });

  function metaForTitle(title) {
    const found = catalog.findCaseByTitle(title);
    if (found) {
      return {
        caseId: found.caseId,
        type: found.type,
        module: found.module,
        steps: found.steps || [],
      };
    }
    const t = String(title || '');
    if (/book service|BS-/i.test(t)) {
      return { caseId: 'BS-E2E-01', type: 'e2e', module: 'Book Service' };
    }
    if (/request treatment|TC-VP-|TC-NRS-/i.test(t)) {
      return {
        caseId: '',
        type: /N0|neg/i.test(t) ? 'negative' : 'positive',
        module: 'Request Treatment',
      };
    }
    if (/positive|SI-P|VP-SI-P/i.test(t)) {
      return { caseId: '', type: 'positive', module: 'Sign In' };
    }
    if (/negative|SI-N|VP-SI-N|invalid/i.test(t)) {
      return { caseId: '', type: 'negative', module: 'Sign In' };
    }
    return { caseId: '', type: 'unknown', module: 'Other' };
  }

  function ensureDirs() {
    for (const dir of [project.screenshotsDir, project.reportsDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  const appId =
    platformName === 'iOS'
      ? process.env.IOS_BUNDLE_ID ||
        (project.defaults && project.defaults.ios && project.defaults.ios.bundleId) ||
        ''
      : process.env.ANDROID_APP_PACKAGE ||
        (project.defaults &&
          project.defaults.android &&
          project.defaults.android.appPackage) ||
        '';

  // Live phone + Xcode — do not trust leftover simulator defaults in .env
  const platformMeta = buildPlatformMeta(platformName, appId);

  return {
    onPrepare() {
      ensureDirs();
      testReport.resetRunFiles();
    },

    beforeSession() {
      ensureDirs();
      testReport.writeCatalogHtml(project.reportsDir);
      testReport.startSuite(platformMeta);
    },

    /**
     * Session is up — overlay Appium caps (true OS version / device name).
     */
    async before() {
      try {
        const caps =
          (browser && (browser.capabilities || browser.requestedCapabilities)) ||
          {};
        const live = fromSessionCaps(caps);
        if (live.deviceName || live.osVersion) {
          const displayName =
            platformMeta.deviceModel || live.deviceName || platformMeta.deviceName;
          testReport.startSuite({
            ...platformMeta,
            ...live,
            device: displayName,
            deviceName: displayName,
          });
        }
      } catch (error) {
        console.log(`Could not read session capabilities: ${error.message}`);
      }
    },

    async afterTest(test, _context, { error, passed, duration }) {
      const status = passed ? 'PASS' : 'FAIL';
      const name = test.title || 'unnamed';
      const meta = metaForTitle(name);
      console.log(
        `\n${status} - ${meta.module || project.displayName} :: ${meta.caseId ? meta.caseId + ' — ' : ''}${name}`,
      );

      let screenshot = null;
      if (!passed) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeName = String(name)
          .replace(/[^a-z0-9-_]+/gi, '_')
          .slice(0, 80);
        const filePath = path.join(
          project.screenshotsDir,
          `${safeName}_${stamp}.png`,
        );
        try {
          await browser.saveScreenshot(filePath);
          screenshot = filePath;
          console.log(`Failure reason: ${error && error.message}`);
          console.log(`Screenshot path: ${filePath}`);
          console.log(
            `Device/platform: ${platformName} | app=${appId || 'n/a'}`,
          );
        } catch (shotError) {
          console.log(`Could not capture screenshot: ${shotError.message}`);
          console.log(`Failure reason: ${error && error.message}`);
        }
      }

      testReport.recordTest(
        { title: name, parent: test.parent && test.parent.title },
        { passed, error, duration },
        { ...meta, screenshot },
      );
    },

    onComplete() {
      testReport.writeReports(project.reportsDir);
    },
  };
}

module.exports = { buildReporterHooks };

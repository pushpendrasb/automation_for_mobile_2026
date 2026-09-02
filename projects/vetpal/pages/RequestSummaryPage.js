/**
 * Vet Practice Request Summary (PrescriptionSummary.js).
 * Footer: Submit Request Now.
 */
const { ui } = require('./ui');
const { requestTreatmentData } = require('../data/animalCategories');
const { TEST_IDS } = require('../data/testIds');

class RequestSummaryPage {
  async verifyRequestSummary(opts = {}) {
    await browser.waitUntil(
      async () => Boolean(await ui.firstByTestId(TEST_IDS.summary.submitNow)),
      {
        timeout: 25000,
        interval: 250,
        timeoutMsg:
          'Request Summary (summary.submitNow) not displayed — rebuild/reinstall the Vet Pal app',
      },
    );
    await ui.screenshot('request-summary');

    if (opts.category) {
      const shown = await ui.byContainsText(opts.category);
      if (!(await ui.isShown(shown))) {
        ui.log(
          'Summary',
          `Category "${opts.category}" not found as visible text — still on summary`,
        );
      }
    }
    if (opts.vetPractice) {
      await ui.scrollToText(opts.vetPractice).catch(() => {});
    }
    if (opts.remedyStore) {
      await ui.scrollToText(opts.remedyStore).catch(() => {});
    }
    if (opts.treatment) {
      await ui.scrollToText(opts.treatment).catch(() => {});
    }
  }

  async clickSubmitRequestNow() {
    ui.log('Request Treatment', 'Submit Request Now (summary.submitNow)');
    await ui.requireTapTestId(TEST_IDS.summary.submitNow);
  }

  async verifyRequestSuccess() {
    await browser.pause(1500);
    const markers = [
      'success',
      'submitted',
      'Pending Prescriptions',
      'Request Vet Advice/Treatment',
      requestTreatmentData.labels.requestTreatment,
    ];
    for (const m of markers) {
      if (await ui.isTextVisible(m)) {
        ui.log('Request Treatment', `Success indicator: ${m}`);
        await ui.screenshot('after-successful-submission');
        return m;
      }
    }
    throw new Error(
      'No success/confirmation screen after Submit Request Now (check API / toast)',
    );
  }
}

module.exports = new RequestSummaryPage();

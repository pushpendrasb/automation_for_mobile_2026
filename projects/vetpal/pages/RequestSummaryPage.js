/**
 * Vet Practice Request Summary (PrescriptionSummary.js).
 * Footer CTA is `summary.submitNow` — no text-hunting swipes.
 */
const { ui } = require('./ui');
const { requestTreatmentData } = require('../data/animalCategories');
const { TEST_IDS } = require('../data/testIds');

class RequestSummaryPage {
  /**
   * Wait for the summary footer, then swipe once so the list/footer settles.
   */
  async verifyRequestSummary(_opts = {}) {
    await browser.waitUntil(
      async () => Boolean(await ui.firstByTestId(TEST_IDS.summary.submitNow)),
      {
        timeout: 25000,
        interval: 250,
        timeoutMsg:
          'Request Summary (summary.submitNow) not displayed — rebuild/reinstall the Vet Pal app',
      },
    );
    ui.log('Summary', 'Swipe once');
    await ui.swipeUp();
    await browser.pause(200);
    await ui.screenshot('request-summary');
  }

  /**
   * Tap Submit Request Now after the single summary swipe.
   */
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

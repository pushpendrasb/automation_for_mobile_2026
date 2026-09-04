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

  /**
   * After Submit Request Now, PrescriptionSummary.js shows
   * "Your request for advice has been sent" then `navigation.pop(2)` on toast
   * hide — that lands on Pending Prescriptions. Do not require the word
   * "success"; wait for the list (`pending.requestAdvice`), not a 1.5s snapshot.
   */
  async verifyRequestSuccess() {
    const toast = requestTreatmentData.toasts.requestSent;
    let sawToast = false;
    await browser.waitUntil(
      async () => {
        if (
          !sawToast &&
          (await ui.anyTextVisible([toast, 'advice has been sent']))
        ) {
          sawToast = true;
          ui.log('Request Treatment', `Toast: ${toast}`);
        }
        if (await ui.firstByTestId(TEST_IDS.pending.requestAdvice)) {
          return true;
        }
        return ui.anyDisplayed(ui.pendingPrescriptionsSelector());
      },
      {
        timeout: 20000,
        interval: 350,
        timeoutMsg:
          'Pending Prescriptions list not shown after Submit Request Now',
      },
    );
    ui.log(
      'Request Treatment',
      sawToast
        ? 'Toast then Pending Prescriptions list'
        : 'Pending Prescriptions list',
    );
    await ui.screenshot('after-successful-submission');
  }
}

module.exports = new RequestSummaryPage();

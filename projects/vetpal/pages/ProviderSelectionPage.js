/**
 * Choose a Provider modal (`ChooseProviderPopup.js`).
 * Tap `pending.requestAdvice`, then `provider.vetPractice` / `provider.nearby`.
 */
const { ui } = require('./ui');
const { TEST_IDS } = require('../data/testIds');

class ProviderSelectionPage {
  async waitForPopup(timeout = 10000) {
    await browser.waitUntil(
      async () => Boolean(await ui.firstByTestId(TEST_IDS.provider.vetPractice)),
      {
        timeout,
        interval: 250,
        timeoutMsg:
          'Choose a Provider popup not displayed (provider.vetPractice) — rebuild/reinstall the Vet Pal app',
      },
    );
  }

  async assertVisible() {
    await this.waitForPopup();
  }

  /**
   * Bottom CTA on Pending Prescriptions (`pending.requestAdvice`).
   */
  async clickRequestVetAdviceTreatment() {
    ui.log('Request Treatment', 'Tapping pending.requestAdvice');
    await ui.requireTapTestId(TEST_IDS.pending.requestAdvice);
    await this.waitForPopup();
    await ui.screenshot('before-provider-selection');
  }

  /**
   * @param {'Vet Practice'|'Nearby Remedy Store'} provider
   */
  async selectProvider(provider) {
    ui.log('Provider', `Selecting ${provider}`);
    await this.waitForPopup();
    await ui.tapProviderOption(provider);
    await ui.screenshot('after-provider-selection');
  }

  async selectVetPractice() {
    await this.waitForPopup();
    await ui.requireTapTestId(TEST_IDS.provider.vetPractice);
    await ui.screenshot('after-provider-selection');
  }

  async selectNearby() {
    await this.waitForPopup();
    await ui.requireTapTestId(TEST_IDS.provider.nearby);
    await ui.screenshot('after-provider-selection');
  }
}

module.exports = new ProviderSelectionPage();

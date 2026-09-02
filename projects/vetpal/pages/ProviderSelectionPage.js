/**
 * Choose a Provider modal.
 * Source: vetpal-animal-owner/src/Screens/CustomPopup/ChooseProviderPopup.js
 *
 * Titles sit inside Pressable (not standalone StaticText), so exact
 * `label == "Vet Practice"` fails even when the card is on screen.
 */
const { ui } = require('./ui');
const { requestTreatmentData } = require('../data/animalCategories');

class ProviderSelectionPage {
  #chooseProviderSelector() {
    const t = requestTreatmentData.labels.chooseProvider;
    if (ui.isAndroid()) {
      return `android=new UiSelector().text("${t}")`;
    }
    return `-ios predicate string:label == "${t}" OR name == "${t}"`;
  }

  async waitForPopup(timeout = 10000) {
    await browser.waitUntil(
      async () => ui.anyDisplayed(this.#chooseProviderSelector()),
      {
        timeout,
        interval: 250,
        timeoutMsg: 'Choose a Provider popup not displayed',
      },
    );
  }

  async assertVisible() {
    await this.waitForPopup();
  }

  /**
   * Bottom CTA on Pending Prescriptions (MyPrescriptions.js).
   * Full-width button — tap the bottom bar, do not CONTAINS-search (slow / full-screen hits).
   */
  async clickRequestVetAdviceTreatment() {
    ui.log('Request Treatment', 'Tapping Request Vet Advice/Treatment');
    await ui.tapRequestVetAdviceButton();
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
    await this.selectProvider(requestTreatmentData.labels.vetPractice);
  }

  async selectNearby() {
    await this.selectProvider(requestTreatmentData.labels.nearbyRemedyStore);
  }
}

module.exports = new ProviderSelectionPage();

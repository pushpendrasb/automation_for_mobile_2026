/**
 * Nearby Remedy Store negatives — toasts from NewPrescriptionForRemedyStore.js.
 */
const HomePage = require('../../pages/HomePage');
const ProviderSelectionPage = require('../../pages/ProviderSelectionPage');
const RequestTreatmentFlow = require('../../pages/RequestTreatmentFlow');
const NearbyRemedyStorePage = require('../../pages/NearbyRemedyStorePage');
const { ui } = require('../../pages/ui');
const { requestTreatmentData } = require('../../data/animalCategories');

describe('Request Treatment — Nearby Remedy Store — Negative', () => {
  beforeEach(async () => {
    await HomePage.goHomeFresh();
  });

  it('TC-NRS-N01: Next without store shows Please select a Remedy Store', async () => {
    await RequestTreatmentFlow.openRequestTreatment();
    await ProviderSelectionPage.selectNearby();
    await NearbyRemedyStorePage.assertNearbyFlow();
    await NearbyRemedyStorePage.clickNext();
    await ui.waitForToastContaining(requestTreatmentData.toasts.selectNearbyStore);
  });

  it('TC-NRS-N02: Next on animal step without category shows category toast', async () => {
    await RequestTreatmentFlow.openRequestTreatment();
    await ProviderSelectionPage.selectNearby();
    await NearbyRemedyStorePage.selectNearbyRemedyStore();
    await NearbyRemedyStorePage.selectBranchFirstOrAutoSelected();
    await NearbyRemedyStorePage.clickNext();
    await NearbyRemedyStorePage.assertAnimalCategoryScreen();
    await NearbyRemedyStorePage.clickNext();
    await ui.waitForToastContaining(requestTreatmentData.toasts.selectCategory);
  });
});

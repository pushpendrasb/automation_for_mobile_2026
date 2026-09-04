/**
 * TC-NRS-001 … TC-NRS-007 — Nearby Remedy Store (positive).
 * Step 3 is a react-native-webview assessment form.
 */
const HomePage = require('../../pages/HomePage');
const RequestTreatmentFlow = require('../../pages/RequestTreatmentFlow');
const {
  animalCategories,
  identificationFor,
} = require('../../data/animalCategories');
const { providerData } = require('../../data/providerData');

describe('Request Treatment — Nearby Remedy Store — Positive', () => {
  beforeEach(async () => {
    await HomePage.goHomeFresh();
  });

  animalCategories.forEach((cat, index) => {
    const id = `TC-NRS-${String(index + 1).padStart(3, '0')}`;
    it(`${id}: ${cat.key} + identification + Step 3 web form`, async () => {
      const ident = identificationFor(cat.key, providerData.identificationMode);
      console.log(
        `[Request Treatment] Nearby Remedy Store | ${cat.key} | identification=${JSON.stringify(ident)}`,
      );
      await RequestTreatmentFlow.requestTreatmentWithNearbyRemedyStore(cat.key);
    });
  });
});

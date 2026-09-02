/**
 * TC-NRS-001 … TC-NRS-007 — Nearby Remedy Store (positive).
 * Step 3 is a react-native-webview assessment form.
 */
const HomePage = require('../../pages/HomePage');
const RequestTreatmentFlow = require('../../pages/RequestTreatmentFlow');
const { animalCategories } = require('../../data/animalCategories');

describe('Request Treatment — Nearby Remedy Store — Positive', () => {
  beforeEach(async () => {
    await HomePage.goHomeFresh();
  });

  animalCategories.forEach((cat, index) => {
    const id = `TC-NRS-${String(index + 1).padStart(3, '0')}`;
    it(`${id}: ${cat.key} + identification + Step 3 web form`, async () => {
      console.log(
        `[Request Treatment] Nearby Remedy Store | ${cat.key} | identification=${JSON.stringify(cat.identification)}`,
      );
      await RequestTreatmentFlow.requestTreatmentWithNearbyRemedyStore(cat.key);
    });
  });
});

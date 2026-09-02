/**
 * TC-VP-001 … TC-VP-007 — Vet Practice Request Treatment (positive).
 */
const HomePage = require('../../pages/HomePage');
const RequestTreatmentFlow = require('../../pages/RequestTreatmentFlow');
const { animalCategories } = require('../../data/animalCategories');

describe('Request Treatment — Vet Practice — Positive', () => {
  beforeEach(async () => {
    await HomePage.goHomeFresh();
  });

  animalCategories.forEach((cat, index) => {
    const id = `TC-VP-${String(index + 1).padStart(3, '0')}`;
    it(`${id}: ${cat.key} + valid identification + treatment request`, async () => {
      console.log(
        `[Request Treatment] Vet Practice | ${cat.key} | identification=${JSON.stringify(cat.identification)}`,
      );
      await RequestTreatmentFlow.requestTreatmentWithVetPractice(cat.key);
    });
  });
});

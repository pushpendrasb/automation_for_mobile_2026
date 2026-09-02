/**
 * Vet Practice negative cases — toasts from NewPrescription.js / Messages.js.
 */
const HomePage = require('../../pages/HomePage');
const ProviderSelectionPage = require('../../pages/ProviderSelectionPage');
const RequestTreatmentFlow = require('../../pages/RequestTreatmentFlow');
const VetPracticeFormPage = require('../../pages/VetPracticeFormPage');
const { ui } = require('../../pages/ui');
const { requestTreatmentData } = require('../../data/animalCategories');

describe('Request Treatment — Vet Practice — Negative', () => {
  beforeEach(async () => {
    await HomePage.goHomeFresh();
  });

  it('TC-VP-N01: Next without Vet Practice shows select-vet toast', async () => {
    await RequestTreatmentFlow.openRequestTreatment();
    await ProviderSelectionPage.selectVetPractice();
    await VetPracticeFormPage.assertStep1();
    await VetPracticeFormPage.clickNext();
    await ui.waitForToastContaining(requestTreatmentData.toasts.selectVet);
  });

  it('TC-VP-N02: Next without Remedy Store shows store toast', async () => {
    await RequestTreatmentFlow.openRequestTreatment();
    await ProviderSelectionPage.selectVetPractice();
    await VetPracticeFormPage.assertStep1();
    await VetPracticeFormPage.selectVetPractice();
    await VetPracticeFormPage.clickNext();
    await ui.waitForToastContaining(requestTreatmentData.toasts.selectRemedyStore);
  });

  it('TC-VP-N03: Submit Request without animal category shows category toast', async () => {
    await RequestTreatmentFlow.openRequestTreatment();
    await ProviderSelectionPage.selectVetPractice();
    await VetPracticeFormPage.assertStep1();
    await VetPracticeFormPage.selectVetPractice();
    await VetPracticeFormPage.selectRemedyStore();
    await VetPracticeFormPage.selectBranchFirstOrAutoSelected();
    await VetPracticeFormPage.clickNext();
    await VetPracticeFormPage.assertAnimalCategoryScreen();
    await VetPracticeFormPage.clickSubmitRequest();
    await ui.waitForToastContaining(requestTreatmentData.toasts.selectCategory);
  });

  it('TC-VP-N04: Submit Request without treatment text shows history toast', async () => {
    await RequestTreatmentFlow.openRequestTreatment();
    await ProviderSelectionPage.selectVetPractice();
    await VetPracticeFormPage.assertStep1();
    await VetPracticeFormPage.selectVetPractice();
    await VetPracticeFormPage.selectRemedyStore();
    await VetPracticeFormPage.selectBranchFirstOrAutoSelected();
    await VetPracticeFormPage.clickNext();
    await VetPracticeFormPage.selectAnimalCategory('Horse');
    await VetPracticeFormPage.clickSubmitRequest();
    await ui.waitForToastContaining(requestTreatmentData.toasts.enterTreatment);
  });
});

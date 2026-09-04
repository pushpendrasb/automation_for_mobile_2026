/**
 * Request Treatment orchestrator — reusable flow methods from the Cursor prompt.
 */
const HomePage = require('./HomePage');
const ProviderSelectionPage = require('./ProviderSelectionPage');
const VetPracticeFormPage = require('./VetPracticeFormPage');
const NearbyRemedyStorePage = require('./NearbyRemedyStorePage');
const AnimalIdentificationPage = require('./AnimalIdentificationPage');
const RequestSummaryPage = require('./RequestSummaryPage');
const WebTreatmentFormPage = require('./WebTreatmentFormPage');
const { providerData } = require('../data/providerData');
const { categoryByKey } = require('../data/animalCategories');
const { ui } = require('./ui');

class RequestTreatmentFlow {
  async openRequestTreatment() {
    await HomePage.openRequestTreatment();
    await ProviderSelectionPage.clickRequestVetAdviceTreatment();
  }

  /**
   * Full Vet Practice happy path for one animal category.
   * @param {string} categoryKey Horse|Cattle|…
   */
  async requestTreatmentWithVetPractice(categoryKey) {
    const cat = categoryByKey(categoryKey);
    const practice = providerData.vetPractice;
    const store = providerData.remedyStore;
    const practiceIndex = providerData.vetPracticeIndex;
    const storeIndex = providerData.remedyStoreIndex;
    const branchIndex = providerData.branchIndex;

    await this.openRequestTreatment();
    await ProviderSelectionPage.selectVetPractice();
    await VetPracticeFormPage.assertStep1();

    await VetPracticeFormPage.selectVetPractice(practice, practiceIndex);
    await VetPracticeFormPage.selectRemedyStore(store, storeIndex);
    await VetPracticeFormPage.selectBranch(branchIndex);
    await VetPracticeFormPage.clickNext();
    await VetPracticeFormPage.assertAnimalCategoryScreen();

    await VetPracticeFormPage.selectAnimalCategory(cat.key);
    await AnimalIdentificationPage.fillAnimalIdentification(cat.key);
    await VetPracticeFormPage.fillTreatmentRequest(providerData.treatmentRequest);
    await VetPracticeFormPage.clickSubmitRequest();

    await RequestSummaryPage.verifyRequestSummary({
      category: cat.pickerContains,
      vetPractice: practice,
      remedyStore: store,
      treatment: providerData.treatmentRequest,
    });
    await RequestSummaryPage.clickSubmitRequestNow();
    await RequestSummaryPage.verifyRequestSuccess();

    ui.log(
      'Result',
      `Vet Practice | ${cat.key} | store=${store} | PASS`,
    );
  }

  /**
   * Nearby Remedy Store. Does not change the Vet Practice happy path
   * (`requestTreatmentWithVetPractice` / TC-VP-*).
   *
   * Pending Prescriptions → Request Vet Advice/Treatment → Nearby Remedy Store
   * → inline store + branch → animal identification → Step 3 assessment.
   *
   * @param {string} categoryKey
   */
  async requestTreatmentWithNearbyRemedyStore(categoryKey) {
    const cat = categoryByKey(categoryKey);
    const store = providerData.remedyStore;
    const storeIndex = providerData.remedyStoreIndex;

    await this.openRequestTreatment();
    await ProviderSelectionPage.selectNearby();
    await NearbyRemedyStorePage.assertNearbyFlow();
    await NearbyRemedyStorePage.selectNearbyRemedyStore(store, storeIndex);
    await NearbyRemedyStorePage.selectBranch(providerData.branchIndex);
    await NearbyRemedyStorePage.clickNext();
    await NearbyRemedyStorePage.assertAnimalCategoryScreen();

    await NearbyRemedyStorePage.selectAnimalCategory(cat.key);
    await AnimalIdentificationPage.fillAnimalIdentification(cat.key);
    await NearbyRemedyStorePage.clickNext();
    await NearbyRemedyStorePage.assertStep3();

    await WebTreatmentFormPage.fillMandatoryFields();
    await WebTreatmentFormPage.submitForm();
    await WebTreatmentFormPage.verifySubmission();

    ui.log(
      'Result',
      `Nearby Remedy Store | ${cat.key} | store=${store} | PASS`,
    );
  }
}

module.exports = new RequestTreatmentFlow();

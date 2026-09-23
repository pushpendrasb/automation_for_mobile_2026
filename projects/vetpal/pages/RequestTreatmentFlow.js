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
   * Step 1 of the Vet Practice flow, through Animal Category selection —
   * stops before Animal Identification. Shared by the happy path below and
   * by standalone Animal Identification tests (e.g. the Free Text
   * character-limit test) that don't need to submit a full request.
   * @param {string} categoryKey
   * @returns {Promise<object>} the resolved category record
   */
  async reachAnimalIdentificationForVetPractice(categoryKey, opts = {}) {
    const cat = categoryByKey(categoryKey);
    const practice = providerData.vetPractice;
    const store = providerData.remedyStore;
    const practiceIndex = providerData.vetPracticeIndex;
    const storeIndex = providerData.remedyStoreIndex;
    const branchIndex = providerData.branchIndex;

    if (opts.fromPending) {
      await ProviderSelectionPage.clickRequestVetAdviceTreatment();
    } else {
      await this.openRequestTreatment();
    }
    await ProviderSelectionPage.selectVetPractice();
    await VetPracticeFormPage.assertStep1();

    await VetPracticeFormPage.selectVetPractice(practice, practiceIndex);
    await VetPracticeFormPage.selectRemedyStore(store, storeIndex);
    await VetPracticeFormPage.selectBranch(branchIndex);
    await VetPracticeFormPage.clickNext();
    await VetPracticeFormPage.assertAnimalCategoryScreen();

    await VetPracticeFormPage.selectAnimalCategory(cat.key);
    return cat;
  }

  /**
   * Full Vet Practice happy path for one animal category.
   * @param {string} categoryKey Horse|Cattle|…
   */
  async requestTreatmentWithVetPractice(categoryKey, opts = {}) {
    const store = providerData.remedyStore;
    const cat = await this.reachAnimalIdentificationForVetPractice(categoryKey, opts);

    const idResult = await AnimalIdentificationPage.fillAnimalIdentification(cat.key);
    await VetPracticeFormPage.fillTreatmentRequest(providerData.treatmentRequest);
    await VetPracticeFormPage.clickSubmitRequest();

    await RequestSummaryPage.verifyRequestSummary({
      category: cat.pickerContains,
      vetPractice: providerData.vetPractice,
      remedyStore: store,
      treatment: providerData.treatmentRequest,
    });
    await RequestSummaryPage.clickSubmitRequestNow();
    await RequestSummaryPage.verifyRequestSuccess();

    ui.log(
      'Result',
      `Vet Practice | ${cat.key} | ${idResult.mode} | ${idResult.identification} | age=${idResult.age} | ageUnit=${idResult.ageUnit} | store=${store} | PASS`,
    );
  }

  /**
   * Step 1 of the Nearby Remedy Store flow, through Animal Category
   * selection — stops before Animal Identification. See
   * {@link reachAnimalIdentificationForVetPractice}.
   * @param {string} categoryKey
   * @returns {Promise<object>} the resolved category record
   */
  async reachAnimalIdentificationForNearby(categoryKey, opts = {}) {
    const cat = categoryByKey(categoryKey);
    const store = providerData.remedyStore;
    const storeIndex = providerData.remedyStoreIndex;

    if (opts.fromPending) {
      await ProviderSelectionPage.clickRequestVetAdviceTreatment();
    } else {
      await this.openRequestTreatment();
    }
    await ProviderSelectionPage.selectNearby();
    await NearbyRemedyStorePage.assertNearbyFlow();
    await NearbyRemedyStorePage.selectNearbyRemedyStore(store, storeIndex);
    await NearbyRemedyStorePage.selectBranch(providerData.branchIndex);
    await NearbyRemedyStorePage.clickNext({ until: 'animal' });
    await NearbyRemedyStorePage.assertAnimalCategoryScreen();

    await NearbyRemedyStorePage.selectAnimalCategory(cat.key);
    return cat;
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
  async requestTreatmentWithNearbyRemedyStore(categoryKey, opts = {}) {
    const store = providerData.remedyStore;
    const cat = await this.reachAnimalIdentificationForNearby(categoryKey, opts);

    const idResult = await AnimalIdentificationPage.fillAnimalIdentification(cat.key);
    await NearbyRemedyStorePage.clickNext();
    await NearbyRemedyStorePage.assertStep3();

    await WebTreatmentFormPage.fillMandatoryFields();
    await WebTreatmentFormPage.submitForm();
    await WebTreatmentFormPage.verifySubmission();

    ui.log(
      'Result',
      `Nearby Remedy Store | ${cat.key} | ${idResult.mode} | ${idResult.identification} | age=${idResult.age} | ageUnit=${idResult.ageUnit} | store=${store} | PASS`,
    );
  }
}

module.exports = new RequestTreatmentFlow();

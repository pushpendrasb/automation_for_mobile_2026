/**
 * Request Treatment catalog — Vet Practice + Nearby Remedy Store.
 */
const { animalCategories } = require('../data/animalCategories');

const VP_POSITIVE = animalCategories.map((cat, index) => {
  const id = `TC-VP-${String(index + 1).padStart(3, '0')}`;
  return {
    caseId: id,
    module: 'Request Treatment — Vet Practice',
    type: 'positive',
    title: `${cat.key} + valid identification + treatment request`,
    understanding: `Vet Practice flow for ${cat.key}. Identification from app: ${cat.fields.requiredTag}.`,
    steps: [
      'Home → Request Treatment → Request Vet Advice/Treatment',
      'Choose Vet Practice',
      'Select configured vet practice and remedy store',
      'Branch auto or first item',
      `Select animal category matching ${cat.key}`,
      `Fill ${cat.defaultMode} identification`,
      'Enter treatment request text',
      'Submit Request → Request Summary → Submit Request Now',
    ],
    expected: 'Request submitted (Pending Prescriptions or success UI)',
    passWhen: 'Summary then success/pending list',
    failWhen: 'Toast, stuck on New Request, or WebView/API error',
  };
});

const VP_NEGATIVE = [
  {
    caseId: 'TC-VP-N01',
    module: 'Request Treatment — Vet Practice',
    type: 'negative',
    title: 'Next without Vet Practice shows select-vet toast',
    understanding: 'NewPrescription.js toast Messages.error_selectVet.',
    steps: ['Open Vet Practice form', 'Tap Next with no practice'],
    expected: 'Please select a vet practice',
    passWhen: 'Toast shown; stay on step 1',
    failWhen: 'Advances to animal category',
  },
  {
    caseId: 'TC-VP-N02',
    module: 'Request Treatment — Vet Practice',
    type: 'negative',
    title: 'Next without Remedy Store shows store toast',
    understanding: 'Toast Please select Remedy Store.',
    steps: ['Select vet practice only', 'Tap Next'],
    expected: 'Please select Remedy Store',
    passWhen: 'Toast shown',
    failWhen: 'Advances without store',
  },
  {
    caseId: 'TC-VP-N03',
    module: 'Request Treatment — Vet Practice',
    type: 'negative',
    title: 'Submit Request without animal category shows category toast',
    understanding: 'Please select animal category / type',
    steps: ['Complete step 1', 'Tap Submit Request with no category'],
    expected: 'Please select animal category / type',
    passWhen: 'Toast shown',
    failWhen: 'Summary opens',
  },
  {
    caseId: 'TC-VP-N04',
    module: 'Request Treatment — Vet Practice',
    type: 'negative',
    title: 'Submit Request without treatment text shows history toast',
    understanding: 'Please enter history or symptoms of animal',
    steps: ['Select Horse', 'Leave treatment empty', 'Submit Request'],
    expected: 'Please enter history or symptoms of animal',
    passWhen: 'Toast shown',
    failWhen: 'Summary opens',
  },
];

const NRS_POSITIVE = animalCategories.map((cat, index) => {
  const id = `TC-NRS-${String(index + 1).padStart(3, '0')}`;
  return {
    caseId: id,
    module: 'Request Treatment — Nearby Remedy Store',
    type: 'positive',
    title: `${cat.key} + identification + Step 3 web form`,
    understanding: `Nearby flow for ${cat.key}. Step 3 is react-native-webview assessment (not native RN form).`,
    steps: [
      'Choose Nearby Remedy Store',
      'Select store + branch',
      `Select ${cat.key} and fill identification`,
      'Next → Step 3 WebView',
      'Fill mandatory web fields dynamically',
      'Submit web form',
    ],
    expected: 'Assessment submitted (success URL or native postMessage)',
    passWhen: 'Step 3 completed / native success handler',
    failWhen: 'No WEBVIEW, missing fields, or validation in HTML form',
  };
});

const NRS_NEGATIVE = [
  {
    caseId: 'TC-NRS-N01',
    module: 'Request Treatment — Nearby Remedy Store',
    type: 'negative',
    title: 'Next without store shows Please select a Remedy Store',
    understanding: 'NewPrescriptionForRemedyStore.js step-1 validation.',
    steps: ['Open Nearby flow', 'Tap Next'],
    expected: 'Please select a Remedy Store',
    passWhen: 'Toast shown',
    failWhen: 'Advances',
  },
  {
    caseId: 'TC-NRS-N02',
    module: 'Request Treatment — Nearby Remedy Store',
    type: 'negative',
    title: 'Next on animal step without category shows category toast',
    understanding: 'Please select animal category / type',
    steps: ['Select store + branch', 'Next', 'Next without category'],
    expected: 'Please select animal category / type',
    passWhen: 'Toast shown',
    failWhen: 'Step 3 opens',
  },
];

const REQUEST_TREATMENT_TEST_CASES = [
  ...VP_POSITIVE,
  ...VP_NEGATIVE,
  ...NRS_POSITIVE,
  ...NRS_NEGATIVE,
];

module.exports = { REQUEST_TREATMENT_TEST_CASES };

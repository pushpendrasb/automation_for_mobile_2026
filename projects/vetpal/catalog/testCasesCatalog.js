/**
 * Vet-Pal Animal Owner — test case catalog.
 */
const { REQUEST_TREATMENT_TEST_CASES } = require('./requestTreatmentCatalog');
const { SIGN_UP_TEST_CASES } = require('./signUpCatalog');

/** @type {Array<Record<string, string | string[]>>} */
const SIGN_IN_TEST_CASES = [
  {
    caseId: 'VP-SI-P01',
    module: 'Sign In',
    type: 'positive',
    title: 'Login screen is ready',
    understanding:
      'After app launch we must see Sign In tab with Mobile number, Password and Sign In Now before typing.',
    steps: [
      'Open Vet-Pal Animal Owner app',
      'Ensure Sign In tab is active',
      'Check Mobile number field is visible',
      'Check Password field is visible',
      'Check Sign In Now button is visible',
    ],
    expected: 'Sign In form is ready (+353 country code default)',
    passWhen: 'Mobile, Password, Sign In Now visible',
    failWhen: 'Fields missing (splash, crash, Sign Up tab only)',
  },
  {
    caseId: 'VP-SI-P02',
    module: 'Sign In',
    type: 'positive',
    title: 'Valid mobile login goes to Home',
    understanding:
      'Correct +353 mobile + password from .env must open Home with VETPAL header and menu tiles.',
    steps: [
      'Enter valid mobile (.env)',
      'Enter valid password (.env)',
      'Tap Sign In Now',
      'Wait for API + navigation',
    ],
    expected: 'Home with VETPAL / Request Treatment / My Appointments',
    passWhen: 'Home indicator visible after login',
    failWhen: 'Error toast, OTP-only account, stuck loader, still on Sign In',
  },
  {
    caseId: 'VP-SI-N01',
    module: 'Sign In',
    type: 'negative',
    title: 'Empty mobile → validation toast',
    understanding: 'Tap Sign In Now with empty fields shows "Please enter mobile number".',
    steps: ['Leave mobile & password empty', 'Tap Sign In Now'],
    expected: 'Toast: Please enter mobile number; stay on Sign In',
    passWhen: 'Mobile blank toast + still on login',
    failWhen: 'Home opens or no validation',
  },
  {
    caseId: 'VP-SI-N02',
    module: 'Sign In',
    type: 'negative',
    title: 'Mobile only → password validation',
    understanding: 'Mobile filled, password empty → "Please enter password".',
    steps: ['Enter mobile only', 'Tap Sign In Now'],
    expected: 'Toast: Please enter password; stay on Sign In',
    passWhen: 'Password blank toast shown',
    failWhen: 'API called or Home opened',
  },
  {
    caseId: 'VP-SI-N03',
    module: 'Sign In',
    type: 'negative',
    title: 'Invalid mobile + invalid password',
    understanding: 'Invalid pair rejected by API; stay on Sign In.',
    steps: ['Enter invalid mobile', 'Enter invalid password', 'Tap Sign In Now'],
    expected: 'API error toast; stay on Sign In',
    passWhen: 'Still on login after API response',
    failWhen: 'Home opens',
  },
  {
    caseId: 'VP-SI-N04',
    module: 'Sign In',
    type: 'negative',
    title: 'Valid mobile + wrong password',
    understanding: 'Known mobile with wrong password must be rejected.',
    steps: ['Enter valid mobile', 'Enter wrong password', 'Tap Sign In Now'],
    expected: 'API error toast; stay on Sign In',
    passWhen: 'Still on login',
    failWhen: 'Home opens',
  },
  {
    caseId: 'VP-SI-N05',
    module: 'Sign In',
    type: 'negative',
    title: 'Unknown mobile number',
    understanding: 'Unregistered mobile must not open Home.',
    steps: ['Enter unknown mobile', 'Enter any password', 'Tap Sign In Now'],
    expected: 'API error; stay on Sign In',
    passWhen: 'Still on login',
    failWhen: 'Home opens',
  },
];

const ALL_TEST_CASES = [
  ...SIGN_IN_TEST_CASES,
  ...SIGN_UP_TEST_CASES,
  ...REQUEST_TREATMENT_TEST_CASES,
];

function findCaseByTitle(title) {
  const t = String(title || '');
  return (
    ALL_TEST_CASES.find(
      c => t.startsWith(c.caseId) || t.includes(c.caseId),
    ) ||
    ALL_TEST_CASES.find(c =>
      t.toLowerCase().includes(c.title.toLowerCase().slice(0, 24)),
    ) ||
    null
  );
}

module.exports = {
  SIGN_IN_TEST_CASES,
  SIGN_UP_TEST_CASES,
  REQUEST_TREATMENT_TEST_CASES,
  ALL_TEST_CASES,
  findCaseByTitle,
};

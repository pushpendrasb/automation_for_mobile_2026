/**
 * Master catalog of RosKids automation cases — written in plain QA language.
 * Used for catalog HTML + runtime report enrichment (not credentials).
 */

/** @typedef {'positive'|'negative'|'e2e'} CaseType */
/** @typedef {{ caseId: string, module: string, type: CaseType, title: string, understanding: string, steps: string[], expected: string, passWhen: string, failWhen: string }} TestCaseDef */

/** @type {TestCaseDef[]} */
const SIGN_IN_TEST_CASES = [
  {
    caseId: 'SI-P01',
    module: 'Sign In',
    type: 'positive',
    title: 'Login screen is ready',
    understanding:
      'After app launch we must see Sign In with Email, Password and Sign In button before typing.',
    steps: [
      'Open RosKids app',
      'Wait for Sign In screen',
      'Check Email field is visible',
      'Check Password field is visible',
      'Check Sign In button is visible',
    ],
    expected: 'Sign In form is ready for input',
    passWhen: 'All three controls are visible',
    failWhen: 'Email/Password/Sign In missing (animation, crash, wrong screen)',
  },
  {
    caseId: 'SI-P02',
    module: 'Sign In',
    type: 'positive',
    title: 'Valid login goes to Home',
    understanding:
      'Correct email + password from .env must call login API and open MainDashBoard (My Children / Book A Service).',
    steps: [
      'Enter valid email (.env)',
      'Enter valid password (.env)',
      'Tap Sign In',
      'Wait for API + navigation',
    ],
    expected: 'Home dashboard with My Children or Book A Service',
    passWhen: 'Dashboard tiles visible after login',
    failWhen: 'Error toast, stuck loader, or still on Sign In',
  },
  {
    caseId: 'SI-N01',
    module: 'Sign In',
    type: 'negative',
    title: 'Empty fields → ask for email',
    understanding:
      'If user taps Sign In with nothing filled, app should not call API; show “Please enter Email”.',
    steps: ['Leave email & password empty', 'Tap Sign In'],
    expected: 'Toast: Please enter Email; stay on Sign In',
    passWhen: 'Blank-email toast shown and still on login',
    failWhen: 'Navigates to Home or no validation message',
  },
  {
    caseId: 'SI-N02',
    module: 'Sign In',
    type: 'negative',
    title: 'Email only → ask for password',
    understanding:
      'Email filled but password empty should show “Please enter password”.',
    steps: ['Enter email only', 'Tap Sign In'],
    expected: 'Toast: Please enter password; stay on Sign In',
    passWhen: 'Password blank toast shown',
    failWhen: 'API called or Home opened',
  },
  {
    caseId: 'SI-N03',
    module: 'Sign In',
    type: 'negative',
    title: 'Wrong email + wrong password',
    understanding: 'Invalid pair must show Error toast from API and stay on Sign In.',
    steps: [
      'Enter invalid email',
      'Enter invalid password',
      'Tap Sign In',
    ],
    expected: 'Error toast; stay on Sign In; no dashboard',
    passWhen: 'Error toast + still on login',
    failWhen: 'Home opens or silent failure',
  },
  {
    caseId: 'SI-N04',
    module: 'Sign In',
    type: 'negative',
    title: 'Correct email + wrong password',
    understanding: 'Known email with wrong password must be rejected by API.',
    steps: [
      'Enter valid email',
      'Enter wrong password',
      'Tap Sign In',
    ],
    expected: 'Error toast (incorrect credentials); stay on Sign In',
    passWhen: 'Error toast + still on login',
    failWhen: 'Home opens',
  },
  {
    caseId: 'SI-N05',
    module: 'Sign In',
    type: 'negative',
    title: 'Unknown email',
    understanding: 'Email that does not exist must show Error and not open Home.',
    steps: ['Enter unknown email', 'Enter any password', 'Tap Sign In'],
    expected: 'Error toast; stay on Sign In',
    passWhen: 'Error toast + still on login',
    failWhen: 'Home opens',
  },
];

/** @type {TestCaseDef[]} */
const BOOK_SERVICE_TEST_CASES = [
  {
    caseId: 'BS-E2E-01',
    module: 'Book Service',
    type: 'e2e',
    title: 'Full Book Service flow to payment gateway',
    understanding:
      'From Home (or after login), open Book A Service and complete week → child → steps → morning slots (2 hours/day) → afternoon care No → terms → summary → submit → no more child → Pay Now → payment gateway. Do not fake payment success.',
    steps: [
      'Ensure Home (skip Sign In if already logged in)',
      'Tap Book A Service',
      'Select first available week',
      'Step 1: select first child (+ location/school if needed)',
      'Step 2: Next (allergy default)',
      'Step 3: Yes morning care → select ~2 hours slots Mon–Fri → Done',
      'Step 4: Next (morning transport default No)',
      'Step 5: Afternoon childcare = No → Next',
      'Step 6: Next (afternoon transport default No)',
      'Step 7: accept both consent checkboxes → Next',
      'Summary: Accept Terms → Submit',
      'Popup: Book another child? → No → Continue',
      'Payment Summary → Pay Now',
      'Verify Payment Gateway opened',
    ],
    expected:
      'Payment gateway screen/WebView opens; log “Payment gateway opened successfully”. Thank you only if gateway completes.',
    passWhen: 'Gateway opened (and Thank you if payment finishes)',
    failWhen:
      'Any step missing, cannot select 2h slots, submit blocked, or gateway never opens',
  },
];

const ALL_TEST_CASES = [...SIGN_IN_TEST_CASES, ...BOOK_SERVICE_TEST_CASES];

function findCaseByTitle(title) {
  const t = String(title || '');
  return (
    ALL_TEST_CASES.find(
      c => t.startsWith(c.caseId) || t.includes(c.caseId),
    ) ||
    ALL_TEST_CASES.find(c => t.toLowerCase().includes(c.title.toLowerCase().slice(0, 24))) ||
    null
  );
}

module.exports = {
  SIGN_IN_TEST_CASES,
  BOOK_SERVICE_TEST_CASES,
  ALL_TEST_CASES,
  findCaseByTitle,
};

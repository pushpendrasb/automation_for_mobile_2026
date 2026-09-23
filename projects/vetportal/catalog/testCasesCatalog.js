/**
 * Test catalog for HTML reports — extend as you add cases.
 */

/** @type {Array<Record<string, unknown>>} */
const ALL_TEST_CASES = [
  {
    caseId: 'SM-001',
    module: 'Smoke',
    type: 'smoke',
    title: 'starts a session and reports the current app id',
    understanding:
      'Appium can open a session and we can read the active app bundle/package id.',
    steps: [
      'Start Appium session for the configured app',
      'Wait briefly for launch',
      'Read active iOS bundle id or Android package',
    ],
    expected: 'Session starts; app id is logged',
    passWhen: 'No session / launch error',
    failWhen: 'Appium cannot start session or app is missing',
  },

  // ---------------------------------------------------------------- Sign In
  {
    caseId: 'VPO-SI-P01',
    module: 'Sign In',
    type: 'positive',
    title: 'Login screen shows email, password, Sign In, Forgot Password and Register Now',
    understanding: 'The vet user Sign In form renders every control.',
    steps: ['Launch app (log out if needed)', 'Check login.* testIDs are displayed'],
    expected: 'Email, Password, Sign In, Forgot Password?, Register Now visible',
    passWhen: 'All five controls are displayed',
    failWhen: 'Any control is missing',
  },
  {
    caseId: 'VPO-SI-P02',
    module: 'Sign In',
    type: 'positive',
    title: 'Valid email + password navigate past Sign In',
    understanding: 'A vet assistant account (TEST_USER / TEST_PASSWORD) can sign in.',
    steps: ['Enter valid email', 'Enter valid password', 'Tap Sign In'],
    expected: 'Home (practice joined) or Subscribe Vets (no practice) opens',
    passWhen: 'home.menu or subscribeVets.screen is displayed within 25s',
    failWhen: 'App stays on Sign In or shows "Please login with vet assistant account."',
  },
  {
    caseId: 'VPO-SI-N01',
    module: 'Sign In',
    type: 'negative',
    title: 'Empty email and empty password show email blank toast',
    understanding: 'Client-side validation blocks an empty form.',
    steps: ['Leave both fields empty', 'Tap Sign In'],
    expected: 'Toast "Please enter email."; stays on Sign In',
    passWhen: 'Toast shown and Sign In form still visible',
    failWhen: 'No toast, or app navigates away',
  },
  {
    caseId: 'VPO-SI-N02',
    module: 'Sign In',
    type: 'negative',
    title: 'Email filled and password empty show password blank toast',
    understanding: 'Client-side validation blocks a missing password.',
    steps: ['Enter valid email', 'Leave password empty', 'Tap Sign In'],
    expected: 'Toast "Please enter password."; stays on Sign In',
    passWhen: 'Toast shown and Sign In form still visible',
    failWhen: 'No toast, or app navigates away',
  },
  {
    caseId: 'VPO-SI-N03',
    module: 'Sign In',
    type: 'negative',
    title: 'Unregistered email with any password stays on Sign In',
    understanding: 'The login API rejects an email with no account.',
    steps: ['Enter unregistered email', 'Enter any password', 'Tap Sign In'],
    expected: 'Error toast from API; stays on Sign In',
    passWhen: 'Sign In form returns and never reaches Home / Subscribe Vets',
    failWhen: 'App navigates past Sign In, or loader never clears',
  },
  {
    caseId: 'VPO-SI-N04',
    module: 'Sign In',
    type: 'negative',
    title: 'Registered email with wrong password stays on Sign In',
    understanding: 'The login API rejects a wrong password.',
    steps: ['Enter valid email', 'Enter wrong password', 'Tap Sign In'],
    expected: 'Error toast from API; stays on Sign In',
    passWhen: 'Sign In form returns and never reaches Home / Subscribe Vets',
    failWhen: 'App navigates past Sign In, or loader never clears',
  },
  {
    caseId: 'VPO-SI-N05',
    module: 'Sign In',
    type: 'negative',
    title: 'Malformed email with a password stays on Sign In',
    understanding:
      'Email format validation is commented out in Login.js, so the API must reject a malformed email.',
    steps: ['Enter "not-an-email"', 'Enter any password', 'Tap Sign In'],
    expected: 'Stays on Sign In',
    passWhen: 'Sign In form returns and never reaches Home / Subscribe Vets',
    failWhen: 'App navigates past Sign In, or loader never clears',
  },
  {
    caseId: 'VPO-SI-F01',
    module: 'Sign In',
    type: 'positive',
    title: 'User signs in with a mistaken wrong password',
    understanding:
      'Failure-report demo: the user intends to sign in but mistypes the password, so the goal (reach Home) is not met.',
    steps: ['Enter valid email (TEST_USER)', 'Enter a wrong password', 'Tap Sign In'],
    expected: 'User is signed in and reaches Home',
    passWhen: 'Home / Subscribe Vets is displayed',
    failWhen: 'App rejects the password — report shows the app error message and a screenshot',
  },

  // ---------------------------------------------------------------- Registration
  {
    caseId: 'VPO-SU-P01',
    module: 'Registration',
    type: 'positive',
    title: 'New vet registers with all details and a gallery profile photo',
    understanding:
      'A new vet user can register from Sign In → Register Now (dev API, unique email per run).',
    steps: [
      'Sign In → Register Now',
      'Profile Image → Photos Library → pick photo → Choose',
      'First name Pushpendra, Middle name empty, Last name Singh',
      'Email pushpendra.reg<timestamp>@appdesign.ie (or exact pushpendra@appdesign.ie when REG_EMAIL_UNIQUE=false), Password and Mobile from .env',
      'Qualification Bachelor of Veterinary Science, Vet council reg. no. 02/55',
      'Map icon → search "dublin" → pick the second suggestion',
      'Eircode from the picked place (fallback D01 F5P2)',
      'Tick Veterinary Council agreement and Terms & Conditions',
      'Tap Register Now',
    ],
    expected: '"You have successfully created your account" alert; Ok returns to Sign In',
    passWhen: 'Success alert shown',
    failWhen: 'A validation or API error toast is shown, or no response within 45s',
  },

  // ---------------------------------------------------------------- Compose Script (Veterinary Practice)
  {
    caseId: 'VPO-CS-P01',
    module: 'Compose Script',
    type: 'positive',
    title: 'Existing client + animal + medicine, signed and submitted, creates a prescription',
    understanding:
      'A vet composes a Veterinary Practice (Dispensing) script for an existing client and submits it (creates a real prescription).',
    steps: [
      'Sign in → My Prescriptions → Compose New Script → Veterinary Practice (Dispensing)',
      'Vet Practice tab: practice is preselected → Next',
      'Client Name → search and pick COMPOSE_CLIENT_NAME (default Adelina Amara)',
      'Animal Category/ Type → COMPOSE_ANIMAL (default Horses - Horses) → Next',
      'Add Medicine → pick a drug from the Drug Compendium → quantity + animal ID → Add',
      'Compose and Dispense → draw signature → tick confirmation → Complete Script Now',
    ],
    expected: '"Prescription created successfully" alert with an RX number',
    passWhen: 'Success alert shown; OK returns to My Prescriptions',
    failWhen: 'A validation / API error toast is shown, or no success alert within 40s',
  },
  {
    caseId: 'VPO-CS-N01',
    module: 'Compose Script',
    type: 'negative',
    title: 'Next without a client shows "Enter/select client name"',
    understanding: 'The Client/Dispenser step cannot continue without a client.',
    steps: ['Open Compose New Script → Veterinary Practice', 'Leave Client Name empty', 'Tap Next'],
    expected: 'Toast "Enter/select client name"; stays on Client/Dispenser',
    passWhen: 'Toast shown and Medicine tab not opened',
    failWhen: 'No toast, or the Medicine tab opens',
  },
  {
    caseId: 'VPO-CS-N02',
    module: 'Compose Script',
    type: 'negative',
    title: 'Address is filled from the existing client and cannot be edited',
    understanding:
      'The address comes from the picked client and is read-only, so the "Please enter address" toast cannot be reached in this flow.',
    steps: ['Pick COMPOSE_CLIENT_NAME', 'Check the Address field', 'Try to type into Address'],
    expected: 'Address shows the client address and typing does not change it',
    passWhen: 'Address is non-empty and unchanged after typing',
    failWhen: 'Address is empty or accepts typed text',
  },
  {
    caseId: 'VPO-CS-N03',
    module: 'Compose Script',
    type: 'negative',
    title: 'Herd animal without a Herd No shows the Herd No toast',
    understanding: 'Cattle / Sheep / Goats / Deer need a Herd No / Equine No / Flock No.',
    steps: ['Pick a client with no Herd No', 'Animal Category/ Type → COMPOSE_HERD_ANIMAL (default Cattle - Dairy)', 'Tap Next'],
    expected: 'Toast "Please select or enter Herd No/Equine No/Flock No"',
    passWhen: 'Toast shown and Medicine tab not opened',
    failWhen: 'No toast, or the Medicine tab opens',
  },
  {
    caseId: 'VPO-CS-N04',
    module: 'Compose Script',
    type: 'negative',
    title: 'Compose and Dispense with no medicine shows "Please add medicines or upload script"',
    understanding: 'A script cannot be signed without at least one medicine.',
    steps: ['Pick client + animal → Next', 'On Medicine tab tap Compose and Dispense without adding a medicine'],
    expected: 'Toast "Please add medicines or upload script"; no signature popup',
    passWhen: 'Toast shown and no medicine listed',
    failWhen: 'No toast, or the signature popup opens',
  },

  // ---------------------------------------------------------------- Compose Script — Animal Remedy Store
  {
    caseId: 'VPO-CR-P01',
    module: 'Compose Script (Remedy Store)',
    type: 'positive',
    title: 'Existing client + animal + dispenser + medicine, signed and submitted, creates a prescription',
    understanding:
      'Same flow as Veterinary Practice (VPO-CS-P01); on step 2 the vet also picks the Remedy Store dispenser and its branch (creates a real prescription).',
    steps: [
      'Sign in → My Prescriptions → Compose New Script → Animal Remedy Store (Prescribing)',
      'Vet Practice tab: practice is preselected → Next',
      'Client Name → COMPOSE_REMEDY_CLIENT_NAME (a client with a mobile number on file)',
      'Animal Category/ Type → COMPOSE_ANIMAL (default Horses - Horses)',
      'Dispenser Details → Dispenser name → COMPOSE_DISPENSER_NAME (default first in list)',
      'Branch → auto-selected when there is one, else COMPOSE_BRANCH_NAME (default first) → Save → Next',
      'Add Medicine → pick a drug from the Drug Compendium → quantity + animal ID → Add',
      'Compose and Prescribe → draw signature → tick confirmation → Complete Script Now',
    ],
    expected: '"Prescription created successfully" alert with an RX number',
    passWhen: 'Success alert shown; OK returns to My Prescriptions',
    failWhen: 'Client has no mobile, dispenser has no branches, a validation / API error toast, or no success alert within 40s',
  },
  {
    caseId: 'VPO-CR-N01',
    module: 'Compose Script (Remedy Store)',
    type: 'negative',
    title: 'Remedy Store: Next with no client picked shows "Enter/select client name"',
    understanding: 'The Client/Dispenser step cannot continue without a client.',
    steps: ['Open Compose New Script → Animal Remedy Store', 'Leave Client Name empty', 'Tap Next'],
    expected: 'Toast "Enter/select client name"; stays on Client/Dispenser',
    passWhen: 'Toast shown and Medicine tab not opened',
    failWhen: 'No toast, or the Medicine tab opens',
  },
  {
    caseId: 'VPO-CR-N02',
    module: 'Compose Script (Remedy Store)',
    type: 'negative',
    title: 'Next without a dispenser shows "Please select a dispenser"',
    understanding: 'Remedy Store scripts must name the dispenser that will supply the medicine.',
    steps: ['Pick client + animal', 'Leave Dispenser name empty', 'Tap Next'],
    expected: 'Toast "Please select a dispenser"; stays on Client/Dispenser',
    passWhen: 'Toast shown and Medicine tab not opened',
    failWhen: 'No toast, or the Medicine tab opens',
  },
  {
    caseId: 'VPO-CR-N03',
    module: 'Compose Script (Remedy Store)',
    type: 'negative',
    title: 'Compose and Prescribe with no medicine shows "Please add medicines or upload script"',
    understanding: 'A script cannot be signed without at least one medicine.',
    steps: ['Pick client + animal + dispenser + branch → Next', 'On Medicine tab tap Compose and Prescribe without adding a medicine'],
    expected: 'Toast "Please add medicines or upload script"; no signature popup',
    passWhen: 'Toast shown and no medicine listed',
    failWhen: 'No toast, or the signature popup opens',
  },
];

/**
 * @param {string} title
 * @returns {Record<string, unknown>|null}
 */
function findCaseByTitle(title) {
  const t = String(title || '').toLowerCase();
  return (
    ALL_TEST_CASES.find((c) => String(c.title || '').toLowerCase() === t) ||
    ALL_TEST_CASES.find((c) => t.includes(String(c.title || '').toLowerCase())) ||
    null
  );
}

module.exports = { ALL_TEST_CASES, findCaseByTitle };

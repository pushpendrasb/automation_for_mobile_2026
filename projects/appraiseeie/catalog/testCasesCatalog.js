/**
 * Test catalog for Appraisee IE HTML reports.
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
  {
    caseId: 'AP-SI-P01',
    module: 'Sign In',
    type: 'positive',
    title: 'Login screen shows email, password, and Login',
    understanding:
      'After launch we must see the Appraisee login form (email, password, Login button) before typing. If already on home, logout via side menu first.',
    steps: [
      'If home: menu → scroll LOGOUT → YES',
      'Wait for login_email',
      'Check password and Login controls',
    ],
    expected: 'Login form visible with accessibility ids',
    passWhen: 'email, password, submit displayed',
    failWhen: 'Splash stuck, crash, or ids missing (rebuild app)',
  },
  {
    caseId: 'AP-SI-P02',
    module: 'Sign In',
    type: 'positive',
    title: 'Valid email + password reaches user role screen',
    understanding:
      'Correct TEST_USER + TEST_PASSWORD from .env must leave login and show LoginUserRoleVC role list. If iOS shows Save Password / Not Now, dismiss it first.',
    steps: [
      'Enter email (.env TEST_USER)',
      'Enter password (.env TEST_PASSWORD)',
      'Tap Login',
      'If "Not Now" popup appears, tap Not Now (skip if absent)',
      'Wait for login_user_role_screen',
    ],
    expected: 'User role table visible',
    passWhen: 'login_user_role_table displayed',
    failWhen: 'Validation alert, wrong credentials, or ids missing',
  },
  {
    caseId: 'AP-SI-P03',
    module: 'Sign In',
    type: 'positive',
    title: 'Select first role after login and open home',
    understanding:
      'On LoginUserRoleVC, tap login_user_role_cell_0 (first role card), then home (History/TradeIn) must open.',
    steps: [
      'Login if still on ViewController',
      'Wait for LoginUserRoleVC role list',
      'Tap role cell at index 0 (APPRAISEE_ROLE_INDEX)',
      'Wait for home_screen',
    ],
    expected: 'Role screen closes; home is visible',
    passWhen: 'home_screen (or search) displayed after cell tap',
    failWhen: 'Cell missing, or stuck on role list',
  },
  {
    caseId: 'AP-SI-P04',
    module: 'Sign In',
    type: 'positive',
    title: 'Side menu scroll to LOGOUT and return to login',
    understanding:
      'After first login the side menu often auto-opens. LOGOUT is below HOW TO USE — scroll until visible, tap LOGOUT → YES, land on login.',
    steps: [
      'Reach home (side menu may already be open)',
      'If menu closed, tap home_menu_button',
      'Scroll side menu until LOGOUT is visible',
      'Tap LOGOUT → YES',
      'Wait for login form',
    ],
    expected: 'Back on ViewController login',
    passWhen: 'login_email displayed after logout',
    failWhen: 'Menu/LOGOUT missing or stuck on home',
  },
  {
    caseId: 'AP-SI-P05',
    module: 'Sign In',
    type: 'positive',
    title: 'Password hide and unhide toggles secure entry',
    understanding:
      'login_show_hide_password toggles txtPassword.secureTextEntry on ViewController.',
    steps: [
      'Open login',
      'Enter password',
      'Assert secure (hidden)',
      'Tap show/hide → assert visible',
      'Tap show/hide → assert hidden again',
    ],
    expected: 'Password masking toggles',
    passWhen: 'secure ↔ plain toggles without crash',
    failWhen: 'Eye button missing or no change',
  },
  {
    caseId: 'AP-SI-N01',
    module: 'Sign In',
    type: 'negative',
    title: 'Empty email shows Please enter E-mail',
    understanding: 'ViewController LoginAction validates empty email.',
    steps: ['Leave email empty', 'Enter any password', 'Tap Login'],
    expected: 'Toast: Please enter E-mail.',
    passWhen: 'Toast seen; still on login',
    failWhen: 'No toast or navigated away',
  },
  {
    caseId: 'AP-SI-N02',
    module: 'Sign In',
    type: 'negative',
    title: 'Invalid email shows Enter a valid email address',
    understanding: 'Invalid email format is rejected before API.',
    steps: ['Enter not-an-email', 'Enter password', 'Tap Login'],
    expected: 'Toast about valid email',
    passWhen: 'Toast seen; still on login',
    failWhen: 'Accepted invalid email',
  },
  {
    caseId: 'AP-SI-N03',
    module: 'Sign In',
    type: 'negative',
    title: 'Empty password shows Please enter password',
    understanding: 'Empty password blocked by LoginAction.',
    steps: ['Enter valid-format email', 'Leave password empty', 'Tap Login'],
    expected: 'Toast: Please enter password.',
    passWhen: 'Toast seen; still on login',
    failWhen: 'No toast or navigated away',
  },
  {
    caseId: 'AP-SI-N04',
    module: 'Sign In',
    type: 'negative',
    title: 'Wrong password stays on login (or shows error toast)',
    understanding: 'Wrong credentials must not open LoginUserRoleVC.',
    steps: ['Enter TEST_USER', 'Enter wrong password', 'Tap Login'],
    expected: 'Remain on login',
    passWhen: 'login form still visible',
    failWhen: 'Reached role screen',
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

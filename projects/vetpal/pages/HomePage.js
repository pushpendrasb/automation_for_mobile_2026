/**
 * Home / dashboard — Request Treatment tile (`home.tile.0` testID).
 */
const { ui } = require('./ui');
const LoginPage = require('./LoginPage');
const { testData } = require('../data/testData');
const { TEST_IDS } = require('../data/testIds');

class HomePage {
  async isHomeVisible() {
    return ui.anyTestIdExists([TEST_IDS.home.requestTreatment]);
  }

  /**
   * One XCUITest query per poll. Never use CONTAINS "VETPAL" — that match
   * walks the whole tree (~4s) and returns Application + 14 nodes.
   * @param {number} [timeout=45000]
   */
  async waitForHomeOrLogin(timeout = 45000) {
    await LoginPage.dismissNoInternetAlertIfPresent();
    await browser.waitUntil(
      async () => {
        if (ui.isAndroid()) {
          return (
            (await ui.firstByTestId(TEST_IDS.home.requestTreatment)) ||
            (await ui.firstByTestId(TEST_IDS.login.mobile))
          );
        }
        const els = await $$(
          `-ios predicate string:name == "${TEST_IDS.home.requestTreatment}" OR label == "${TEST_IDS.home.requestTreatment}" OR name == "${TEST_IDS.login.mobile}" OR label == "${TEST_IDS.login.mobile}"`,
        );
        return els.length > 0;
      },
      {
        timeout,
        interval: 500,
        timeoutMsg:
          'Neither home.tile.0 nor login.mobile appeared. Rebuild/reinstall Vet Pal so tile testIDs are visible to XCUITest.',
      },
    );
  }

  /**
   * Login when needed. Does not reset a session that is already on Home.
   */
  async ensureLoggedIn() {
    await this.waitForHomeOrLogin();
    if (await this.isHomeVisible() || (await LoginPage.isHomeVisibleFast())) {
      ui.log('Home', 'Already on dashboard');
      return;
    }
    ui.log('Home', 'Signing in');
    await LoginPage.ensureSignInMode();
    await LoginPage.enterMobile(testData.mobileNumber);
    await LoginPage.enterPassword(testData.password);
    await LoginPage.tapSignIn();
    const ok = await LoginPage.isLoginSuccessful(25000);
    if (!ok) {
      throw new Error('Could not reach Vet-Pal Home after Sign In');
    }
  }

  /**
   * Land on Home while staying logged in.
   * If the session is already authenticated (Home or an inner screen), do not
   * logout or Sign In again. Only sign in when the Sign In form is showing.
   */
  async goHomeFresh() {
    await this.waitForHomeOrLogin();
    if (await this.isHomeVisible() || (await LoginPage.isHomeVisibleFast())) {
      ui.log('Home', 'Already logged in on dashboard — skip logout');
      return;
    }
    if (await LoginPage.isOnLoginScreenFast()) {
      await this.ensureLoggedIn();
      return;
    }
    ui.log('Home', 'Already logged in — return to Home without logout');
    await this.#returnToHomeWithoutLogout();
    if (!(await this.isHomeVisible()) && !(await LoginPage.isHomeVisibleFast())) {
      await this.ensureLoggedIn();
    }
  }

  /**
   * Tap `rt.back` until the dashboard is visible. Never opens Logout.
   */
  async #returnToHomeWithoutLogout() {
    for (let i = 0; i < 8; i += 1) {
      if (await this.isHomeVisible()) {
        return;
      }
      if (!(await ui.tapTestId(TEST_IDS.requestTreatment.back))) {
        return;
      }
      await browser.pause(280);
    }
  }

  /**
   * MyPrescriptions header after opening the Request Treatment tile.
   * One Appium query (same pattern as LoginPage home check).
   */
  async isPendingPrescriptionsVisible() {
    return ui.anyDisplayed(ui.pendingPrescriptionsSelector());
  }

  /**
   * Home → Request Treatment tile (`home.tile.0`) → Pending Prescriptions.
   */
  async openRequestTreatment() {
    ui.log('Request Treatment', 'Tap home.tile.0');
    await this.ensureLoggedIn();

    if (await this.isPendingPrescriptionsVisible()) {
      ui.log('Request Treatment', 'Already on Pending Prescriptions');
      return;
    }

    if (!(await ui.tapTestId(TEST_IDS.home.requestTreatment))) {
      throw new Error(
        'Request Treatment tile testID home.tile.0 not found — rebuild/reinstall the Vet Pal app',
      );
    }

    await browser.waitUntil(async () => this.isPendingPrescriptionsVisible(), {
      timeout: 5000,
      interval: 150,
      timeoutMsg: 'Pending Prescriptions not visible after home.tile.0 tap',
    });
    ui.log('Request Treatment', 'Pending Prescriptions opened');
  }
}

module.exports = new HomePage();

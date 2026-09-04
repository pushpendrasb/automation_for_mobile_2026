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
   * One XCUITest query per poll. Includes inner Request Treatment screens
   * (`rt.back`, Nearby search, Pending CTA) so a leftover New Request session
   * is treated as logged-in instead of waiting 45s for Home.
   * @param {number} [timeout=45000]
   */
  async waitForHomeOrLogin(timeout = 45000) {
    await LoginPage.dismissNoInternetAlertIfPresent();
    const readyIds = [
      TEST_IDS.home.requestTreatment,
      TEST_IDS.login.mobile,
      TEST_IDS.pending.requestAdvice,
      TEST_IDS.requestTreatment.back,
      TEST_IDS.requestTreatment.nearbySearch,
      TEST_IDS.provider.nearby,
    ];
    await browser.waitUntil(
      async () => {
        if (ui.isAndroid()) {
          for (const id of readyIds) {
            if (await ui.firstByTestId(id)) {
              return true;
            }
          }
          return false;
        }
        const parts = readyIds.map(id => `name == "${id}" OR label == "${id}"`);
        const els = await $$(`-ios predicate string:${parts.join(' OR ')}`);
        return els.length > 0;
      },
      {
        timeout,
        interval: 500,
        timeoutMsg:
          'Neither Home, Sign In, nor Request Treatment appeared. Rebuild/reinstall Vet Pal so tile testIDs are visible to XCUITest.',
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
    if (await this.isPendingPrescriptionsVisible()) {
      ui.log('Home', 'Already on Pending Prescriptions');
      return;
    }
    if (
      (await ui.firstByTestId(TEST_IDS.requestTreatment.back)) ||
      (await ui.firstByTestId(TEST_IDS.requestTreatment.nearbySearch))
    ) {
      ui.log('Home', 'Already in Request Treatment — skip Sign In');
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
    if (await ui.firstByTestId(TEST_IDS.provider.close)) {
      await ui.tapTestId(TEST_IDS.provider.close);
      await browser.pause(200);
    }
    ui.log('Home', 'Already logged in — return to Home without logout');
    await this.#returnToHomeWithoutLogout();
    if (await this.isHomeVisible() || (await LoginPage.isHomeVisibleFast())) {
      return;
    }
    if (await this.isPendingPrescriptionsVisible()) {
      ui.log('Home', 'On Pending Prescriptions — skip extra Sign In');
      return;
    }
    if (await LoginPage.isOnLoginScreenFast()) {
      await this.ensureLoggedIn();
    }
  }

  /**
   * Tap `rt.back` / `pending.back` until the dashboard is visible.
   */
  async #returnToHomeWithoutLogout() {
    for (let i = 0; i < 8; i += 1) {
      if (await this.isHomeVisible()) {
        return;
      }
      if (await ui.tapTestId(TEST_IDS.provider.close)) {
        await browser.pause(200);
        continue;
      }
      const wentBack =
        (await ui.tapTestId(TEST_IDS.requestTreatment.back)) ||
        (await ui.tapTestId(TEST_IDS.pending.back));
      if (!wentBack) {
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

    if (
      (await ui.firstByTestId(TEST_IDS.requestTreatment.nearbySearch)) ||
      (await ui.firstByTestId(TEST_IDS.requestTreatment.header))
    ) {
      ui.log('Request Treatment', 'On New Request — back to Pending Prescriptions');
      await ui.tapTestId(TEST_IDS.requestTreatment.back);
      if (await this.isPendingPrescriptionsVisible()) {
        return;
      }
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

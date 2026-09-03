/**
 * Splash auth → Create Profile (VP-SP-P01).
 *
 * Splash.js validateAuth() (refresh-token API), same gate as Login.js:
 *   is_profile_completed == '1' → Home
 *   else → CreateProfile (fill from signUpData.profile)
 *
 * Needs a stored refresh token (sign in / sign up first, do not logout).
 * Edit profile fields in data/signUpData.js.
 */
const SplashPage = require('../../pages/SplashPage');
const CreateProfilePage = require('../../pages/CreateProfilePage');
const { signUpData } = require('../../data/signUpData');

describe('Vet-Pal Splash — Create Profile', () => {
  it('VP-SP-P01: Auth API incomplete profile fills Create Profile', async () => {
    console.log(
      `Create Profile data: ${signUpData.profile.firstName} ${signUpData.profile.lastName} / eircode ${signUpData.profile.postcode} / animals ${(signUpData.profile.animals || []).join(',')}`,
    );

    if (await CreateProfilePage.isVisible()) {
      console.log('Already on Create Profile — filling without relaunch');
    } else {
      await SplashPage.relaunchKeepingSession();
      const dest = await SplashPage.waitForAuthDestination(45000);

      if (dest === 'login') {
        throw new Error(
          'Splash sent Login (no refresh token or auth API failed). Sign in first with an account where is_profile_completed is not 1, then re-run this spec — do not logout.',
        );
      }

      if (dest === 'home') {
        console.log(
          'is_profile_completed == 1 — Home. Nothing to fill on Create Profile.',
        );
        expect(dest).toBe('home');
        return;
      }

      if (dest !== 'createProfile') {
        throw new Error(`Unexpected Splash destination: ${dest}`);
      }
    }

    await CreateProfilePage.fillAndSubmit();
    await CreateProfilePage.skipSubscribeAndWaitHome();
  });
});

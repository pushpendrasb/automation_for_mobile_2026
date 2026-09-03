/**
 * Positive Sign Up (VP-SU-P01, VP-SU-P02).
 * Edit inputs in data/signUpData.js (including profile + optional otp).
 *
 * P02 follows Login.js after register:
 *   Default Sign In → Sign Up tab once (never Sign In tab)
 *   → fill form → Sign Up Now → OtpVerifyScreen (wait 20s; type OTP)
 *   → Verify OTP → SignUpSuccess Ok
 *   → Sign In Now (already on Sign In — do not tap the Sign In tab)
 *   → otp_status true → OTP again
 *   → is_profile_completed == '1' → Home
 *   → else → CreateProfile (fill) → Subscribe Skip Now → Home
 */
const LoginPage = require('../../pages/LoginPage');
const SignUpPage = require('../../pages/SignUpPage');
const CreateProfilePage = require('../../pages/CreateProfilePage');
const { signUpData } = require('../../data/signUpData');

describe('Vet-Pal Sign Up — Positive', () => {
  beforeEach(async () => {
    await LoginPage.resetAppToLoginScreen({ skipSignInTab: true });
    await SignUpPage.ensureSignUpMode();
  });

  it('VP-SU-P01: Sign Up form shows email, mobile, passwords, T&C, Sign Up Now', async () => {
    await SignUpPage.assertSignUpFormVisible();
  });

  it('VP-SU-P02: Sign Up → OTP → Sign In → Home or Create Profile', async () => {
    console.log(
      `Sign Up from signUpData.js: ${signUpData.countryCode} ${signUpData.mobileNumber} / ${signUpData.email}`,
    );
    // Email → mobile → password → confirm → hide keyboard → T&C checkbox
    await SignUpPage.fillValidForm();
    await SignUpPage.tapSignUpNow();

    const signedUp = await SignUpPage.isSignUpSuccessful(25000);
    if (!signedUp) {
      throw new Error(
        'Did not reach Enter OTP. Check password + Confirm Password, T&C checkbox, and Sign Up Now. If an Error alert appeared, email/mobile may already be registered — change them in data/signUpData.js',
      );
    }

    // 20s on Enter OTP (signUpData.otpWaitMs) — type the WhatsApp OTP on the device
    await SignUpPage.completeOtpAndGoToSignIn();
    const dest = await signInWithSignupCredentials();
    await landAfterLogin(dest);
  });
});

/**
 * Sign In with the same phone/password used on Sign Up.
 * @returns {Promise<'home'|'createProfile'|'otp'>}
 */
async function signInWithSignupCredentials() {
  await LoginPage.selectCountryCode(signUpData.countryCode);
  await LoginPage.enterMobile(signUpData.mobileNumber);
  await LoginPage.enterPassword(signUpData.password);
  await LoginPage.tapSignIn();
  return LoginPage.waitForPostLoginDestination(25000);
}

/**
 * Login.js: otp_status → OTP; is_profile_completed == '1' → Home; else CreateProfile.
 * @param {'home'|'createProfile'|'otp'} dest
 */
async function landAfterLogin(dest) {
  let current = dest;

  if (current === 'otp') {
    console.log(
      'Login.js otp_status is true — verifying OTP again then signing in',
    );
    await SignUpPage.completeOtpAndGoToSignIn();
    current = await signInWithSignupCredentials();
  }

  if (current === 'otp') {
    throw new Error(
      'Still on Enter OTP after Sign In. OTP may not have cleared otp_status.',
    );
  }

  if (current === 'home') {
    console.log('is_profile_completed == 1 — Home');
    expect(current).toBe('home');
    return;
  }

  if (current !== 'createProfile') {
    throw new Error(`Unexpected post-login screen: ${current}`);
  }

  console.log(
    'is_profile_completed != 1 — filling Create Profile from signUpData.profile',
  );
  await CreateProfilePage.fillAndSubmit();
  await CreateProfilePage.skipSubscribeAndWaitHome();
}

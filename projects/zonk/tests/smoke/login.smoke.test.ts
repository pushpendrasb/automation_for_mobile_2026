import HomePage from '../../pages/HomePage';
import BottomNav from '../../pages/BottomNav';
import LoginPage from '../../pages/LoginPage';

describe('Zonk — login flow', () => {
  it('SM-002 navigates to Account and opens Login Screen', async () => {
    // 0. Dismiss the Force Update modal if it appears on app launch
    await HomePage.dismissUpdateModalIfPresent();

    // 1. Wait for Home Screen
    const isHomeVisible = await HomePage.isDisplayed();
    expect(isHomeVisible).toBe(true);

    // 2. Tap on Account Tab
    await driver.pause(2000); // Give React Navigation time to settle
    await BottomNav.tapAccount();

    // 3. Verify Login Screen is displayed
    const isLoginVisible = await LoginPage.isDisplayed();
    expect(isLoginVisible).toBe(true);
  });

  it('SM-003 shows error for invalid login', async () => {
    // Try to login with invalid email to trigger inline validation
    await LoginPage.login('test', 'invalidpassword');

    // Verify inline error message for invalid email
    const errorMsg = LoginPage.errorMessage;
    await errorMsg.waitForDisplayed({ timeout: 10000 });
    expect(await errorMsg.isDisplayed()).toBe(true);
  });

  it('SM-004 logs in successfully with valid credentials', async () => {
    // Note: Replace with actual valid credentials or use environment variables
    const validEmail = process.env.TEST_USER_EMAIL || 'ramsample1@gmail.com';
    const validPassword = process.env.TEST_USER_PASSWORD || 'Test@123';

    // We may need to clear the email input first since it has 'test' from the previous test
    // But webdriverio's setValue automatically clears before setting
    await LoginPage.login(validEmail, validPassword);

    // Verify successful login by checking if Home Screen is displayed
    // Depending on IS_CLIENT_DEMO, it might navigate to Account or Home.
    // Let's wait for Home screen or Account screen elements to appear.
    // For now, we will verify the Home Screen is displayed.
    const isHomeVisible = await HomePage.isDisplayed();
    expect(isHomeVisible).toBe(true);
  });
});

class LoginPage {
  get emailInput() {
    return driver.isAndroid
      ? $('(//android.widget.EditText)[1]')
      : $('~Email Address'); // Usually accessibility label is set on form fields
  }

  get passwordInput() {
    return driver.isAndroid
      ? $('(//android.widget.EditText)[2]')
      : $('~Password');
  }

  get signInButton() {
    return driver.isAndroid
      ? $('//*[@text="Sign In"]')
      : $('~Sign In');
  }

  get errorMessage() {
    return driver.isAndroid
      ? $('//*[@text="Sign In Failed" or contains(@text, "invalid email") or contains(@text, "valid email")]')
      : $('~error-message'); // Adjust if iOS has specific error label
  }

  async isDisplayed() {
    return this.signInButton.waitForDisplayed({ timeout: 15000 });
  }

  async login(email?: string, password?: string) {
    if (email) {
      await this.emailInput.waitForDisplayed({ timeout: 5000 });
      await this.emailInput.setValue(email);
    }
    
    if (password) {
      await this.passwordInput.waitForDisplayed({ timeout: 5000 });
      await this.passwordInput.setValue(password);
    }

    // Hide keyboard if it's blocking the button on Android
    if (driver.isAndroid) {
      try {
        await driver.hideKeyboard();
      } catch (e) {
        // Keyboard might already be hidden
      }
    }

    await this.signInButton.waitForDisplayed({ timeout: 5000 });
    await this.signInButton.click();
  }
}

export default new LoginPage();

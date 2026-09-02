/**
 * RosKids test credentials and UI labels — loaded from project .env only.
 * Never log password values.
 */
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill values.`,
    );
  }
  return value.trim();
}

const testData = {
  get email() {
    return requireEnv('ROS_KIDS_TEST_EMAIL');
  },
  get password() {
    return requireEnv('ROS_KIDS_TEST_PASSWORD');
  },
  invalidEmail: process.env.ROS_KIDS_INVALID_EMAIL || 'invalid.user@example.com',
  invalidPassword: process.env.ROS_KIDS_INVALID_PASSWORD || 'WrongPass!999',
  wrongPassword: process.env.ROS_KIDS_WRONG_PASSWORD || 'WrongPass!NotMine999',
  dashboardTitle: 'RAY OF SUNSHINE',
  dashboardTileMyChildren: 'My Children',
  dashboardTileBookService: 'Book A Service',
  loginTitle: 'Sign In',
  errorToastTitle: 'Error',
  emailBlankToast: 'Please enter Email',
  passwordBlankToast: 'Please enter password',
  forgotPasswordLink: 'Forgot Password?',
  signUpLink: 'Sign Up',
};

module.exports = { testData };

/**
 * Client-facing progress log for the Control Desk "Client" view.
 *
 * The dashboard's Client mode shows only lines tagged `[CLIENT]` (see
 * dashboard/public/app.js filterClientLines); everything else appears in Full
 * mode only. Page objects call step() at each user-visible action, e.g.
 * "Email entered", "Sign In button tapped".
 *
 * Keep messages short, plain English, and free of secrets (never log
 * passwords; avoid emails / phone numbers).
 */

/**
 * @param {string} message plain-English step, e.g. "Password entered"
 */
function step(message) {
  console.log(`[CLIENT] ${message}`);
}

module.exports = { step };

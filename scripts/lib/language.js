/**
 * Ask which language the user wants for automation scripts.
 * New projects are scaffolded from language-specific templates.
 */
const { askChoice } = require('./prompt');

/**
 * @typedef {'javascript' | 'typescript' | 'python'} ScriptLanguage
 */

/**
 * Normalize CLI / free-text language values.
 * @param {string} value
 * @returns {ScriptLanguage|null}
 */
function normalizeLanguage(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase();
  if (v === 'javascript' || v === 'js') return 'javascript';
  if (v === 'typescript' || v === 'ts') return 'typescript';
  if (v === 'python' || v === 'py') return 'python';
  return null;
}

/**
 * Human label for logs / next-steps.
 * @param {ScriptLanguage} language
 * @returns {string}
 */
function languageLabel(language) {
  if (language === 'typescript') return 'TypeScript (WebdriverIO + Appium)';
  if (language === 'python') return 'Python (pytest + Appium-Python-Client)';
  return 'JavaScript (WebdriverIO + Appium)';
}

/**
 * Template folder name under projects/ for a language.
 * @param {ScriptLanguage} language
 * @returns {string}
 */
function templateFolderForLanguage(language) {
  if (language === 'typescript') return '_template_typescript';
  if (language === 'python') return '_template_python';
  return '_template';
}

/**
 * Prompt for script language (JavaScript / TypeScript / Python).
 * @param {{ assumeJavascript?: boolean }} [opts]
 * @returns {Promise<ScriptLanguage>}
 */
async function askScriptLanguage(opts = {}) {
  if (opts.assumeJavascript) {
    return 'javascript';
  }

  console.log('\n=== Script language ===');
  console.log('  New projects are scaffolded for the language you pick.');
  console.log('  Existing VetPal / RosKids projects stay on JavaScript.');

  const pick = await askChoice(
    'Which language do you want to write automation scripts in?',
    [
      'JavaScript (WebdriverIO — recommended for this repo)',
      'TypeScript (WebdriverIO + tsx)',
      'Python (pytest + Appium-Python-Client)',
    ],
    0,
  );

  if (pick.startsWith('TypeScript')) return 'typescript';
  if (pick.startsWith('Python')) return 'python';
  return 'javascript';
}

module.exports = {
  askScriptLanguage,
  normalizeLanguage,
  languageLabel,
  templateFolderForLanguage,
};

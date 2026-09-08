/**
 * Tiny readline helpers for interactive setup wizards.
 * No third-party deps — works with Node built-ins only.
 */
const readline = require('readline');

/**
 * @param {string} question
 * @param {string} [defaultValue]
 * @returns {Promise<string>}
 */
function ask(question, defaultValue = '') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      const trimmed = String(answer || '').trim();
      resolve(trimmed || defaultValue);
    });
  });
}

/**
 * Ask until the user picks a valid option (1-based index or exact value).
 * @param {string} question
 * @param {string[]} choices
 * @param {number} [defaultIndex] 0-based
 * @returns {Promise<string>}
 */
async function askChoice(question, choices, defaultIndex = 0) {
  if (!choices.length) {
    throw new Error('askChoice requires at least one choice');
  }
  console.log(`\n${question}`);
  choices.forEach((c, i) => console.log(`  ${i + 1}) ${c}`));
  const def = String(defaultIndex + 1);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const raw = await ask('Enter number', def);
    const asNum = Number.parseInt(raw, 10);
    if (!Number.isNaN(asNum) && asNum >= 1 && asNum <= choices.length) {
      return choices[asNum - 1];
    }
    const byValue = choices.find((c) => c.toLowerCase() === raw.toLowerCase());
    if (byValue) return byValue;
    console.log(`Please choose 1–${choices.length}.`);
  }
}

/**
 * Yes/no prompt. Default true when defaultYes is true.
 * @param {string} question
 * @param {boolean} [defaultYes]
 * @returns {Promise<boolean>}
 */
async function askYesNo(question, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const raw = await ask(`${question} (${hint})`, defaultYes ? 'Y' : 'N');
  const v = raw.trim().toLowerCase();
  if (!v) return defaultYes;
  return v === 'y' || v === 'yes';
}

module.exports = { ask, askChoice, askYesNo };

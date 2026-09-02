/**
 * Request Treatment — one animal category on iOS (Vet Practice positive).
 *
 * Category comes from data/animalCategories.js (same order as TC-VP-001…).
 * Practice/store/branch indexes are 0-based; CLI overrides `.env`.
 *
 * Usage (from projects/vetpal):
 *   npm run test:ios:rt:cattle
 *   npm run test:ios:rt:cattle -- 2 1
 *   npm run test:ios:rt:cattle -- 2 1 0
 *   npm run test:ios:rt:horse -- --practice=2 --store=1 --branch=0
 *   npm run test:ios:rt:cattle -- --practice-name="Dev Test Account-U" --store-name="Southwood Pharmacy"
 */
const { spawn } = require('child_process');
const path = require('path');
const { animalCategories } = require('../data/animalCategories');

const root = path.join(__dirname, '..');
const wdioBin = path.join(root, 'node_modules', '.bin', 'wdio');

const CATEGORY_KEYS = animalCategories.map(c => c.key.toLowerCase());

/**
 * @param {string} name Horse|Cattle|…
 * @returns {{ key: string, caseId: string }}
 */
function resolveCategory(name) {
  const needle = String(name || '').trim().toLowerCase();
  const index = animalCategories.findIndex(c => c.key.toLowerCase() === needle);
  if (index < 0) {
    console.error(`Unknown animal category: ${name || '(missing)'}`);
    console.error(`Use one of: ${CATEGORY_KEYS.join(', ')}`);
    process.exit(1);
  }
  return {
    key: animalCategories[index].key,
    caseId: `TC-VP-${String(index + 1).padStart(3, '0')}`,
  };
}

/**
 * @param {string[]} argv process.argv.slice(2)
 * @returns {{ category?: string, practice?: string, store?: string, branch?: string, practiceName?: string, storeName?: string, platform: string }}
 */
function parseArgs(argv) {
  const args = argv.filter(a => a !== '--');
  let category;
  let practice;
  let store;
  let branch;
  let practiceName;
  let storeName;
  let platform = 'ios';
  const positional = [];

  for (const arg of args) {
    const practiceMatch = arg.match(/^--practice=(\d+)$/);
    const storeMatch = arg.match(/^--store=(\d+)$/);
    const branchMatch = arg.match(/^--branch=(\d+)$/);
    const practiceNameMatch = arg.match(/^--practice-name=(.+)$/);
    const storeNameMatch = arg.match(/^--store-name=(.+)$/);
    const platformMatch = arg.match(/^--platform=(ios|android)$/);
    if (practiceMatch) {
      practice = practiceMatch[1];
    } else if (storeMatch) {
      store = storeMatch[1];
    } else if (branchMatch) {
      branch = branchMatch[1];
    } else if (practiceNameMatch) {
      practiceName = practiceNameMatch[1].trim();
    } else if (storeNameMatch) {
      storeName = storeNameMatch[1].trim();
    } else if (platformMatch) {
      platform = platformMatch[1];
    } else if (/^\d+$/.test(arg)) {
      positional.push(arg);
    } else if (!arg.startsWith('-')) {
      if (category) {
        console.error(`Unexpected extra argument: ${arg}`);
        process.exit(1);
      }
      category = arg;
    } else {
      console.error(`Unknown argument: ${arg}`);
      console.error(
        'Usage: npm run test:ios:rt:<category> -- [--practice=N] [--store=N] [--branch=N]',
      );
      process.exit(1);
    }
  }

  if (positional.length === 1) {
    console.error(
      'Pass practice + store together: npm run test:ios:rt:cattle -- <VET_PRACTICE_INDEX> <REMEDY_STORE_INDEX> [BRANCH_INDEX]',
    );
    process.exit(1);
  }
  if (positional.length > 3) {
    console.error('Too many indexes. Expected: practice store [branch]');
    process.exit(1);
  }
  if (positional.length >= 2) {
    practice = practice ?? positional[0];
    store = store ?? positional[1];
  }
  if (positional.length === 3) {
    branch = branch ?? positional[2];
  }

  return { category, practice, store, branch, practiceName, storeName, platform };
}

const { category, practice, store, branch, practiceName, storeName, platform } =
  parseArgs(process.argv.slice(2));
const { key, caseId } = resolveCategory(category);

if (practice != null) {
  process.env.VET_PRACTICE_INDEX = practice;
}
if (store != null) {
  process.env.REMEDY_STORE_INDEX = store;
}
if (branch != null) {
  process.env.BRANCH_INDEX = branch;
}
if (practiceName) {
  process.env.VET_PRACTICE_NAME = practiceName;
}
if (storeName) {
  process.env.REMEDY_STORE_NAME = storeName;
}

const conf =
  platform === 'android' ? './wdio.android.conf.js' : './wdio.ios.conf.js';

console.log(
  `[RT ${key}] ${caseId} | platform=${platform} | ` +
    `practice="${process.env.VET_PRACTICE_NAME ?? '(from .env)'}" ` +
    `store="${process.env.REMEDY_STORE_NAME ?? '(from .env)'}" | ` +
    `VET_PRACTICE_INDEX=${process.env.VET_PRACTICE_INDEX ?? '(from .env)'} ` +
    `REMEDY_STORE_INDEX=${process.env.REMEDY_STORE_INDEX ?? '(from .env)'} ` +
    `BRANCH_INDEX=${process.env.BRANCH_INDEX ?? '(from .env / 0)'}`,
);

const child = spawn(
  wdioBin,
  [
    'run',
    conf,
    '--spec',
    './tests/requestTreatment/vetPractice.positive.test.js',
    `--mochaOpts.grep=${caseId}`,
  ],
  {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  },
);

child.on('exit', code => {
  process.exit(code == null ? 1 : code);
});

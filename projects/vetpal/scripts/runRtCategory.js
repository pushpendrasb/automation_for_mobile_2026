/**
 * Request Treatment — one animal category (Vet Practice or Nearby Remedy Store).
 *
 * Default is Vet Practice (TC-VP-*). Pass `--nearby` only for Nearby (TC-NRS-*).
 * Existing `npm run test:ios:rt:horse` (no --nearby) is unchanged.
 *   npm run test:ios:rt:horse -- --nearby
 *   npm run test:ios:rt:horse -- --nearby --mode=group --store=1 --branch=0
 *   npm run test:ios:rt:cattle -- --nearby --store-name="Southwood Pharmacy"
 *   npm run test:ios:rt:nearby
 */
const { spawn } = require('child_process');
const path = require('path');
const { animalCategories } = require('../data/animalCategories');

const root = path.join(__dirname, '..');
const wdioBin = path.join(root, 'node_modules', '.bin', 'wdio');

const CATEGORY_KEYS = animalCategories.map(c => c.key.toLowerCase());

/**
 * @param {string} name Horse|Cattle|…
 * @param {'vet'|'nearby'} [flow='vet']
 * @returns {{ key: string, caseId: string }}
 */
function resolveCategory(name, flow = 'vet') {
  const needle = String(name || '').trim().toLowerCase();
  const index = animalCategories.findIndex(c => c.key.toLowerCase() === needle);
  if (index < 0) {
    console.error(`Unknown animal category: ${name || '(missing)'}`);
    console.error(`Use one of: ${CATEGORY_KEYS.join(', ')}`);
    process.exit(1);
  }
  const prefix = flow === 'nearby' ? 'TC-NRS' : 'TC-VP';
  return {
    key: animalCategories[index].key,
    caseId: `${prefix}-${String(index + 1).padStart(3, '0')}`,
  };
}

/**
 * @param {string[]} argv process.argv.slice(2)
 * @returns {{ category?: string, practice?: string, store?: string, branch?: string, practiceName?: string, storeName?: string, platform: string, mode?: string }}
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
  let mode;
  let nearby = false;
  const positional = [];

  for (const arg of args) {
    const practiceMatch = arg.match(/^--practice=(\d+)$/);
    const storeMatch = arg.match(/^--store=(\d+)$/);
    const branchMatch = arg.match(/^--branch=(\d+)$/);
    const practiceNameMatch = arg.match(/^--practice-name=(.+)$/);
    const storeNameMatch = arg.match(/^--store-name=(.+)$/);
    const platformMatch = arg.match(/^--platform=(ios|android)$/);
    const modeMatch = arg.match(/^--mode=(.+)$/);
    const flowMatch = arg.match(/^--flow=(vet|nearby)$/);
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
    } else if (modeMatch) {
      mode = modeMatch[1].trim();
    } else if (flowMatch) {
      nearby = flowMatch[1] === 'nearby';
    } else if (arg === '--nearby') {
      nearby = true;
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
        'Usage: npm run test:ios:rt:<category> -- [--nearby] [--mode=group|tags] [--store=N] [--branch=N]',
      );
      process.exit(1);
    }
  }

  if (nearby) {
    if (positional.length === 1) {
      store = store ?? positional[0];
    } else if (positional.length === 2) {
      store = store ?? positional[0];
      branch = branch ?? positional[1];
    } else if (positional.length > 2) {
      console.error('Nearby expected: [store] [branch]  or  --store=N --branch=N');
      process.exit(1);
    }
  } else {
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
  }

  return {
    category,
    practice,
    store,
    branch,
    practiceName,
    storeName,
    platform,
    mode,
    nearby,
  };
}

const { category, practice, store, branch, practiceName, storeName, platform, mode, nearby } =
  parseArgs(process.argv.slice(2));
const flow = nearby ? 'nearby' : 'vet';
const { key, caseId } = resolveCategory(category, flow);

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
if (mode) {
  const { normalizeIdentificationMode } = require('../data/animalCategories');
  process.env.ANIMAL_ID_MODE = normalizeIdentificationMode(mode);
}

const conf =
  platform === 'android' ? './wdio.android.conf.js' : './wdio.ios.conf.js';

console.log(
  `[RT ${key}] ${caseId} | flow=${flow} | platform=${platform} | ` +
    `mode=${process.env.ANIMAL_ID_MODE ?? '(category default)'} | ` +
    `store="${process.env.REMEDY_STORE_NAME ?? '(from .env)'}" | ` +
    `REMEDY_STORE_INDEX=${process.env.REMEDY_STORE_INDEX ?? '(from .env)'} ` +
    `BRANCH_INDEX=${process.env.BRANCH_INDEX ?? '(from .env / 0)'}`,
);

const spec = nearby
  ? './tests/requestTreatment/nearbyRemedyStore.positive.test.js'
  : './tests/requestTreatment/vetPractice.positive.test.js';

const child = spawn(
  wdioBin,
  ['run', conf, '--spec', spec, `--mochaOpts.grep=${caseId}`],
  {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  },
);

child.on('exit', code => {
  process.exit(code == null ? 1 : code);
});

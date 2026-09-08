#!/usr/bin/env node
/**
 * Scaffold a new Appium project under projects/<id> from projects/_template.
 *
 * Usage:
 *   node scripts/new-project.js
 *   node scripts/new-project.js --id myapp --name "My App" --bundle com.example.myapp
 *   npm run new-project
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { ask, askYesNo } = require('./lib/prompt');
const { repoRoot, projectDir, listProjects } = require('./lib/detect');

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ id?: string, name?: string, bundle?: string, skipInstall?: boolean }} */
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--id' && argv[i + 1]) opts.id = argv[++i];
    else if (a === '--name' && argv[i + 1]) opts.name = argv[++i];
    else if (a === '--bundle' && argv[i + 1]) opts.bundle = argv[++i];
    else if (a === '--skip-install') opts.skipInstall = true;
  }
  return opts;
}

/**
 * Validate project folder slug: lowercase, digits, hyphen.
 * @param {string} id
 */
function assertValidId(id) {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(id)) {
    throw new Error(
      `Invalid project id "${id}". Use lowercase letters, numbers, hyphens (e.g. my-app).`,
    );
  }
  if (id === 'template' || id.startsWith('_')) {
    throw new Error('Reserved project id.');
  }
}

/**
 * Recursively copy directory, skipping node_modules / reports / screenshots / .env
 * @param {string} src
 * @param {string} dest
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'reports' ||
      entry.name === 'screenshots' ||
      entry.name === '.env' ||
      entry.name === '.DS_Store'
    ) {
      continue;
    }
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

/**
 * Replace placeholders in text files under dest.
 * @param {string} dest
 * @param {Record<string, string>} map
 */
function replacePlaceholders(dest, map) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(js|json|md|example|html)$/i.test(entry.name) && entry.name !== '.env.example') {
        continue;
      }
      let text = fs.readFileSync(full, 'utf8');
      let changed = false;
      for (const [key, value] of Object.entries(map)) {
        const token = `__${key}__`;
        if (text.includes(token)) {
          text = text.split(token).join(value);
          changed = true;
        }
      }
      if (changed) fs.writeFileSync(full, text, 'utf8');
    }
  };
  walk(dest);
}

/**
 * Create a new project interactively or from CLI opts.
 * @param {{ id?: string, name?: string, bundle?: string, skipInstall?: boolean }} opts
 * @returns {Promise<string>} project id
 */
async function createProject(opts = {}) {
  console.log('\n=== New project ===');
  const existing = new Set(listProjects());

  let id = opts.id || (await ask('Project folder id (e.g. myapp)', 'myapp'));
  id = id.trim().toLowerCase();
  assertValidId(id);
  if (existing.has(id)) {
    throw new Error(`projects/${id} already exists`);
  }

  const displayName =
    opts.name || (await ask('Display name', id.replace(/-/g, ' ')));
  const bundle =
    opts.bundle || (await ask('Bundle ID / app package', `ie.${id.replace(/-/g, '')}`));

  const templateDir = path.join(repoRoot(), 'projects', '_template');
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Missing template at ${templateDir}`);
  }

  const dest = projectDir(id);
  copyDir(templateDir, dest);

  // Ensure empty runtime dirs exist
  fs.mkdirSync(path.join(dest, 'reports'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'screenshots'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'helpers'), { recursive: true });

  replacePlaceholders(dest, {
    PROJECT_ID: id,
    PROJECT_NAME: displayName,
    BUNDLE_ID: bundle,
    PACKAGE_NAME: `${id}-automation`,
    REPORT_BASE: `${id}-report`,
  });

  console.log(`\nCreated projects/${id}`);
  console.log(`  displayName: ${displayName}`);
  console.log(`  bundle/package: ${bundle}`);

  const doInstall = opts.skipInstall
    ? false
    : await askYesNo(`Run npm install in projects/${id} now?`, true);
  if (doInstall) {
    const result = spawnSync('npm', ['install'], { cwd: dest, stdio: 'inherit' });
    if (result.status !== 0) {
      console.warn('npm install failed — run it manually later.');
    }
  }

  console.log(`
Next:
  1. Replace pages/, tests/, data/ for your app
  2. Run: npm run setup -- --project ${id}
     (or: node scripts/setup-mac.js --project ${id} --skip-tools)
  3. Start appium, then: cd projects/${id} && npm run check:devices:ios
`);

  return id;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  try {
    await createProject(opts);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createProject };

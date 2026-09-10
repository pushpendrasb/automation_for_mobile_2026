#!/usr/bin/env node
/**
 * Scaffold a new Appium project under projects/<id> from a language template.
 *
 * Usage:
 *   node scripts/new-project.js
 *   node scripts/new-project.js --language typescript
 *   node scripts/new-project.js --id myapp --name "My App" --bundle com.example.myapp --language python
 *   npm run new-project
 */
const fs = require('fs');
const path = require('path');

const { ask, askYesNo } = require('./lib/prompt');
const {
  askScriptLanguage,
  normalizeLanguage,
  languageLabel,
  templateFolderForLanguage,
} = require('./lib/language');
const { repoRoot, projectDir, listProjects } = require('./lib/detect');
const {
  installForLanguage,
  firstTestCommand,
  deviceCheckCommand,
} = require('./lib/installLanguage');
const { askPlatformAndAppIds } = require('./lib/platformIds');
const { askAppSourceLinks } = require('./lib/appSource');

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{
   *   id?: string,
   *   name?: string,
   *   bundle?: string,
   *   androidPackage?: string,
   *   platform?: string,
   *   skipInstall?: boolean,
   *   language?: string,
   * }} */
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--id' && argv[i + 1]) opts.id = argv[++i];
    else if (a === '--name' && argv[i + 1]) opts.name = argv[++i];
    else if (a === '--bundle' && argv[i + 1]) opts.bundle = argv[++i];
    else if (a === '--android-package' && argv[i + 1]) opts.androidPackage = argv[++i];
    else if (a === '--platform' && argv[i + 1]) opts.platform = String(argv[++i]);
    else if (a === '--skip-install') opts.skipInstall = true;
    else if ((a === '--language' || a === '--lang') && argv[i + 1]) {
      opts.language = String(argv[++i]).toLowerCase();
    }
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
 * Recursively copy directory, skipping node_modules / reports / screenshots / .env / .venv
 * @param {string} src
 * @param {string} dest
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.venv' ||
      entry.name === 'reports' ||
      entry.name === 'screenshots' ||
      entry.name === '.env' ||
      entry.name === '.DS_Store' ||
      entry.name === '__pycache__'
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
      const okExt =
        /\.(js|ts|py|json|md|example|html|ini|txt|yml|yaml)$/i.test(entry.name) ||
        entry.name === '.env.example';
      if (!okExt) continue;

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
 * After copy, wire a real-project tsconfig (package types) and drop template stubs.
 * The bare `_template_typescript` keeps stubs so the IDE does not error without node_modules.
 * @param {string} dest
 */
function finalizeTypescriptProject(dest) {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'Node16',
      moduleResolution: 'Node16',
      lib: ['ES2022'],
      types: ['node', '@wdio/globals/types', 'expect-webdriverio', 'mocha'],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      noEmit: true,
      rootDir: '.',
      ignoreDeprecations: '6.0',
    },
    include: ['tests/**/*.ts', 'pages/**/*.ts', 'catalog/**/*.ts'],
    exclude: ['node_modules', 'reports', 'screenshots'],
  };
  fs.writeFileSync(
    path.join(dest, 'tsconfig.json'),
    `${JSON.stringify(tsconfig, null, 2)}\n`,
    'utf8',
  );
  const stub = path.join(dest, 'types', 'template-stubs.d.ts');
  if (fs.existsSync(stub)) {
    fs.unlinkSync(stub);
  }
  const typesDir = path.join(dest, 'types');
  if (fs.existsSync(typesDir) && fs.readdirSync(typesDir).length === 0) {
    fs.rmdirSync(typesDir);
  }
}

/**
 * Create a new project interactively or from CLI opts.
 * @param {{
 *   id?: string,
 *   name?: string,
 *   bundle?: string,
 *   androidPackage?: string,
 *   platform?: string,
 *   skipInstall?: boolean,
 *   skipLanguageAsk?: boolean,
 *   scriptLanguage?: import('./lib/language').ScriptLanguage,
 *   language?: string,
 * }} opts
 * @returns {Promise<{
 *   id: string,
 *   platform: import('./lib/platformIds').TargetPlatform,
 *   iosBundleId: string,
 *   androidPackage: string,
 *   appSourcePath: string,
 *   appSourceRepoUrl: string,
 * }>}
 */
async function createProject(opts = {}) {
  console.log('\n=== New project ===');

  /** @type {import('./lib/language').ScriptLanguage} */
  let scriptLanguage = opts.scriptLanguage || 'javascript';
  if (opts.language) {
    const normalized = normalizeLanguage(opts.language);
    if (!normalized) {
      throw new Error(
        `Unknown --language ${opts.language}. Use javascript, typescript, or python.`,
      );
    }
    scriptLanguage = normalized;
  } else if (!opts.skipLanguageAsk) {
    scriptLanguage = await askScriptLanguage({});
  } else if (opts.scriptLanguage) {
    scriptLanguage = opts.scriptLanguage;
  }

  console.log(`  Scaffold language: ${languageLabel(scriptLanguage)}`);

  const existing = new Set(listProjects());

  let id = opts.id || (await ask('Project folder id (e.g. myapp)', 'myapp'));
  id = id.trim().toLowerCase();
  assertValidId(id);
  if (existing.has(id)) {
    throw new Error(`projects/${id} already exists`);
  }

  const displayName =
    opts.name || (await ask('Display name', id.replace(/-/g, ' ')));

  /** @type {import('./lib/platformIds').TargetPlatform|undefined} */
  let platformOpt;
  if (opts.platform) {
    const p = String(opts.platform).toLowerCase();
    if (p === 'ios') platformOpt = 'iOS';
    else if (p === 'android') platformOpt = 'Android';
    else if (p === 'both') platformOpt = 'Both';
  }

  // Platform BEFORE app ids (iOS bundle vs Android package).
  const ids = await askPlatformAndAppIds(id, {
    platform: platformOpt,
    iosBundleId: opts.bundle,
    androidPackage: opts.androidPackage || opts.bundle,
    skipFilledPrompts: Boolean(opts.bundle || opts.androidPackage),
  });

  // App source — local path and/or git URL for writing scripts later.
  const source = await askAppSourceLinks({
    appSourcePath: opts.appSourcePath,
    appSourceRepoUrl: opts.appSourceRepoUrl,
    skipFilledPrompts: Boolean(opts.appSourcePath || opts.appSourceRepoUrl),
  });

  const templateName = templateFolderForLanguage(scriptLanguage);
  const templateDir = path.join(repoRoot(), 'projects', templateName);
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Missing template at ${templateDir}`);
  }

  const dest = projectDir(id);
  copyDir(templateDir, dest);

  fs.mkdirSync(path.join(dest, 'reports'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'screenshots'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'helpers'), { recursive: true });

  replacePlaceholders(dest, {
    PROJECT_ID: id,
    PROJECT_NAME: displayName,
    BUNDLE_ID: ids.iosBundleId,
    ANDROID_PACKAGE: ids.androidPackage,
    PACKAGE_NAME: `${id}-automation`,
    REPORT_BASE: `${id}-report`,
  });

  // Seed .env.example / write notes into README is via placeholders; source goes to a starter .env.example keys already present.
  const envExample = path.join(dest, '.env.example');
  if (fs.existsSync(envExample)) {
    let text = fs.readFileSync(envExample, 'utf8');
    if (source.appSourcePath && text.includes('APP_SOURCE_PATH=')) {
      text = text.replace(
        /^APP_SOURCE_PATH=.*$/m,
        `APP_SOURCE_PATH=${source.appSourcePath}`,
      );
    }
    if (source.appSourceRepoUrl && text.includes('APP_SOURCE_REPO_URL=')) {
      text = text.replace(
        /^APP_SOURCE_REPO_URL=.*$/m,
        `APP_SOURCE_REPO_URL=${source.appSourceRepoUrl}`,
      );
    }
    fs.writeFileSync(envExample, text, 'utf8');
  }

  console.log(`\nCreated projects/${id} (${scriptLanguage})`);
  console.log(`  displayName: ${displayName}`);
  console.log(`  platform: ${ids.platform}`);
  console.log(`  iOS bundle ID: ${ids.iosBundleId}`);
  console.log(`  Android package: ${ids.androidPackage}`);
  console.log(`  app source: ${source.appSourcePath || '(not set)'}`);
  console.log(`  app repo: ${source.appSourceRepoUrl || '(not set)'}`);
  console.log(`  template: projects/${templateName}`);

  if (scriptLanguage === 'typescript') {
    finalizeTypescriptProject(dest);
  }

  const doInstall = opts.skipInstall
    ? false
    : await askYesNo(
        scriptLanguage === 'python'
          ? `Create .venv + pip install in projects/${id} now?`
          : `Run npm install in projects/${id} now?`,
        true,
      );
  if (doInstall) {
    installForLanguage(dest, scriptLanguage);
  }

  const checkCmd = deviceCheckCommand(dest, scriptLanguage);
  const testCmd = firstTestCommand(dest, scriptLanguage);

  console.log(`
Next:
  1. Replace pages/, tests/ using the app at APP_SOURCE_PATH
  2. Run: npm run setup -- --project ${id} --language ${scriptLanguage}
  3. Start appium, then:
       cd projects/${id}
       ${checkCmd}
       ${testCmd}
`);

  return {
    id,
    platform: ids.platform,
    iosBundleId: ids.iosBundleId,
    androidPackage: ids.androidPackage,
    appSourcePath: source.appSourcePath,
    appSourceRepoUrl: source.appSourceRepoUrl,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  try {
    const created = await createProject(opts);
    console.log(`Project ready: ${created.id}`);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createProject };

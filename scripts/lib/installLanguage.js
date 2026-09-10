/**
 * Install project dependencies for the chosen automation language.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { runQuiet, detectTools } = require('./detect');
const { ensureWdioPeerDeps } = require('./fixWdioPeers');

/**
 * Detect how an existing project folder is set up.
 * @param {string} projectPath
 * @returns {'javascript'|'typescript'|'python'|'unknown'}
 */
function detectProjectLanguage(projectPath) {
  if (fs.existsSync(path.join(projectPath, 'requirements.txt'))) {
    return 'python';
  }
  const pkgPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };
      if (deps.typescript || deps.tsx || deps['ts-node']) {
        return 'typescript';
      }
    } catch {
      // fall through
    }
    return 'javascript';
  }
  return 'unknown';
}

/**
 * Ensure Python 3 is available (Homebrew on Mac if missing).
 * @returns {string} path or command name for python3
 */
function ensurePython3() {
  const existing = runQuiet('python3', ['--version']);
  if (existing) {
    console.log(`  Python ${existing.replace(/^Python\s+/i, '')}`);
    return 'python3';
  }

  console.log('  python3 not found — trying Homebrew…');
  const brew = runQuiet('brew', ['--version']);
  if (!brew) {
    console.error(
      'Python 3 is required. Install from https://www.python.org/ or: brew install python',
    );
    process.exit(1);
  }
  const install = spawnSync('brew', ['install', 'python'], { stdio: 'inherit' });
  if (install.status !== 0) {
    console.error('Failed to install Python via Homebrew.');
    process.exit(1);
  }
  const after = runQuiet('python3', ['--version']);
  if (!after) {
    console.error('python3 still missing after brew install.');
    process.exit(1);
  }
  console.log(`  Python ${after.replace(/^Python\s+/i, '')}`);
  return 'python3';
}

/**
 * Create .venv and pip install -r requirements.txt
 * @param {string} projectPath
 */
function pipInstallProject(projectPath) {
  const python = ensurePython3();
  const venvDir = path.join(projectPath, '.venv');
  const req = path.join(projectPath, 'requirements.txt');

  if (!fs.existsSync(req)) {
    console.error(`Missing requirements.txt in ${projectPath}`);
    process.exit(1);
  }

  console.log(`\n=== Python venv + pip install ===`);
  if (!fs.existsSync(venvDir)) {
    const created = spawnSync(python, ['-m', 'venv', '.venv'], {
      cwd: projectPath,
      stdio: 'inherit',
    });
    if (created.status !== 0) {
      console.error('Failed to create .venv');
      process.exit(1);
    }
  }

  const pip = path.join(venvDir, 'bin', 'pip');
  const upgrade = spawnSync(pip, ['install', '--upgrade', 'pip'], {
    cwd: projectPath,
    stdio: 'inherit',
  });
  if (upgrade.status !== 0) {
    console.warn('pip upgrade failed — continuing…');
  }

  const install = spawnSync(pip, ['install', '-r', 'requirements.txt'], {
    cwd: projectPath,
    stdio: 'inherit',
  });
  if (install.status !== 0) {
    console.error('pip install failed. Fix errors, then re-run setup.');
    process.exit(1);
  }
}

/**
 * npm install inside the project folder (JS / TS).
 * Auto-fixes known WDIO peer mismatches before install.
 * @param {string} projectPath
 */
function npmInstallProjectPath(projectPath) {
  const tools = detectTools();
  if (!tools.node) {
    console.error('Node.js is not available. Run: bash scripts/bootstrap.sh');
    process.exit(1);
  }

  const peerFix = ensureWdioPeerDeps(projectPath);
  if (peerFix.fixed) {
    console.log('\n=== Fixed WebdriverIO peer dependencies ===');
    for (const line of peerFix.changes) {
      console.log(`  • ${line}`);
    }
  }

  console.log(`\n=== npm install ===`);
  const result = spawnSync('npm', ['install'], {
    cwd: projectPath,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`
npm install failed.

If you still see ERESOLVE / peer dependency errors:
  1. Re-run setup (it auto-aligns expect-webdriverio for WDIO 9), or
  2. cd ${projectPath} && npm install
`);
    process.exit(1);
  }
}

/**
 * Install deps for the chosen language (or auto-detected project type).
 * @param {string} projectPath
 * @param {'javascript'|'typescript'|'python'} language
 */
function installForLanguage(projectPath, language) {
  const detected = detectProjectLanguage(projectPath);
  const effective =
    detected === 'python' || detected === 'typescript' || detected === 'javascript'
      ? detected
      : language;

  if (effective === 'python') {
    pipInstallProject(projectPath);
    return;
  }
  npmInstallProjectPath(projectPath);
}

/**
 * First recommended test command for a project.
 * @param {string} projectPath
 * @param {'javascript'|'typescript'|'python'} language
 * @returns {string}
 */
function firstTestCommand(projectPath, language) {
  const detected = detectProjectLanguage(projectPath);
  if (detected === 'python' || language === 'python') {
    return 'source .venv/bin/activate && pytest -m smoke -s';
  }

  const pkgPath = path.join(projectPath, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const scripts = (pkg && pkg.scripts) || {};
    const preferred = [
      'test:ios:smoke',
      'test:ios:signin',
      'test:ios:positive',
      'test:ios',
      'test',
    ];
    for (const name of preferred) {
      if (scripts[name]) return `npm run ${name}`;
    }
  } catch {
    // fall through
  }
  return 'npm run test:ios:smoke';
}

/**
 * Device-check command for next steps.
 * @param {string} projectPath
 * @param {'javascript'|'typescript'|'python'} language
 * @returns {string}
 */
function deviceCheckCommand(projectPath, language) {
  const detected = detectProjectLanguage(projectPath);
  if (detected === 'python' || language === 'python') {
    return 'source .venv/bin/activate && python scripts/check_devices.py ios';
  }
  return 'npm run check:devices:ios';
}

module.exports = {
  detectProjectLanguage,
  ensurePython3,
  pipInstallProject,
  npmInstallProjectPath,
  installForLanguage,
  firstTestCommand,
  deviceCheckCommand,
};

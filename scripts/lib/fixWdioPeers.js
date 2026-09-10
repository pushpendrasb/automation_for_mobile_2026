/**
 * Keep WebdriverIO peer dependencies compatible before npm install.
 * Prevents ERESOLVE failures like expect-webdriverio@5 vs @wdio/globals@9 (needs ^6).
 */
const fs = require('fs');
const path = require('path');

/** Minimum expect-webdriverio major required by @wdio/globals 9.x */
const EXPECT_WDIO_FOR_WDIO9 = '^6.0.9';

/**
 * @param {string} range
 * @returns {number|null} leading major, if any
 */
function leadingMajor(range) {
  const m = String(range || '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Patch package.json in place when known WDIO peer conflicts are present.
 * @param {string} projectPath
 * @returns {{ fixed: boolean, changes: string[] }}
 */
function ensureWdioPeerDeps(projectPath) {
  const pkgPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { fixed: false, changes: [] };
  }

  /** @type {Record<string, unknown>} */
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return { fixed: false, changes: [] };
  }

  const deps = /** @type {Record<string, string>} */ ({
    ...(typeof pkg.dependencies === 'object' && pkg.dependencies
      ? pkg.dependencies
      : {}),
  });
  const dev = /** @type {Record<string, string>} */ ({
    ...(typeof pkg.devDependencies === 'object' && pkg.devDependencies
      ? pkg.devDependencies
      : {}),
  });

  const all = { ...deps, ...dev };
  const changes = [];

  const hasWdio9 =
    Boolean(all['@wdio/globals'] || all['@wdio/cli'] || all.webdriverio) &&
    Object.keys(all).some((name) => {
      if (!name.startsWith('@wdio/') && name !== 'webdriverio') return false;
      const major = leadingMajor(all[name]);
      return major === 9;
    });

  if (!hasWdio9) {
    return { fixed: false, changes: [] };
  }

  const expectRange = all['expect-webdriverio'];
  const expectMajor = leadingMajor(expectRange);
  if (!expectRange || (expectMajor != null && expectMajor < 6)) {
    // Prefer keeping it as a devDependency (TypeScript template style).
    if (dev['expect-webdriverio'] || !deps['expect-webdriverio']) {
      dev['expect-webdriverio'] = EXPECT_WDIO_FOR_WDIO9;
      delete deps['expect-webdriverio'];
    } else {
      deps['expect-webdriverio'] = EXPECT_WDIO_FOR_WDIO9;
    }
    changes.push(
      `expect-webdriverio → ${EXPECT_WDIO_FOR_WDIO9} (required by @wdio/globals 9)`,
    );
  }

  if (!changes.length) {
    return { fixed: false, changes: [] };
  }

  pkg.dependencies = deps;
  pkg.devDependencies = dev;
  // Drop empty sections for cleaner package.json
  if (!Object.keys(deps).length) delete pkg.dependencies;
  if (!Object.keys(dev).length) delete pkg.devDependencies;

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return { fixed: true, changes };
}

module.exports = {
  ensureWdioPeerDeps,
  EXPECT_WDIO_FOR_WDIO9,
};

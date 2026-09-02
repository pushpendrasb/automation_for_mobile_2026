/**
 * Project-agnostic HTML/JSON report builder.
 *
 * WDIO runs tests in a worker process and writes the HTML in the launcher
 * (`onComplete`). Results are therefore persisted to disk as JSONL so the
 * launcher can read every test the worker recorded.
 *
 * Each project supplies its own test case catalog module.
 */
const fs = require('fs');
const path = require('path');
const { buildStrongHtml, escapeHtml } = require('./strongHtmlReport');

const HISTORY_LIMIT = 8;

/**
 * @param {{ ALL_TEST_CASES: Array<Record<string, unknown>>, findCaseByTitle: (title: string) => Record<string, unknown>|null }} catalog
 * @param {{ displayName: string, reportBaseName: string, reportsDir?: string }} projectMeta
 */
function createTestReport(catalog, projectMeta) {
  const { ALL_TEST_CASES, findCaseByTitle } = catalog;
  const displayName = projectMeta.displayName || 'Mobile App';
  const reportBaseName = projectMeta.reportBaseName || 'automation-report';
  const reportsDir = projectMeta.reportsDir || '';

  /** @type {Array<Record<string, unknown>>} */
  const results = [];
  let suiteStartedAt = Date.now();
  let platformMeta = {};

  function resultsPath() {
    return path.join(reportsDir, `.${reportBaseName}-results.jsonl`);
  }

  function metaPath() {
    return path.join(reportsDir, `.${reportBaseName}-meta.json`);
  }

  function historyPath() {
    return path.join(reportsDir, `.${reportBaseName}-history.json`);
  }

  function ensureReportsDir() {
    if (reportsDir && !fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
  }

  /**
   * Called from the launcher (`onPrepare`) so a fresh run cannot pick up
   * leftover JSONL from a previous worker.
   */
  function resetRunFiles() {
    if (!reportsDir) return;
    ensureReportsDir();
    fs.writeFileSync(resultsPath(), '', 'utf8');
    fs.writeFileSync(
      metaPath(),
      JSON.stringify({ startedAt: Date.now(), platform: {} }, null, 2),
      'utf8',
    );
  }

  /**
   * @param {Record<string, unknown>} meta
   */
  function startSuite(meta = {}) {
    results.length = 0;
    suiteStartedAt = Date.now();
    platformMeta = meta;
    if (!reportsDir) return;
    ensureReportsDir();
    // Keep any JSONL already written; only refresh platform meta + start time.
    const existing = readJson(metaPath(), {});
    fs.writeFileSync(
      metaPath(),
      JSON.stringify(
        {
          startedAt: existing.startedAt || suiteStartedAt,
          platform: { ...(existing.platform || {}), ...meta },
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  function guessModule(parent, title) {
    const s = `${parent || ''} ${title || ''}`.toLowerCase();
    if (s.includes('book service') || s.includes('bs-')) return 'Book Service';
    if (s.includes('request treatment') || s.includes('tc-vp') || s.includes('tc-nrs')) {
      return 'Request Treatment';
    }
    if (s.includes('sign in') || s.includes('si-') || s.includes('vp-si')) {
      return 'Sign In';
    }
    return 'Other';
  }

  /**
   * @param {{ title: string, parent?: string }} test
   * @param {{ passed: boolean, error?: Error, duration?: number }} outcome
   * @param {{ caseId?: string, type?: string, screenshot?: string, module?: string, steps?: string[] }} extra
   */
  function recordTest(test, outcome, extra = {}) {
    const caseDef = findCaseByTitle(test.title) || {};
    const row = {
      caseId: extra.caseId || caseDef.caseId || '',
      module: extra.module || caseDef.module || guessModule(test.parent, test.title),
      type: extra.type || caseDef.type || 'unknown',
      suite: test.parent || '',
      title: test.title || 'unnamed',
      understanding: caseDef.understanding || '',
      expected: caseDef.expected || '',
      passWhen: caseDef.passWhen || '',
      failWhen: caseDef.failWhen || '',
      steps: extra.steps || caseDef.steps || [],
      status: outcome.passed ? 'PASS' : 'FAIL',
      durationMs: outcome.duration || 0,
      error: outcome.error ? String(outcome.error.message || outcome.error) : null,
      screenshot: extra.screenshot || null,
      finishedAt: new Date().toISOString(),
    };
    results.push(row);
    if (reportsDir) {
      ensureReportsDir();
      fs.appendFileSync(resultsPath(), `${JSON.stringify(row)}\n`, 'utf8');
    }
  }

  function sharedStyles() {
    return `<style>
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; margin: 24px; color: #1a1a1a; max-width: 1200px; }
    h1 { margin-bottom: 4px; color: #0f75bc; }
    h2 { margin-top: 28px; border-bottom: 2px solid #0f75bc; padding-bottom: 6px; }
    .meta { color: #555; margin-bottom: 20px; line-height: 1.45; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #ddd; padding: 10px 8px; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #0f75bc; color: #fff; }
    .pass-hint { color: #166534; }
    .fail-hint { color: #991b1b; }
    code { background: #eef3f6; padding: 1px 6px; border-radius: 4px; }
  </style>`;
  }

  function writeCatalogHtml(outDir) {
    const dir = outDir || reportsDir;
    if (!dir) return;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const byModule = {};
    for (const c of ALL_TEST_CASES) {
      byModule[c.module] = byModule[c.module] || [];
      byModule[c.module].push(c);
    }

    const sections = Object.entries(byModule)
      .map(([module, cases]) => {
        const rows = cases
          .map(
            c => `
        <tr>
          <td><code>${escapeHtml(c.caseId)}</code></td>
          <td>${escapeHtml(c.type)}</td>
          <td><strong>${escapeHtml(c.title)}</strong><br/><span class="muted">${escapeHtml(c.understanding)}</span></td>
          <td><ol>${c.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol></td>
          <td>${escapeHtml(c.expected)}</td>
          <td class="pass-hint">${escapeHtml(c.passWhen)}</td>
          <td class="fail-hint">${escapeHtml(c.failWhen)}</td>
        </tr>`,
          )
          .join('\n');
        return `
      <h2>${escapeHtml(module)}</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Type</th><th>What we mean</th><th>Steps</th>
            <th>Expected</th><th>PASS when</th><th>FAIL when</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
      })
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${escapeHtml(displayName)} — Test Case Catalog</title>
${sharedStyles()}
</head><body>
  <h1>${escapeHtml(displayName)} — Test Case Catalog</h1>
  <p class="meta">
    Planned automated cases. Runtime results after a run:
    <a href="./${escapeHtml(reportBaseName)}.html">${escapeHtml(reportBaseName)}.html</a>
  </p>
  ${sections}
</body></html>`;

    fs.writeFileSync(path.join(dir, 'test-catalog.html'), html, 'utf8');
  }

  function readJson(file, fallback) {
    try {
      if (!fs.existsSync(file)) return fallback;
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return fallback;
    }
  }

  function readJsonl(file) {
    if (!fs.existsSync(file)) return [];
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  /**
   * Catalog cases that were not executed are appended as SKIP so the
   * report still shows the full planned suite.
   * @param {Array<Record<string, unknown>>} executed
   */
  function withSkippedCatalog(executed) {
    const seen = new Set(
      executed.map(t => String(t.caseId || t.title).toLowerCase()),
    );
    const skipped = ALL_TEST_CASES.filter(c => {
      const id = String(c.caseId || '').toLowerCase();
      const title = String(c.title || '').toLowerCase();
      return !seen.has(id) && ![...seen].some(s => s.includes(id) || s.includes(title.slice(0, 20)));
    }).map(c => ({
      caseId: c.caseId,
      module: c.module,
      type: c.type,
      suite: '',
      title: `${c.caseId}: ${c.title}`,
      understanding: c.understanding,
      expected: c.expected,
      passWhen: c.passWhen,
      failWhen: c.failWhen,
      steps: c.steps || [],
      status: 'SKIP',
      durationMs: 0,
      error: null,
      screenshot: null,
      finishedAt: null,
    }));
    return [...executed, ...skipped];
  }

  /**
   * Append this run's pass rate to the rolling history (last 8 runs).
   * @param {number} passRate
   * @param {string} generatedAt
   */
  function appendHistory(passRate, generatedAt) {
    if (!reportsDir) return [];
    const prev = readJson(historyPath(), []);
    const list = Array.isArray(prev) ? prev : [];
    const last = list[list.length - 1];
    if (last && last.generatedAt === generatedAt && last.passRate === passRate) {
      return list;
    }
    const next = [
      ...(Array.isArray(prev) ? prev : []),
      { generatedAt, passRate },
    ].slice(-HISTORY_LIMIT);
    fs.writeFileSync(historyPath(), JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  /**
   * Write JSON + strong HTML into reportsDir.
   * Reads JSONL from disk so this works in the WDIO launcher process.
   * @param {string} [outDir]
   */
  function writeReports(outDir) {
    const dir = outDir || reportsDir;
    if (!dir) {
      throw new Error('reportsDir is required to write the HTML report');
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    writeCatalogHtml(dir);

    const diskMeta = readJson(path.join(dir, `.${reportBaseName}-meta.json`), {});
    const diskResults = readJsonl(path.join(dir, `.${reportBaseName}-results.jsonl`));
    const executed = diskResults.length ? diskResults : results;
    const tests = withSkippedCatalog(executed);

    const passed = executed.filter(r => r.status === 'PASS').length;
    const failed = executed.filter(r => r.status === 'FAIL').length;
    const skipped = tests.filter(r => r.status === 'SKIP').length;
    const total = tests.length;
    const startedAt = diskMeta.startedAt || suiteStartedAt;
    const summedMs = executed.reduce(
      (sum, row) => sum + (Number(row.durationMs) || 0),
      0,
    );
    const durationMs = Math.max(Date.now() - startedAt, summedMs);
    const lastFinished = executed
      .map(row => row.finishedAt)
      .filter(Boolean)
      .pop();
    const generatedAt = lastFinished || new Date().toISOString();
    const executedCount = passed + failed;
    const passRate = executedCount
      ? Math.round((passed / executedCount) * 100)
      : 0;
    const history = appendHistory(passRate, generatedAt);
    const platform = { ...platformMeta, ...(diskMeta.platform || {}) };

    const payload = {
      title: `${displayName} Automation Report`,
      generatedAt,
      platform,
      summary: { total, passed, failed, skipped, durationMs, passRate },
      understanding:
        'PASS = app behaved as expected. FAIL = missing screen, wrong toast, API reject, device/WDA issue, or flow stopped early.',
      tests,
      catalogCases: ALL_TEST_CASES,
      catalogCount: ALL_TEST_CASES.length,
      history,
      buildTag: 'Development build',
    };

    const jsonPath = path.join(dir, `${reportBaseName}.json`);
    const htmlPath = path.join(dir, `${reportBaseName}.html`);
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.writeFileSync(
      htmlPath,
      buildStrongHtml(payload, { displayName }),
      'utf8',
    );

    console.log(`\n=== ${displayName} Automation Report ===`);
    console.log(
      `Total: ${total} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`,
    );
    console.log(`Catalog: ${path.join(dir, 'test-catalog.html')}`);
    console.log(`HTML:    ${htmlPath}`);
    console.log(`JSON:    ${jsonPath}`);
    console.log(`=====================================\n`);

    return { jsonPath, htmlPath, payload };
  }

  return {
    resetRunFiles,
    startSuite,
    recordTest,
    writeReports,
    writeCatalogHtml,
  };
}

module.exports = { createTestReport };

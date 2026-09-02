/**
 * Strong HTML report renderer.
 *
 * Visual layout matches the VetPal iOS automation report template
 * (hero + gauge, module bars, expandable step trails, iPhone screenshot
 * frame, pass-rate trend, device matrix). Content is filled from the
 * live WebdriverIO run — never from sample/demo numbers.
 */

const path = require('path');

/**
 * Escape text for safe HTML interpolation.
 * @param {unknown} value
 */
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format milliseconds as "12s" or "1m 21s".
 * @param {number} ms
 */
function formatDuration(ms) {
  const total = Math.max(0, Math.round(Number(ms) / 1000));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ${seconds}s`;
}

/**
 * Format an ISO timestamp in Asia/Kolkata (IST).
 * @param {string} iso
 */
function formatIst(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return String(iso || '');
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatted} IST`;
}

/**
 * Classify a failure for the badge colour.
 * @param {string} error
 */
function failureKind(error) {
  const text = String(error || '').toLowerCase();
  if (/crash|sigabrt|not running|exc_crash/.test(text)) return 'crash';
  if (
    /nosuchelement|element not found|accessibility id|locator|stale element/.test(
      text,
    )
  ) {
    return 'locator';
  }
  return 'assert';
}

const BADGE_LABEL = {
  crash: 'App crash',
  locator: 'Locator issue',
  assert: 'Assertion failure',
};

/**
 * Semicircle gauge stroke: circumference of r=78 is ~245.
 * @param {number} passRate 0–100
 */
function gaugeDash(passRate) {
  const circ = 245;
  const filled = Math.max(0, Math.min(100, passRate)) / 100 * circ;
  return `${filled.toFixed(1)} ${circ}`;
}

/**
 * Build SVG polyline for the last N pass rates (0–100).
 * @param {number[]} rates
 */
function trendSvg(rates) {
  if (!rates.length) return '';
  const w = 720;
  const pad = 20;
  const usable = w - pad * 2;
  const yFor = r => 118 - (Math.max(0, Math.min(100, r)) / 100) * 72;
  const points = rates.map((rate, i) => {
    const x =
      rates.length === 1
        ? w / 2
        : pad + (i / (rates.length - 1)) * usable;
    return [x, yFor(rate)];
  });
  const poly = points.map(([x, y]) => `${x},${y}`).join(' ');
  const last = points[points.length - 1];
  const fillPts = `${poly} ${last[0]},118 ${points[0][0]},118`;
  const dots = points
    .map(([x, y], i) => {
      const r = i === points.length - 1 ? 5 : 3.5;
      return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
    })
    .join('');
  const first = rates[0];
  const latest = rates[rates.length - 1];
  return `
      <svg viewBox="0 0 720 130" preserveAspectRatio="none" role="img"
           aria-label="Pass rate trend ${first}% to ${latest}%">
        <defs>
          <linearGradient id="fillTrend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0E8C6D" stop-opacity=".18"/>
            <stop offset="100%" stop-color="#0E8C6D" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <line x1="0" y1="118" x2="720" y2="118" stroke="#D9E6E4" stroke-width="1"/>
        <polygon fill="url(#fillTrend)" points="${fillPts}"/>
        <polyline fill="none" stroke="#0E8C6D" stroke-width="2.5" stroke-linecap="round" points="${poly}"/>
        <g fill="#0E8C6D">${dots}</g>
      </svg>`;
}

/**
 * Relative screenshot href from reports/ to screenshots/.
 * @param {string|null} screenshot
 */
function screenshotSrc(screenshot) {
  if (!screenshot) return null;
  return `../screenshots/${path.basename(String(screenshot))}`;
}

/**
 * Group catalog + results by module for the progress bars.
 * @param {object} payload
 */
function moduleStats(payload) {
  const tests = payload.tests || [];
  const catalog = payload.catalogCases || [];
  const names = [];
  const seen = new Set();
  for (const c of catalog) {
    const name = c.module || 'Other';
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  for (const t of tests) {
    const name = t.module || 'Other';
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }

  return names.map(name => {
    const inModule = tests.filter(t => (t.module || 'Other') === name);
    const passed = inModule.filter(t => t.status === 'PASS').length;
    const failed = inModule.filter(t => t.status === 'FAIL').length;
    const skipped = inModule.filter(t => t.status === 'SKIP').length;
    const catalogCount = catalog.filter(c => (c.module || 'Other') === name)
      .length;
    const executed = passed + failed;
    const total = executed + skipped || catalogCount || executed;
    const rate = executed ? Math.round((passed / executed) * 1000) / 10 : 0;
    return { name, passed, failed, skipped, executed, total, rate };
  });
}

/**
 * Step trail for one test. PASS = all catalog steps ok.
 * FAIL = prior steps ok, last step marked as the failure point.
 * SKIP = all steps not executed.
 * @param {object} test
 */
function stepItems(test) {
  const steps = Array.isArray(test.steps) ? test.steps : [];
  if (!steps.length) {
    if (test.status === 'FAIL') {
      return [
        '<li class="bad"><span class="icon">✕</span>Test failed<span class="crashpoint">ERROR HERE</span></li>',
      ];
    }
    if (test.status === 'SKIP') {
      return [
        '<li class="na"><span class="icon">–</span>Not executed this run<span class="stime">not executed</span></li>',
      ];
    }
    return [
      '<li class="ok"><span class="icon">✓</span>Completed successfully</li>',
    ];
  }

  return steps.map((step, index) => {
    const label = escapeHtml(step);
    if (test.status === 'PASS') {
      return `<li class="ok"><span class="icon">✓</span>${label}</li>`;
    }
    if (test.status === 'SKIP') {
      return `<li class="na"><span class="icon">–</span>${label}<span class="stime">not executed</span></li>`;
    }
    const isLast = index === steps.length - 1;
    if (isLast) {
      return `<li class="bad"><span class="icon">✕</span>${label}<span class="crashpoint">ERROR HERE</span></li>`;
    }
    return `<li class="ok"><span class="icon">✓</span>${label}</li>`;
  });
}

/**
 * Expandable card for one test (pass, fail, or skip).
 * Failures start expanded so the error + screenshot are visible.
 * @param {object} test
 * @param {object} payload
 */
function testCard(test, payload) {
  const plat = payload.platform || {};
  const isFail = test.status === 'FAIL';
  const isSkip = test.status === 'SKIP';
  const kind = isFail ? failureKind(test.error) : '';
  const badge = isFail
    ? `<span class="badge ${kind}">${BADGE_LABEL[kind]}</span>`
    : isSkip
      ? `<span class="badge locator">Skipped</span>`
      : `<span class="badge ok">Passed</span>`;
  // Pass and fail start expanded so every case is visible without clicking.
  const openClass = isSkip ? '' : ' open';
  const shot = screenshotSrc(test.screenshot);
  const device =
    plat.deviceName || plat.device || plat.platformName || 'device';
  const tid = [test.caseId, test.module, device].filter(Boolean).join(' · ');

  let shotHtml = '';
  if (isFail) {
    const cap = test.finishedAt
      ? `captured · ${escapeHtml(formatIst(test.finishedAt))}`
      : 'failure screenshot';
    const inner = shot
      ? `<img src="${escapeHtml(shot)}" alt="Failure screenshot ${escapeHtml(test.caseId || '')}">`
      : `<div class="placeholder">screenshot slot<br><br>${escapeHtml(test.caseId || 'test')}<br>_failure.png</div>`;
    shotHtml = `
        <div class="shotframe">
          <div class="notch"></div>
          <div class="screen">${inner}</div>
          <div class="cap">${cap}</div>
        </div>`;
  }

  const cause = isFail
    ? `<div class="cause"><span class="causelabel">Error — what happened</span>${escapeHtml(test.error || 'Unknown error')}</div>`
    : test.understanding
      ? `<p class="caption" style="margin-top:0">${escapeHtml(test.understanding)}</p>`
      : '';

  const footBits = [
    plat.osVersion ? `iOS ${escapeHtml(plat.osVersion)}` : escapeHtml(plat.platformName || ''),
    test.durationMs ? `Duration ${formatDuration(test.durationMs)}` : '',
    test.expected ? `Expected: ${escapeHtml(test.expected)}` : '',
    test.passWhen && test.status === 'PASS'
      ? `PASS when: ${escapeHtml(test.passWhen)}`
      : '',
    test.failWhen && test.status === 'FAIL'
      ? `FAIL when: ${escapeHtml(test.failWhen)}`
      : '',
  ].filter(Boolean);

  return `
    <div class="failure${openClass}">
      <button class="fhead" onclick="this.parentElement.classList.toggle('open')" type="button">
        <div>
          <div class="tid">${escapeHtml(tid)}</div>
          <h3>${escapeHtml(test.title)}</h3>
        </div>
        <div class="right">
          ${badge}
          <span class="chev">▾</span>
        </div>
      </button>
      <div class="fbody">
        <div class="ftext">
          <ol class="steps">
            ${stepItems(test).join('\n            ')}
          </ol>
          ${cause}
          <div class="foot">${footBits.map(b => `<span>${b}</span>`).join('')}</div>
        </div>
        ${shotHtml}
      </div>
    </div>`;
}

/**
 * Sort tests in catalog order (VP-SI-P01, P02, N01…) so the report
 * matches the planned suite instead of pass/fail grouping.
 * @param {object[]} tests
 * @param {object[]} catalogCases
 */
function sortByCatalog(tests, catalogCases) {
  const order = new Map(
    (catalogCases || []).map((c, index) => [String(c.caseId || ''), index]),
  );
  return [...tests].sort((a, b) => {
    const ia = order.has(a.caseId) ? order.get(a.caseId) : 999;
    const ib = order.has(b.caseId) ? order.get(b.caseId) : 999;
    if (ia !== ib) return ia - ib;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

/**
 * Always-visible table of every case (no expand/collapse).
 * @param {object[]} tests
 */
function allCasesTable(tests) {
  const rows = tests
    .map(t => {
      const statusClass =
        t.status === 'PASS'
          ? 'status-ok'
          : t.status === 'FAIL'
            ? 'status-bad'
            : 'status-skip';
      return `<tr>
          <td class="num">${escapeHtml(t.caseId || '—')}</td>
          <td>${escapeHtml(t.module || '')}</td>
          <td>${escapeHtml(t.title || '')}</td>
          <td class="${statusClass}">${escapeHtml(t.status)}</td>
          <td class="num">${t.durationMs ? formatDuration(t.durationMs) : '—'}</td>
          <td>${escapeHtml(t.error || t.expected || '—')}</td>
        </tr>`;
    })
    .join('\n        ');
  return `
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Module</th><th>Case</th><th>Status</th>
          <th>Duration</th><th>Expected / error</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6">No tests recorded.</td></tr>'}
      </tbody>
    </table>`;
}

/**
 * Shared CSS — same visual system as the VetPal iOS report template.
 */
function reportCss() {
  return `
  :root{
    --bg:#F2F7F6;
    --ink:#12343B;
    --ink-soft:#5B7479;
    --line:#D9E6E4;
    --card:#FFFFFF;
    --teal:#0E7C6B;
    --teal-deep:#0A5A4E;
    --pass:#0E8C6D;
    --pass-soft:#DCF0E9;
    --fail:#D64545;
    --fail-soft:#FBE7E7;
    --skip:#C08A1E;
    --skip-soft:#F7EDD6;
    --radius:14px;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{
    font-family:'Manrope',sans-serif;
    background:var(--bg);
    color:var(--ink);
    font-size:15px;
    line-height:1.6;
  }
  .mono{font-family:'JetBrains Mono',monospace}
  .wrap{max-width:980px;margin:0 auto;padding:36px 24px 90px}
  .hero{
    background:var(--ink);
    color:#F2F7F6;
    border-radius:20px;
    padding:36px 40px 32px;
    display:flex;justify-content:space-between;align-items:center;
    gap:32px;flex-wrap:wrap;
    position:relative;overflow:hidden;
  }
  .hero::after{
    content:"";position:absolute;right:-30px;bottom:-46px;width:230px;height:230px;
    background:
      radial-gradient(circle at 50% 68%, rgba(255,255,255,.05) 0 26%, transparent 27%),
      radial-gradient(circle at 26% 34%, rgba(255,255,255,.05) 0 10%, transparent 11%),
      radial-gradient(circle at 44% 22%, rgba(255,255,255,.05) 0 10%, transparent 11%),
      radial-gradient(circle at 62% 22%, rgba(255,255,255,.05) 0 10%, transparent 11%),
      radial-gradient(circle at 78% 34%, rgba(255,255,255,.05) 0 10%, transparent 11%);
    pointer-events:none;
  }
  .hero h1{font-size:27px;font-weight:800;letter-spacing:-0.015em;line-height:1.25}
  .hero .sub{color:#9DBBB6;margin-top:6px;font-size:14.5px}
  .devtag{
    display:inline-block;margin-left:8px;padding:2px 11px;border-radius:20px;
    background:rgba(240,200,110,.16);color:#EFC463;font-size:12px;font-weight:700;
    border:1px solid rgba(240,200,110,.35);vertical-align:middle;
  }
  .hero .runline{margin-top:18px;display:flex;gap:22px;flex-wrap:wrap;font-size:13px;color:#9DBBB6}
  .hero .runline b{color:#E5F0EE;font-weight:600;font-family:'JetBrains Mono',monospace;font-size:12.5px}
  .gauge{flex-shrink:0;text-align:center;position:relative;z-index:1}
  .gauge svg{display:block}
  .gauge .big{font-size:34px;font-weight:800;fill:#F2F7F6;font-family:'Manrope',sans-serif}
  .gauge .small{font-size:11px;fill:#9DBBB6;font-family:'Manrope',sans-serif}
  .gauge .counts{margin-top:6px;font-size:12.5px;color:#9DBBB6}
  .gauge .counts b{color:#E5F0EE}
  .stats{
    display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
    gap:14px;margin-top:18px;
  }
  .stat{
    background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
    padding:16px 18px;
  }
  .stat .k{font-size:12.5px;color:var(--ink-soft);font-weight:600}
  .stat .v{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:14px;margin-top:4px;line-height:1.35;word-break:break-word}
  .stat.pass .v{color:var(--pass)}
  .stat.fail .v{color:var(--fail)}
  .stat.skip .v{color:var(--skip)}
  section{margin-top:46px}
  section > h2{
    font-size:15px;font-weight:800;letter-spacing:.01em;
    display:flex;align-items:center;gap:12px;margin-bottom:16px;
  }
  section > h2::after{content:"";flex:1;height:1px;background:var(--line)}
  .modules{display:flex;flex-direction:column;gap:10px}
  .mod{
    background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
    padding:14px 18px;display:grid;
    grid-template-columns:minmax(7rem,1.1fr) auto auto minmax(5rem,1fr) 5.5rem;
    gap:12px 14px;align-items:center;overflow:visible;
  }
  .mod .name{font-weight:700;font-size:14.5px}
  .mod .counts{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--ink-soft);white-space:nowrap}
  .mod .counts b{color:var(--ink)}
  .mod .fails{font-family:'JetBrains Mono',monospace;font-size:12.5px;white-space:nowrap;color:var(--fail);font-weight:600}
  .mod .fails.zero{color:var(--pass)}
  .bar{height:8px;border-radius:4px;background:var(--fail-soft);overflow:hidden;min-width:48px}
  .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--teal),var(--pass));border-radius:4px}
  .rate{
    font-family:'JetBrains Mono',monospace;font-weight:600;font-size:13px;
    display:inline-flex;align-items:center;justify-content:center;
    min-width:4.75rem;height:28px;padding:0 12px;border-radius:20px;
    white-space:nowrap;line-height:1;justify-self:end;flex-shrink:0;
    box-sizing:border-box;
  }
  .rate.good{background:var(--pass-soft);color:var(--teal-deep)}
  .rate.bad{background:var(--fail-soft);color:var(--fail)}
  .failure{
    background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
    margin-bottom:16px;overflow:hidden;
  }
  .fhead{
    width:100%;text-align:left;border:none;background:none;cursor:pointer;
    padding:18px 22px;display:flex;justify-content:space-between;align-items:center;gap:14px;
    font-family:inherit;color:inherit;
  }
  .fhead:hover{background:#FAFCFC}
  .fhead .tid{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ink-soft)}
  .fhead h3{font-size:15px;font-weight:700;margin-top:3px}
  .fhead .right{display:flex;align-items:center;gap:12px;flex-shrink:0}
  .badge{
    font-size:12px;font-weight:700;padding:3px 12px;border-radius:20px;white-space:nowrap;
  }
  .badge.crash{background:var(--fail);color:#fff}
  .badge.assert{background:var(--fail-soft);color:var(--fail)}
  .badge.locator{background:var(--skip-soft);color:var(--skip)}
  .badge.ok{background:var(--pass-soft);color:var(--teal-deep)}
  .chev{
    width:26px;height:26px;border-radius:50%;border:1px solid var(--line);
    display:flex;align-items:center;justify-content:center;
    color:var(--ink-soft);font-size:12px;transition:transform .25s ease;flex-shrink:0;
  }
  .failure.open .chev{transform:rotate(180deg)}
  .fbody{display:none;padding:0 22px 20px}
  .failure.open .fbody{display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap}
  .ftext{flex:1;min-width:280px}
  .steps{list-style:none;position:relative;margin:4px 0 14px;padding-left:4px}
  .steps li{
    display:flex;gap:12px;align-items:flex-start;position:relative;
    padding:6px 8px;font-size:13.5px;border-radius:8px;
  }
  .steps li:not(:last-child)::before{
    content:"";position:absolute;left:17px;top:30px;bottom:-8px;width:2px;background:var(--line);
  }
  .steps .icon{
    flex-shrink:0;width:20px;height:20px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    font-size:11px;font-weight:800;margin-top:1px;position:relative;z-index:1;
  }
  .steps li.ok .icon{background:var(--pass-soft);color:var(--pass)}
  .steps li.bad .icon{background:var(--fail);color:#fff}
  .steps li.na .icon{background:#E9EFEE;color:#A3B4B2}
  .steps li.bad{background:var(--fail-soft);font-weight:700}
  .steps li.bad:not(:last-child)::before{background:var(--fail-soft)}
  .steps li.na{color:#A3B4B2}
  .stime{
    margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11.5px;
    color:var(--ink-soft);flex-shrink:0;padding-left:10px;font-weight:400;
  }
  .crashpoint{
    display:inline-block;background:var(--fail);color:#fff;font-size:10px;
    font-weight:800;border-radius:20px;padding:2px 9px;margin-left:8px;
    letter-spacing:.03em;vertical-align:middle;
  }
  .cause{
    background:#0F2A30;border-radius:10px;
    padding:12px 14px;font-family:'JetBrains Mono',monospace;font-size:12.5px;
    color:#F3B8B8;white-space:pre-wrap;overflow-x:auto;line-height:1.65;
  }
  .cause .causelabel{
    display:block;color:#7FA8A2;font-family:'Manrope',sans-serif;
    font-size:12px;font-weight:700;margin-bottom:6px;
  }
  .foot{display:flex;gap:18px;margin-top:12px;font-size:13px;color:var(--ink-soft);flex-wrap:wrap}
  .foot a{color:var(--teal);text-decoration:none;font-weight:700}
  .shotframe{
    width:172px;flex-shrink:0;border-radius:22px;
    background:#101418;padding:9px 7px;box-shadow:0 6px 18px rgba(18,52,59,.18);
  }
  .shotframe .notch{width:64px;height:5px;border-radius:3px;background:#2A3138;margin:0 auto 6px}
  .shotframe .screen{
    background:#1B2228;border-radius:15px;aspect-ratio:9/19.5;overflow:hidden;
    display:flex;align-items:center;justify-content:center;
  }
  .shotframe img{width:100%;height:100%;object-fit:cover;display:block}
  .shotframe .placeholder{
    color:#75838E;font-size:11.5px;text-align:center;padding:12px;line-height:1.55;
    font-family:'JetBrains Mono',monospace;
  }
  .shotframe .cap{
    color:var(--ink-soft);font-size:11.5px;text-align:center;margin-top:7px;
    font-family:'JetBrains Mono',monospace;word-break:break-all;
  }
  .panel{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:24px}
  .panel svg{width:100%;height:130px;display:block}
  .caption{color:var(--ink-soft);font-size:13px;margin-top:10px}
  table{width:100%;border-collapse:separate;border-spacing:0;background:var(--card);
    border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
  th{text-align:left;font-size:12.5px;color:var(--ink-soft);font-weight:700;
    padding:12px 16px;border-bottom:1px solid var(--line);background:#F7FAFA}
  td{padding:12px 16px;border-bottom:1px solid var(--line);font-size:14px}
  tr:last-child td{border-bottom:none}
  td.num{font-family:'JetBrains Mono',monospace;font-size:12.5px}
  .status-ok{color:var(--pass);font-weight:700}
  .status-bad{color:var(--fail);font-weight:700}
  .status-skip{color:var(--skip);font-weight:700}
  footer{
    margin-top:60px;padding-top:18px;border-top:1px solid var(--line);
    color:var(--ink-soft);font-size:12.5px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;
  }
  @media (max-width:720px){
    .hero{padding:28px 24px}
    .mod{grid-template-columns:1fr auto;row-gap:8px}
    .mod .bar{grid-column:1/-1}
    .mod .rate{grid-column:2;grid-row:1;justify-self:end}
    .stime{display:none}
    .shotframe{width:150px}
  }
  @media (prefers-reduced-motion: reduce){
    .chev{transition:none}
  }`;
}

/**
 * Render the full strong HTML report.
 * @param {object} payload  Runtime payload from createTestReport.writeReports
 * @param {{ displayName?: string }} [opts]
 */
function buildStrongHtml(payload, opts = {}) {
  const displayName = opts.displayName || payload.title || 'Mobile App';
  const plat = payload.platform || {};
  const summary = payload.summary || {};
  const tests = payload.tests || [];
  const passed = summary.passed || 0;
  const failed = summary.failed || 0;
  const skipped = summary.skipped || 0;
  const executed = passed + failed;
  const total = summary.total || tests.length;
  const passRate = executed ? Math.round((passed / executed) * 100) : 0;
  const platformLabel = plat.platformName || 'iOS';
  const generatedAt = payload.generatedAt || new Date().toISOString();
  const trigger =
    process.env.BUILD_TAG ||
    (process.env.BUILD_NUMBER ? `Jenkins #${process.env.BUILD_NUMBER}` : 'Local CLI');
  const appBuild =
    plat.appBuild || process.env.APP_BUILD || plat.appId || 'n/a';
  const osLabel = plat.osVersion
    ? `${platformLabel} ${plat.osVersion}`
    : platformLabel;
  const deviceLabel = plat.deviceName || plat.device || 'n/a';
  const driverLabel =
    plat.driver ||
    (platformLabel === 'Android' ? 'UiAutomator2 · Appium' : 'XCUITest · Appium');
  const xcodeLabel = plat.xcode || process.env.IOS_XCODE_VERSION || '—';

  const modules = moduleStats(payload);
  const moduleRows = modules
    .map(m => {
      const width = m.executed ? m.rate : 0;
      const failClass = m.failed === 0 ? 'fails zero' : 'fails';
      const rateClass = m.rate >= 85 ? 'good' : 'bad';
      const rateText = m.executed ? `${m.rate}%` : 'n/a';
      return `
      <div class="mod">
        <span class="name">${escapeHtml(m.name)}</span>
        <span class="counts"><b>${m.passed}</b>/${m.executed || m.total} passed</span>
        <span class="${failClass}">${m.failed} failed</span>
        <div class="bar"><i style="width:${width}%"></i></div>
        <span class="rate ${m.executed ? rateClass : 'locator'}">${rateText}</span>
      </div>`;
    })
    .join('');

  const skipNote =
    skipped > 0
      ? `<p class="caption">${skipped} test${skipped === 1 ? '' : 's'} not executed this run — still listed from the catalog as skipped.</p>`
      : '';

  const orderedTests = sortByCatalog(tests, payload.catalogCases);
  const detailCards = orderedTests.map(t => testCard(t, payload)).join('\n');
  const casesTable = allCasesTable(orderedTests);

  const history = Array.isArray(payload.history) ? payload.history : [];
  const rates = history.map(h => h.passRate).filter(n => typeof n === 'number');
  const trendSection =
    rates.length >= 2
      ? `
  <section>
    <h2>Pass-rate trend — last ${rates.length} runs</h2>
    <div class="panel">
      ${trendSvg(rates)}
      <div class="caption">${rates[0]}% → ${rates[rates.length - 1]}% executed pass rate.</div>
    </div>
  </section>`
      : '';

  const matrixStatus =
    failed > 0 ? `status-bad">${failed} failure${failed === 1 ? '' : 's'}` : 'status-ok">All passed';
  const matrixSection = `
  <section>
    <h2>Device matrix</h2>
    <table>
      <thead><tr><th>Device</th><th>OS</th><th>Executed</th><th>Passed</th><th>Failed</th><th>Result</th></tr></thead>
      <tbody>
        <tr>
          <td>${escapeHtml(deviceLabel)}</td>
          <td class="num">${escapeHtml(osLabel)}</td>
          <td class="num">${executed}</td>
          <td class="num">${passed}</td>
          <td class="num">${failed}</td>
          <td class="${matrixStatus}</td>
        </tr>
      </tbody>
    </table>
  </section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(displayName)} — Automation Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${reportCss()}
</style>
</head>
<body>
<div class="wrap">

  <div class="hero">
    <div>
      <h1>${escapeHtml(displayName)}<br>${escapeHtml(platformLabel)} Automation Report</h1>
      <div class="sub">Regression Suite · ${escapeHtml(appBuild)} <span class="devtag">${escapeHtml(payload.buildTag || 'Development build')}</span></div>
      <div class="runline">
        <span>Executed <b>${escapeHtml(formatIst(generatedAt))}</b></span>
        <span>Duration <b>${escapeHtml(formatDuration(summary.durationMs || 0))}</b></span>
        <span>Trigger <b>${escapeHtml(trigger)}</b></span>
      </div>
    </div>
    <div class="gauge">
      <svg width="190" height="120" viewBox="0 0 190 120">
        <path d="M 20 105 A 78 78 0 0 1 170 105" fill="none" stroke="#24444B" stroke-width="14" stroke-linecap="round"/>
        <path d="M 20 105 A 78 78 0 0 1 170 105" fill="none" stroke="#25B893" stroke-width="14"
              stroke-linecap="round" stroke-dasharray="${gaugeDash(passRate)}" />
        <text x="95" y="88" text-anchor="middle" class="big">${passRate}%</text>
        <text x="95" y="106" text-anchor="middle" class="small">pass rate</text>
      </svg>
      <div class="counts"><b>${passed}</b> passed · <b>${failed}</b> failed · <b>${skipped}</b> skipped · ${total} total</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="k">App / bundle</div><div class="v">${escapeHtml(appBuild)}</div></div>
    <div class="stat"><div class="k">Platform</div><div class="v">${escapeHtml(osLabel)}</div></div>
    <div class="stat"><div class="k">Device</div><div class="v">${escapeHtml(deviceLabel)}</div></div>
    <div class="stat"><div class="k">Driver</div><div class="v">${escapeHtml(driverLabel)}</div></div>
    <div class="stat"><div class="k">Xcode</div><div class="v">${escapeHtml(xcodeLabel)}</div></div>
  </div>

  <section>
    <h2>Results by module</h2>
    <div class="modules">
      ${moduleRows || '<p class="caption">No modules recorded.</p>'}
    </div>
    ${skipNote}
  </section>

  <section>
    <h2>All test cases</h2>
    ${casesTable}
    <p class="caption">Every catalog case from this run. PASS / FAIL / SKIP is always visible here — details below are already expanded.</p>
  </section>

  <section>
    <h2>Case details — steps, error &amp; screenshot</h2>
    ${detailCards || '<p class="caption">No tests recorded.</p>'}
  </section>

  ${trendSection}

  ${matrixSection}

  <footer>
    <span>${escapeHtml(driverLabel)} · WebdriverIO · ${escapeHtml(trigger)}</span>
    <span>${escapeHtml(displayName)} QA Automation</span>
  </footer>

</div>
</body>
</html>`;
}

module.exports = {
  buildStrongHtml,
  escapeHtml,
  formatDuration,
  formatIst,
};

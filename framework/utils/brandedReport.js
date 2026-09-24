/**
 * App Design branded run report (https://appdesign.ie/).
 *
 * Same data as the plain report in strongHtmlReport.js — only the layout and
 * visual system differ: dark App Design cover with verdict + pass-rate ring,
 * headline numbers, module cards, case table, detailed case cards with the
 * failure screenshot, pass-rate trend and a branded footer. Fonts and palette
 * match the dashboard (Fraunces + Outfit, orange #F37324 on black / paper).
 *
 * strongHtmlReport.js passes its helpers in (no circular require).
 */

/**
 * @typedef {object} ReportHelpers
 * @property {(v: unknown) => string} escapeHtml
 * @property {(ms: number) => string} formatDuration
 * @property {(iso: string) => string} formatIst
 * @property {(payload: object) => Array<{name:string,passed:number,failed:number,skipped:number,executed:number,total:number,rate:number}>} moduleStats
 * @property {(tests: object[], catalog: object[]) => object[]} sortByCatalog
 * @property {(test: object) => string[]} stepItems
 * @property {(screenshot: string|null) => string|null} screenshotSrc
 * @property {(error: string) => 'crash'|'locator'|'assert'} failureKind
 * @property {Record<string,string>} BADGE_LABEL
 */

/** Full-circle pass-rate ring. */
function ringSvg(rate) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, rate)) / 100) * c;
  return `
    <svg class="ring" viewBox="0 0 132 132" role="img" aria-label="Pass rate ${rate}%">
      <circle cx="66" cy="66" r="${r}" class="ring-track"/>
      ${filled > 0 ? `<circle cx="66" cy="66" r="${r}" class="ring-arc"
              stroke-dasharray="${filled.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 66 66)"/>` : ''}
    </svg>`;
}

/** Orange area chart of the last N executed pass rates. */
function trendChart(rates, h) {
  const w = 720;
  const top = 18;
  const base = 128;
  const pad = 48;
  const usable = w - pad - 16;
  const yFor = r => base - (Math.max(0, Math.min(100, r)) / 100) * (base - top);
  const pts = rates.map((rate, i) => [
    rates.length === 1 ? w / 2 : pad + (i / (rates.length - 1)) * usable,
    yFor(rate),
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} ${pts[pts.length - 1][0].toFixed(1)},${base} ${pts[0][0].toFixed(1)},${base}`;
  const grid = [0, 50, 100]
    .map(v => `<line x1="${pad}" x2="${w - 16}" y1="${yFor(v)}" y2="${yFor(v)}" class="tgrid"/>
      <text x="${pad - 10}" y="${yFor(v) + 4}" class="tlabel" text-anchor="end">${v}%</text>`)
    .join('');
  const dots = pts
    .map(([x, y], i) => {
      const last = i === pts.length - 1;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${last ? 5.5 : 3.5}" class="${last ? 'tdot last' : 'tdot'}"/>`;
    })
    .join('');
  return `
      <svg viewBox="0 0 ${w} 140" role="img"
           aria-label="Pass rate trend ${h.escapeHtml(rates[0])}% to ${h.escapeHtml(rates[rates.length - 1])}%">
        <defs>
          <linearGradient id="adTrend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#F37324" stop-opacity=".28"/>
            <stop offset="100%" stop-color="#F37324" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid}
        <polygon points="${area}" fill="url(#adTrend)"/>
        <polyline points="${line}" class="tline"/>
        ${dots}
      </svg>`;
}

function statusPill(status) {
  const cls = status === 'PASS' ? 'pass' : status === 'FAIL' ? 'fail' : 'skip';
  const label = status === 'PASS' ? 'Passed' : status === 'FAIL' ? 'Failed' : 'Skipped';
  return `<span class="pill ${cls}">${label}</span>`;
}

/**
 * One case: header with status, step trail, plain-English cause, facts, and
 * the failure screenshot in a phone frame. Failures and passes start open.
 */
function caseCard(test, payload, h) {
  const plat = payload.platform || {};
  const e = h.escapeHtml;
  const isFail = test.status === 'FAIL';
  const isSkip = test.status === 'SKIP';
  const status = isFail ? 'fail' : isSkip ? 'skip' : 'pass';
  const kind = isFail ? h.failureKind(test.error) : '';
  const device = plat.deviceName || plat.device || plat.platformName || 'device';

  const shot = isFail ? h.screenshotSrc(test.screenshot) : null;
  const phone = isFail
    ? `
        <figure class="phone">
          <div class="phone-body">
            <div class="phone-notch"></div>
            <div class="phone-screen">${
              shot
                ? `<img src="${e(shot)}" alt="Screen when ${e(test.caseId || 'the test')} failed">`
                : `<div class="noshot">No screenshot<br>captured</div>`
            }</div>
          </div>
          <figcaption>Screen at failure${test.finishedAt ? `<br>${e(h.formatIst(test.finishedAt))}` : ''}</figcaption>
        </figure>`
    : '';

  const negative =
    test.expectedError || test.actualError
      ? `
          <div class="compare ${isFail ? 'bad' : 'good'}">
            <div><span>Expected</span>${e(test.expectedError || '—')}</div>
            <div><span>Actual</span>${e(test.actualError || '—')}</div>
          </div>`
      : '';

  const technical =
    test.errorTechnical && String(test.errorTechnical) !== String(test.error)
      ? `<details class="tech"><summary>Technical details</summary><pre>${e(String(test.errorTechnical))}</pre></details>`
      : '';

  const cause = isFail
    ? `
          <div class="cause">
            <div class="cause-label">What went wrong</div>
            <div class="cause-text">${e(test.error || 'Unknown error')}</div>
            ${technical}
          </div>${negative}`
    : `${negative}${test.understanding ? `<p class="about">${e(test.understanding)}</p>` : ''}`;

  const facts = [
    ['Duration', test.durationMs ? h.formatDuration(test.durationMs) : ''],
    ['Expected', test.expected || ''],
    [isFail ? 'Fails when' : 'Passes when', isFail ? test.failWhen : test.passWhen],
    ['Page', test.pageContext || ''],
    ['Action', test.action || ''],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${e(v)}</dd></div>`)
    .join('');

  const kindTag = isFail ? `<span class="kind ${kind}">${e(h.BADGE_LABEL[kind])}</span>` : '';

  return `
    <article class="case ${status}${isSkip ? '' : ' open'}" id="case-${e(test.caseId || '')}">
      <button class="case-head" type="button" onclick="this.parentElement.classList.toggle('open')">
        <span class="case-id">${e(test.caseId || '—')}</span>
        <span class="case-title">
          <span class="case-meta">${e([test.module, device].filter(Boolean).join(' · '))}</span>
          <span class="case-name">${e(String(test.title || '').replace(/^[A-Z]+-[A-Z]+-[A-Z0-9]+:\s*/, ''))}</span>
        </span>
        <span class="case-right">${kindTag}${statusPill(test.status)}<span class="chev" aria-hidden="true"></span></span>
      </button>
      <div class="case-body">
        <div class="case-main">
          <ol class="steps">
            ${h.stepItems(test).join('\n            ')}
          </ol>
          ${cause}
          ${facts ? `<dl class="facts">${facts}</dl>` : ''}
        </div>
        ${phone}
      </div>
    </article>`;
}

function brandedCss() {
  return `
  :root{
    --orange:#F37324;--orange-deep:#C2410C;--orange-soft:#FDE3D1;--orange-tint:#FFF4EC;
    --black:#111111;--ink:#141414;--ink-soft:#6B6560;--paper:#FAF7F4;--card:#FFFFFF;--line:#ECE5DE;
    --pass:#15803D;--pass-soft:#DCFCE7;--fail:#DC2626;--fail-soft:#FEE2E2;--skip:#B45309;--skip-soft:#FEF3C7;
    --radius:18px;--shadow:0 1px 2px rgba(20,20,20,.04),0 8px 28px rgba(20,20,20,.06);
    --display:'Fraunces',Georgia,serif;--sans:'Outfit',system-ui,sans-serif;--mono:'JetBrains Mono',ui-monospace,monospace;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
  body{font-family:var(--sans);background:var(--paper);color:var(--ink);font-size:15px;line-height:1.6;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  a{color:inherit}
  .wrap{max-width:1040px;margin:0 auto;padding:0 24px}

  /* ---------- cover */
  .cover{background:var(--black);color:#F5F1ED;position:relative;overflow:hidden;padding:30px 0 118px}
  .cover::before{content:"";position:absolute;inset:0;
    background:
      radial-gradient(620px 420px at 88% 18%,rgba(243,115,36,.30),transparent 62%),
      radial-gradient(520px 380px at 4% 110%,rgba(243,115,36,.14),transparent 60%);
    pointer-events:none}
  .cover::after{content:"";position:absolute;inset:0;opacity:.07;pointer-events:none;
    background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);
    background-size:44px 44px;mask-image:linear-gradient(180deg,#000 0,transparent 85%);
    -webkit-mask-image:linear-gradient(180deg,#000 0,transparent 85%)}
  .cover .wrap{position:relative;z-index:1}
  .topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .topbar img{height:38px;display:block}
  .chip{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;letter-spacing:.12em;
    text-transform:uppercase;color:#FDBA8C;border:1px solid rgba(243,115,36,.45);background:rgba(243,115,36,.10);
    padding:6px 14px;border-radius:999px}
  .chip i{width:7px;height:7px;border-radius:50%;background:var(--orange);box-shadow:0 0 0 4px rgba(243,115,36,.22)}
  .cover-main{display:grid;grid-template-columns:1fr auto;gap:40px;align-items:center;margin-top:52px}
  .eyebrow{font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#A8A09A}
  .cover h1{font-family:var(--display);font-weight:600;font-size:clamp(38px,6vw,64px);line-height:1.02;
    letter-spacing:-.02em;margin-top:12px}
  .cover h1 em{font-style:italic;color:var(--orange);font-weight:500}
  .verdict{display:inline-flex;align-items:center;gap:10px;margin-top:22px;padding:10px 18px 10px 12px;
    border-radius:999px;font-weight:700;font-size:15px}
  .verdict b{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:14px;color:#fff}
  .verdict.good{background:rgba(34,197,94,.14);color:#86EFAC;border:1px solid rgba(34,197,94,.35)}
  .verdict.good b{background:#16A34A}
  .verdict.bad{background:rgba(243,115,36,.14);color:#FDBA8C;border:1px solid rgba(243,115,36,.45)}
  .verdict.bad b{background:var(--orange)}
  .verdict.none{background:rgba(255,255,255,.08);color:#D6CFC9;border:1px solid rgba(255,255,255,.18)}
  .verdict.none b{background:#57534E}
  .runline{display:flex;flex-wrap:wrap;gap:8px 26px;margin-top:22px;font-size:13.5px;color:#A8A09A}
  .runline b{color:#F5F1ED;font-weight:600}
  .ringbox{position:relative;width:210px;height:210px;flex-shrink:0}
  .ring{width:100%;height:100%;display:block}
  .ring circle{fill:none;stroke-width:11}
  .ring-track{stroke:rgba(255,255,255,.09)}
  .ring-arc{stroke:var(--orange);stroke-linecap:round;animation:ringIn 1.1s cubic-bezier(.2,.8,.2,1) both}
  .ringbox.good .ring-arc{stroke:#22C55E}
  @keyframes ringIn{from{stroke-dasharray:0 400}}
  .ringtxt{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
  .ringtxt strong{font-family:var(--display);font-size:52px;font-weight:600;line-height:1;letter-spacing:-.02em}
  .ringtxt strong small{font-size:24px;color:#A8A09A;margin-left:2px}
  .ringtxt span{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:#A8A09A;margin-top:6px}

  /* ---------- headline numbers (overlap the cover) */
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:-72px;position:relative;z-index:2}
  .kpi{background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px 22px;
    border:1px solid var(--line);position:relative;overflow:hidden}
  .kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--line)}
  .kpi.pass::before{background:#22C55E}.kpi.fail::before{background:var(--fail)}.kpi.run::before{background:var(--orange)}
  .kpi .k{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
  .kpi .v{font-family:var(--display);font-size:40px;font-weight:600;line-height:1.1;margin-top:6px;letter-spacing:-.02em}
  .kpi.pass .v{color:var(--pass)}.kpi.fail .v{color:var(--fail)}
  .kpi .s{font-size:12.5px;color:var(--ink-soft);margin-top:2px}

  .env{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
  .env div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:9px 14px;font-size:13px;max-width:100%;overflow-wrap:anywhere}
  .env span{color:var(--ink-soft);margin-right:8px}
  .env b{font-family:var(--mono);font-weight:500;font-size:12.5px}

  /* ---------- sections */
  section{margin-top:56px}
  .sec-head{display:flex;align-items:baseline;gap:14px;margin-bottom:18px;flex-wrap:wrap}
  .sec-head .no{font-family:var(--mono);font-size:12px;color:var(--orange);font-weight:600}
  .sec-head h2{font-family:var(--display);font-size:28px;font-weight:600;letter-spacing:-.01em;line-height:1.15}
  .sec-head p{color:var(--ink-soft);font-size:13.5px;flex-basis:100%;margin-top:2px}
  .note{color:var(--ink-soft);font-size:13px;margin-top:12px}

  /* ---------- modules */
  .mods{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:14px}
  .mod{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;box-shadow:var(--shadow)}
  .mod-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  .mod h3{font-size:16px;font-weight:700;line-height:1.3}
  .mod .rate{font-family:var(--display);font-size:26px;font-weight:600;line-height:1}
  .mod .rate.good{color:var(--pass)}.mod .rate.bad{color:var(--fail)}
  .mbar{display:flex;height:8px;border-radius:99px;overflow:hidden;background:#F1ECE7;margin-top:14px}
  .mbar .p{background:#22C55E}.mbar .f{background:var(--fail)}.mbar .s{background:#F59E0B}
  .mod .counts{display:flex;gap:16px;margin-top:10px;font-size:13px;color:var(--ink-soft)}
  .mod .counts b{color:var(--ink);font-weight:700}

  /* ---------- table */
  .tablebox{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);overflow-x:auto;box-shadow:var(--shadow)}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);
    padding:14px 18px;background:#FBF8F5;border-bottom:1px solid var(--line)}
  td{padding:14px 18px;border-bottom:1px solid var(--line);font-size:14px;vertical-align:top}
  tr:last-child td{border-bottom:none}
  tbody tr:hover td{background:#FFFBF7}
  td.id{font-family:var(--mono);font-size:12.5px;white-space:nowrap}
  td.id a{text-decoration:none;color:var(--orange-deep);font-weight:600}
  td.time{font-family:var(--mono);font-size:12.5px;white-space:nowrap;color:var(--ink-soft)}
  td.msg{color:var(--ink-soft);font-size:13px;max-width:320px}
  td.msg.bad{color:#991B1B}
  .pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 11px;border-radius:999px;white-space:nowrap}
  .pill::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
  .pill.pass{background:var(--pass-soft);color:var(--pass)}
  .pill.fail{background:var(--fail-soft);color:var(--fail)}
  .pill.skip{background:var(--skip-soft);color:var(--skip)}

  /* ---------- case cards */
  .case{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);margin-bottom:16px;
    box-shadow:var(--shadow);overflow:hidden;position:relative}
  .case::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:#22C55E}
  .case.fail::before{background:var(--fail)}.case.skip::before{background:#F59E0B}
  .case-head{width:100%;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;
    display:flex;align-items:center;gap:18px;padding:20px 22px 20px 28px}
  .case-head:hover{background:#FFFBF7}
  .case-id{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--orange-deep);background:var(--orange-tint);
    border:1px solid var(--orange-soft);border-radius:8px;padding:5px 9px;white-space:nowrap;flex-shrink:0}
  .case-title{flex:1;min-width:0}
  .case-meta{display:block;font-size:12px;color:var(--ink-soft);font-weight:600;letter-spacing:.02em}
  .case-name{display:block;font-size:16px;font-weight:700;line-height:1.35;margin-top:2px}
  .case-right{display:flex;align-items:center;gap:10px;flex-shrink:0}
  .kind{font-size:11.5px;font-weight:700;color:var(--ink-soft);border:1px solid var(--line);border-radius:999px;padding:3px 10px}
  .kind.crash{color:#fff;background:var(--fail);border-color:var(--fail)}
  .chev{width:28px;height:28px;border-radius:50%;border:1px solid var(--line);position:relative;transition:transform .25s}
  .chev::after{content:"";position:absolute;left:50%;top:45%;width:7px;height:7px;border-right:2px solid var(--ink-soft);
    border-bottom:2px solid var(--ink-soft);transform:translate(-50%,-50%) rotate(45deg)}
  .case.open .chev{transform:rotate(180deg)}
  .case-body{display:none;gap:28px;padding:0 24px 24px 28px;align-items:flex-start}
  .case.open .case-body{display:flex;flex-wrap:wrap}
  .case-main{flex:1;min-width:min(300px,100%)}
  .steps{list-style:none;margin:2px 0 16px;position:relative}
  .steps li{display:flex;gap:12px;align-items:flex-start;padding:7px 10px;border-radius:10px;font-size:14px;position:relative}
  .steps li:not(:last-child)::before{content:"";position:absolute;left:21px;top:32px;bottom:-8px;width:2px;background:var(--line)}
  .steps .icon{flex-shrink:0;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;
    font-size:11px;font-weight:800;line-height:1;position:relative;z-index:1}
  .steps li.ok .icon{background:var(--pass-soft);color:var(--pass)}
  .steps li.bad{background:var(--fail-soft);font-weight:700}
  .steps li.bad .icon{background:var(--fail);color:#fff}
  .steps li.na{color:#A8A29E}.steps li.na .icon{background:#F1ECE7;color:#A8A29E}
  .crashpoint{margin-left:auto;background:var(--fail);color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.06em;
    border-radius:999px;padding:3px 10px;white-space:nowrap;align-self:center}
  .stime{margin-left:auto;font-family:var(--mono);font-size:11.5px;color:var(--ink-soft);white-space:nowrap}
  .cause{background:#17120F;border-radius:14px;padding:16px 18px;position:relative;overflow:hidden}
  .cause::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--orange)}
  .cause-label{font-size:11.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#FDBA8C}
  .cause-text{font-family:var(--mono);font-size:13px;color:#FBE9DF;margin-top:6px;white-space:pre-wrap;word-break:break-word;line-height:1.65}
  .tech{margin-top:10px}.tech summary{cursor:pointer;color:#A8A09A;font-size:12.5px}
  .tech pre{white-space:pre-wrap;font-family:var(--mono);font-size:12px;color:#D6CFC9;margin-top:8px}
  .compare{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
  .compare div{border-radius:12px;padding:12px 14px;font-size:13.5px;border:1px solid var(--line);background:#FBF8F5}
  .compare span{display:block;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:4px}
  .compare.bad div:last-child{background:var(--fail-soft);border-color:#FECACA;color:#7F1D1D}
  .compare.good div:last-child{background:var(--pass-soft);border-color:#BBF7D0;color:#14532D}
  .about{color:var(--ink-soft);font-size:14px}
  .facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px 18px;margin-top:16px;
    padding-top:14px;border-top:1px dashed var(--line)}
  .facts dt{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft)}
  .facts dd{font-size:13.5px;margin-top:2px}
  .phone{width:200px;flex-shrink:0;margin:0}
  .phone-body{background:#0B0B0C;border-radius:30px;padding:10px 8px;box-shadow:0 18px 40px rgba(20,20,20,.22),inset 0 0 0 2px #2A2623}
  .phone-notch{width:70px;height:6px;border-radius:4px;background:#2A2623;margin:2px auto 8px}
  .phone-screen{border-radius:22px;overflow:hidden;aspect-ratio:9/19.5;background:#1C1917;display:grid;place-items:center}
  .phone-screen img{width:100%;height:100%;object-fit:cover;display:block}
  .noshot{color:#78716C;font-size:12px;text-align:center;font-family:var(--mono)}
  .phone figcaption{text-align:center;font-size:12px;color:var(--ink-soft);margin-top:10px;line-height:1.5}

  /* ---------- trend */
  .panel{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:22px 24px;box-shadow:var(--shadow)}
  .panel svg{width:100%;height:auto;display:block}
  .tgrid{stroke:#EFE9E3;stroke-width:1}
  .tlabel{font-family:var(--sans);font-size:11px;fill:#A8A29E}
  .tline{fill:none;stroke:var(--orange);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
  .tdot{fill:#fff;stroke:var(--orange);stroke-width:2}
  .tdot.last{fill:var(--orange);stroke:#fff;stroke-width:2.5}

  /* ---------- footer */
  .brandfoot{background:var(--black);color:#A8A09A;margin-top:72px;position:relative;overflow:hidden}
  .brandfoot::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,var(--orange),#FF9A5C,var(--orange))}
  .brandfoot .wrap{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;padding-top:34px;padding-bottom:34px}
  .brandfoot img{height:32px;display:block}
  .brandfoot .tagline{font-family:var(--display);font-style:italic;color:#F5F1ED;font-size:18px;margin-top:10px}
  .brandfoot .links{display:flex;flex-direction:column;gap:6px;text-align:right;font-size:13.5px}
  .brandfoot a{color:#F5F1ED;text-decoration:none;font-weight:600}
  .brandfoot a:hover{color:var(--orange)}
  .techline{text-align:center;font-size:12px;color:#78716C;padding:14px 0 26px;background:var(--black);border-top:1px solid #221E1B}

  @media (max-width:820px){
    .cover-main{grid-template-columns:1fr}
    .ringbox{width:170px;height:170px}
    .kpis{grid-template-columns:repeat(2,1fr)}
    .compare{grid-template-columns:1fr}
    .brandfoot .links{text-align:left}
    td.msg{display:none}
  }
  @media (max-width:560px){
    .wrap{padding:0 16px}
    .chip{display:none}
    .kpi{padding:16px}.kpi .v{font-size:32px}
    .case-head{flex-wrap:wrap;padding:18px 16px 18px 22px}.case-right{width:100%;justify-content:flex-end}
    .case-body{padding:0 16px 20px 22px}
    th,td{padding:12px}
    .phone{width:170px;margin:0 auto}
    th:nth-child(3),td:nth-child(3){display:none}
  }
  @media (prefers-reduced-motion:reduce){.ring-arc{animation:none}.chev{transition:none}html{scroll-behavior:auto}}
  @media print{
    body{background:#fff}
    .case-body{display:flex !important;flex-wrap:wrap}
    .chev{display:none}
    .case,.mod,.kpi,.panel,.tablebox{box-shadow:none;break-inside:avoid}
    .ring-arc{animation:none}
  }`;
}

/**
 * @param {object} payload runtime payload from createTestReport.writeReports
 * @param {{ displayName?: string }} opts
 * @param {{ name:string, site:string, siteLabel:string, email:string, phone:string, phoneHref:string, logoDark:string, logoLight:string }} brand
 * @param {ReportHelpers} h
 */
function buildBrandedHtml(payload, opts, brand, h) {
  const e = h.escapeHtml;
  const displayName = opts.displayName || payload.title || 'Mobile App';
  const plat = payload.platform || {};
  const summary = payload.summary || {};
  const tests = payload.tests || [];
  const passed = summary.passed || 0;
  const failed = summary.failed || 0;
  const skipped = summary.skipped || 0;
  const executed = passed + failed;
  const passRate = executed ? Math.round((passed / executed) * 100) : 0;
  const platformLabel = plat.platformName || 'iOS';
  const generatedAt = payload.generatedAt || new Date().toISOString();
  const trigger =
    process.env.BUILD_TAG ||
    (process.env.BUILD_NUMBER ? `Jenkins #${process.env.BUILD_NUMBER}` : 'Local run');
  const appBuild = plat.appBuild || process.env.APP_BUILD || plat.appId || 'n/a';
  const osLabel = plat.osVersion ? `${platformLabel} ${plat.osVersion}` : platformLabel;
  const deviceLabel = plat.deviceName || plat.device || 'n/a';
  const driverLabel =
    plat.driver || (platformLabel === 'Android' ? 'UiAutomator2 · Appium' : 'XCUITest · Appium');
  const xcodeLabel = plat.xcode || process.env.IOS_XCODE_VERSION || '';
  const duration = h.formatDuration(summary.durationMs || 0);

  const verdict =
    executed === 0
      ? { cls: 'none', icon: '–', text: 'No tests were executed in this run' }
      : failed === 0
        ? { cls: 'good', icon: '✓', text: `All ${passed} check${passed === 1 ? '' : 's'} passed` }
        : { cls: 'bad', icon: '!', text: `${failed} of ${executed} check${executed === 1 ? '' : 's'} need${failed === 1 ? 's' : ''} attention` };

  // Modules that actually ran; the rest are listed in one line instead of empty bars.
  const allModules = h.moduleStats(payload);
  const ran = allModules.filter(m => m.executed + m.skipped > 0);
  const notRun = allModules.filter(m => m.executed + m.skipped === 0).map(m => m.name);
  const moduleCards = ran
    .map(m => {
      const n = m.executed + m.skipped;
      const pct = x => (n ? (x / n) * 100 : 0).toFixed(1);
      return `
      <div class="mod">
        <div class="mod-top">
          <h3>${e(m.name)}</h3>
          <span class="rate ${m.failed ? 'bad' : 'good'}">${m.executed ? `${Math.round(m.rate)}%` : '—'}</span>
        </div>
        <div class="mbar"><i class="p" style="width:${pct(m.passed)}%"></i><i class="f" style="width:${pct(m.failed)}%"></i><i class="s" style="width:${pct(m.skipped)}%"></i></div>
        <div class="counts"><span><b>${m.passed}</b> passed</span><span><b>${m.failed}</b> failed</span>${m.skipped ? `<span><b>${m.skipped}</b> skipped</span>` : ''}</div>
      </div>`;
    })
    .join('');

  const ordered = h.sortByCatalog(tests, payload.catalogCases);
  const rows = ordered
    .map(t => {
      const msg = t.status === 'FAIL' ? t.error || '' : t.expected || '';
      return `<tr>
          <td class="id"><a href="#case-${e(t.caseId || '')}">${e(t.caseId || '—')}</a></td>
          <td>${e(String(t.title || '').replace(/^[A-Z]+-[A-Z]+-[A-Z0-9]+:\s*/, ''))}</td>
          <td>${e(t.module || '')}</td>
          <td>${statusPill(t.status)}</td>
          <td class="time">${t.durationMs ? h.formatDuration(t.durationMs) : '—'}</td>
          <td class="msg${t.status === 'FAIL' ? ' bad' : ''}">${e(msg || '—')}</td>
        </tr>`;
    })
    .join('\n        ');
  const cards = ordered.map(t => caseCard(t, payload, h)).join('\n');

  const history = Array.isArray(payload.history) ? payload.history : [];
  const rates = history.map(x => x.passRate).filter(n => typeof n === 'number');

  let n = 0;
  const no = () => String(++n).padStart(2, '0');

  const env = [
    ['App', appBuild],
    ['Platform', osLabel],
    ['Device', deviceLabel],
    ['Driver', driverLabel],
    ['Xcode', xcodeLabel],
  ]
    .filter(([, v]) => v && v !== '—')
    .map(([k, v]) => `<div><span>${k}</span><b>${e(v)}</b></div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(displayName)} — ${e(platformLabel)} Test Report · ${e(brand.name)}</title>
<link rel="icon" href="${brand.logoDark}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${brandedCss()}
</style>
</head>
<body>
<header class="cover">
  <div class="wrap">
    <div class="topbar">
      <a href="${brand.site}" target="_blank" rel="noopener"><img src="${brand.logoLight}" alt="${e(brand.name)}"></a>
      <span class="chip"><i></i>Mobile QA Automation</span>
    </div>
    <div class="cover-main">
      <div>
        <div class="eyebrow">${e(payload.buildTag || 'Development build')} · Regression suite</div>
        <h1>${e(displayName)}<br><em>${e(platformLabel)} test report</em></h1>
        <div class="verdict ${verdict.cls}"><b>${verdict.icon}</b>${e(verdict.text)}</div>
        <div class="runline">
          <span>Executed <b>${e(h.formatIst(generatedAt))}</b></span>
          <span>Duration <b>${e(duration)}</b></span>
          <span>Device <b>${e(deviceLabel)}</b></span>
          <span>Trigger <b>${e(trigger)}</b></span>
        </div>
      </div>
      <div class="ringbox ${executed && failed === 0 ? 'good' : ''}">
        ${ringSvg(passRate)}
        <div class="ringtxt"><strong>${passRate}<small>%</small></strong><span>Pass rate</span></div>
      </div>
    </div>
  </div>
</header>

<main class="wrap">
  <div class="kpis">
    <div class="kpi run"><div class="k">Tests run</div><div class="v">${executed}</div><div class="s">${skipped ? `${skipped} skipped` : 'this session'}</div></div>
    <div class="kpi pass"><div class="k">Passed</div><div class="v">${passed}</div><div class="s">working as expected</div></div>
    <div class="kpi${failed ? ' fail' : ''}"><div class="k">Failed</div><div class="v">${failed}</div><div class="s">${failed ? 'see details below' : 'nothing to fix'}</div></div>
    <div class="kpi"><div class="k">Duration</div><div class="v">${e(duration)}</div><div class="s">end to end</div></div>
  </div>
  <div class="env">${env}</div>

  <section>
    <div class="sec-head"><span class="no">${no()}</span><h2>Results by module</h2></div>
    <div class="mods">${moduleCards || '<p class="note">No modules recorded.</p>'}</div>
    ${notRun.length ? `<p class="note">Not run this session: ${e(notRun.join(' · '))}. Full plan in test-catalog.html.</p>` : ''}
  </section>

  <section>
    <div class="sec-head"><span class="no">${no()}</span><h2>Test cases</h2><p>Every script that ran this session. Select an ID to jump to its details.</p></div>
    <div class="tablebox">
      <table>
        <thead><tr><th>ID</th><th>Case</th><th>Module</th><th>Result</th><th>Time</th><th>Expected / error</th></tr></thead>
        <tbody>
        ${rows || '<tr><td colspan="6">No tests recorded.</td></tr>'}
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <div class="sec-head"><span class="no">${no()}</span><h2>Case details</h2><p>Steps, what went wrong in plain English, and the device screen at the moment of failure.</p></div>
    ${cards || '<p class="note">No tests recorded.</p>'}
  </section>

  ${
    rates.length >= 2
      ? `<section>
    <div class="sec-head"><span class="no">${no()}</span><h2>Pass-rate trend</h2><p>Last ${rates.length} runs · ${rates[0]}% → ${rates[rates.length - 1]}%</p></div>
    <div class="panel">${trendChart(rates, h)}</div>
  </section>`
      : ''
  }
</main>

<footer class="brandfoot">
  <div class="wrap">
    <div>
      <a href="${brand.site}" target="_blank" rel="noopener"><img src="${brand.logoLight}" alt="${e(brand.name)}"></a>
      <div class="tagline">Apps with real purpose, tested on every release.</div>
    </div>
    <div class="links">
      <a href="${brand.site}" target="_blank" rel="noopener">${e(brand.siteLabel)}</a>
      <a href="mailto:${brand.email}">${e(brand.email)}</a>
      <a href="${brand.phoneHref}">${e(brand.phone)}</a>
    </div>
  </div>
  <div class="techline">${e(displayName)} QA automation · ${e(driverLabel)} · WebdriverIO · ${e(trigger)}</div>
</footer>
</body>
</html>`;
}

module.exports = { buildBrandedHtml };

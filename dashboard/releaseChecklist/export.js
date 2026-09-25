/**
 * Export a release checklist as CSV, Excel (SpreadsheetML .xls), or printable HTML (→ PDF).
 *
 * The PDF/HTML uses the same App Design cover and footer as the test report
 * (framework/utils/reportBrand.js + brandedReport.js): light logo on the dark
 * header, and logo plus appdesign.ie / email / phone in the footer.
 *
 * Supports full checklist or a single platform/section report
 * (e.g. iOS-only for an iOS developer to send separately).
 */

const { reportBrand } = require('../../framework/utils/reportBrand');

const STATUS_LABEL = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
  na: 'N/A',
};

/** section query value → section id(s) */
const SECTION_ALIASES = {
  all: null,
  full: null,
  backend: ['backend'],
  api: ['backend'],
  web: ['web'],
  ios: ['ios'],
  android: ['android'],
  security: ['security'],
  qa: ['qa'],
  uat: ['qa'],
  golive: ['golive'],
  'go-live': ['golive'],
};

function escapeCsv(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeXml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Resolve export options from query/body.
 * @param {object} checklist full enriched checklist
 * @param {{ section?: string, preparedBy?: string }} [opts]
 */
function prepareExportChecklist(checklist, opts = {}) {
  const preparedBy = String(
    opts.preparedBy || checklist.preparedBy || checklist.updatedBy || checklist.createdBy || ''
  ).trim();
  const raw = String(opts.section || opts.scope || 'all')
    .trim()
    .toLowerCase();
  const ids = SECTION_ALIASES[raw] === undefined
    ? (raw && raw !== 'all' ? [raw] : null)
    : SECTION_ALIASES[raw];

  let sections = checklist.sections || [];
  if (ids && ids.length) {
    sections = sections.filter((s) => ids.includes(s.id));
  }

  // Recompute progress for the filtered view (N/A excluded)
  let completed = 0;
  let total = 0;
  const bySection = {};
  for (const section of sections) {
    let sDone = 0;
    let sTotal = 0;
    for (const item of section.items || []) {
      if (item.status === 'na') continue;
      sTotal += 1;
      total += 1;
      if (item.status === 'completed') {
        sDone += 1;
        completed += 1;
      }
    }
    bySection[section.id] = {
      id: section.id,
      title: section.title,
      completed: sDone,
      total: sTotal,
      percent: sTotal ? Math.round((sDone / sTotal) * 100) : 0,
      applicable: sTotal > 0,
    };
    section.progress = bySection[section.id];
  }

  const sectionLabel =
    ids && ids.length === 1
      ? sections[0]?.title || ids[0]
      : ids && ids.length
        ? ids.join('+')
        : 'Full';

  return {
    ...checklist,
    sections,
    preparedBy,
    exportScope: ids ? ids.join(',') : 'full',
    exportScopeLabel: sectionLabel,
    progress: {
      completed,
      total,
      percent: total ? Math.round((completed / total) * 100) : 0,
      bySection,
    },
  };
}

function fileBaseName(checklist) {
  const project = String(checklist.displayName || checklist.projectId || 'Project')
    .replace(/\s+/g, '');
  const env =
    checklist.environment === 'staging' ? 'Staging' : 'Production';
  const ver = String(checklist.releaseVersion || 'v0').replace(/[^\w.\-]/g, '_');
  const scope =
    checklist.exportScope && checklist.exportScope !== 'full'
      ? `_${String(checklist.exportScopeLabel || checklist.exportScope)
          .replace(/\s+/g, '')
          .replace(/[^a-zA-Z0-9+_-]/g, '')}`
      : '';
  return `${project}_${env}${scope}_Release_Checklist_${ver}`;
}

function developerName(checklist) {
  const owners = checklist.owners || {};
  const scope = checklist.exportScope;
  if (scope && scope !== 'full') {
    const key = String(scope).split(',')[0];
    if (owners[key]) return owners[key];
    if (key === 'golive' || key === 'security') return owners.qa || owners.backend || '';
  }
  return (
    checklist.preparedBy ||
    checklist.updatedBy ||
    checklist.createdBy ||
    owners.ios ||
    owners.web ||
    owners.android ||
    owners.backend ||
    ''
  );
}

function ownersRows(checklist) {
  const o = checklist.owners || {};
  return [
    ['iOS developer', o.ios || '—'],
    ['Web / Frontend developer', o.web || '—'],
    ['Android developer', o.android || '—'],
    ['Backend developer', o.backend || '—'],
    ['QA owner', o.qa || '—'],
  ];
}

/** Flatten rows for tabular exports. */
function rowsOf(checklist) {
  const rows = [];
  for (const section of checklist.sections || []) {
    for (const item of section.items || []) {
      rows.push({
        category: section.title,
        item: item.label,
        status: STATUS_LABEL[item.status] || item.status,
        responsible: item.responsible || '',
        updatedBy: item.updatedBy || '',
        updated: item.updatedAt
          ? new Date(item.updatedAt).toLocaleString()
          : '',
        remarks: item.remarks || '',
        evidence: item.evidence || '',
      });
    }
  }
  return rows;
}

function metaLines(checklist) {
  const who = developerName(checklist) || '—';
  return [
    ['Project', checklist.displayName || checklist.projectId],
    ['Environment', checklist.environment],
    ['Release version', checklist.releaseVersion || '—'],
    ['Report scope', checklist.exportScopeLabel || 'Full checklist'],
    ['Progress', `${checklist.progress?.percent ?? 0}%`],
    ['Release Status', checklist.releaseStatus],
    ...ownersRows(checklist),
    ['Prepared / filled by', who],
    ['Created by', checklist.createdBy || who],
    ['Last updated by', checklist.updatedBy || who],
    ['Last updated', checklist.updatedAt || ''],
  ];
}

function buildCsv(checklist) {
  const header = [
    'Category',
    'Item',
    'Status',
    'Responsible',
    'Updated By',
    'Updated',
    'Remarks',
    'Evidence',
  ];
  const lines = metaLines(checklist).map(
    ([k, v]) => `# ${escapeCsv(k)},${escapeCsv(v)}`
  );
  lines.push('', header.join(','));
  for (const row of rowsOf(checklist)) {
    lines.push(
      [
        row.category,
        row.item,
        row.status,
        row.responsible,
        row.updatedBy,
        row.updated,
        row.remarks,
        row.evidence,
      ]
        .map(escapeCsv)
        .join(',')
    );
  }
  return {
    filename: `${fileBaseName(checklist)}.csv`,
    contentType: 'text/csv; charset=utf-8',
    body: Buffer.from(lines.join('\n'), 'utf8'),
  };
}

/** Excel-friendly SpreadsheetML (opens in Excel / Numbers). */
function buildExcel(checklist) {
  const rows = rowsOf(checklist);
  const cells = (vals) =>
    vals
      .map(
        (v) =>
          `<Cell><Data ss:Type="String">${escapeXml(v)}</Data></Cell>`
      )
      .join('');

  const meta = metaLines(checklist)
    .map((r) => `<Row>${cells(r)}</Row>`)
    .join('');

  const header = `<Row>${cells([
    'Category',
    'Item',
    'Status',
    'Responsible',
    'Updated By',
    'Updated',
    'Remarks',
    'Evidence',
  ])}</Row>`;

  const data = rows
    .map(
      (r) =>
        `<Row>${cells([
          r.category,
          r.item,
          r.status,
          r.responsible,
          r.updatedBy,
          r.updated,
          r.remarks,
          r.evidence,
        ])}</Row>`
    )
    .join('');

  const sheetName = String(checklist.exportScopeLabel || 'Release Checklist')
    .slice(0, 31)
    .replace(/[\\/*?:\[\]]/g, ' ');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   ${meta}
   <Row></Row>
   ${header}
   ${data}
  </Table>
 </Worksheet>
</Workbook>`;

  return {
    filename: `${fileBaseName(checklist)}.xls`,
    contentType: 'application/vnd.ms-excel',
    body: Buffer.from(xml, 'utf8'),
  };
}

/**
 * Printable HTML for the checklist PDF.
 * Cover and footer match the App Design test report (logo inlined as a data URI).
 * @param {object} checklist enriched checklist from prepareExportChecklist
 */
function buildHtml(checklist) {
  const progress = checklist.progress || { percent: 0, bySection: {} };
  const who = developerName(checklist) || '— not set —';
  const brand = reportBrand();
  const scopeLabel = checklist.exportScopeLabel || 'Full checklist';
  const isPartial = checklist.exportScope && checklist.exportScope !== 'full';
  const version = checklist.releaseVersion || '—';
  const owners = checklist.owners || {};

  const sectionBars = Object.values(progress.bySection || {})
    .map(
      (s) =>
        `<div class="bar"><span>${escapeHtml(s.title)}</span><b>${
          s.applicable ? `${s.percent}%` : 'N/A'
        }</b></div>`
    )
    .join('');

  const teamCards = [
    ['iOS', owners.ios],
    ['Web / Frontend', owners.web],
    ['Android', owners.android],
    ['Backend', owners.backend],
    ['QA', owners.qa],
  ]
    .filter(([role, name]) => {
      if (!isPartial) return true;
      const map = {
        ios: 'iOS',
        web: 'Web / Frontend',
        android: 'Android',
        backend: 'Backend',
        qa: 'QA',
        security: 'QA',
        golive: 'QA',
      };
      const want = map[String(checklist.exportScope).split(',')[0]];
      return !want || role === want;
    })
    .map(
      ([role, name]) =>
        `<div class="team-cell">
          <p class="label">${escapeHtml(role)}</p>
          <p class="value">${escapeHtml(name || '— not assigned —')}</p>
        </div>`
    )
    .join('');

  const sectionsHtml = (checklist.sections || [])
    .map((section) => {
      const ownerKey =
        section.id === 'golive' || section.id === 'security' ? 'qa' : section.id;
      const sectionOwner = owners[ownerKey] || '';
      const items = (section.items || [])
        .map((item) => {
          const st = STATUS_LABEL[item.status] || item.status;
          return `<tr>
            <td>${escapeHtml(item.label)}</td>
            <td class="st st-${escapeHtml(item.status)}">${escapeHtml(st)}</td>
            <td>${escapeHtml(item.responsible || sectionOwner || '—')}</td>
            <td>${escapeHtml(item.updatedBy || '—')}</td>
            <td>${escapeHtml(item.remarks || '')}</td>
            <td>${escapeHtml(item.evidence || '')}</td>
          </tr>`;
        })
        .join('');
      return `<section>
        <h2>
          <span>${escapeHtml(section.title)}${
            sectionOwner
              ? ` <em class="owner-tag">· ${escapeHtml(sectionOwner)}</em>`
              : ''
          }</span>
          <small>${
            section.progress?.applicable ? `${section.progress.percent}%` : 'N/A'
          }</small>
        </h2>
        <table>
          <thead><tr>
            <th>Item</th><th>Status</th><th>Responsible</th>
            <th>Updated by</th><th>Remarks</th><th>Evidence</th>
          </tr></thead>
          <tbody>${items}</tbody>
        </table>
      </section>`;
    })
    .join('');

  const logo = brand
    ? `<a href="${brand.site}" target="_blank" rel="noopener"><img src="${brand.logoLight}" alt="${escapeHtml(brand.name)}"></a>`
    : `<span class="wordmark">App Design</span>`;
  const footLinks = brand
    ? `<a href="${brand.site}" target="_blank" rel="noopener">${escapeHtml(brand.siteLabel)}</a>
       <a href="mailto:${brand.email}">${escapeHtml(brand.email)}</a>
       <a href="${brand.phoneHref}">${escapeHtml(brand.phone)}</a>`
    : 'App Design · appdesign.ie';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(checklist.displayName || checklist.projectId)} — Release Checklist · App Design</title>
${brand ? `<link rel="icon" href="${brand.logoDark}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&display=swap" rel="stylesheet">
<style>
  :root{--orange:#F37324;--black:#141414;--paper:#F7F5F2;--ink:#141414;--ink-soft:#5E5A56;--line:#E7E1DA}
  *{box-sizing:border-box}
  body{font-family:Outfit,system-ui,sans-serif;color:var(--ink);background:var(--paper);margin:0;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .wrap{max-width:1040px;margin:0 auto;padding:0 28px}
  .cover{background:var(--black);color:#F5F1ED;position:relative;overflow:hidden;padding:28px 0 36px}
  .cover::before{content:"";position:absolute;inset:0;
    background:radial-gradient(620px 420px at 88% 18%,rgba(243,115,36,.30),transparent 62%);pointer-events:none}
  .cover .wrap{position:relative;z-index:1}
  .topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .topbar img{height:38px;display:block}
  .wordmark{font-weight:800;letter-spacing:.04em}
  .chip{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;letter-spacing:.12em;
    text-transform:uppercase;color:#FDBA8C;border:1px solid rgba(243,115,36,.45);background:rgba(243,115,36,.10);
    padding:6px 14px;border-radius:999px}
  .chip i{width:7px;height:7px;border-radius:50%;background:var(--orange);display:inline-block}
  .eyebrow{margin-top:28px;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#A8A09A}
  .cover h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:40px;line-height:1.05;margin:10px 0 0;letter-spacing:-.02em}
  .cover h1 em{font-style:italic;color:var(--orange);font-weight:500}
  .runline{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:16px;font-size:13.5px;color:#A8A09A}
  .runline b{color:#F5F1ED;font-weight:600}
  main.wrap{padding-top:28px;padding-bottom:8px}
  .scope{display:inline-block;background:#141414;color:#F5F1ED;font-size:12px;font-weight:700;
    letter-spacing:.06em;text-transform:uppercase;padding:6px 12px;border-radius:999px;margin-bottom:14px}
  .version-hero{background:linear-gradient(135deg,#141414,#2a211c);color:#F5F1ED;border-radius:18px;
    padding:22px 26px;margin:10px 0 18px;display:flex;justify-content:space-between;align-items:center;
    gap:18px;flex-wrap:wrap;position:relative;overflow:hidden}
  .version-hero::before{content:"";position:absolute;left:0;right:0;top:0;height:4px;
    background:linear-gradient(90deg,#F37324,#FF9A5C)}
  .version-hero .vh-label{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#B9B2AB;margin:0 0 6px}
  .version-hero .vh-version{font-family:Fraunces,Georgia,serif;font-size:42px;font-weight:700;color:#F37324;margin:0;line-height:1}
  .version-hero .vh-meta{text-align:right;font-size:14px;color:#D5CFC8;line-height:1.5}
  .version-hero .vh-meta b{color:#fff}
  .team-card{background:#fff;border:1px solid #E7E1DA;border-radius:16px;padding:16px 18px;margin:0 0 20px}
  .team-card h3{margin:0 0 12px;font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#5E5A56}
  .team-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
  .team-cell{background:#FBF8F5;border-radius:12px;padding:12px 14px;border-left:4px solid #F37324}
  .team-cell .label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#5E5A56;margin:0 0 4px}
  .team-cell .value{font-size:16px;font-weight:700;margin:0;word-break:break-word}
  .dev-card{background:#141414;color:#F5F1ED;border-radius:16px;padding:16px 20px;margin:0 0 18px;
    display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:14px;position:relative;overflow:hidden}
  .dev-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:#F37324}
  .dev-card .label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#B9B2AB;margin:0 0 4px}
  .dev-card .value{font-size:16px;font-weight:700;margin:0;word-break:break-word}
  .dev-card .value.accent{color:#F37324;font-family:Fraunces,Georgia,serif;font-size:20px}
  .meta{color:#5E5A56;margin-bottom:18px;font-size:14px;line-height:1.55}
  .meta b{color:#F37324}
  .bars{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:14px 0 24px}
  .bar{background:#fff;border:1px solid #E7E1DA;border-radius:12px;padding:12px 14px;display:flex;justify-content:space-between;gap:8px}
  .bar b{color:#F37324}
  section{background:#fff;border:1px solid #E7E1DA;border-radius:16px;padding:18px 20px;margin-bottom:18px}
  h2{font-size:17px;margin:0 0 12px;display:flex;justify-content:space-between;align-items:center;gap:12px}
  h2 small{color:#F37324;font-weight:700;white-space:nowrap}
  h2 .owner-tag{font-style:normal;font-weight:600;color:#5E5A56;font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #ECE5DE;vertical-align:top}
  th{background:#FBF8F5;font-weight:600}
  .st-completed{color:#15803d;font-weight:700}
  .st-in_progress{color:#B45309;font-weight:700}
  .st-blocked{color:#DC2626;font-weight:700}
  .st-na{color:#9CA3AF}
  .st-not_started{color:#6B6560}
  .brandfoot{background:var(--black);color:#A8A09A;margin-top:48px;position:relative;overflow:hidden}
  .brandfoot::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,var(--orange),#FF9A5C,var(--orange))}
  .brandfoot .wrap{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;padding-top:28px;padding-bottom:28px}
  .brandfoot img{height:32px;display:block}
  .brandfoot .tagline{font-family:Fraunces,Georgia,serif;font-style:italic;color:#F5F1ED;font-size:18px;margin-top:10px}
  .brandfoot .links{display:flex;flex-direction:column;gap:6px;text-align:right;font-size:13.5px}
  .brandfoot a{color:#F5F1ED;text-decoration:none;font-weight:600}
  .techline{text-align:center;font-size:12px;color:#78716C;padding:12px 16px 20px;background:var(--black);border-top:1px solid #221E1B}
  @media print{
    body{background:#fff}
    .cover,.brandfoot,.version-hero,.dev-card,.team-cell{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style>
</head>
<body>
<header class="cover">
  <div class="wrap">
    <div class="topbar">
      ${logo}
      <span class="chip"><i></i>Release Checklist</span>
    </div>
    <div class="eyebrow">${escapeHtml(isPartial ? `${scopeLabel} report` : 'Full release checklist')} · Go-live readiness</div>
    <h1>${escapeHtml(checklist.displayName || checklist.projectId)}<br><em>${
      isPartial ? escapeHtml(scopeLabel) : 'Release checklist'
    }</em></h1>
    <div class="runline">
      <span>Version <b>${escapeHtml(version)}</b></span>
      <span>Environment <b>${escapeHtml(checklist.environment)}</b></span>
      <span>Progress <b>${progress.percent}%</b></span>
      <span>Status <b>${escapeHtml(checklist.releaseStatus || '—')}</b></span>
    </div>
  </div>
</header>
<main class="wrap">

  <div class="version-hero">
    <div>
      <p class="vh-label">Release version</p>
      <p class="vh-version">${escapeHtml(version)}</p>
    </div>
    <div class="vh-meta">
      <div>Project <b>${escapeHtml(checklist.displayName || checklist.projectId)}</b></div>
      <div>Environment <b>${escapeHtml(checklist.environment)}</b></div>
      <div>Progress <b>${progress.percent}%</b> · Status <b>${escapeHtml(
        checklist.releaseStatus || '—'
      )}</b></div>
    </div>
  </div>

  <div class="team-card">
    <h3>Development team (platform owners)</h3>
    <div class="team-grid">${teamCards}</div>
  </div>

  <div class="dev-card">
    <div>
      <p class="label">${escapeHtml(
        isPartial ? `${scopeLabel} developer (this report)` : 'Report prepared / filled by'
      )}</p>
      <p class="value accent">${escapeHtml(who)}</p>
    </div>
    <div>
      <p class="label">Last updated by</p>
      <p class="value">${escapeHtml(checklist.updatedBy || who)}</p>
    </div>
    <div>
      <p class="label">Last updated</p>
      <p class="value">${escapeHtml(
        checklist.updatedAt ? new Date(checklist.updatedAt).toLocaleString() : '—'
      )}</p>
    </div>
  </div>

  <p class="meta">
    Release version <b>${escapeHtml(version)}</b> ·
    Scope <b>${escapeHtml(scopeLabel)}</b>
    ${
      isPartial
        ? `<br/><em>Platform-specific report for the ${escapeHtml(
            scopeLabel
          )} developer — other platforms are omitted.</em>`
        : ''
    }
  </p>
  <div class="bars">${sectionBars}</div>
  ${sectionsHtml || '<p>No items in this scope.</p>'}
</main>
<footer class="brandfoot">
  <div class="wrap">
    <div>
      ${logo}
      <div class="tagline">Apps with real purpose, tested on every release.</div>
    </div>
    <div class="links">${footLinks}</div>
  </div>
  <div class="techline">${escapeHtml(checklist.displayName || checklist.projectId)} release checklist · ${escapeHtml(version)} · prepared by ${escapeHtml(who)}</div>
</footer>
</body>
</html>`;

  return {
    filename: `${fileBaseName(checklist)}.html`,
    contentType: 'text/html; charset=utf-8',
    body: Buffer.from(html, 'utf8'),
    fileBaseName: fileBaseName(checklist),
  };
}

module.exports = {
  buildCsv,
  buildExcel,
  buildHtml,
  fileBaseName,
  prepareExportChecklist,
  SECTION_ALIASES,
  STATUS_LABEL,
};

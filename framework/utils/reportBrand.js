/**
 * Client branding for the HTML reports (App Design — https://appdesign.ie/).
 * Same logo and orange/black palette as the dashboard (dashboard/public/brand).
 *
 * Logos are inlined as data URIs so a report file still shows them when it is
 * emailed or opened outside the repo. Set REPORT_BRAND=off for an unbranded report.
 */
const fs = require('fs');
const path = require('path');

const BRAND_DIR = path.join(__dirname, '..', '..', 'dashboard', 'public', 'brand');

const APP_DESIGN = {
  name: 'App Design',
  site: 'https://appdesign.ie/',
  siteLabel: 'appdesign.ie',
  email: 'info@appdesign.ie',
  phone: '+353 91 393 310',
  phoneHref: 'tel:+35391393310',
};

/** @returns {string|null} SVG file as a data URI, or null if missing */
function svgDataUri(file) {
  try {
    const svg = fs.readFileSync(path.join(BRAND_DIR, file));
    return `data:image/svg+xml;base64,${svg.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Brand details for the reports, or null when branding is off or the logo
 * files are missing (the report then renders unbranded).
 * @returns {null | typeof APP_DESIGN & { logoDark: string, logoLight: string }}
 */
function reportBrand() {
  if (String(process.env.REPORT_BRAND || '').trim().toLowerCase() === 'off') {
    return null;
  }
  const logoDark = svgDataUri('appdesign-logo.svg');
  const logoLight = svgDataUri('appdesign-logo-light.svg');
  if (!logoDark || !logoLight) {
    return null;
  }
  return { ...APP_DESIGN, logoDark, logoLight };
}

/**
 * Overrides for the runtime report (strongHtmlReport.js). Pass/fail colours
 * stay green/red so results read the same; accents and hero go orange/black.
 */
function strongReportBrandCss() {
  return `
  body.brand-appdesign{
    --bg:#F7F5F2;
    --ink:#141414;
    --ink-soft:#5E5A56;
    --line:#E7E1DA;
    --teal:#F37324;
    --teal-deep:#B84F12;
    --gauge:#F37324;
  }
  body.brand-appdesign .brandbar{
    display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
    background:var(--card);border:1px solid var(--line);border-radius:16px;
    padding:14px 22px;margin-bottom:14px;position:relative;overflow:hidden;
  }
  body.brand-appdesign .brandbar::before{
    content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:#F37324;
  }
  body.brand-appdesign .brandbar img{height:34px;display:block}
  body.brand-appdesign .brandbar .tag{font-size:12.5px;color:var(--ink-soft);font-weight:600;text-align:right}
  body.brand-appdesign .brandbar .tag b{color:#F37324}
  body.brand-appdesign .hero{background:#141414}
  body.brand-appdesign .hero::after{
    background:radial-gradient(circle, rgba(243,115,36,.35) 0, rgba(243,115,36,0) 70%);
    width:320px;height:320px;right:-90px;bottom:-140px;
  }
  body.brand-appdesign .hero::before{
    content:"";position:absolute;left:0;right:0;top:0;height:4px;
    background:linear-gradient(90deg,#F37324,#FF9A5C);
  }
  body.brand-appdesign .hero .sub,
  body.brand-appdesign .hero .runline,
  body.brand-appdesign .gauge .counts{color:#B9B2AB}
  body.brand-appdesign .gauge .small{fill:#B9B2AB}
  body.brand-appdesign .gauge .track{stroke:#2E2A27}
  body.brand-appdesign .gauge .arc{stroke:var(--gauge)}
  body.brand-appdesign section > h2::before{
    content:"";width:10px;height:10px;border-radius:3px;background:#F37324;flex-shrink:0;
  }
  body.brand-appdesign .bar i{background:linear-gradient(90deg,#F37324,#FF9A5C)}
  body.brand-appdesign th{background:#FBF8F5}
  body.brand-appdesign .brandfoot{
    margin-top:60px;background:#141414;color:#B9B2AB;border-radius:16px;
    padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
  }
  body.brand-appdesign .brandfoot img{height:28px;display:block}
  body.brand-appdesign .brandfoot .links{display:flex;gap:18px;flex-wrap:wrap;font-size:13px}
  body.brand-appdesign .brandfoot a{color:#FFFFFF;text-decoration:none;font-weight:600}
  body.brand-appdesign .brandfoot a:hover{color:#F37324}
  body.brand-appdesign footer{margin-top:18px}`;
}

/** Strip above the report hero: client logo + "prepared for" line. */
function brandBarHtml(brand, escapeHtml) {
  return `
  <div class="brandbar">
    <a href="${brand.site}" target="_blank" rel="noopener"><img src="${brand.logoDark}" alt="${escapeHtml(brand.name)}"></a>
    <span class="tag">Mobile QA Automation · prepared for <b>${escapeHtml(brand.name)}</b></span>
  </div>`;
}

/** Dark footer with the client logo and contact links. */
function brandFootHtml(brand, escapeHtml) {
  return `
  <div class="brandfoot">
    <a href="${brand.site}" target="_blank" rel="noopener"><img src="${brand.logoLight}" alt="${escapeHtml(brand.name)}"></a>
    <span class="links">
      <a href="${brand.site}" target="_blank" rel="noopener">${escapeHtml(brand.siteLabel)}</a>
      <a href="mailto:${brand.email}">${escapeHtml(brand.email)}</a>
      <a href="${brand.phoneHref}">${escapeHtml(brand.phone)}</a>
    </span>
  </div>`;
}

/** Overrides for the plain test-catalog.html styles (testReport.js). */
function catalogBrandCss() {
  return `<style>
    h1 { color: #141414; }
    h2 { border-bottom-color: #F37324; }
    th { background: #141414; }
    a { color: #F37324; }
    .brandbar { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;
      border-left: 5px solid #F37324; background:#FBF8F5; border-radius: 10px; padding: 12px 18px; margin-bottom: 18px; }
    .brandbar img { height: 32px; display:block; }
    .brandbar .tag { color:#5E5A56; font-size:13px; font-weight:600; }
    .brandbar .tag b { color:#F37324; }
    .brandfoot { margin-top: 32px; background:#141414; color:#B9B2AB; border-radius: 10px; padding: 16px 20px;
      display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
    .brandfoot img { height: 26px; display:block; }
    .brandfoot .links { display:flex; gap:16px; flex-wrap:wrap; font-size:13px; }
    .brandfoot a { color:#fff; text-decoration:none; font-weight:600; }
  </style>`;
}

module.exports = {
  reportBrand,
  strongReportBrandCss,
  brandBarHtml,
  brandFootHtml,
  catalogBrandCss,
};

/**
 * App Design (appdesign.ie) client branding — showcase welcome screen.
 *
 * - Opens once per browser session, and again from the header "Showcase" button.
 * - Numbers are live: apps, scripts and saved HTML reports from /api/projects,
 *   runs from /api/history (the dashboard's own saved run history).
 * - ?brand=off in the URL turns all branding off (default teal Control Desk).
 */
(function () {
  const SEEN_KEY = 'appdesignShowcaseSeen';
  const params = new URLSearchParams(location.search);

  if (params.get('brand') === 'off') {
    document.body.classList.remove('brand-appdesign');
    document.getElementById('showcase')?.remove();
    return;
  }

  const overlay = document.getElementById('showcase');
  if (!overlay) return;

  /**
   * Count a stat element up from 0 to `value` (ease-out), keeping any suffix
   * such as "%".
   * @param {HTMLElement} el element whose first text node holds the number
   * @param {number} value
   */
  function countUp(el, value) {
    const suffix = el.dataset.suffix || '';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !Number.isFinite(value)) {
      el.innerHTML = `${Number.isFinite(value) ? value : '—'}${suffix ? `<small>${suffix}</small>` : ''}`;
      return;
    }
    const duration = 1400;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.innerHTML = `${Math.round(value * eased)}${suffix ? `<small>${suffix}</small>` : ''}`;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Fetch JSON; null on any failure so the showcase still opens offline. */
  async function getJson(url) {
    try {
      const res = await fetch(url);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  /** Fill the four stat tiles from the dashboard APIs. */
  async function loadStats() {
    const [projectsData, historyData] = await Promise.all([
      getJson('/api/projects'),
      getJson('/api/history'),
    ]);
    const projects = projectsData?.projects || [];
    const history = historyData?.history || [];

    const stats = {
      apps: projects.length,
      scripts: projects.reduce((sum, p) => sum + (p.scriptCount || 0), 0),
      runs: history.length,
      reports: projects.reduce((sum, p) => sum + (p.reportCount || 0), 0),
    };
    for (const [key, value] of Object.entries(stats)) {
      const el = overlay.querySelector(`[data-stat="${key}"]`);
      if (el) countUp(el, value);
    }
  }

  function open() {
    overlay.hidden = false;
    // Next frame so the fade/rise transitions run.
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    loadStats();
    overlay.querySelector('.showcase-enter')?.focus({ preventScroll: true });
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    sessionStorage.setItem(SEEN_KEY, '1');
    // Enter Control Desk should land on the full project list, not the last opened app.
    document.dispatchEvent(new CustomEvent('desk:show-projects'));
    setTimeout(() => {
      if (!overlay.classList.contains('is-open')) overlay.hidden = true;
    }, 500);
  }

  overlay.querySelectorAll('[data-showcase-close]').forEach((btn) =>
    btn.addEventListener('click', close)
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });
  document.getElementById('btnShowcase')?.addEventListener('click', open);

  if (!sessionStorage.getItem(SEEN_KEY) || params.get('showcase') === '1') {
    open();
  }
})();

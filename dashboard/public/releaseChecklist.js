/**
 * Release Checklist UI — project-wise go-live checklist on Control Desk.
 * Persistence + exports are served by /api/release-checklist*.
 */
(function () {
  const STATUS_OPTIONS = [
    { value: 'not_started', label: '— Not Started' },
    { value: 'in_progress', label: '◐ In Progress' },
    { value: 'completed', label: '✓ Completed' },
    { value: 'blocked', label: '! Blocked' },
    { value: 'na', label: '— N/A' },
  ];

  const UPLOAD_LABELS = {
    web: {
      title: 'Web Upload / Deployment',
      note: 'Attach the production web build as evidence. This does not deploy hosting — mark Deployed / Verified separately.',
      openLabel: 'Open Deployment',
      openKey: 'deploymentUrl',
    },
    ios: {
      title: 'iOS App Upload',
      note: 'Attach IPA/archive evidence only. Upload ≠ App Store release — advance status through TestFlight → Review → Released.',
      openLabel: 'Open App Store Connect',
      openKey: 'appStoreUrl',
      secondaryLabel: 'Open TestFlight',
      secondaryKey: 'testFlightUrl',
    },
    android: {
      title: 'Android App Upload',
      note: 'Attach AAB evidence only. Upload ≠ Play production release — advance status through testing → Review → Released.',
      openLabel: 'Open Google Play Console',
      openKey: 'playConsoleUrl',
      secondaryLabel: 'Open Internal Testing',
      secondaryKey: 'internalTestingUrl',
    },
  };

  const els = {
    panel: document.getElementById('releasePanel'),
    automationView: document.getElementById('automationView'),
    navAutomation: document.getElementById('navAutomation'),
    navRelease: document.getElementById('navRelease'),
    selProject: document.getElementById('selReleaseProject'),
    selEnv: document.getElementById('selReleaseEnv'),
    inpVersion: document.getElementById('inpReleaseVersion'),
    inpUser: document.getElementById('inpReleaseUser'),
    progressPct: document.getElementById('releaseProgressPct'),
    progressSub: document.getElementById('releaseProgressSub'),
    statusValue: document.getElementById('releaseStatusValue'),
    updatedSub: document.getElementById('releaseUpdatedSub'),
    platformBars: document.getElementById('releasePlatformBars'),
    sections: document.getElementById('releaseSections'),
    historyList: document.getElementById('releaseHistoryList'),
    btnDownload: document.getElementById('btnReleaseDownload'),
    downloadPanel: document.getElementById('releaseDownloadPanel'),
    btnReset: document.getElementById('btnReleaseReset'),
  };

  if (!els.panel || !els.selProject) return;

  /** @type {object | null} */
  let checklist = null;
  /** @type {Array<{id:string,displayName:string}>} */
  let projects = [];
  let saveTimer = null;
  const collapsed = new Set(
    JSON.parse(localStorage.getItem('desk.release.collapsed') || '[]')
  );

  function userName() {
    const v = (els.inpUser.value || '').trim() || localStorage.getItem('desk.release.user') || 'User';
    localStorage.setItem('desk.release.user', v);
    return v;
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { ok: false, error: text || res.statusText };
    }
    if (!res.ok && data.ok !== false) data.ok = false;
    if (!data.error && !res.ok) data.error = res.statusText;
    return data;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setView(view) {
    const release = view === 'release';
    els.panel.hidden = !release;
    if (els.automationView) els.automationView.hidden = release;
    els.navAutomation?.classList.toggle('active', !release);
    els.navRelease?.classList.toggle('active', release);
    localStorage.setItem('desk.view', release ? 'release' : 'automation');
    if (release && !checklist) loadChecklist();
  }

  async function loadProjects() {
    try {
      const data = await api('/api/projects');
      projects = Array.isArray(data.projects) ? data.projects : [];
    } catch {
      projects = [];
    }
    const last =
      localStorage.getItem('desk.release.project') ||
      localStorage.getItem('desk.lastProject') ||
      '';
    els.selProject.innerHTML = projects
      .map(
        (p) =>
          `<option value="${escapeHtml(p.id)}" ${p.id === last ? 'selected' : ''}>${escapeHtml(
            p.displayName || p.id
          )}</option>`
      )
      .join('');
    if (!els.selProject.value && projects[0]) els.selProject.value = projects[0].id;
  }

  async function loadChecklist() {
    const projectId = els.selProject.value;
    const env = els.selEnv.value || 'production';
    if (!projectId) {
      els.sections.innerHTML = '<p class="muted">No projects found.</p>';
      return;
    }
    localStorage.setItem('desk.release.project', projectId);
    localStorage.setItem('desk.release.env', env);
    els.sections.innerHTML = '<p class="muted">Loading checklist…</p>';
    const data = await api(
      `/api/release-checklist?projectId=${encodeURIComponent(projectId)}&env=${encodeURIComponent(env)}`
    );
    if (!data.ok || !data.checklist) {
      els.sections.innerHTML = `<p class="muted">Could not load checklist: ${escapeHtml(
        data.error || 'unknown error'
      )}</p>`;
      return;
    }
    checklist = data.checklist;
    render();
  }

  function render() {
    if (!checklist) return;
    els.inpVersion.value = checklist.releaseVersion || '';
    if (!els.inpUser.value) {
      els.inpUser.value = localStorage.getItem('desk.release.user') || checklist.updatedBy || '';
    }
    const owners = checklist.owners || {};
    document.querySelectorAll('[data-owner]').forEach((inp) => {
      const key = inp.getAttribute('data-owner');
      inp.value = owners[key] || '';
    });
    const pct = checklist.progress?.percent ?? 0;
    els.progressPct.textContent = `${pct}%`;
    els.progressSub.textContent = `${checklist.progress?.completed ?? 0} of ${
      checklist.progress?.total ?? 0
    } completed`;
    els.statusValue.textContent = checklist.releaseStatus || '—';
    const when = checklist.updatedAt
      ? new Date(checklist.updatedAt).toLocaleString()
      : '—';
    els.updatedSub.textContent = `Updated ${when}${
      checklist.updatedBy ? ` · ${checklist.updatedBy}` : ''
    }`;

    els.platformBars.innerHTML = Object.values(checklist.progress?.bySection || {})
      .map((s) => {
        const na = !s.applicable;
        const title = s.title.split('/')[0].trim();
        return `<button type="button" class="release-plat ${na ? 'is-na' : ''}" data-goto-section="${escapeHtml(
          s.id
        )}" title="Open the ${escapeHtml(title)} checklist">
          <p class="plat-title">${escapeHtml(title)}</p>
          <p class="plat-pct">${na ? 'N/A' : `${s.percent}%`}</p>
          <span class="plat-go">Open checklist</span>
        </button>`;
      })
      .join('');

    els.sections.innerHTML = (checklist.sections || [])
      .map((section) => renderSection(section))
      .join('');

    const history = checklist.history || [];
    els.historyList.innerHTML = history.length
      ? history
          .slice(0, 40)
          .map((h) => {
            const at = h.at ? new Date(h.at).toLocaleString() : '';
            return `<div class="release-history-item">
              <strong>${escapeHtml(h.itemLabel || h.itemId)}</strong>
              <span>${escapeHtml(h.previousStatus)} → ${escapeHtml(h.newStatus)}</span>
              <span class="muted"> · ${escapeHtml(h.user || '')} · ${escapeHtml(at)}</span>
              ${h.remarks ? `<div class="muted">${escapeHtml(h.remarks)}</div>` : ''}
            </div>`;
          })
          .join('')
      : '<p class="muted">No changes yet.</p>';

    bindSectionEvents();
    bindPlatformJumps();
  }

  /**
   * Platform tile (iOS, Android, Web, …) opens that section and expands it.
   */
  function openSection(sectionId) {
    const art = els.sections.querySelector(`[data-section="${CSS.escape(sectionId)}"]`);
    if (!art) return;
    art.classList.remove('is-collapsed');
    collapsed.delete(sectionId);
    localStorage.setItem('desk.release.collapsed', JSON.stringify([...collapsed]));
    art.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bindPlatformJumps() {
    els.platformBars.querySelectorAll('[data-goto-section]').forEach((btn) => {
      btn.addEventListener('click', () => openSection(btn.getAttribute('data-goto-section')));
    });
  }

  function statusSelect(current) {
    return STATUS_OPTIONS.map(
      (o) =>
        `<option value="${o.value}" ${o.value === current ? 'selected' : ''}>${o.label}</option>`
    ).join('');
  }

  function renderUploadBlock(channel, data) {
    const meta = UPLOAD_LABELS[channel];
    if (!meta || !data) return '';
    const statuses = checklist.template?.uploadStatuses?.[channel] || [];
    const statusOpts = statuses
      .map(
        (s) =>
          `<option value="${s}" ${s === data.status ? 'selected' : ''}>${s.replace(
            /_/g,
            ' '
          )}</option>`
      )
      .join('');

    const fields =
      channel === 'web'
        ? `
      <label><span class="muted">Build version</span>
        <input data-up-field="buildVersion" value="${escapeHtml(data.buildVersion || '')}" /></label>
      <label><span class="muted">Upload date</span>
        <input data-up-field="uploadDate" value="${escapeHtml(data.uploadDate || '')}" /></label>
      <label><span class="muted">Uploaded by</span>
        <input data-up-field="uploadedBy" value="${escapeHtml(data.uploadedBy || '')}" /></label>
      <label><span class="muted">Deployment URL</span>
        <input data-up-field="deploymentUrl" value="${escapeHtml(data.deploymentUrl || '')}" /></label>`
        : channel === 'ios'
          ? `
      <label><span class="muted">App version</span>
        <input data-up-field="appVersion" value="${escapeHtml(data.appVersion || '')}" /></label>
      <label><span class="muted">Build number</span>
        <input data-up-field="buildNumber" value="${escapeHtml(data.buildNumber || '')}" /></label>
      <label><span class="muted">Upload date</span>
        <input data-up-field="uploadDate" value="${escapeHtml(data.uploadDate || '')}" /></label>
      <label><span class="muted">Uploaded by</span>
        <input data-up-field="uploadedBy" value="${escapeHtml(data.uploadedBy || '')}" /></label>`
          : `
      <label><span class="muted">App version</span>
        <input data-up-field="appVersion" value="${escapeHtml(data.appVersion || '')}" /></label>
      <label><span class="muted">Version code</span>
        <input data-up-field="versionCode" value="${escapeHtml(data.versionCode || '')}" /></label>
      <label><span class="muted">Upload date</span>
        <input data-up-field="uploadDate" value="${escapeHtml(data.uploadDate || '')}" /></label>
      <label><span class="muted">Uploaded by</span>
        <input data-up-field="uploadedBy" value="${escapeHtml(data.uploadedBy || '')}" /></label>`;

    const fileLine = data.fileName
      ? `<p class="muted">Attached: <strong>${escapeHtml(data.fileName)}</strong></p>`
      : '<p class="muted">No build attached yet.</p>';

    return `<div class="release-upload" data-channel="${channel}">
      <h4>${escapeHtml(meta.title)}</h4>
      <p class="upload-note">${escapeHtml(meta.note)}</p>
      <div class="release-upload-grid">
        ${fields}
        <label><span class="muted">Deployment status</span>
          <select data-up-field="status">${statusOpts}</select></label>
        <label><span class="muted">Attach build / file</span>
          <input type="file" data-up-file /></label>
      </div>
      ${fileLine}
      <div class="release-upload-actions">
        <button type="button" class="btn btn-primary btn-tiny" data-up-attach>Upload Build</button>
        <button type="button" class="btn btn-ghost btn-tiny" data-up-save>Save details</button>
        <button type="button" class="btn btn-ghost btn-tiny" data-up-open="${escapeHtml(
          meta.openKey
        )}">${escapeHtml(meta.openLabel)}</button>
        ${
          meta.secondaryKey
            ? `<button type="button" class="btn btn-ghost btn-tiny" data-up-open="${escapeHtml(
                meta.secondaryKey
              )}">${escapeHtml(meta.secondaryLabel)}</button>`
            : ''
        }
        <button type="button" class="btn btn-ghost btn-tiny" data-up-mark="qa_approved">Mark QA Approved</button>
        <button type="button" class="btn btn-ghost btn-tiny" data-up-mark="client_approved">Mark Client Approved</button>
        ${
          channel === 'web'
            ? `<button type="button" class="btn btn-ghost btn-tiny" data-up-mark="verified">Mark as Verified</button>`
            : ''
        }
      </div>
    </div>`;
  }

  function renderSection(section) {
    const isCollapsed = collapsed.has(section.id);
    const pct = section.progress?.applicable
      ? `${section.progress.percent}%`
      : 'N/A';
    const uploadHtml = section.upload
      ? renderUploadBlock(section.upload, checklist.uploads?.[section.upload])
      : '';
    const items = (section.items || [])
      .map((item) => {
        return `<div class="release-item" data-item-id="${escapeHtml(item.id)}">
          <div>
            <div class="release-item-label">${escapeHtml(item.label)}</div>
            <span class="release-status-pill" data-status="${escapeHtml(
              item.status || 'not_started'
            )}">${escapeHtml(
          STATUS_OPTIONS.find((o) => o.value === item.status)?.label || item.status
        )}</span>
          </div>
          <div>
            <select data-field="status">${statusSelect(item.status || 'not_started')}</select>
          </div>
          <div class="release-item-meta">
            <input data-field="responsible" placeholder="Responsible" value="${escapeHtml(
              item.responsible || ''
            )}" />
            <textarea data-field="remarks" placeholder="Remarks">${escapeHtml(
              item.remarks || ''
            )}</textarea>
            <input data-field="evidence" placeholder="Evidence / link (no secrets)" value="${escapeHtml(
              item.evidence || ''
            )}" />
          </div>
        </div>`;
      })
      .join('');

    return `<article class="release-section ${isCollapsed ? 'is-collapsed' : ''}" id="release-section-${escapeHtml(
      section.id
    )}" data-section="${escapeHtml(section.id)}">
      <div class="release-section-bar">
        <button type="button" class="release-section-head" data-toggle-section>
          <div>
            <h3>${escapeHtml(section.title)}</h3>
            <p class="muted">${escapeHtml(section.subtitle || '')}</p>
          </div>
          <span class="release-section-pct">${escapeHtml(pct)} Complete</span>
        </button>
        <button type="button" class="btn btn-ghost btn-tiny" data-section-pdf="${escapeHtml(
          section.id
        )}">Download PDF</button>
      </div>
      <div class="release-section-body">
        ${uploadHtml}
        ${items}
      </div>
    </article>`;
  }

  function bindSectionEvents() {
    els.sections.querySelectorAll('[data-section-pdf]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        download('pdf', btn.getAttribute('data-section-pdf'));
      });
    });

    els.sections.querySelectorAll('[data-toggle-section]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const art = btn.closest('.release-section');
        const id = art?.dataset.section;
        if (!id) return;
        art.classList.toggle('is-collapsed');
        if (art.classList.contains('is-collapsed')) collapsed.add(id);
        else collapsed.delete(id);
        localStorage.setItem('desk.release.collapsed', JSON.stringify([...collapsed]));
      });
    });

    els.sections.querySelectorAll('.release-item').forEach((row) => {
      const itemId = row.dataset.itemId;
      row.querySelectorAll('[data-field]').forEach((field) => {
        const ev = field.tagName === 'SELECT' ? 'change' : 'change';
        field.addEventListener(ev, () => queueItemSave(itemId, row));
        if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
          field.addEventListener('blur', () => queueItemSave(itemId, row));
        }
      });
    });

    els.sections.querySelectorAll('.release-upload').forEach((block) => {
      const channel = block.dataset.channel;
      block.querySelector('[data-up-save]')?.addEventListener('click', () =>
        saveUploadMeta(channel, block)
      );
      block.querySelector('[data-up-attach]')?.addEventListener('click', () =>
        attachFile(channel, block)
      );
      block.querySelectorAll('[data-up-open]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-up-open');
          const url = checklist.uploads?.[channel]?.[key];
          if (url) window.open(url, '_blank', 'noopener');
          else alert('Set a URL in the fields first, then Save details.');
        });
      });
      block.querySelectorAll('[data-up-mark]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const status = btn.getAttribute('data-up-mark');
          await saveUploadMeta(channel, block, { status });
        });
      });
      block.querySelector('[data-up-field="status"]')?.addEventListener('change', () =>
        saveUploadMeta(channel, block)
      );
    });
  }

  function queueItemSave(itemId, row) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveItem(itemId, row), 280);
  }

  async function saveItem(itemId, row) {
    if (!checklist) return;
    const body = {
      projectId: checklist.projectId,
      env: checklist.environment,
      itemId,
      updatedBy: userName(),
    };
    row.querySelectorAll('[data-field]').forEach((el) => {
      body[el.getAttribute('data-field')] = el.value;
    });
    const data = await api('/api/release-checklist/item', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (data.ok && data.checklist) {
      checklist = data.checklist;
      render();
    } else {
      alert(data.error || 'Could not save item');
    }
  }

  async function saveUploadMeta(channel, block, extra = {}) {
    if (!checklist) return;
    const body = {
      projectId: checklist.projectId,
      env: checklist.environment,
      channel,
      updatedBy: userName(),
      ...extra,
    };
    block.querySelectorAll('[data-up-field]').forEach((el) => {
      body[el.getAttribute('data-up-field')] = el.value;
    });
    const data = await api('/api/release-checklist/upload-meta', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (data.ok && data.checklist) {
      checklist = data.checklist;
      render();
    } else {
      alert(data.error || 'Could not save upload details');
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function attachFile(channel, block) {
    if (!checklist) return;
    const input = block.querySelector('[data-up-file]');
    const file = input?.files?.[0];
    if (!file) {
      alert('Choose a build file first.');
      return;
    }
    const meta = {};
    block.querySelectorAll('[data-up-field]').forEach((el) => {
      const k = el.getAttribute('data-up-field');
      if (k !== 'status') meta[k] = el.value;
    });
    const contentBase64 = await fileToBase64(file);
    const data = await api('/api/release-checklist/attach', {
      method: 'POST',
      body: JSON.stringify({
        projectId: checklist.projectId,
        env: checklist.environment,
        channel,
        fileName: file.name,
        contentBase64,
        uploadedBy: userName(),
        meta,
      }),
    });
    if (data.ok && data.checklist) {
      checklist = data.checklist;
      if (data.note) console.info(data.note);
      render();
    } else {
      alert(data.error || 'Attach failed');
    }
  }

  async function saveMeta(extra = {}) {
    if (!checklist) return;
    const owners = {};
    document.querySelectorAll('[data-owner]').forEach((inp) => {
      owners[inp.getAttribute('data-owner')] = inp.value.trim();
    });
    const data = await api('/api/release-checklist/meta', {
      method: 'POST',
      body: JSON.stringify({
        projectId: checklist.projectId,
        env: checklist.environment,
        releaseVersion: els.inpVersion.value,
        owners,
        updatedBy: userName(),
        createdBy: userName(),
        ...extra,
      }),
    });
    if (data.ok && data.checklist) {
      checklist = data.checklist;
      render();
    }
  }

  async function saveVersion() {
    await saveMeta();
  }

  function exportUrl(format, section) {
    if (!checklist) return '#';
    const scope = section || 'all';
    const owners = checklist.owners || {};
    const platformOwner =
      scope !== 'all' && owners[scope] ? owners[scope] : '';
    const who = platformOwner || userName();
    const params = new URLSearchParams({
      projectId: checklist.projectId,
      env: checklist.environment,
      format,
      section: scope,
      preparedBy: who,
    });
    return `/api/release-checklist/export?${params.toString()}`;
  }

  /**
   * Download full or platform-scoped report.
   * Passes “Your name” so PDF shows Prepared by (developer).
   * @param {string} format pdf|excel|csv
   * @param {string} [section] all|ios|android|web|backend|…
   */
  function download(format, section) {
    if (!checklist) return;
    const who = (els.inpUser.value || '').trim();
    if (!who) {
      alert('Enter your name in “Your name (who is editing now)” before downloading.');
      els.inpUser.focus();
      return;
    }
    persistBeforeDownload().then(() => {
      const a = document.createElement('a');
      a.href = exportUrl(format, section);
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      els.downloadPanel.hidden = true;
    });
  }

  // —— Events ——
  els.navAutomation?.addEventListener('click', () => setView('automation'));
  els.navRelease?.addEventListener('click', () => setView('release'));
  els.selProject.addEventListener('change', () => loadChecklist());
  els.selEnv.addEventListener('change', () => loadChecklist());
  els.inpVersion.addEventListener('change', () => saveVersion());
  els.inpUser.addEventListener('change', () => {
    localStorage.setItem('desk.release.user', els.inpUser.value.trim());
  });
  document.querySelectorAll('[data-owner]').forEach((inp) => {
    inp.addEventListener('change', () => saveMeta());
  });

  /**
   * Before download, persist version + platform owners so PDF includes them.
   */
  async function persistBeforeDownload() {
    await saveMeta();
  }

  els.btnDownload?.addEventListener('click', (e) => {
    e.stopPropagation();
    els.downloadPanel.hidden = !els.downloadPanel.hidden;
  });
  els.downloadPanel?.querySelectorAll('[data-export]').forEach((btn) => {
    btn.addEventListener('click', () =>
      download(btn.getAttribute('data-export'), btn.getAttribute('data-section') || 'all')
    );
  });
  document.addEventListener('click', (e) => {
    if (!els.btnDownload?.contains(e.target) && !els.downloadPanel?.contains(e.target)) {
      if (els.downloadPanel) els.downloadPanel.hidden = true;
    }
  });

  els.btnReset?.addEventListener('click', async () => {
    if (!checklist) return;
    const ok = confirm(
      `Reset the entire ${checklist.displayName} (${checklist.environment}) checklist? This cannot be undone.`
    );
    if (!ok) return;
    const data = await api('/api/release-checklist/reset', {
      method: 'POST',
      body: JSON.stringify({
        projectId: checklist.projectId,
        env: checklist.environment,
        user: userName(),
      }),
    });
    if (data.ok && data.checklist) {
      checklist = data.checklist;
      render();
    } else {
      alert(data.error || 'Reset failed');
    }
  });

  // Init
  (async function init() {
    els.inpUser.value = localStorage.getItem('desk.release.user') || '';
    const savedEnv = localStorage.getItem('desk.release.env');
    if (savedEnv && els.selEnv.querySelector(`option[value="${savedEnv}"]`)) {
      els.selEnv.value = savedEnv;
    }
    await loadProjects();
    const view = localStorage.getItem('desk.view');
    if (view === 'release') setView('release');
  })();
})();

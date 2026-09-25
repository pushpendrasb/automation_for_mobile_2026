/**
 * Persist per-project / per-environment release checklists under
 * dashboard/data/release-checklists/<projectId>/<env>.json
 *
 * Upload attachments live in .../<env>/uploads/<channel>/
 */

const fs = require('fs');
const path = require('path');
const {
  SECTIONS,
  ITEM_STATUSES,
  ENVIRONMENTS,
  UPLOAD_STATUSES,
  itemSectionMap,
} = require('./template');

const SECTION_MAP = itemSectionMap();

/**
 * @param {string} dataDir absolute path to dashboard/data
 */
function createReleaseChecklistStore(dataDir) {
  const root = path.join(dataDir, 'release-checklists');

  function ensureRoot() {
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  }

  function safeId(id) {
    return String(id || '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);
  }

  function envKey(env) {
    const e = String(env || 'production').toLowerCase();
    return ENVIRONMENTS.includes(e) ? e : 'production';
  }

  function checklistPath(projectId, env) {
    return path.join(root, safeId(projectId), `${envKey(env)}.json`);
  }

  function uploadsDir(projectId, env, channel) {
    return path.join(root, safeId(projectId), envKey(env), 'uploads', safeId(channel));
  }

  /**
   * Optional project overrides from projects/<id>/releaseChecklist.json
   * @param {string} projectRoot
   */
  function readProjectOverrides(projectRoot) {
    const p = path.join(projectRoot, 'releaseChecklist.json');
    if (!fs.existsSync(p)) return { disabledSections: [], disabledItems: [] };
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      return {
        disabledSections: Array.isArray(raw.disabledSections)
          ? raw.disabledSections.map(String)
          : [],
        disabledItems: Array.isArray(raw.disabledItems)
          ? raw.disabledItems.map(String)
          : [],
      };
    } catch {
      return { disabledSections: [], disabledItems: [] };
    }
  }

  function emptyUploads() {
    return {
      web: {
        status: 'not_started',
        buildVersion: '',
        uploadDate: '',
        uploadedBy: '',
        deploymentUrl: '',
        fileName: '',
        storedAs: '',
      },
      ios: {
        status: 'not_started',
        appVersion: '',
        buildNumber: '',
        uploadDate: '',
        uploadedBy: '',
        fileName: '',
        storedAs: '',
        appStoreUrl: 'https://appstoreconnect.apple.com/',
        testFlightUrl: 'https://appstoreconnect.apple.com/apps',
      },
      android: {
        status: 'not_started',
        appVersion: '',
        versionCode: '',
        uploadDate: '',
        uploadedBy: '',
        fileName: '',
        storedAs: '',
        playConsoleUrl: 'https://play.google.com/console',
        internalTestingUrl: '',
      },
    };
  }

  function emptyOwners() {
    return {
      backend: '',
      web: '',
      ios: '',
      android: '',
      qa: '',
    };
  }

  /** Fresh checklist document for a project/env. */
  function blankDoc(projectId, displayName, env, overrides) {
    const items = {};
    for (const section of SECTIONS) {
      const sectionDisabled = overrides.disabledSections.includes(section.id);
      for (const item of section.items) {
        const itemDisabled =
          sectionDisabled || overrides.disabledItems.includes(item.id);
        items[item.id] = {
          status: itemDisabled ? 'na' : 'not_started',
          remarks: '',
          evidence: '',
          responsible: '',
          updatedAt: null,
          updatedBy: '',
        };
      }
    }
    const now = new Date().toISOString();
    return {
      projectId,
      displayName: displayName || projectId,
      environment: envKey(env),
      releaseVersion: 'v1.0.0',
      createdAt: now,
      createdBy: '',
      updatedAt: now,
      updatedBy: '',
      /** Named developers per platform — shown on PDF (e.g. ios: Pushpendra). */
      owners: emptyOwners(),
      items,
      uploads: emptyUploads(),
      history: [],
    };
  }

  function load(projectId, env, opts = {}) {
    ensureRoot();
    const file = checklistPath(projectId, env);
    const overrides = readProjectOverrides(opts.projectRoot || '');
    if (!fs.existsSync(file)) {
      const doc = blankDoc(projectId, opts.displayName, env, overrides);
      save(doc);
      return enrich(doc, overrides);
    }
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    // Merge new template items that older saves may lack
    let dirty = false;
    for (const section of SECTIONS) {
      const sectionDisabled = overrides.disabledSections.includes(section.id);
      for (const item of section.items) {
        if (!doc.items[item.id]) {
          const itemDisabled =
            sectionDisabled || overrides.disabledItems.includes(item.id);
          doc.items[item.id] = {
            status: itemDisabled ? 'na' : 'not_started',
            remarks: '',
            evidence: '',
            responsible: '',
            updatedAt: null,
            updatedBy: '',
          };
          dirty = true;
        }
      }
    }
    if (!doc.uploads) {
      doc.uploads = emptyUploads();
      dirty = true;
    }
    if (!doc.owners || typeof doc.owners !== 'object') {
      doc.owners = emptyOwners();
      dirty = true;
    } else {
      doc.owners = { ...emptyOwners(), ...doc.owners };
    }
    for (const channel of ['web', 'ios', 'android']) {
      doc.uploads[channel] = {
        ...emptyUploads()[channel],
        ...(doc.uploads[channel] || {}),
      };
    }
    if (!Array.isArray(doc.history)) doc.history = [];
    if (opts.displayName) doc.displayName = opts.displayName;
    if (dirty) save(doc);
    return enrich(doc, overrides);
  }

  function save(doc) {
    ensureRoot();
    const dir = path.dirname(checklistPath(doc.projectId, doc.environment));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const toWrite = {
      ...doc,
      // strip computed fields
      progress: undefined,
      sections: undefined,
      releaseStatus: undefined,
      template: undefined,
    };
    delete toWrite.progress;
    delete toWrite.sections;
    delete toWrite.releaseStatus;
    delete toWrite.template;
    fs.writeFileSync(
      checklistPath(doc.projectId, doc.environment),
      JSON.stringify(toWrite, null, 2),
      'utf8'
    );
  }

  /**
   * Compute overall + per-section progress (N/A excluded).
   * @param {object} doc
   */
  function computeProgress(doc) {
    const bySection = {};
    let done = 0;
    let total = 0;
    for (const section of SECTIONS) {
      let sDone = 0;
      let sTotal = 0;
      for (const item of section.items) {
        const row = doc.items[item.id];
        if (!row || row.status === 'na') continue;
        sTotal += 1;
        total += 1;
        if (row.status === 'completed') {
          sDone += 1;
          done += 1;
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
    }
    return {
      completed: done,
      total,
      percent: total ? Math.round((done / total) * 100) : 0,
      bySection,
    };
  }

  function releaseStatusOf(doc, progress) {
    const statuses = Object.values(doc.items)
      .map((i) => i.status)
      .filter((s) => s !== 'na');
    if (!statuses.length) return 'Not Applicable';
    if (statuses.some((s) => s === 'blocked')) return 'Blocked';
    if (progress.total > 0 && progress.completed === progress.total) {
      return 'Completed';
    }
    if (statuses.some((s) => s === 'in_progress' || s === 'completed')) {
      return 'In Progress';
    }
    return 'Not Started';
  }

  function enrich(doc, overrides) {
    const progress = computeProgress(doc);
    const sections = SECTIONS.map((section) => {
      const disabled = overrides.disabledSections.includes(section.id);
      return {
        ...section,
        disabled,
        progress: progress.bySection[section.id],
        items: section.items.map((item) => ({
          ...item,
          ...(doc.items[item.id] || {}),
        })),
      };
    });
    return {
      ...doc,
      progress,
      releaseStatus: releaseStatusOf(doc, progress),
      sections,
      template: {
        itemStatuses: ITEM_STATUSES,
        environments: ENVIRONMENTS,
        uploadStatuses: UPLOAD_STATUSES,
      },
    };
  }

  /**
   * Update one checklist item; appends audit history.
   */
  function updateItem(projectId, env, body, opts = {}) {
    const doc = load(projectId, env, opts);
    const itemId = String(body.itemId || '');
    if (!SECTION_MAP.has(itemId)) {
      return { ok: false, error: `Unknown checklist item: ${itemId}` };
    }
    const prev = { ...(doc.items[itemId] || {}) };
    const nextStatus = body.status != null ? String(body.status) : prev.status;
    if (!ITEM_STATUSES.includes(nextStatus)) {
      return { ok: false, error: `Invalid status: ${nextStatus}` };
    }
    const user = String(body.updatedBy || body.user || 'User').slice(0, 80);
    const now = new Date().toISOString();
    doc.items[itemId] = {
      status: nextStatus,
      remarks:
        body.remarks != null
          ? String(body.remarks).slice(0, 2000)
          : prev.remarks || '',
      evidence:
        body.evidence != null
          ? String(body.evidence).slice(0, 2000)
          : prev.evidence || '',
      responsible:
        body.responsible != null
          ? String(body.responsible).slice(0, 120)
          : prev.responsible || '',
      updatedAt: now,
      updatedBy: user,
    };
    if (prev.status !== nextStatus || body.remarks != null) {
      doc.history.unshift({
        at: now,
        user,
        itemId,
        itemLabel:
          SECTIONS.flatMap((s) => s.items).find((i) => i.id === itemId)
            ?.label || itemId,
        previousStatus: prev.status || 'not_started',
        newStatus: nextStatus,
        remarks: doc.items[itemId].remarks || '',
      });
      doc.history = doc.history.slice(0, 200);
    }
    doc.updatedAt = now;
    doc.updatedBy = user;
    save(doc);
    return { ok: true, checklist: load(projectId, env, opts) };
  }

  /** Update release meta (version, platform owners, createdBy). */
  function updateMeta(projectId, env, body, opts = {}) {
    const doc = load(projectId, env, opts);
    const user = String(body.updatedBy || body.user || 'User').slice(0, 80);
    const now = new Date().toISOString();
    if (body.releaseVersion != null) {
      doc.releaseVersion = String(body.releaseVersion).trim().slice(0, 40) || doc.releaseVersion;
    }
    if (body.owners && typeof body.owners === 'object') {
      doc.owners = { ...emptyOwners(), ...(doc.owners || {}), ...sanitizeOwners(body.owners) };
    }
    for (const key of ['backend', 'web', 'ios', 'android', 'qa']) {
      const flat = body[`owner${key[0].toUpperCase()}${key.slice(1)}`] ?? body[`owner_${key}`];
      if (flat != null) {
        doc.owners = doc.owners || emptyOwners();
        doc.owners[key] = String(flat).trim().slice(0, 80);
      }
    }
    if (body.createdBy != null && !doc.createdBy) {
      doc.createdBy = String(body.createdBy).slice(0, 80);
    }
    doc.updatedAt = now;
    doc.updatedBy = user;
    save(doc);
    return { ok: true, checklist: load(projectId, env, opts) };
  }

  function sanitizeOwners(raw) {
    const out = {};
    for (const key of Object.keys(emptyOwners())) {
      if (raw[key] != null) out[key] = String(raw[key]).trim().slice(0, 80);
    }
    return out;
  }

  /** Update upload / deployment channel metadata (not the same as release-complete). */
  function updateUpload(projectId, env, channel, body, opts = {}) {
    if (!['web', 'ios', 'android'].includes(channel)) {
      return { ok: false, error: 'Invalid upload channel' };
    }
    const doc = load(projectId, env, opts);
    const allowed = UPLOAD_STATUSES[channel];
    const prev = doc.uploads[channel] || emptyUploads()[channel];
    const next = { ...prev };
    const user = String(body.updatedBy || body.user || 'User').slice(0, 80);
    const now = new Date().toISOString();

    for (const key of Object.keys(prev)) {
      if (body[key] != null && key !== 'storedAs') {
        next[key] = String(body[key]).slice(0, 500);
      }
    }
    if (body.status != null) {
      if (!allowed.includes(String(body.status))) {
        return { ok: false, error: `Invalid ${channel} status` };
      }
      next.status = String(body.status);
    }
    doc.uploads[channel] = next;
    if (prev.status !== next.status) {
      doc.history.unshift({
        at: now,
        user,
        itemId: `${channel}-upload`,
        itemLabel: `${channel} upload status`,
        previousStatus: prev.status,
        newStatus: next.status,
        remarks: body.remarks ? String(body.remarks).slice(0, 500) : '',
      });
      doc.history = doc.history.slice(0, 200);
    }
    doc.updatedAt = now;
    doc.updatedBy = user;
    save(doc);
    return { ok: true, checklist: load(projectId, env, opts) };
  }

  /**
   * Attach a build file locally (evidence only — does not deploy to stores).
   * @param {{ fileName: string, buffer: Buffer, uploadedBy?: string, meta?: object }} file
   */
  function attachUpload(projectId, env, channel, file, opts = {}) {
    if (!['web', 'ios', 'android'].includes(channel)) {
      return { ok: false, error: 'Invalid upload channel' };
    }
    const maxBytes = 80 * 1024 * 1024;
    if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
      return { ok: false, error: 'Missing file' };
    }
    if (file.buffer.length > maxBytes) {
      return { ok: false, error: 'File too large (max 80 MB)' };
    }
    const dir = uploadsDir(projectId, env, channel);
    fs.mkdirSync(dir, { recursive: true });
    const safeName = path
      .basename(String(file.fileName || 'build.bin'))
      .replace(/[^\w.\-()+ ]/g, '_');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storedAs = `${stamp}_${safeName}`;
    fs.writeFileSync(path.join(dir, storedAs), file.buffer);

    const doc = load(projectId, env, opts);
    const user = String(file.uploadedBy || 'User').slice(0, 80);
    const now = new Date().toISOString();
    const prev = doc.uploads[channel];
    doc.uploads[channel] = {
      ...prev,
      ...(file.meta || {}),
      fileName: safeName,
      storedAs,
      uploadDate: now.slice(0, 10),
      uploadedBy: user,
      // Upload ≠ release: only advance to "uploaded" if still not started / build ready
      status:
        prev.status === 'not_started' || prev.status === 'build_ready'
          ? 'uploaded'
          : prev.status,
    };
    doc.history.unshift({
      at: now,
      user,
      itemId: `${channel}-upload`,
      itemLabel: `${channel} build attached`,
      previousStatus: prev.status,
      newStatus: doc.uploads[channel].status,
      remarks: `Attached ${safeName}`,
    });
    doc.history = doc.history.slice(0, 200);
    doc.updatedAt = now;
    doc.updatedBy = user;
    save(doc);
    return {
      ok: true,
      checklist: load(projectId, env, opts),
      storedAs,
      note: 'File stored as checklist evidence only — not deployed to App Store / Play / hosting.',
    };
  }

  function reset(projectId, env, opts = {}) {
    const overrides = readProjectOverrides(opts.projectRoot || '');
    const doc = blankDoc(projectId, opts.displayName, env, overrides);
    doc.createdBy = String(opts.user || '').slice(0, 80);
    doc.updatedBy = doc.createdBy;
    save(doc);
    return { ok: true, checklist: load(projectId, env, opts) };
  }

  function attachmentPath(projectId, env, channel, storedAs) {
    const full = path.join(
      uploadsDir(projectId, env, channel),
      path.basename(String(storedAs || ''))
    );
    if (!fs.existsSync(full)) return null;
    return full;
  }

  return {
    load,
    updateItem,
    updateMeta,
    updateUpload,
    attachUpload,
    reset,
    attachmentPath,
    computeProgress,
    SECTIONS,
    ENVIRONMENTS,
    UPLOAD_STATUSES,
    ITEM_STATUSES,
  };
}

module.exports = { createReleaseChecklistStore };

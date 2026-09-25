/**
 * HTTP handlers for the Release Checklist module.
 * Mounted from dashboard/server.js — does not alter automation run APIs.
 */

const fs = require('fs');
const path = require('path');
const { createReleaseChecklistStore } = require('./store');
const {
  buildCsv,
  buildExcel,
  buildHtml,
  prepareExportChecklist,
} = require('./export');

/**
 * @param {object} deps
 * @param {string} deps.dataDir
 * @param {(id: string) => boolean} deps.isRealProject
 * @param {string} deps.projectsDir
 * @param {(res: import('http').ServerResponse, data: object, code?: number) => void} deps.json
 * @param {(htmlPath: string) => Promise<string>} deps.reportToPdf
 * @param {(req: import('http').IncomingMessage) => Promise<object>} deps.readBody
 */
function createReleaseChecklistApi(deps) {
  const store = createReleaseChecklistStore(deps.dataDir);

  function projectOpts(projectId) {
    const projectRoot = path.join(deps.projectsDir, projectId);
    let displayName = projectId;
    try {
      const cfg = require(path.join(projectRoot, 'project.config.js'));
      if (cfg?.displayName) displayName = cfg.displayName;
    } catch {
      /* optional */
    }
    return { projectRoot, displayName };
  }

  function requireProject(projectId) {
    if (!projectId || !deps.isRealProject(projectId)) {
      return { ok: false, error: 'Unknown project' };
    }
    return { ok: true };
  }

  /**
   * Handle /api/release-checklist* routes.
   * @returns {Promise<boolean>} true if handled
   */
  async function handle(req, res, pathname, method, url) {
    if (!pathname.startsWith('/api/release-checklist')) return false;

    // GET template (shared, no project)
    if (method === 'GET' && pathname === '/api/release-checklist/template') {
      deps.json(res, {
        ok: true,
        sections: store.SECTIONS,
        itemStatuses: store.ITEM_STATUSES,
        environments: store.ENVIRONMENTS,
        uploadStatuses: store.UPLOAD_STATUSES,
      });
      return true;
    }

    const projectId = url.searchParams.get('projectId') || '';
    const env = url.searchParams.get('env') || 'production';

    // GET checklist
    if (method === 'GET' && pathname === '/api/release-checklist') {
      const check = requireProject(projectId);
      if (!check.ok) {
        deps.json(res, check, 404);
        return true;
      }
      const checklist = store.load(projectId, env, projectOpts(projectId));
      deps.json(res, { ok: true, checklist });
      return true;
    }

    // PATCH / POST meta
    if (
      method === 'POST' &&
      pathname === '/api/release-checklist/meta'
    ) {
      const body = await deps.readBody(req);
      const id = body.projectId || projectId;
      const check = requireProject(id);
      if (!check.ok) {
        deps.json(res, check, 404);
        return true;
      }
      deps.json(
        res,
        store.updateMeta(id, body.env || env, body, projectOpts(id))
      );
      return true;
    }

    // POST item update
    if (method === 'POST' && pathname === '/api/release-checklist/item') {
      const body = await deps.readBody(req);
      const id = body.projectId || projectId;
      const check = requireProject(id);
      if (!check.ok) {
        deps.json(res, check, 404);
        return true;
      }
      deps.json(
        res,
        store.updateItem(id, body.env || env, body, projectOpts(id))
      );
      return true;
    }

    // POST upload channel meta
    if (method === 'POST' && pathname === '/api/release-checklist/upload-meta') {
      const body = await deps.readBody(req);
      const id = body.projectId || projectId;
      const channel = body.channel;
      const check = requireProject(id);
      if (!check.ok) {
        deps.json(res, check, 404);
        return true;
      }
      deps.json(
        res,
        store.updateUpload(id, body.env || env, channel, body, projectOpts(id))
      );
      return true;
    }

    // POST attach file (base64 JSON — no multipart deps; local evidence only)
    if (method === 'POST' && pathname === '/api/release-checklist/attach') {
      const body = await deps.readBody(req);
      const id = body.projectId || projectId;
      const check = requireProject(id);
      if (!check.ok) {
        deps.json(res, check, 404);
        return true;
      }
      let buffer;
      try {
        buffer = Buffer.from(String(body.contentBase64 || ''), 'base64');
      } catch {
        deps.json(res, { ok: false, error: 'Invalid file encoding' }, 400);
        return true;
      }
      const result = store.attachUpload(
        id,
        body.env || env,
        body.channel,
        {
          fileName: body.fileName,
          buffer,
          uploadedBy: body.uploadedBy || body.user,
          meta: body.meta || {},
        },
        projectOpts(id)
      );
      deps.json(res, result, result.ok ? 200 : 400);
      return true;
    }

    // POST reset
    if (method === 'POST' && pathname === '/api/release-checklist/reset') {
      const body = await deps.readBody(req);
      const id = body.projectId || projectId;
      const check = requireProject(id);
      if (!check.ok) {
        deps.json(res, check, 404);
        return true;
      }
      deps.json(
        res,
        store.reset(id, body.env || env, {
          ...projectOpts(id),
          user: body.user || body.updatedBy,
        })
      );
      return true;
    }

    // GET export ?format=csv|excel|pdf|html&section=ios|android|…&preparedBy=Name
    if (method === 'GET' && pathname === '/api/release-checklist/export') {
      const check = requireProject(projectId);
      if (!check.ok) {
        deps.json(res, check, 404);
        return true;
      }
      const format = String(url.searchParams.get('format') || 'csv').toLowerCase();
      const section = url.searchParams.get('section') || url.searchParams.get('scope') || 'all';
      const preparedBy = String(url.searchParams.get('preparedBy') || '').trim();
      const full = store.load(projectId, env, projectOpts(projectId));
      if (preparedBy) {
        store.updateMeta(
          projectId,
          env,
          {
            releaseVersion: full.releaseVersion,
            updatedBy: preparedBy,
            createdBy: preparedBy,
          },
          projectOpts(projectId)
        );
      }
      const fresh = preparedBy
        ? store.load(projectId, env, projectOpts(projectId))
        : full;
      const checklist = prepareExportChecklist(
        { ...fresh, preparedBy: preparedBy || fresh.updatedBy || fresh.createdBy },
        { section, preparedBy: preparedBy || fresh.updatedBy || fresh.createdBy }
      );
      const disposition = url.searchParams.get('download') === '0' ? 'inline' : 'attachment';

      if (format === 'csv') {
        const out = buildCsv(checklist);
        res.writeHead(200, {
          'Content-Type': out.contentType,
          'Content-Disposition': `${disposition}; filename="${out.filename}"`,
          'Content-Length': out.body.length,
        });
        res.end(out.body);
        return true;
      }

      if (format === 'excel' || format === 'xls' || format === 'xlsx') {
        const out = buildExcel(checklist);
        const name =
          format === 'xlsx'
            ? out.filename.replace(/\.xls$/, '.xlsx')
            : out.filename;
        res.writeHead(200, {
          'Content-Type': out.contentType,
          'Content-Disposition': `${disposition}; filename="${name}"`,
          'Content-Length': out.body.length,
        });
        res.end(out.body);
        return true;
      }

      if (format === 'html') {
        const out = buildHtml(checklist);
        res.writeHead(200, {
          'Content-Type': out.contentType,
          'Content-Disposition': `${disposition}; filename="${out.filename}"`,
          'Content-Length': out.body.length,
        });
        res.end(out.body);
        return true;
      }

      if (format === 'pdf') {
        const out = buildHtml(checklist);
        const tmpDir = path.join(deps.dataDir, 'release-checklists', '_export');
        fs.mkdirSync(tmpDir, { recursive: true });
        const htmlPath = path.join(tmpDir, `${out.fileBaseName}.html`);
        fs.writeFileSync(htmlPath, out.body);
        try {
          const pdfPath = await deps.reportToPdf(htmlPath);
          const pdfBuf = fs.readFileSync(pdfPath);
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `${disposition}; filename="${out.fileBaseName}.pdf"`,
            'Content-Length': pdfBuf.length,
          });
          res.end(pdfBuf);
        } catch (err) {
          deps.json(
            res,
            {
              ok: false,
              error: `PDF export failed: ${err.message || err}. Try CSV or Excel.`,
            },
            500
          );
        }
        return true;
      }

      deps.json(res, { ok: false, error: 'format must be csv, excel, html, or pdf' }, 400);
      return true;
    }

    // GET attached file download
    if (method === 'GET' && pathname === '/api/release-checklist/attachment') {
      const channel = url.searchParams.get('channel') || '';
      const storedAs = url.searchParams.get('storedAs') || '';
      const check = requireProject(projectId);
      if (!check.ok) {
        deps.json(res, check, 404);
        return true;
      }
      const full = store.attachmentPath(projectId, env, channel, storedAs);
      if (!full) {
        deps.json(res, { ok: false, error: 'Attachment not found' }, 404);
        return true;
      }
      const buf = fs.readFileSync(full);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${path.basename(full)}"`,
        'Content-Length': buf.length,
      });
      res.end(buf);
      return true;
    }

    deps.json(res, { ok: false, error: 'Unknown release-checklist route' }, 404);
    return true;
  }

  return { handle, store };
}

module.exports = { createReleaseChecklistApi };

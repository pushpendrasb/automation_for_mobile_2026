# Automation Control Desk

## How to open

All of these still work — use whichever you prefer:

| Way | Command / action |
|-----|------------------|
| **Click app (recommended)** | Double-click **`Control Desk.app`** or **`Open Control Desk.command`** — starts the server if needed + opens the browser |
| **Terminal** | `npm run dashboard` |
| **Short aliases** | `npm start` or `npm run desk` |
| **`.webloc` bookmark** | Opens **http://testsuite.appdesign.ie:3939/** only — does **not** start the server. If you see **ERR_CONNECTION_REFUSED**, the Node process is not running: use **Control Desk.app** or `npm run dashboard` first. Browser Reload never starts the server. |

`npm run dashboard` is unchanged and fully supported.

## Features

| Feature | What it does |
|--------|----------------|
| **Setup** | Live Mac checks + step-by-step guide · **Run bootstrap** opens Terminal with `bash scripts/bootstrap.sh` · **Run npm setup** for Node-already-installed · Copy command |
| **Appium** | Status + version · Start / Stop |
| **Devices** | Connected iOS / Android (refreshable) |
| **Projects** | Cards for AppraiseeIE, VetPal, RosKids… |
| **Env check** | Warns if `.env` missing `TEST_USER` / `TEST_PASSWORD` |
| **Suites** | One-click Sign-in / Smoke suites |
| **Multi-select** | Check scripts → **Run selected** (queued) |
| **Queue** | If a run is busy, next scripts wait automatically |
| **Live log** | **Client** (plain steps) or **Full** (all technical output) — toggle in Run log |
| **Last run summary** | Pass/fail + counts + duration |
| **View report** | Opens HTML report after finish |
| **Reports list** | Latest report + catalog per project |
| **Screenshots** | Opens `projects/<id>/screenshots` in Finder |
| **History** | Last 25 runs; each finished run archives its own HTML report snapshot |
| **Release Checklist** | Project-wise go-live checklist (Backend / Web / iOS / Android / Security / QA / Go-Live) · progress · upload evidence · PDF/Excel/CSV download · activity history |
| **Theme** | Light / Dark (remembered) |
| **Last project** | Reopens the project you used last |

### Release Checklist

Open **Release Checklist** in the header nav (next to Automation). Each project + environment (`Production` / `Staging`) has its own saved state under `dashboard/data/release-checklists/`.

- Progress ignores **N/A** items
- **Upload ≠ Release** — attaching a build only stores evidence; advance store/deploy status separately
- Optional per-project defaults: `projects/<id>/releaseChecklist.json` (`disabledSections` / `disabledItems`)
- Downloads: PDF · Excel · CSV named like `VetPortal_Production_Release_Checklist_v1.4.0.*`

### Setup on the dashboard

The wizard is **interactive** (device, Team ID, credentials), so Control Desk does **not** run it inside the browser. It:

1. Shows readiness checks (Homebrew, Node ≥ 18, Xcode, Appium, project `.env`)
2. Explains what bootstrap does and what the wizard will ask
3. Opens **Terminal.app** with either:
   - `bash scripts/bootstrap.sh` (fresh Mac — installs Homebrew/Node if needed)
   - `npm run setup` (Node already present)
4. You answer prompts in Terminal, then click **Refresh checks** and use Projects / Appium as usual

Same as the CLI docs in `SETUP.md`.

### Another Mac shows Setup **404**?

**Cause:** An old Node process is still listening on port **3939**. The browser loads the new HTML/JS from disk, but the process in memory has no `/api/setup` routes. Re-opening Control Desk used to reuse that old process if the port was already up.

**Fix on that Mac:**

```bash
lsof -ti:3939 | xargs kill -9
cd /path/to/automation_for_mobile_2026
git pull
npm run dashboard
```

`npm run dashboard` now frees port 3939 before start. Control Desk.app / launch script also restarts automatically when `/api/setup` is missing.

Hard-refresh the browser (Cmd+Shift+R). Allow Terminal when macOS asks — if you deny Automation, use **Copy command** and paste into Terminal; that still works without the button.

## Optional env

```bash
DASHBOARD_PORT=4040 npm run dashboard
DASHBOARD_HOST=0.0.0.0 npm run dashboard   # LAN — use only on trusted networks
```

## Notes

- Local by default (`127.0.0.1`)
- **Client** log mode (default): plain steps only (`Email has been entered`, `Keyboard is hidden`…). Switch to **Full** for all technical output. Choice is remembered.
- Test runs prompt to start Appium if offline
- Reports served from `projects/<id>/reports/*.html`

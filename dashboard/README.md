# Automation Control Desk

## How to open

All of these still work — use whichever you prefer:

| Way | Command / action |
|-----|------------------|
| **Terminal (kept)** | `npm run dashboard` |
| **Short aliases** | `npm start` or `npm run desk` |
| **Click app (optional)** | Double-click **`Control Desk.app`** — starts server if needed + opens browser |
| **URL / bookmark** | **http://127.0.0.1:3939** (server must already be running) |

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
| **Theme** | Light / Dark (remembered) |
| **Last project** | Reopens the project you used last |

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

That is **not** Terminal permission. It means the browser loaded newer UI while Node is still an **old** `dashboard` process (or the repo was not pulled).

On the other Mac:

```bash
cd /path/to/automation_for_mobile_2026
git pull
# stop anything on 3939, then:
npm run dashboard
```

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

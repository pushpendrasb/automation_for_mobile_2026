# Automation Control Desk

One-click graphical dashboard for this repo.

```bash
npm run dashboard
```

Opens **http://127.0.0.1:3939**

## Features

| Feature | What it does |
|--------|----------------|
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
| **History** | Last 10 runs (saved under `dashboard/data/`) |
| **Theme** | Light / Dark (remembered) |
| **Last project** | Reopens the project you used last |

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

# RosKids automation project

RosKids-specific **pages**, **tests**, and **data** for the shared `@mobile-automation/appium-core` framework.

**App repo (no automation code):**  
`~/Documents/React_Native/RosKids/RoskidsReactnativeApp`

## Setup

```bash
cd ~/Documents/React_Native/RosKids/mobile-automation/projects/roskids
npm install
cp .env.example .env
```

If you already had credentials in the old in-app `automation/.env`:

```bash
cp ~/Documents/React_Native/RosKids/RoskidsReactnativeApp/automation/.env ./.env
```

## Run

```bash
# Terminal 1
appium

# Terminal 2
npm run test:ios:positive
npm run test:ios:signin
npm run test:ios:bookservice
npm run test:android:signin
```

## Reports

After a run:

- `reports/roskids-report.html` — results
- `reports/test-catalog.html` — planned cases (our understanding)
- `screenshots/` — failure captures

```bash
npm run report:open
```

## Project layout (what changes per app)

| Folder | Purpose |
|--------|---------|
| `pages/` | Page objects (Login, Book Service, …) |
| `tests/` | Mocha spec files |
| `data/testData.js` | Credentials + UI labels from `.env` |
| `catalog/testCasesCatalog.js` | QA case definitions for reports |
| `helpers/` | App-specific helpers (e.g. slot selection) |
| `project.config.js` | Bundle IDs, report name, spec paths |

Shared WDIO/Appium config is in `../../framework/`.

# __PROJECT_NAME__ automation

Scaffolded from `projects/_template` via `npm run new-project`.

## First-time on this Mac

From the repo root:

```bash
bash scripts/bootstrap.sh --project __PROJECT_ID__
```

Or if Node/Appium are already installed:

```bash
npm run setup -- --project __PROJECT_ID__
```

## Run

```bash
# Terminal 1
appium

# Terminal 2
cd projects/__PROJECT_ID__
npm run check:devices:ios
npm run test:ios:smoke
```

## Customize

1. Set `IOS_BUNDLE_ID` / `ANDROID_APP_PACKAGE` in `.env` (defaults: `__BUNDLE_ID__`)
2. Replace `pages/` locators for your app
3. Add specs under `tests/`
4. Update `catalog/testCasesCatalog.js` for the HTML report

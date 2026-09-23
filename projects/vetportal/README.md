# VetPortal automation

Scaffolded from `projects/_template` via `npm run new-project`.

## First-time on this Mac

From the repo root:

```bash
bash scripts/bootstrap.sh --project vetportal
```

Or if Node/Appium are already installed:

```bash
npm run setup -- --project vetportal
```

## Run

```bash
# Terminal 1
appium

# Terminal 2
cd projects/vetportal
npm run check:devices:ios
npm run test:ios:smoke
```

## Customize

1. Set `IOS_BUNDLE_ID` / `ANDROID_APP_PACKAGE` in `.env` (defaults: `ie.vetpal.vet`)
2. Replace `pages/` locators for your app
3. Add specs under `tests/`
4. Update `catalog/testCasesCatalog.js` for the HTML report

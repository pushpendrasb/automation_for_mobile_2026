# __PROJECT_NAME__ automation (TypeScript)

Scaffolded from `projects/_template_typescript` via setup / `npm run new-project`.

## First-time on this Mac

From the repo root:

```bash
bash scripts/bootstrap.sh
# choose TypeScript when asked for language, then create this project
```

Or:

```bash
npm run new-project -- --language typescript
npm run setup -- --project __PROJECT_ID__ --language typescript
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

1. Set `IOS_BUNDLE_ID` / `ANDROID_APP_PACKAGE` in `.env`
2. Replace `pages/*.ts` locators for your app
3. Add specs under `tests/**/*.test.ts`
4. Update `catalog/testCasesCatalog.js` for the HTML report

# __PROJECT_NAME__ automation (Python)

Scaffolded from `projects/_template_python`. Uses **pytest** + **Appium-Python-Client**.

Appium server is still required (same as JS/TS). The shared WebdriverIO HTML reporter is JS-only; Python projects use pytest output + screenshots on failure.

## First-time on this Mac

From the repo root:

```bash
bash scripts/bootstrap.sh
# choose Python when asked for language, then create this project
```

Or:

```bash
npm run new-project -- --language python
npm run setup -- --project __PROJECT_ID__ --language python
```

Setup creates `.venv` and installs `requirements.txt`.

## Run

```bash
# Terminal 1
appium

# Terminal 2
cd projects/__PROJECT_ID__
source .venv/bin/activate
python scripts/check_devices.py ios
pytest -m smoke -s --platform ios
# Android: pytest -m smoke -s --platform android
```

## Customize

1. Set `IOS_BUNDLE_ID` / `ANDROID_APP_PACKAGE` in `.env`
2. Replace `pages/` locators
3. Add tests under `tests/test_*.py`

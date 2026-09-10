# Who may change what

## Rule

| Path | Who may change |
|------|----------------|
| `projects/<your-app>/` (e.g. `appraiseeie`, `vetpal`) | Any collaborator (your app only) |
| `framework/` | **@pushpendrasb only** (ask permission) |
| `scripts/` | **@pushpendrasb only** |
| `projects/_template*` | **@pushpendrasb only** |
| `.github/`, root docs (`SETUP.md`, …) | **@pushpendrasb only** |

`.env` is never committed — each Mac keeps its own device/Team ID secrets.

## For other developers

1. Clone the repo and run `bash scripts/bootstrap.sh` (or `npm run setup`).
2. Work **only** under `projects/<your-app>/` (pages, tests, catalog, project `.env` locally).
3. During setup, provide your **app source path / git URL** (`APP_SOURCE_PATH`) so scripts can reference the real app.
4. Open a **branch + pull request** — do not push shared folders.
5. If you need a framework/setup change, ask **@pushpendrasb**.

## For the owner (@pushpendrasb)

Turn on GitHub branch protection so this rule is enforced:

1. Repo → **Settings** → **Branches** → **Add rule** for `main`
2. Enable:
   - **Require a pull request before merging**
   - **Require review from Code Owners**
   - **Require status checks to pass** → select **Protect shared paths**
3. Optionally: **Restrict who can push to matching branches** → only you

Without branch protection, CODEOWNERS + CI only help on pull requests (not force-pushes to `main`).

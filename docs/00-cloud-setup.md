# 00 — Cloud Setup (human steps)

How the developer runs this project with **Claude Code on the web** and **no software installed locally**. Everything happens in the browser: GitHub, claude.ai/code, and Netlify.

Claude: this file is reference only. You do not perform these steps.

## Accounts needed

| Service | Plan | Used for |
|---|---|---|
| GitHub | Free | Hosts the repo. Claude Code on the web requires it |
| Claude | Pro, Max, Team, or Enterprise (premium seat) | Cloud sessions at claude.ai/code |
| Netlify | Free | Deploy previews so you can see the app in a browser (you cannot open `localhost`) |

## One-time setup

1. **Create the repo** at github.com/new: name `bank-fair`. Leave **Add a README**, **.gitignore**, and **license** all unticked. The Angular scaffold must not collide with existing files.
2. **Upload the docs**: on the empty repo page, click **uploading an existing file**. Drag in `CLAUDE.md` and the `docs` folder (keep the folder structure). Commit directly to `main`.
3. **Connect Claude**: open claude.ai/code → sign in → **connect GitHub** and approve.
4. **Install the Claude GitHub App** on the repo (required for a private repo; recommended anyway): github.com/apps/claude/installations/new → **Only select repositories** → `bank-fair`.
5. **Environment**: Pro/Max users get a **Default** environment automatically. Team/Enterprise users see a form; keep the defaults and click **Create & finish**. Leave network access on **Trusted**.

## Running a phase (repeat for each phase)

1. At claude.ai/code, select repo `bank-fair`, branch `main`.
2. Set mode:
   - **Plan** for the first message of a phase. Claude proposes the plan; you approve it.
   - **Accept edits** (or **Auto**, if offered) after you approve.
3. Paste the phase prompt from `docs/06-build-plan.md`.
4. When Claude finishes, open the diff (`+N −N` indicator). Leave inline comments if something is off, and send them.
5. Click **Create PR**.
6. Open the **Netlify deploy preview** link on the PR (from Phase 1 onwards) and click through the pages Claude listed.
7. Read the "Concepts to explain" summary Claude gives you. Ask follow-up questions in the same session until you can explain each one.
8. **Merge the PR** on GitHub. Start the next phase in a **new session** from `main`.

Closing the browser tab does not stop a session. It keeps running and you can come back later.

## Netlify (do this after the Phase 1 PR exists)

1. app.netlify.com → sign in with GitHub → **Add new project** → **Import from Git** → GitHub.
2. Grant access to **only** the `bank-fair` repo.
3. Netlify reads `netlify.toml` from the repo (Claude creates it in Phase 1). Confirm:
   - Build command: `npm run build`
   - Publish directory: `dist/bank-fair/browser`
4. Deploy. From then on:
   - Every PR gets a **deploy preview** URL (posted on the PR).
   - Every merge to `main` updates the **production** URL. This is the link you show in the interview.

## Troubleshooting

| Problem | Fix |
|---|---|
| Repo does not appear in claude.ai/code | Install the Claude GitHub App on it (step 4) |
| Claude reports Node.js is below 22.22.3 | The VM ships 22.22.2 and Angular 22 requires 22.22.3. **`scripts/cloud-session-start.sh` handles this automatically** (~6s on the first session, cached afterwards), so normally you do nothing. If the hook cannot reach nodejs.org it says so; the manual fallback is to edit the environment (cloud icon above the message box → gear icon), add this setup script and start a new session: `npm install -g n && n 22 && hash -r && npm install -g npm@latest && node -v && npm -v` |
| `npm install` fails with `Cannot read properties of null (reading 'edgesOut')` | npm 10 bug. The setup script above upgrades npm. As a one-off, `npm ci` works on any npm version because it installs from the lockfile |
| Setup script fails | Add `set -x` at the top to see which line failed; keep total runtime under ~5 minutes |
| Netlify build fails on Node version | The repo's `.nvmrc` sets Node 22. Check the Netlify build log; set `NODE_VERSION=22` in Netlify site environment variables if needed |
| Deploy preview shows 404 on refresh | `netlify.toml` SPA redirect is missing; ask Claude to add it |

## Security notes

- Keep the repo **private** while building if you prefer; make it public before the interview if you want to share the code.
- Never put secrets in the cloud environment's variables or setup script. Anyone using the environment can read them.
- Grant Netlify and the Claude GitHub App access to **this repo only**, not your whole account.

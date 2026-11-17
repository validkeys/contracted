---
name: release-npm
description: Release and publish @validkeys/contracted to npm using changesets. Use when asked to release, publish, cut a release, bump a version, or create a changeset. Covers the full workflow: writing a changeset, versioning, pushing a tag, and OIDC-based publishing via GitHub Actions.
---

# Release to npm — @validkeys/contracted

## Overview

This project uses **[@changesets/cli](https://changesets.dev)** for versioning and **OIDC trusted publishing** via GitHub Actions for the actual npm publish. No npm token is stored anywhere.

**Publish mechanism:** pushing a `v*` git tag triggers `.github/workflows/publish.yml`, which builds, tests, and runs `changeset publish` using a short-lived OIDC credential issued by GitHub to the `npm` environment.

Package name: `@validkeys/contracted`  
Registry access: `public`  
Package manager: `pnpm`  

---

## Full Release Workflow

### Step 1 — Verify working state

```bash
# Must be on main, clean working tree
git status
git branch --show-current   # should be main

# Tests must pass before tagging
pnpm test:run src/core/
```

### Step 2 — Create a changeset

A changeset is a Markdown file in `.changeset/` describing the change and its semver impact.

> **Note:** The interactive `pnpm changeset` CLI requires a TTY. In a non-interactive environment, write the file directly (see below).

#### Interactive (terminal with TTY)
```bash
pnpm changeset
# 1. Select @validkeys/contracted (space, then enter)
# 2. Choose bump type: patch | minor | major
# 3. Write a summary — this appears verbatim in CHANGELOG.md
```

#### Non-interactive (scripted / agent environment)
Create `.changeset/<slug>.md` manually:

```markdown
---
"@validkeys/contracted": minor
---

Short description of the change — goes into CHANGELOG.md.
```

Then commit:
```bash
git add .changeset/
git commit -m "chore: add changeset for <brief description>"
```

> If changesets already exist in `.changeset/` (from prior work), skip to Step 3.

### Step 3 — Version packages

Consume the pending changesets, bump `package.json`, and update `CHANGELOG.md`:

```bash
pnpm changeset version
```

Review the diff, then commit:

```bash
git diff
git add package.json CHANGELOG.md
git commit -m "chore: release @validkeys/contracted@<new-version>"
```

### Step 4 — Push the tag to trigger CI publish

```bash
# Push the commit, then push the version tag
# The tag is what fires .github/workflows/publish.yml
git push origin main
git tag v<new-version>        # e.g. git tag v4.2.0
git push origin v<new-version>

# Or use the convenience script (pushes main + all tags):
pnpm tag
```

The GitHub Actions workflow will:
1. Install dependencies
2. Run `pnpm test:run`
3. Run `pnpm build`
4. Run `npm stage publish` — submits the tarball to npm's staging area via OIDC

### Step 5 — Approve the staged release

After the workflow succeeds, the package is **staged but not yet live**. A maintainer must
review and approve it with 2FA before it becomes publicly available.

**Via npmjs.com:**
Go to https://www.npmjs.com/settings/~/staged-packages, find the pending release,
review it, and click **Approve** (2FA prompt will appear).

**Via CLI:**
```bash
# List staged packages waiting for approval
npm stage list @validkeys/contracted

# View details for a specific staged release
npm stage view <stage-id>

# Approve (triggers 2FA prompt)
npm stage approve <stage-id>
```
5. The workflow completes with the package staged — it is **not yet live**.

Monitor the CI workflow at: https://github.com/validkeys/contracted/actions  
Review and approve staged releases at: https://www.npmjs.com/settings/~/staged-packages

---

## Verification After Release

```bash
# Confirm the new version is live on npm
npm view @validkeys/contracted version

# Confirm provenance attestation exists
npm audit signatures

# Smoke-test the published package
mkdir /tmp/contracted-smoke && cd /tmp/contracted-smoke
npm init -y && npm install @validkeys/contracted
node -e "const c = require('@validkeys/contracted'); console.log(Object.keys(c))"
```

---

## Semver Decision Guide

| Change type | Bump |
|---|---|
| Bug fix, internal refactor, type fix with no API change | `patch` |
| New export, new option, new overload, additive change | `minor` |
| Removed export, changed function signature, changed required deps | `major` |
| Fix that corrects undocumented / clearly broken behaviour | `patch` |

---

## Pre-release / Beta Versions

```bash
# Enter pre-release mode
pnpm changeset pre enter beta

# Create changeset and version as normal — produces e.g. 4.3.0-beta.0
pnpm changeset
pnpm changeset version
git add -A && git commit -m "chore: release v4.3.0-beta.0"

# Push a beta tag — CI will publish to the "beta" dist-tag
git tag v4.3.0-beta.0
git push origin main v4.3.0-beta.0

# When ready to go stable, exit pre-release mode
pnpm changeset pre exit
pnpm changeset version
git add -A && git commit -m "chore: release v4.3.0"
git tag v4.3.0
git push origin main v4.3.0
```

> **Note:** `changeset publish` publishes pre-releases to the `next` dist-tag by default. Consumers install with `npm install @validkeys/contracted@next`.

---

## OIDC Trusted Publishing — How It Works

Publishing uses staged publishing via OIDC — no npm token anywhere:

1. The `publish.yml` workflow runs in the `npm` GitHub environment.
2. GitHub mints a short-lived OIDC token for the job (`id-token: write` permission).
3. `npm stage publish` exchanges the token with npm's registry, which verifies it matches the trusted publisher on the package settings page.
4. If repository, workflow filename, and environment name all match, the tarball is submitted to the **staging area** with a provenance attestation.
5. A maintainer approves the staged release with 2FA before it goes live.

**Why staged publishing?** npm's recommended security posture for trusted publishing is stage-only: CI cannot directly publish live releases. Each publish requires a human approval with 2FA, preventing automated supply-chain attacks even if the workflow is compromised.

**Prerequisites (one-time setup — already done):**

| Step | Where |
|------|-------|
| Create `npm` environment | https://github.com/validkeys/contracted/settings/environments |
| Add trusted publisher | https://www.npmjs.com/package/@validkeys/contracted → Settings → Trusted Publishers |
| Trusted publisher config | Owner: `validkeys`, Repo: `contracted`, Workflow: `publish.yml`, Env: `npm`, **Allow: stage publish only** |

**Key constraint:** A newly created trusted publisher configuration that has not completed a successful publish within **48 hours** is automatically removed by npm. After setup, push a tag promptly.

---

## Troubleshooting

### Workflow fails with `ENEEDAUTH` or `401`
- npm CLI below 11.5.1 does not support OIDC. The workflow upgrades npm with `npm install -g npm@latest` — confirm that step ran.
- `NODE_AUTH_TOKEN` or `NPM_TOKEN` must **not** be set in the job environment. If either is set, the CLI uses token auth instead of OIDC and may fail. Remove any such secrets from the repository and workflow.

### Workflow fails with `403` / "not allowed to publish"
- The trusted publisher configuration on npmjs.com may have expired (>48h without a successful publish) or may not match the workflow exactly. Go to the package settings and verify/recreate it.
- Confirm the job runs in the `npm` environment — check `environment: npm` is present in `publish.yml`.
- Confirm the GitHub Actions runner is GitHub-hosted (`ubuntu-latest`). Self-hosted runners are not supported for OIDC publishing.

### `npm stage publish` says "nothing to publish" or version already staged
The package may already be staged. Check: `npm stage list @validkeys/contracted`.
If a stale staged version exists, reject it first: `npm stage reject <stage-id>`.

### Tag pushed but workflow did not fire
Confirm the tag matches `v*` (e.g. `v4.2.0`, not `4.2.0`). The workflow trigger is `push: tags: ['v*']`.

### Staged release not appearing on npmjs.com
Check https://www.npmjs.com/settings/~/staged-packages. Staged versions appear there
(not on the package page) until approved. The first ever staged publish also creates a
placeholder `0.0.0-stage` version on the package page — this is expected.

### Accidental staged publish of wrong version
Reject the staged version before it is approved:
```bash
npm stage list @validkeys/contracted
npm stage reject <stage-id>
```
If already approved and live, `npm deprecate @validkeys/contracted@<bad-version> "published in error"`.

### Emergency local publish (bypass CI)
The trusted publisher is configured for **stage publish only** — direct `npm publish` via
CI is intentionally not permitted. If you need to publish directly in an emergency:
```bash
npm login          # interactive session token; use recovery code as OTP if prompted
pnpm build
npm publish --access public    # direct publish from local machine
```

---

## Key Files

| File | Purpose |
|------|---------|
| `.changeset/config.json` | Changesets config — access level, base branch, changelog format |
| `CHANGELOG.md` | Auto-updated by `changeset version` |
| `.github/workflows/publish.yml` | OIDC publish workflow — fires on `v*` tags, runs `npm stage publish` |
| `.github/workflows/ci.yml` | Tests + build on every push to main and PR |
| `package.json` `scripts.tag` | `git push origin main --follow-tags` — triggers CI publish |
| `package.json` `scripts.version` | `changeset version` |
| `package.json` `files` | `["dist"]` — only compiled output is packed |
| `tsconfig.json` | Excludes tests and examples from the build |

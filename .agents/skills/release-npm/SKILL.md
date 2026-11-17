---
name: release-npm
description: Release and publish @validkeys/contracted to npm using changesets. Use when asked to release, publish, cut a release, bump a version, or create a changeset. Covers the full workflow: writing a changeset, versioning, building, publishing, and pushing tags.
---

# Release to npm — @validkeys/contracted

## Overview

This project uses **[@changesets/cli](https://changesets.dev)** for versioning and publishing. The workflow separates two concerns:

1. **Authoring** — writing changeset files that describe what changed and the semver impact
2. **Releasing** — consuming those changesets to bump versions, update `CHANGELOG.md`, build, and publish to npm

Package name: `@validkeys/contracted`  
Registry access: `public` (set in `.changeset/config.json`)  
Package manager: `pnpm`  

---

## Full Release Workflow

### Step 1 — Verify working state

```bash
# Confirm you are on main and it is clean
git status
git branch --show-current   # should be main

# Run tests — do not release broken code
pnpm test:run

# Confirm dist is not stale (optional but good hygiene)
rm -rf dist && pnpm build
ls dist/index.js dist/index.d.ts
```

### Step 2 — Create a changeset (if one does not already exist)

A changeset is a small Markdown file in `.changeset/` that describes what changed and the semver bump type.

```bash
pnpm changeset
```

The interactive CLI will ask:
1. **Which packages changed?** — select `@validkeys/contracted` (space to select, enter to confirm)
2. **Bump type?** — choose one:
   - `patch` — bug fixes, internal refactors, no API change
   - `minor` — new backwards-compatible feature or export
   - `major` — breaking change to the public API
3. **Summary** — write a short description; this goes into `CHANGELOG.md`

This creates a file like `.changeset/fuzzy-lions-dance.md`. Commit it:

```bash
git add .changeset/
git commit -m "chore: add changeset for <brief description>"
```

> If changesets already exist in `.changeset/` (from prior work), skip this step and go to Step 3.

### Step 3 — Version packages

The version command consumes all pending changeset files, bumps `package.json`, and updates `CHANGELOG.md`:

```bash
pnpm changeset version
```

This will:
- Delete the consumed `.changeset/*.md` files
- Update `"version"` in `package.json`
- Prepend the new entry to `CHANGELOG.md`

Review the diff before committing:

```bash
git diff
```

Commit the version bump:

```bash
git add package.json CHANGELOG.md
git commit -m "chore: release @validkeys/contracted@<new-version>"
```

### Step 4 — Publish to npm

```bash
pnpm release
```

This runs `pnpm build && changeset publish` under the hood (`package.json` scripts):
- Compiles TypeScript → `dist/`
- Runs `changeset publish` which calls `npm publish --access public`
- Creates a git tag `v<version>` (e.g. `v4.2.0`)

> **npm authentication required.** You must be logged in:
> ```bash
> npm whoami          # confirm you are logged in
> npm login           # if not — follow the prompts
> ```
> For accounts with 2FA enabled, npm will prompt for an OTP during publish.

### Step 5 — Push commits and tags

```bash
git push origin main --follow-tags
```

`--follow-tags` pushes the annotated version tag created by `changeset publish` alongside the commits.

---

## Verification After Release

```bash
# Confirm the new version is live on npm
npm view @validkeys/contracted version

# Confirm the full dist-tag listing
npm dist-tag ls @validkeys/contracted

# Smoke-test the published package (in a temp dir)
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
| Fix that corrects undocumented / clearly broken behavior | `patch` |

---

## Pre-release / Beta Versions

To publish a pre-release (e.g. `4.2.0-beta.0`):

```bash
# Enter pre-release mode
pnpm changeset pre enter beta

# Create changeset as normal, then version
pnpm changeset
pnpm changeset version    # produces 4.2.0-beta.0

# Publish with explicit dist-tag so it does NOT become "latest"
pnpm build && pnpm changeset publish --tag beta

git push origin main --follow-tags

# When stable, exit pre-release mode
pnpm changeset pre exit
```

Consumers install beta explicitly: `npm install @validkeys/contracted@beta`

---

## Troubleshooting

### `changeset publish` says "nothing to publish"
All pending changesets must be consumed by `changeset version` first. Check `.changeset/` for leftover files and re-run `pnpm changeset version`.

### `npm publish` fails with 403
- Run `npm whoami` — if not logged in, run `npm login`
- Confirm you have publish access: `npm access list packages <your-npm-username>`
- For scoped packages: confirm `.changeset/config.json` has `"access": "public"`

### Version was bumped but dist is out of date
`pnpm release` runs the build automatically. If you ran `changeset publish` directly (bypassing the `release` script), run `pnpm build` first.

### Accidental publish of wrong version
npm does not allow re-publishing the same version. Options:
- `npm deprecate @validkeys/contracted@<bad-version> "published in error"` — marks it as deprecated without removing it
- `npm unpublish @validkeys/contracted@<bad-version>` — only possible within 72 hours of publish

---

## Key Files

| File | Purpose |
|---|---|
| `.changeset/config.json` | Changesets config — access level, base branch, changelog format |
| `CHANGELOG.md` | Auto-updated by `changeset version` |
| `package.json` `scripts.release` | `pnpm build && changeset publish` |
| `package.json` `scripts.version` | `changeset version` |
| `package.json` `files` | `["dist"]` — only the compiled output is packed |
| `tsconfig.json` | Excludes tests and examples from the build |

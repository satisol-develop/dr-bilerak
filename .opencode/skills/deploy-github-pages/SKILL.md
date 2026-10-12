---
name: deploy-github-pages
description: Use when deploying or publishing this static site to GitHub Pages with GitHub Actions, enabling Pages on the repo, watching the workflow run, or fixing a failed pages deploy. Front-loads keywords deploy, GitHub Pages, workflow, gh api pages, publish, satisol-develop/dr-bilerak.
---

# Deploy to GitHub Pages

Publish the static site in this repository with the official GitHub Actions
Pages flow (no third-party build).

## Workflow file: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
```

Only the site files are at the repo root, so `path: .` is safe: `.github/`
and `.opencode/` are never served (dotfiles are excluded by the artifact
action, and the static host ignores them anyway).

## One-time setup: enable Pages (build type = workflow)

```powershell
gh api -X POST repos/satisol-develop/dr-bilerak/pages -f build_type=workflow
```

If Pages is already enabled with a branch source, switch it first:

```powershell
gh api -X PATCH repos/satisol-develop/dr-bilerak/pages -f build_type=workflow
```

## Run and monitor

```powershell
git push -u origin main
gh run list --repo satisol-develop/dr-bilerak
gh run watch --repo satisol-develop/dr-bilerak   # pick the run id if several
gh run view --repo satisol-develop/dr-bilerak <run-id> --log-failed   # on failure
```

## Final URL

`https://satisol-develop.github.io/dr-bilerak/`

## Common failures

- **404 after a green run**: Pages not enabled, or enabled with the wrong
  source → re-run the `gh api ... pages -f build_type=workflow` call.
- **Artifact too large / unexpected files**: narrow `path:` in
  `upload-pages-artifact` to the explicit site files (`index.html`, `css/`,
  `js/`).
- **Workflow not triggering**: check the push landed on `main`
  (`gh api repos/satisol-develop/dr-bilerak/pages` shows `html_url`).

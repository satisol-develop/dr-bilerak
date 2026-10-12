---
name: monaca-to-web
description: Use when converting a Monaca or Capacitor hybrid mobile app (www/ folder, capacitor.config.json, android/) into a static web app served from a repository root. Front-loads keywords monaca, capacitor, www, capacitor.config.json, hybrid app, static site, IndexedDB, Dexie.
---

# Monaca / Capacitor → Static Web App

Convert the `www/` folder of a Monaca/Capacitor hybrid app into a plain static
site that can be served directly (GitHub Pages, Vercel, Netlify, any static
server). Derived from the real conversion of `minutes-app` → `dr-bilerak`.

## What to keep and what to drop

Keep (it is already pure web):

- `www/index.html`, `www/css/`, `www/js/` → copied to the **repository root**
  (the root is what the static host serves).
- CDN `<script>`/`<link>` tags (dexie, sweetalert2, tom-select, xlsx, etc.)
  exactly as they are. Do not bundle, do not add a build step unless asked.
- Client-side data layer: Dexie/IndexedDB works identically in the browser.

Drop (native-only or irrelevant for web):

- `capacitor.config.json`, `android/`, `ios/`, `www/capacitor.js`,
  `www/capacitor-cordova-plugin-*.js`, cordova bridges.
- `node_modules/`, Monaca `logos/`/splash/icon assets and their zips.
- `package.json` dependencies on `@capacitor/*` → replace with a minimal
  `package.json` (name, version, optional `dev` script using `npx serve`).

## Removing a feature module (checklist)

Modules are wired in exactly these places — a half removal leaves orphan
references that fail at runtime:

1. **File**: delete `js/<module>.js` and its `<script>` tag in `index.html`.
2. **Markup**: remove buttons/toolbars/`<section id="page-...">` in `index.html`.
3. **Router**: remove `case '<page>'` in `navTo()` and the entry in
   `getTitle()` inside `js/app.js`.
4. **Data layer**: remove the table from `DB.version(N).stores({...})` in
   `js/db.js` **and bump N** (Dexie refuses/half-upgrades if you edit an
   already-released version in place).
5. **Call sites**: grep for `DB.<table>`, `App.<moduleFn>` across all JS
   (settings/dummy-data/reset functions are the usual hidden users).
6. **i18n**: remove the module's blocks from every language in `js/lang.js`.
   Safe to over-remove: `App._t()` returns the key when it is missing.

## Verification (run before declaring done)

```powershell
# 1. Syntax of every JS file
Get-ChildItem js\*.js | ForEach-Object { node --check $_.FullName }

# 2. Zero orphan references to the removed feature
Select-String -Path index.html,js\*.js -Pattern "<DB\.table>|<App\.fn>|page-<x>"

# 3. Serve locally and check it loads (npm.ps1 may be blocked → use npx)
npx serve -l 3000 .
```

No test framework exists in these projects; `node --check` + grep + a local
static server is the verification standard.

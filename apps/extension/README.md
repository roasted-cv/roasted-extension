# Copy JD (browser extension)

Adds a **Copy JD** item to the browser context menu. One click copies the full job
description from the current page to your clipboard. No backend, no API, no login, no AI —
everything runs locally in your browser.

If you have text selected, the selection is copied instead. Otherwise the description is
found through three layers, in order:

1. **JSON-LD** — `schema.org/JobPosting` `description` (LinkedIn, Indeed, hh.ru, Lever, Ashby, Workday).
2. **Site selectors / API** — known per-site DOM selectors and the Workday `cxs` JSON API
   (Greenhouse, Indeed, hh.ru, Workday, Apple, Stripe, ...).
3. **Readability** — Mozilla Readability as a universal fallback for any other career site.

Tiers 1–2 are deterministic; tier 3 is a stable reproducible fallback. All extraction logic
lives in [`@roasted/extractor`](../../packages/extractor).

## Permissions

`contextMenus`, `scripting`, `activeTab`. No broad host permissions: the content script is
injected on demand only into the tab you right-click, using the `activeTab` grant.

## Develop

From the repo root:

```bash
pnpm install
pnpm --filter @roasted/extractor build   # build the shared core first
pnpm --filter extension dev              # launches Chrome with the extension loaded
pnpm --filter extension dev:firefox      # Firefox
```

## Build & install unpacked

```bash
pnpm --filter extension build            # -> apps/extension/.output/chrome-mv3
pnpm --filter extension build:firefox    # -> apps/extension/.output/firefox-mv3
```

- **Chrome / Edge:** `chrome://extensions` → enable Developer mode → *Load unpacked* →
  select `apps/extension/.output/chrome-mv3`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* →
  select `manifest.json` inside `apps/extension/.output/firefox-mv3`.

## Test

The deterministic extraction logic is unit-tested in `@roasted/extractor`. This app ships an
end-to-end test that loads the built extension in a real (stealth) Chromium, drives the actual
`runCopyJD` → `scripting.executeScript` → content-script → clipboard path, and reads the
clipboard back:

```bash
pnpm --filter extension e2e
```

The e2e build (`-m e2e`) adds `host_permissions: ["<all_urls>"]` so automation can trigger
injection without a real user gesture. The production build never requests host permissions —
it relies on the context-menu click as the `activeTab` gesture.

Run it against any live job posting to reproduce the per-site coverage:

```bash
pnpm --filter extension build:e2e
node e2e/copy-jd.test.mjs --url "https://job-boards.greenhouse.io/anthropic/jobs/5023394008"
```

# Copy JD — browser extension

> One-click "Copy job description" for any career site.

Adds a **Copy JD** item to the browser context menu. One click copies the full job
description from the current page to your clipboard. No backend, no API, no login, no AI —
everything runs locally in your browser.

## How it works

If you have text selected, the selection is copied. Otherwise the description is found
through a fixed tier ladder — the first tier whose normalized text is long enough wins:

1. **JSON-LD** — `schema.org/JobPosting` `description` (LinkedIn, Indeed, hh.ru, Lever, Ashby, Workday, ...).
2. **Site API / DOM** — known per-host JSON APIs (Workday `cxs`) and DOM selectors (Greenhouse, Indeed, hh.ru, Workday, Apple, Stripe, ...).
3. **Readability** — Mozilla Readability as a universal fallback for any other career site.

Tiers 1–2 are deterministic; tier 3 is a stable reproducible fallback.

The extraction core lives in [`packages/extractor`](./packages/extractor) so it can be
reused by other apps without duplication.

## Install

> Chrome Web Store / Firefox AMO listings — coming soon.

Until then you can load an unpacked build:

```bash
pnpm install
pnpm --filter @roasted/extractor build
pnpm --filter extension build           # -> apps/extension/.output/chrome-mv3
pnpm --filter extension build:firefox   # -> apps/extension/.output/firefox-mv3
```

- **Chrome / Edge:** `chrome://extensions` → enable Developer mode → *Load unpacked* →
  select `apps/extension/.output/chrome-mv3`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* →
  select `manifest.json` inside `apps/extension/.output/firefox-mv3`.

## Permissions

`contextMenus`, `scripting`, `activeTab`. **No broad host permissions:** the content
script is injected on demand only into the tab you right-click, using the `activeTab`
grant. The extension never asks for access to your browsing history or other tabs.

## Repository layout

```
apps/extension/        WXT (MV3) browser extension.
packages/extractor/    Framework-agnostic JD-extraction core. Pure functions over a DOM.
```

`apps/extension` depends on `@roasted/extractor` via `workspace:*`. Build the core
before the extension.

## Develop

Requires Node ≥ 20 and `pnpm@10`.

```bash
pnpm install
pnpm --filter @roasted/extractor build   # build the shared core first
pnpm --filter extension dev              # launches Chrome with the extension loaded
pnpm --filter extension dev:firefox      # Firefox
```

Workspace scripts:

```bash
pnpm build       # build all packages
pnpm test        # unit tests (extractor)
pnpm typecheck   # tsc --noEmit across the workspace
pnpm e2e         # build extension in e2e mode and drive a real Chromium
```

## Adding a new site

The extractor's per-site rules live in [`packages/extractor/src/sites.ts`](./packages/extractor/src/sites.ts).
A `SiteRule` is `{ match(host), selectors?, api? }`. Add a fixture under
`packages/extractor/test/fixtures/` and a case in
`packages/extractor/test/extract.test.ts`, then run:

```bash
pnpm --filter @roasted/extractor test
```

## License

[MIT](./LICENSE).

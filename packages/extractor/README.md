# @roasted/extractor

Framework-agnostic core that deterministically extracts a job description (JD) from a page.
Consumed by `apps/extension` (and future apps), so the logic is never duplicated.

## Usage

```ts
import { extract } from "@roasted/extractor";

const result = await extract(document, {
  url: location.href,
  selection: window.getSelection()?.toString(),
  fetchJson: (url) => fetch(url, { headers: { Accept: "application/json" } }).then((r) => r.json()),
});
// result: { ok: boolean, tier: ExtractTier, text: string }
```

`extract(doc, options)` resolves in this order:

1. `selection` — a non-empty user selection wins over everything.
2. **site API** — for hosts with a JSON API (Workday `cxs`), tried before the DOM.
3. **JSON-LD** — `schema.org/JobPosting` `description` (handles arrays and `@graph`).
4. **site DOM selectors** — known per-site selectors (`sites.ts`).
5. **Readability** — Mozilla Readability fallback for any other page.

`text` is normalized to clean plain text (lists become `- ` lines, block tags become line
breaks, inline whitespace collapses). Returns `{ ok: false, tier: "none", text: "" }` when no
description meets `minLength` (default 40).

### Options

| option      | type                                  | default | meaning                                              |
| ----------- | ------------------------------------- | ------- | ---------------------------------------------------- |
| `url`       | `string`                              | doc URL | used for host matching and the Workday API URL       |
| `selection` | `string \| null`                      | `null`  | user-selected text; takes priority when non-empty    |
| `fetchJson` | `(url) => Promise<unknown>`           | —       | required to enable the Workday `cxs` API branch      |
| `minLength` | `number`                              | `40`    | minimum characters for a tier to be accepted         |

## Develop

```bash
pnpm --filter @roasted/extractor build      # tsc -> dist
pnpm --filter @roasted/extractor test       # vitest, fixtures in test/fixtures
pnpm --filter @roasted/extractor typecheck
```


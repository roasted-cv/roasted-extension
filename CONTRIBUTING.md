# Contributing

Thanks for taking a look. This is a small pnpm workspace with two packages.

## Setup

```bash
pnpm install
pnpm --filter @roasted/extractor build   # build the shared core first
```

Node ≥ 20, `pnpm@10`.

## Where things live

- `apps/extension/` — the WXT browser extension. UX and transport only.
- `packages/extractor/` — deterministic JD-extraction core. **All extraction logic
  belongs here**, never duplicated per app.

## Before opening a PR

```bash
pnpm typecheck
pnpm --filter @roasted/extractor test
```

If you add or fix a per-site rule, add a fixture under
`packages/extractor/test/fixtures/` and a case in
`packages/extractor/test/extract.test.ts` so the behavior is locked in.

## Reporting bugs

Include the URL (or a saved HTML snapshot), the browser/version, and what you
expected vs. what was copied.

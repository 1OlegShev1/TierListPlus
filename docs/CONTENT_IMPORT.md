# Content Import Pipeline

TierListPlus now supports a reusable content import pipeline with source connectors.

## Generic entrypoint

```bash
npm run import:content -- --source <SOURCE> [source options...]
```

PowerShell note (npm v10+): if flags are not forwarded, use one extra separator:

```bash
npm run import:content -- -- --source <SOURCE> [source options...]
```

Current sources:

- `anichart`
- `steam`

Get source-specific help:

```bash
npm run import:content -- --source anichart --help
npm run import:content -- --source steam --help
```

## Compatibility commands

Existing source-specific commands still work:

```bash
npm run import:anichart -- --year 2026
npm run import:steam -- --preset survival-friends
```

## Shared behavior

Both connectors support:

- JSON + CSV export to `scripts/output/...`
- Optional DB import with:
  - `--import-db`
  - `--creator-id <USER_ID>` (optional override)
  - `--public`
  - `--template-prefix <TXT>`

When `--import-db` is enabled, `DATABASE_URL` is required.

Import creator resolution order (when `--creator-id` is omitted):

1. `CONTENT_IMPORT_CREATOR_ID` env var
2. ADMIN user matching `CONTENT_IMPORT_CREATOR_NICKNAME` (default: `Host`)

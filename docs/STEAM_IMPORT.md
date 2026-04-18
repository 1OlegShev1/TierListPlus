# Steam Import

Import Steam game candidates into TierListPlus-ready JSON/CSV, with optional DB publish.

## Commands

Preset for survival-game ranking sessions:

```bash
npm run import:steam -- --preset survival-friends
```

PowerShell note (npm v10+): if flags are not forwarded, use:

```bash
npm run import:steam -- -- --preset survival-friends
```

Equivalent generic command:

```bash
npm run import:content -- --source steam --preset survival-friends
```

Custom genre example:

```bash
npm run import:steam -- --genre Survival --top 40 --min-reviews 1000 --min-positive-ratio 0.75
```

Import into DB:

```bash
npm run import:steam -- --preset survival-friends --import-db --creator-id <USER_ID>
```

`--creator-id` is optional. If omitted, the importer resolves a creator from:

1. `CONTENT_IMPORT_CREATOR_ID`
2. ADMIN user matching `CONTENT_IMPORT_CREATOR_NICKNAME` (default `Host`)

## Selection model (current)

- candidate source: SteamSpy genre endpoint
- enrichment: Steam Store `appdetails`
- filters:
  - full games only (`type=game`)
  - release is not coming soon
  - review floor (`--min-reviews`)
  - positivity floor (`--min-positive-ratio`)
  - optional release year (`--year`)
  - optional early-access exclusion (`--exclude-early-access`)
- ranking: Wilson-style review confidence + popularity signal (owners/ccu)

## Output

Each run writes:

- `<key>.json`
- `<key>.csv`

Default output directory:

- `scripts/output/steam`

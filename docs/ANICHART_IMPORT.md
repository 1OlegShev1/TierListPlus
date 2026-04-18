# AniChart Season Import

This project includes a script to fetch season entries using the same AniList GraphQL filters AniChart uses, then export list-ready files (JSON + CSV).  
Optional mode can also create templates directly in the local TierListPlus database.

## Commands

Export all four seasons for one year:

```bash
npm run import:anichart -- --year 2026
```

PowerShell note (npm v10+): if flags are not forwarded, use:

```bash
npm run import:anichart -- -- --year 2026
```

Equivalent generic pipeline command:

```bash
npm run import:content -- --source anichart --year 2026
```

Export specific seasons:

```bash
npm run import:anichart -- --season Winter-2026 --season Spring-2026
```

Export to a custom directory:

```bash
npm run import:anichart -- --year 2026 --out-dir scripts/output/my-anime-import
```

Create templates in DB (requires `DATABASE_URL`; `--creator-id` is optional override):

```bash
npm run import:anichart -- --year 2026 --import-db --creator-id <USER_ID>
```

Make imported templates public:

```bash
npm run import:anichart -- --year 2026 --import-db --creator-id <USER_ID> --public
```

If `--creator-id` is omitted, creator resolution uses:

1. `CONTENT_IMPORT_CREATOR_ID`
2. ADMIN user matching `CONTENT_IMPORT_CREATOR_NICKNAME` (default `Host`)

## Output format

For each season, the script writes:

- `<season>.json`
- `<season>.csv`

Each item includes:

- `label`
- `sourceUrl` (AniList URL opened by AniChart cards)
- `imageUrl` (cover image used by AniChart/AniList)
- `sourceNote`
- `sourceType`
- `anichartSeasonUrl`
- `cardTargetUrl`
- `anilistId`

## Note about per-entry AniChart URLs

AniChart does not currently expose a stable route like `/anime/<id>` for each card.  
The card target URL used by AniChart is typically AniList, so `sourceUrl` and `cardTargetUrl` use that destination.

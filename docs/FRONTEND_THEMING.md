# Frontend Theming Standard

## Goals

- Use semantic design tokens instead of raw palette utility classes for shared UI.
- Support `light`, `dark`, and `system` theme modes at the root level.
- Keep accent styling (for spaces) as a separate layer from base surface/foreground tokens.

## Root Theme Contract

Theme is controlled via the `data-theme` attribute on `<html>`:

- `data-theme="dark"`
- `data-theme="light"`
- `data-theme="system"` (resolved by `prefers-color-scheme`)

Current rollout status:
- App default is pinned to `dark` until hotspot screens are migrated to semantic tokens.
- `light` and `system` token sets are available but not yet enabled by default.

Root token definitions live in `src/app/globals.css`.

## Semantic Token Groups

- Surfaces: `--bg-canvas`, `--bg-surface`, `--bg-surface-hover`, `--bg-elevated`, `--bg-overlay`
- Foreground: `--fg-primary`, `--fg-secondary`, `--fg-muted`, `--fg-subtle`, `--fg-on-accent`
- Borders: `--border-default`, `--border-strong`, `--border-subtle`
- Actions: `--action-primary-*`, `--action-secondary-bg-hover`, `--action-danger-*`
- States: `--state-success-*`, `--state-danger-*`, `--state-muted-*`
- Focus/elevation: `--focus-ring`, `--shadow-card-hover`, `--shadow-card-hover-reduced`

## Migration Rules

- For shared and reusable components, do not add new raw utility classes like `bg-neutral-*` or `text-amber-*`.
- Use semantic token classes such as `bg-[var(--bg-surface)]` and `text-[var(--fg-primary)]`.
- Keep one-off brand/accent choices scoped and explicit.
- Avoid new hardcoded hex colors in frontend UI components unless the value is user data (for example tier colors).

## Staged Refactor Plan

1. Foundation (completed)
- Added root semantic tokens for dark/light/system.
- Switched app root from hardcoded `.dark` class to `data-theme` (currently defaulted to `dark`).
- Updated global hover/elevation and scrollbar styles to rely on tokens.

2. Primitive layer (in progress)
- Migrated core shared primitives and shell pieces:
  - `src/components/ui/Button.tsx`
  - `src/components/ui/Input.tsx`
  - `src/components/ui/Textarea.tsx`
  - `src/components/ui/Select.tsx`
  - `src/components/ui/ConfirmDialog.tsx`
  - `src/components/ui/StatusBadge.tsx`
  - `src/components/layout/NavBar.tsx`
  - `src/components/sessions/NewVoteForm.tsx`

3. Hotspot screens (completed)
- Migrate highest-usage files first:
  - `src/components/items/ItemSourceModal.tsx` (completed)
  - `src/components/dashboard/RecoverySection.tsx` (completed)
  - `src/components/sessions/ShareVoteButton.tsx` (completed)
  - `src/components/spaces/SpaceSettingsPanel.tsx` (completed)
  - `src/components/spaces/SpaceInvitePanel.tsx` (completed)
  - `src/app/spaces/page.tsx` (completed)
  - `src/app/spaces/[spaceId]/page.tsx` (completed)
  - `src/app/sessions/[sessionId]/results/BrowsePanel.tsx` (completed)
  - `src/components/dashboard/LinkedBrowsersSection.tsx` (completed)
  - `src/app/sessions/[sessionId]/results/EveryoneResultsSection.tsx` (completed)
  - `src/components/tierlist/TierListBoard.tsx` (completed)
  - `src/components/tierlist/DraggableItem.tsx` (completed)
  - `src/components/tierlist/TierRow.tsx` (completed)
  - `src/components/tierlist/TierRowActions.tsx` (completed)
  - `src/components/tierlist/EditableUnrankedItemCard.tsx` (completed)
  - `src/components/tierlist/UnrankedPool.tsx` (completed)
  - `src/components/bracket/BracketModal.tsx` (completed)
  - `src/components/ui/ListPreviewCard.tsx` (completed)
  - `src/components/ui/JoinCodeBanner.tsx` (completed)
  - `src/components/templates/StartVoteFromTemplateButton.tsx` (completed)
  - `src/components/spaces/CreateSpaceForm.tsx` (completed)
  - `src/app/sessions/[sessionId]/results/ResultsTierGrid.tsx` (completed)
  - `src/app/sessions/[sessionId]/results/ResultsPageClient.tsx` (completed)
  - `src/components/shared/ImageUploader.tsx` (completed)
  - `src/components/templates/ListEditor.tsx` (completed)
  - `src/components/home/HomeContent.tsx` (completed)
  - `src/app/sessions/join/JoinVotePageClient.tsx` (completed)
  - `src/components/ui/VotePreviewSummary.tsx` (completed)
  - `src/components/ui/ErrorMessage.tsx` (completed)
  - `src/components/ui/Loading.tsx` (completed)
  - `src/components/ui/EmptyState.tsx` (completed)
  - `src/components/ui/PageHeader.tsx` (completed)
  - `src/components/ui/SectionHeader.tsx` (completed)
  - `src/components/ui/ItemArtwork.tsx` (completed)
  - `src/components/ui/ItemPreview.tsx` (completed)
  - `src/components/sessions/CloseVoteButton.tsx` (completed)
  - `src/components/sessions/ReopenVoteButton.tsx` (completed)
  - `src/components/sessions/DeleteVoteButton.tsx` (completed)
  - `src/components/spaces/SpaceActionPanel.tsx` (completed)
  - `src/components/spaces/JoinSpaceByCodeForm.tsx` (completed)
  - `src/components/spaces/RemoveSpaceMemberButton.tsx` (completed)
  - `src/components/templates/ListDetailItemsGrid.tsx` (completed)
  - `src/components/templates/DeleteListButton.tsx` (completed)
  - `src/components/bracket/MatchupVoter.tsx` (completed)
  - `src/components/tierlist/TierColorPicker.tsx` (completed)
  - `src/app/sessions/[sessionId]/vote/VotePageClient.tsx` (completed)
  - `src/app/sessions/[sessionId]/vote/page.tsx` (completed)
  - `src/app/sessions/[sessionId]/results/BrowseResultsSection.tsx` (completed)
  - `src/app/templates/page.tsx` (completed)
  - `src/app/templates/[templateId]/page.tsx` (completed)
  - `src/app/sessions/page.tsx` (completed)
  - `src/app/spaces/[spaceId]/templates/import/page.tsx` (completed)

4. Accent layer (completed)
- Refactored `src/lib/space-theme.ts` accent output to avoid raw palette utility classes and compose with the semantic base surface/foreground tokens.

5. Enforcement (next)
- Add a lightweight lint/check script to flag new raw palette utilities and unapproved hardcoded colors in frontend components.

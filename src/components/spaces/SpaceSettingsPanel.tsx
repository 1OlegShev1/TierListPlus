"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ImageUploader, type UploadedImage } from "@/components/shared/ImageUploader";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { apiPatch, getErrorMessage, tryCleanupUnattachedUpload } from "@/lib/api-client";
import { getSpaceAccentClasses, SPACE_ACCENT_OPTIONS } from "@/lib/space-theme";

interface SpaceSettingsPanelProps {
  spaceId: string;
  initialName: string;
  initialDescription: string | null;
  initialLogoUrl: string | null;
  initialAccentColor: "SLATE" | "AMBER" | "SKY" | "EMERALD" | "ROSE";
  initialVisibility: "PRIVATE" | "OPEN";
}

export function SpaceSettingsPanel({
  spaceId,
  initialName,
  initialDescription,
  initialLogoUrl,
  initialAccentColor,
  initialVisibility,
}: SpaceSettingsPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [accentColor, setAccentColor] = useState<"SLATE" | "AMBER" | "SKY" | "EMERALD" | "ROSE">(
    initialAccentColor,
  );
  const [visibility, setVisibility] = useState<"PRIVATE" | "OPEN">(initialVisibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialDescriptionNormalized = (initialDescription ?? "").trim();
  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedDescription = useMemo(() => description.trim(), [description]);

  const isDirty =
    trimmedName !== initialName ||
    trimmedDescription !== initialDescriptionNormalized ||
    logoUrl !== initialLogoUrl ||
    accentColor !== initialAccentColor ||
    visibility !== initialVisibility;

  const canSave = !saving && trimmedName.length > 0 && isDirty;
  const accent = getSpaceAccentClasses(accentColor);
  const nameInitial = trimmedName.charAt(0).toUpperCase() || "?";

  const cleanupUploadedLogo = useCallback(async (url: string) => {
    await tryCleanupUnattachedUpload(url, "space settings cleanup");
  }, []);

  const resetDraftState = () => {
    setName(initialName);
    setDescription(initialDescription ?? "");
    setLogoUrl(initialLogoUrl);
    setAccentColor(initialAccentColor);
    setVisibility(initialVisibility);
    setError(null);
  };

  const cancel = async () => {
    if (saving) return;
    if (logoUrl && logoUrl !== initialLogoUrl) {
      await cleanupUploadedLogo(logoUrl);
    }
    resetDraftState();
    setMode("view");
  };

  const onUploadedLogo = async (image: UploadedImage) => {
    setError(null);

    if (logoUrl && logoUrl !== initialLogoUrl && logoUrl !== image.url) {
      await cleanupUploadedLogo(logoUrl);
    }

    setLogoUrl(image.url);
  };

  const removeLogo = async () => {
    if (!logoUrl || saving) return;

    if (logoUrl !== initialLogoUrl) {
      await cleanupUploadedLogo(logoUrl);
    }

    setLogoUrl(null);
    setError(null);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await apiPatch(`/api/spaces/${spaceId}`, {
        name: trimmedName,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        logoUrl,
        accentColor,
        visibility,
      });
      setMode("view");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update this space"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className={`pointer-events-none absolute inset-0 ${accent.glowClassName}`} />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-100">Space Settings</h3>
          {mode === "view" ? (
            <Button
              variant="secondary"
              onClick={() => setMode("edit")}
              className="!px-3 !py-1.5 !text-sm"
            >
              Edit
            </Button>
          ) : null}
        </div>

        {mode === "view" ? (
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${initialName} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-neutral-400">{nameInitial}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-neutral-100">{initialName}</p>
                <p className="mt-1 inline-flex rounded-full border border-neutral-700 px-2 py-0.5 text-[0.67rem] uppercase tracking-[0.11em] text-neutral-300">
                  {initialVisibility === "OPEN" ? "Open" : "Private"}
                </p>
              </div>
            </div>
            {initialDescription ? (
              <p className="text-neutral-300">{initialDescription}</p>
            ) : (
              <p className="text-neutral-500">No description yet.</p>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${trimmedName || "Space"} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-neutral-400">{nameInitial}</span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <ImageUploader
                  onUploaded={onUploadedLogo}
                  uploadVariant="space_logo"
                  compact
                  idleLabel="Upload logo"
                  className="w-auto"
                />
                <Button
                  variant="secondary"
                  onClick={removeLogo}
                  disabled={!logoUrl || saving}
                  className="!px-3 !py-2 !text-sm"
                >
                  Remove logo
                </Button>
              </div>
            </div>

            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Space name"
            />

            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={280}
              rows={3}
              placeholder="A short description for people browsing this space"
            />

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
                Card accent
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {SPACE_ACCENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAccentColor(option.value)}
                    className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      accentColor === option.value
                        ? "border-neutral-300 bg-neutral-100 text-neutral-900"
                        : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${option.colorClassName}`} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <fieldset className="inline-flex h-11 rounded-lg border border-neutral-700 bg-neutral-950/60 p-1">
              <legend className="sr-only">Space visibility</legend>
              <label
                className={`flex min-w-[5.25rem] cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-colors ${
                  visibility === "PRIVATE"
                    ? "bg-amber-500/15 text-amber-300"
                    : "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
                }`}
              >
                <input
                  type="radio"
                  name={`space-visibility-${spaceId}`}
                  value="PRIVATE"
                  checked={visibility === "PRIVATE"}
                  onChange={() => setVisibility("PRIVATE")}
                  className="sr-only"
                />
                Private
              </label>
              <label
                className={`flex min-w-[5.25rem] cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-colors ${
                  visibility === "OPEN"
                    ? "bg-amber-500/15 text-amber-300"
                    : "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
                }`}
              >
                <input
                  type="radio"
                  name={`space-visibility-${spaceId}`}
                  value="OPEN"
                  checked={visibility === "OPEN"}
                  onChange={() => setVisibility("OPEN")}
                  className="sr-only"
                />
                Open
              </label>
            </fieldset>

            <p className="text-xs text-neutral-500">
              Open spaces are discoverable and allow voting from non-members.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={save} disabled={!canSave} className="!px-4 !py-2 !text-sm">
                {saving ? "Saving..." : "Save changes"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void cancel();
                }}
                disabled={saving}
                className="!px-3 !py-2 !text-sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3">
            <ErrorMessage message={error} />
          </div>
        )}
      </div>
    </div>
  );
}

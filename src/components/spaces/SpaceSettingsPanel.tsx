"use client";

import type { SpaceAccentColor } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ImageUploader, type UploadedImage } from "@/components/shared/ImageUploader";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { apiPatch, getErrorMessage, tryCleanupUnattachedUpload } from "@/lib/api-client";
import { getSpaceAccentClasses, SPACE_ACCENT_OPTIONS } from "@/lib/space-theme";
import { cn } from "@/lib/utils";

interface SpaceSettingsPanelProps {
  spaceId: string;
  initialName: string;
  initialDescription: string | null;
  initialLogoUrl: string | null;
  initialAccentColor: SpaceAccentColor;
  initialVisibility: "PRIVATE" | "OPEN";
  className?: string;
  showHeader?: boolean;
  defaultMode?: "view" | "edit";
  closeHref?: string;
}

export function SpaceSettingsPanel({
  spaceId,
  initialName,
  initialDescription,
  initialLogoUrl,
  initialAccentColor,
  initialVisibility,
  className,
  showHeader = true,
  defaultMode = "view",
  closeHref,
}: SpaceSettingsPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">(defaultMode);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [accentColor, setAccentColor] = useState<SpaceAccentColor>(initialAccentColor);
  const [visibility, setVisibility] = useState<"PRIVATE" | "OPEN">(initialVisibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const accentPickerRef = useRef<HTMLDivElement>(null);
  const accentPickerId = useId();

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
  const selectedAccentOption = SPACE_ACCENT_OPTIONS.find((option) => option.value === accentColor);
  const contentSpacingClass = showHeader ? "mt-3" : "";
  const canToggleMode = showHeader;
  const closeSettingsHref = closeHref ?? `/spaces/${spaceId}`;
  const closeModalView = useCallback(() => {
    if (typeof window === "undefined") return;
    router.replace(closeSettingsHref);
    router.refresh();
  }, [closeSettingsHref, router]);

  useEffect(() => {
    if (!accentPickerOpen) return;
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (accentPickerRef.current?.contains(event.target as Node)) return;
      setAccentPickerOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setAccentPickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [accentPickerOpen]);

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
    if (canToggleMode) {
      setMode("view");
    } else {
      closeModalView();
    }
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
    let keepBusyUntilUnmount = false;
    try {
      await apiPatch(`/api/spaces/${spaceId}`, {
        name: trimmedName,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        logoUrl,
        accentColor,
        visibility,
      });
      if (canToggleMode) {
        setMode("view");
        router.refresh();
      } else {
        keepBusyUntilUnmount = true;
        closeModalView();
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not update this space"));
    } finally {
      if (!keepBusyUntilUnmount) {
        setSaving(false);
      }
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-visible rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5",
        className,
      )}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-44 opacity-75 ${accent.glowClassName}`}
      />
      <div className="relative">
        {showHeader ? (
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
        ) : null}

        {mode === "view" ? (
          <div className={`${contentSpacingClass} space-y-3 text-sm`}>
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
          <div className={`${contentSpacingClass} space-y-4`}>
            <div className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start">
              <div className="flex flex-col items-center space-y-2.5">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950">
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
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <ImageUploader
                    onUploaded={onUploadedLogo}
                    uploadVariant="space_logo"
                    compact
                    idleLabel={logoUrl ? "Replace" : "Upload logo"}
                    className="w-auto"
                  />
                  {logoUrl ? (
                    <Button
                      variant="secondary"
                      onClick={removeLogo}
                      disabled={saving}
                      className="!px-3 !py-2 !text-sm"
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Space name"
                  className="w-full"
                />

                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={280}
                  rows={3}
                  placeholder="A short description for people browsing this space"
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
                  Card accent
                </p>
                <div ref={accentPickerRef} className="relative inline-flex">
                  <button
                    type="button"
                    onClick={() => setAccentPickerOpen((prev) => !prev)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950/70 hover:border-neutral-500"
                    aria-label="Pick card accent color"
                    aria-expanded={accentPickerOpen}
                    aria-controls={accentPickerOpen ? accentPickerId : undefined}
                  >
                    <span
                      className={`h-6 w-6 rounded-full ${selectedAccentOption?.colorClassName ?? "bg-neutral-400"}`}
                    />
                  </button>
                  {accentPickerOpen ? (
                    <div
                      id={accentPickerId}
                      className="absolute bottom-full left-0 z-[70] mb-2 w-[13.5rem] rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-lg"
                    >
                      <p className="mb-2 text-xs text-neutral-500">Choose accent</p>
                      <div className="grid grid-cols-5 gap-2">
                        {SPACE_ACCENT_OPTIONS.map((swatch) => (
                          <button
                            key={swatch.value}
                            type="button"
                            onClick={() => {
                              setAccentColor(swatch.value);
                              setAccentPickerOpen(false);
                            }}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                              accentColor === swatch.value
                                ? "border-neutral-200"
                                : "border-neutral-700 hover:border-neutral-500"
                            }`}
                            aria-label={`Set accent to ${swatch.label}`}
                            title={swatch.label}
                          >
                            <span className={`h-5 w-5 rounded-full ${swatch.colorClassName}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
                  Visibility
                </p>
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
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={save}
                disabled={!canSave}
                className="min-w-[8.5rem] !px-4 !py-2 !text-sm"
              >
                Save changes
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

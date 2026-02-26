"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_TIER_CONFIG, deriveTierKeys } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { TierConfigEditor } from "./TierConfigEditor";
import { apiFetch, apiPost, getErrorMessage } from "@/lib/api-client";
import type { TierConfig, TemplateSummary } from "@/types";

export function NewSessionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedTemplateId = searchParams.get("templateId");

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState(preselectedTemplateId ?? "");
  const [name, setName] = useState("");
  const [tierConfig, setTierConfig] = useState<TierConfig[]>(DEFAULT_TIER_CONFIG);
  const [bracketEnabled, setBracketEnabled] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<TemplateSummary[]>("/api/templates").then(setTemplates).catch(() => {});
  }, []);

  const create = async () => {
    if (!templateId || !name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const data = await apiPost<{ id: string }>("/api/sessions", {
        templateId,
        name,
        tierConfig: deriveTierKeys(tierConfig),
        bracketEnabled,
      });
      router.push(`/sessions/${data.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create session"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Start a Session</h1>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-400">
            Template
          </label>
          <Select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full"
          >
            <option value="">Select a template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t._count.items} items)
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-400">
            Session Name
          </label>
          <Input
            type="text"
            placeholder="e.g., Friday Rankings"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-3 block text-sm font-medium text-neutral-400">
            Tier Rows
          </label>
          <TierConfigEditor
            initialConfig={tierConfig}
            onChange={setTierConfig}
          />
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <input
            type="checkbox"
            checked={bracketEnabled}
            onChange={(e) => setBracketEnabled(e.target.checked)}
            className="h-4 w-4 accent-amber-500"
          />
          <div>
            <p className="font-medium">Enable bracket voting</p>
            <p className="text-sm text-neutral-500">
              1v1 matchups before tier ranking to reduce bias
            </p>
          </div>
        </label>

        {error && <ErrorMessage message={error} />}

        <div className="flex gap-3">
          <Button onClick={create} disabled={creating || !templateId || !name.trim()}>
            {creating ? "Creating..." : "Create Session"}
          </Button>
          <Button variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

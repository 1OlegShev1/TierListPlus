"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";
import { saveLocalUserId } from "@/lib/device-identity";

export function RecoverySection() {
  const { userId } = useUser();
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [copied, setCopied] = useState(false);

  // Link device form
  const [linkCode, setLinkCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linked, setLinked] = useState(false);

  const generateCode = async () => {
    if (!userId) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const data = await apiPost<{ recoveryCode: string }>(`/api/users/${userId}/recovery`, {});
      setRecoveryCode(data.recoveryCode);
    } catch (err) {
      setGenerateError(getErrorMessage(err, "Failed to generate recovery code"));
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = () => {
    if (!recoveryCode) return;
    navigator.clipboard.writeText(recoveryCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const linkDevice = async () => {
    if (!linkCode.trim()) return;
    setLinking(true);
    setLinkError("");
    try {
      const data = await apiPost<{ userId: string }>("/api/users/recover", {
        recoveryCode: linkCode.trim(),
      });
      saveLocalUserId(data.userId);
      setLinked(true);
      // Reload to refresh dashboard with new identity
      window.location.reload();
    } catch (err) {
      setLinkError(getErrorMessage(err, "Invalid recovery code"));
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="mb-4 text-lg font-semibold text-neutral-300">Cross-Device Sync</h2>

      {/* Generate recovery code */}
      <div className="mb-6">
        <p className="mb-3 text-sm text-neutral-400">
          Generate a recovery code to access your data on another device.
        </p>
        {recoveryCode ? (
          <div className="flex items-center gap-3">
            <code className="rounded-lg bg-neutral-800 px-4 py-2 font-mono text-lg tracking-wider text-amber-400">
              {recoveryCode}
            </code>
            <Button variant="secondary" onClick={copyCode} className="cursor-pointer px-4">
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={generateCode} disabled={generating || !userId}>
            {generating ? "Generating..." : "Generate Recovery Code"}
          </Button>
        )}
        {generateError && <ErrorMessage message={generateError} />}
      </div>

      {/* Link existing device */}
      <div className="border-t border-neutral-800 pt-6">
        <p className="mb-3 text-sm text-neutral-400">
          Have a recovery code from another device? Enter it to link this device.
        </p>
        {linked ? (
          <p className="text-sm text-green-400">Device linked successfully! Reloading...</p>
        ) : (
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="e.g., TIGER-MAPLE-RIVER-42"
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
              className="flex-1 font-mono tracking-wider"
            />
            <Button variant="secondary" onClick={linkDevice} disabled={linking || !linkCode.trim()}>
              {linking ? "Linking..." : "Link Device"}
            </Button>
          </div>
        )}
        {linkError && <ErrorMessage message={linkError} />}
      </div>
    </div>
  );
}

"use client";

import { QuickStartVoteButton } from "@/components/sessions/QuickStartVoteButton";

interface StartVoteFromTemplateButtonProps {
  templateId: string;
  templateName: string;
  spaceId?: string | null;
  initialNickname?: string | null;
}

export function StartVoteFromTemplateButton({
  templateId,
  templateName,
  spaceId = null,
  initialNickname = null,
}: StartVoteFromTemplateButtonProps) {
  return (
    <QuickStartVoteButton
      templateId={templateId}
      initialVoteName={templateName}
      spaceId={spaceId}
      initialNickname={initialNickname}
      label="Start Ranking From List"
    />
  );
}

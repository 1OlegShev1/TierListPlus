-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tierConfig" JSONB NOT NULL,
    "bracketEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "templateItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SessionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierVote" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "sessionItemId" TEXT NOT NULL,
    "tierKey" TEXT NOT NULL,
    "rankInTier" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TierVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bracket" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketMatchup" (
    "id" TEXT NOT NULL,
    "bracketId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "itemAId" TEXT,
    "itemBId" TEXT,
    "winnerId" TEXT,

    CONSTRAINT "BracketMatchup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketVote" (
    "id" TEXT NOT NULL,
    "matchupId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "chosenItemId" TEXT NOT NULL,

    CONSTRAINT "BracketVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateItem_templateId_idx" ON "TemplateItem"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_joinCode_key" ON "Session"("joinCode");

-- CreateIndex
CREATE INDEX "Session_joinCode_idx" ON "Session"("joinCode");

-- CreateIndex
CREATE INDEX "Session_templateId_idx" ON "Session"("templateId");

-- CreateIndex
CREATE INDEX "SessionItem_sessionId_idx" ON "SessionItem"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionItem_sessionId_templateItemId_key" ON "SessionItem"("sessionId", "templateItemId");

-- CreateIndex
CREATE INDEX "Participant_sessionId_idx" ON "Participant"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_sessionId_nickname_key" ON "Participant"("sessionId", "nickname");

-- CreateIndex
CREATE INDEX "TierVote_participantId_idx" ON "TierVote"("participantId");

-- CreateIndex
CREATE INDEX "TierVote_sessionItemId_idx" ON "TierVote"("sessionItemId");

-- CreateIndex
CREATE UNIQUE INDEX "TierVote_participantId_sessionItemId_key" ON "TierVote"("participantId", "sessionItemId");

-- CreateIndex
CREATE INDEX "Bracket_sessionId_idx" ON "Bracket"("sessionId");

-- CreateIndex
CREATE INDEX "BracketMatchup_bracketId_round_idx" ON "BracketMatchup"("bracketId", "round");

-- CreateIndex
CREATE INDEX "BracketVote_matchupId_idx" ON "BracketVote"("matchupId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketVote_matchupId_participantId_key" ON "BracketVote"("matchupId", "participantId");

-- AddForeignKey
ALTER TABLE "TemplateItem" ADD CONSTRAINT "TemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItem" ADD CONSTRAINT "SessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItem" ADD CONSTRAINT "SessionItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "TemplateItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierVote" ADD CONSTRAINT "TierVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierVote" ADD CONSTRAINT "TierVote_sessionItemId_fkey" FOREIGN KEY ("sessionItemId") REFERENCES "SessionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bracket" ADD CONSTRAINT "Bracket_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketMatchup" ADD CONSTRAINT "BracketMatchup_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketMatchup" ADD CONSTRAINT "BracketMatchup_itemAId_fkey" FOREIGN KEY ("itemAId") REFERENCES "SessionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketMatchup" ADD CONSTRAINT "BracketMatchup_itemBId_fkey" FOREIGN KEY ("itemBId") REFERENCES "SessionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketMatchup" ADD CONSTRAINT "BracketMatchup_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "SessionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketVote" ADD CONSTRAINT "BracketVote_matchupId_fkey" FOREIGN KEY ("matchupId") REFERENCES "BracketMatchup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketVote" ADD CONSTRAINT "BracketVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

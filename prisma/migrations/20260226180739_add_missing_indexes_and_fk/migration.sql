-- CreateIndex
CREATE INDEX "BracketMatchup_itemAId_idx" ON "BracketMatchup"("itemAId");

-- CreateIndex
CREATE INDEX "BracketMatchup_itemBId_idx" ON "BracketMatchup"("itemBId");

-- CreateIndex
CREATE INDEX "BracketMatchup_winnerId_idx" ON "BracketMatchup"("winnerId");

-- CreateIndex
CREATE INDEX "BracketVote_chosenItemId_idx" ON "BracketVote"("chosenItemId");

-- CreateIndex
CREATE INDEX "SessionItem_templateItemId_idx" ON "SessionItem"("templateItemId");

-- AddForeignKey
ALTER TABLE "BracketVote" ADD CONSTRAINT "BracketVote_chosenItemId_fkey" FOREIGN KEY ("chosenItemId") REFERENCES "SessionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

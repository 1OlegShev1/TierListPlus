CREATE TYPE "SpaceVisibility" AS ENUM ('PRIVATE', 'OPEN');
CREATE TYPE "SpaceRole" AS ENUM ('OWNER', 'MEMBER');

CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" "SpaceVisibility" NOT NULL DEFAULT 'PRIVATE',
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpaceMember" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SpaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpaceInvite" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceInvite_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Template" ADD COLUMN "spaceId" TEXT;
ALTER TABLE "Session" ADD COLUMN "spaceId" TEXT;

CREATE INDEX "Space_creatorId_idx" ON "Space"("creatorId");
CREATE INDEX "Space_visibility_idx" ON "Space"("visibility");
CREATE UNIQUE INDEX "SpaceMember_spaceId_userId_key" ON "SpaceMember"("spaceId", "userId");
CREATE INDEX "SpaceMember_spaceId_idx" ON "SpaceMember"("spaceId");
CREATE INDEX "SpaceMember_userId_idx" ON "SpaceMember"("userId");
CREATE UNIQUE INDEX "SpaceInvite_code_key" ON "SpaceInvite"("code");
CREATE INDEX "SpaceInvite_spaceId_idx" ON "SpaceInvite"("spaceId");
CREATE INDEX "SpaceInvite_spaceId_expiresAt_revokedAt_idx" ON "SpaceInvite"("spaceId", "expiresAt", "revokedAt");
CREATE INDEX "Template_spaceId_updatedAt_idx" ON "Template"("spaceId", "updatedAt");
CREATE INDEX "Session_spaceId_status_updatedAt_idx" ON "Session"("spaceId", "status", "updatedAt");

ALTER TABLE "Space" ADD CONSTRAINT "Space_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpaceInvite" ADD CONSTRAINT "SpaceInvite_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpaceInvite" ADD CONSTRAINT "SpaceInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Template" ADD CONSTRAINT "Template_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

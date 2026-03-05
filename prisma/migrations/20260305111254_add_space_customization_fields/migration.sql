-- CreateEnum
CREATE TYPE "SpaceAccentColor" AS ENUM ('SLATE', 'AMBER', 'SKY', 'EMERALD', 'ROSE');

-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "accentColor" "SpaceAccentColor" NOT NULL DEFAULT 'SLATE',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "logoUrl" TEXT;

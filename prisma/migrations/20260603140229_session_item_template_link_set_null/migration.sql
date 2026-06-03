-- DropForeignKey
ALTER TABLE "SessionItem" DROP CONSTRAINT "SessionItem_templateItemId_fkey";

-- AlterTable
ALTER TABLE "SessionItem" ALTER COLUMN "templateItemId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SessionItem" ADD CONSTRAINT "SessionItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "TemplateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

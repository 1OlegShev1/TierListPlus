-- Add global user roles for admin/moderation capabilities.
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

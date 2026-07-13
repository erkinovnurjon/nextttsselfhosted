-- Ovozlar kutubxonasi: bitta-slot (userId unique) -> ko'p ovoz, majburiy nom + ixtiyoriy rasm.
-- Mavjud qatorlar DEFAULT bilan "Mening ovozim" nomini oladi (schema'da ham @default).

-- DropIndex
DROP INDEX "UserVoice_userId_key";

-- AlterTable
ALTER TABLE "UserVoice" ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Mening ovozim';

-- CreateIndex
CREATE INDEX "UserVoice_userId_createdAt_idx" ON "UserVoice"("userId", "createdAt");

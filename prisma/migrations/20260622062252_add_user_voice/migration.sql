-- CreateTable
CREATE TABLE "UserVoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refPath" TEXT NOT NULL,
    "refText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "durationSec" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserVoice_userId_key" ON "UserVoice"("userId");

-- AddForeignKey
ALTER TABLE "UserVoice" ADD CONSTRAINT "UserVoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

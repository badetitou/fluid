-- AlterTable
ALTER TABLE "SourceConfig" ADD COLUMN "oauthIssuer" TEXT,
ADD COLUMN "oauthClientId" TEXT,
ADD COLUMN "oauthClientSecret" TEXT,
ADD COLUMN "oauthScopes" TEXT,
ADD COLUMN "oauthResource" TEXT;

-- CreateTable
CREATE TABLE "OAuthCredential" (
    "sourceId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthCredential_pkey" PRIMARY KEY ("sourceId")
);

-- AddForeignKey
ALTER TABLE "OAuthCredential" ADD CONSTRAINT "OAuthCredential_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

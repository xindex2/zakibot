/*
  Warnings:

  - You are about to drop the column `channel` on the `BotConfig` table. All the data in the column will be lost.
  - You are about to drop the column `channelId` on the `BotConfig` table. All the data in the column will be lost.
  - You are about to drop the column `channelToken` on the `BotConfig` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BotConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openrouter',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "apiBase" TEXT,
    "model" TEXT NOT NULL DEFAULT 'anthropic/claude-opus-4-5',
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "telegramToken" TEXT,
    "discordEnabled" BOOLEAN NOT NULL DEFAULT false,
    "discordToken" TEXT,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "feishuEnabled" BOOLEAN NOT NULL DEFAULT false,
    "feishuAppId" TEXT,
    "feishuAppSecret" TEXT,
    "webSearchApiKey" TEXT,
    "githubToken" TEXT,
    "browserEnabled" BOOLEAN NOT NULL DEFAULT true,
    "shellEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'stopped',
    "lastRun" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BotConfig" ("apiKey", "createdAt", "id", "lastRun", "model", "provider", "status", "updatedAt", "userId") SELECT "apiKey", "createdAt", "id", "lastRun", coalesce("model", 'anthropic/claude-opus-4-5') AS "model", "provider", "status", "updatedAt", "userId" FROM "BotConfig";
DROP TABLE "BotConfig";
ALTER TABLE "new_BotConfig" RENAME TO "BotConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

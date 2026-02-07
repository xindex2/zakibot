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
    "restrictToWorkspace" BOOLEAN NOT NULL DEFAULT false,
    "gatewayHost" TEXT NOT NULL DEFAULT '0.0.0.0',
    "gatewayPort" INTEGER NOT NULL DEFAULT 18790,
    "maxToolIterations" INTEGER NOT NULL DEFAULT 20,
    "status" TEXT NOT NULL DEFAULT 'stopped',
    "lastRun" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BotConfig" ("apiBase", "apiKey", "browserEnabled", "createdAt", "discordEnabled", "discordToken", "feishuAppId", "feishuAppSecret", "feishuEnabled", "githubToken", "id", "lastRun", "model", "provider", "shellEnabled", "status", "telegramEnabled", "telegramToken", "updatedAt", "userId", "webSearchApiKey", "whatsappEnabled") SELECT "apiBase", "apiKey", "browserEnabled", "createdAt", "discordEnabled", "discordToken", "feishuAppId", "feishuAppSecret", "feishuEnabled", "githubToken", "id", "lastRun", "model", "provider", "shellEnabled", "status", "telegramEnabled", "telegramToken", "updatedAt", "userId", "webSearchApiKey", "whatsappEnabled" FROM "BotConfig";
DROP TABLE "BotConfig";
ALTER TABLE "new_BotConfig" RENAME TO "BotConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

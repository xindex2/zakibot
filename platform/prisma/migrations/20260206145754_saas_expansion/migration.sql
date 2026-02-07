-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'Free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "maxInstances" INTEGER NOT NULL DEFAULT 1,
    "whopMembershipId" TEXT,
    "whopPlanId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhopEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "whopUserId" TEXT,
    "email" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BotConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'New Agent',
    "description" TEXT,
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
    CONSTRAINT "BotConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BotConfig" ("apiBase", "apiKey", "browserEnabled", "createdAt", "description", "discordEnabled", "discordToken", "feishuAppId", "feishuAppSecret", "feishuEnabled", "gatewayHost", "gatewayPort", "githubToken", "id", "lastRun", "maxToolIterations", "model", "name", "provider", "restrictToWorkspace", "shellEnabled", "status", "telegramEnabled", "telegramToken", "updatedAt", "userId", "webSearchApiKey", "whatsappEnabled") SELECT "apiBase", "apiKey", "browserEnabled", "createdAt", "description", "discordEnabled", "discordToken", "feishuAppId", "feishuAppSecret", "feishuEnabled", "gatewayHost", "gatewayPort", "githubToken", "id", "lastRun", "maxToolIterations", "model", "name", "provider", "restrictToWorkspace", "shellEnabled", "status", "telegramEnabled", "telegramToken", "updatedAt", "userId", "webSearchApiKey", "whatsappEnabled" FROM "BotConfig";
DROP TABLE "BotConfig";
ALTER TABLE "new_BotConfig" RENAME TO "BotConfig";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "acquisition_source" TEXT DEFAULT 'Direct',
    "whop_user_id" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "password", "updatedAt") SELECT "createdAt", "email", "id", "password", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_whop_user_id_key" ON "User"("whop_user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_whopMembershipId_key" ON "Subscription"("whopMembershipId");

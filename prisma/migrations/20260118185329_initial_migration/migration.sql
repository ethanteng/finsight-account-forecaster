-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "itemId" TEXT,
    "lastRefreshed" TIMESTAMP(3),
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "lastChecked" TIMESTAMP(3),
    "institutionName" TEXT,
    "transactionSyncCursor" TEXT,
    "lastTransactionSync" TIMESTAMP(3),

    CONSTRAINT "access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "plaidAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "mask" TEXT,
    "officialName" TEXT,
    "currentBalance" DOUBLE PRECISION,
    "availableBalance" DOUBLE PRECISION,
    "currency" TEXT,
    "institution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSynced" TIMESTAMP(3),
    "balanceLastFetched" TIMESTAMP(3),
    "userId" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "plaidTransactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "pending" BOOLEAN NOT NULL,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSynced" TIMESTAMP(3),
    "authorizedDate" TIMESTAMP(3),
    "categoryId" TEXT,
    "checkNumber" TEXT,
    "location" TEXT,
    "merchantName" TEXT,
    "originalDescription" TEXT,
    "paymentChannel" TEXT,
    "paymentMethod" TEXT,
    "pendingTransactionId" TEXT,
    "enriched_data" JSONB,
    "userId" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_patterns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "merchantName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "amountVariance" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "frequency" TEXT NOT NULL,
    "dayOfMonth" INTEGER,
    "dayOfWeek" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "transactionType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "recurringPatternId" TEXT,
    "forecastId" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecast_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "forecastDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "initialBalance" DOUBLE PRECISION NOT NULL,
    "projectedBalance" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "access_tokens_token_key" ON "access_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_plaidAccountId_key" ON "accounts"("plaidAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_plaidTransactionId_key" ON "transactions"("plaidTransactionId");

-- CreateIndex
CREATE INDEX "transactions_accountId_idx" ON "transactions"("accountId");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");

-- CreateIndex
CREATE INDEX "recurring_patterns_userId_idx" ON "recurring_patterns"("userId");

-- CreateIndex
CREATE INDEX "recurring_patterns_accountId_idx" ON "recurring_patterns"("accountId");

-- CreateIndex
CREATE INDEX "forecast_transactions_userId_idx" ON "forecast_transactions"("userId");

-- CreateIndex
CREATE INDEX "forecast_transactions_accountId_idx" ON "forecast_transactions"("accountId");

-- CreateIndex
CREATE INDEX "forecast_transactions_date_idx" ON "forecast_transactions"("date");

-- CreateIndex
CREATE INDEX "forecast_transactions_forecastId_idx" ON "forecast_transactions"("forecastId");

-- CreateIndex
CREATE INDEX "forecasts_userId_idx" ON "forecasts"("userId");

-- CreateIndex
CREATE INDEX "forecasts_accountId_idx" ON "forecasts"("accountId");

-- CreateIndex
CREATE INDEX "forecasts_forecastDate_idx" ON "forecasts"("forecastDate");

-- AddForeignKey
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_patterns" ADD CONSTRAINT "recurring_patterns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_patterns" ADD CONSTRAINT "recurring_patterns_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_transactions" ADD CONSTRAINT "forecast_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_transactions" ADD CONSTRAINT "forecast_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_transactions" ADD CONSTRAINT "forecast_transactions_recurringPatternId_fkey" FOREIGN KEY ("recurringPatternId") REFERENCES "recurring_patterns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_transactions" ADD CONSTRAINT "forecast_transactions_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "forecasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "health_consent_given_at" TIMESTAMP(3),
ADD COLUMN     "health_consent_version" TEXT DEFAULT '1.0';

-- CreateTable
CREATE TABLE "token_usage_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "request_type" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "model_version" TEXT NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_usage_logs_user_id_idx" ON "token_usage_logs"("user_id");

-- CreateIndex
CREATE INDEX "token_usage_logs_created_at_idx" ON "token_usage_logs"("created_at");

-- AddForeignKey
ALTER TABLE "token_usage_logs" ADD CONSTRAINT "token_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "upgrade_request_status" AS ENUM ('pending', 'contacted', 'converted', 'closed');

-- CreateTable
CREATE TABLE "upgrade_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "tier" "subscription_tier" NOT NULL,
    "status" "upgrade_request_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "upgrade_requests_company_id_idx" ON "upgrade_requests"("company_id");

-- CreateIndex
CREATE INDEX "upgrade_requests_status_created_at_idx" ON "upgrade_requests"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "upgrade_requests" ADD CONSTRAINT "upgrade_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrade_requests" ADD CONSTRAINT "upgrade_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

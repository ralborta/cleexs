-- Mercado Pago billing foundation: subscriptions, payments and webhook idempotency.

CREATE TYPE "BillingCurrency" AS ENUM ('ARS', 'USD');

CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'annual');

CREATE TYPE "SubscriptionStatus" AS ENUM ('pending', 'authorized', 'paused', 'cancelled', 'expired');

CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'charged_back');

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'pending',
    "billing_interval" "BillingInterval" NOT NULL DEFAULT 'monthly',
    "currency" "BillingCurrency" NOT NULL DEFAULT 'ARS',
    "amount_usd" DECIMAL(12,2) NOT NULL,
    "amount_ars" DECIMAL(12,2) NOT NULL,
    "fx_rate" DECIMAL(12,4) NOT NULL,
    "mp_preapproval_id" TEXT,
    "mp_preapproval_plan_id" TEXT,
    "payer_email" TEXT,
    "reason" TEXT,
    "init_point" TEXT,
    "sandbox_init_point" TEXT,
    "started_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "currency" "BillingCurrency" NOT NULL DEFAULT 'ARS',
    "amount_usd" DECIMAL(12,2),
    "amount_ars" DECIMAL(12,2) NOT NULL,
    "net_received_amount_ars" DECIMAL(12,2),
    "fx_rate" DECIMAL(12,4),
    "mp_payment_id" TEXT,
    "mp_preapproval_id" TEXT,
    "mp_merchant_order_id" TEXT,
    "payment_method_id" TEXT,
    "payment_type_id" TEXT,
    "status_detail" TEXT,
    "payer_email" TEXT,
    "paid_at" TIMESTAMP(3),
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mercadopago',
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "action" TEXT,
    "resource_id" TEXT,
    "payload" JSONB,
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_mp_preapproval_id_key" ON "subscriptions"("mp_preapproval_id");
CREATE INDEX "subscriptions_tenant_id_status_idx" ON "subscriptions"("tenant_id", "status");
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");

CREATE UNIQUE INDEX "payments_mp_payment_id_key" ON "payments"("mp_payment_id");
CREATE INDEX "payments_tenant_id_created_at_idx" ON "payments"("tenant_id", "created_at");
CREATE INDEX "payments_subscription_id_idx" ON "payments"("subscription_id");
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");
CREATE INDEX "payments_mp_preapproval_id_idx" ON "payments"("mp_preapproval_id");

CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events"("provider", "event_id");
CREATE INDEX "webhook_events_event_type_received_at_idx" ON "webhook_events"("event_type", "received_at");
CREATE INDEX "webhook_events_resource_id_idx" ON "webhook_events"("resource_id");
CREATE INDEX "webhook_events_processed_at_idx" ON "webhook_events"("processed_at");

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

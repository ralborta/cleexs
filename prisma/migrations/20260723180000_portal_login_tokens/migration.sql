-- CreateTable
CREATE TABLE "portal_login_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_login_tokens_token_hash_key" ON "portal_login_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "portal_login_tokens_user_id_expires_at_idx" ON "portal_login_tokens"("user_id", "expires_at");

-- AddForeignKey
ALTER TABLE "portal_login_tokens" ADD CONSTRAINT "portal_login_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

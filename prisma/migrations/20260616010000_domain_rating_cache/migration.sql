-- Cache de Domain Rating (Ahrefs API pública) por dominio
CREATE TABLE "domain_rating_cache" (
    "domain" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_rating_cache_pkey" PRIMARY KEY ("domain")
);

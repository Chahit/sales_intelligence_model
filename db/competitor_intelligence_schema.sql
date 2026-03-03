-- Competitor Price Intelligence Schema
-- Stores competitor product pricing for comparison and market positioning.

CREATE TABLE IF NOT EXISTS competitor_products (
    id BIGSERIAL PRIMARY KEY,
    competitor_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_group TEXT NULL,
    unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    source TEXT NULL,
    scraped_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (competitor_name, product_name)
);

CREATE INDEX IF NOT EXISTS idx_competitor_products_product
ON competitor_products (product_name);

CREATE INDEX IF NOT EXISTS idx_competitor_products_competitor
ON competitor_products (competitor_name);

CREATE INDEX IF NOT EXISTS idx_competitor_products_group
ON competitor_products (product_group);

-- Our own product pricing reference (populated from master_products or manual entry)
CREATE TABLE IF NOT EXISTS our_product_pricing (
    id BIGSERIAL PRIMARY KEY,
    product_name TEXT NOT NULL UNIQUE,
    product_group TEXT NULL,
    unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    cost_price DOUBLE PRECISION NULL,
    margin_pct DOUBLE PRECISION NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_our_product_pricing_group
ON our_product_pricing (product_group);

-- Price alerts: automatically generated when competitor undercuts significantly
CREATE TABLE IF NOT EXISTS competitor_price_alerts (
    id BIGSERIAL PRIMARY KEY,
    product_name TEXT NOT NULL,
    competitor_name TEXT NOT NULL,
    our_price DOUBLE PRECISION NOT NULL,
    competitor_price DOUBLE PRECISION NOT NULL,
    price_diff_pct DOUBLE PRECISION NOT NULL,
    alert_type TEXT NOT NULL DEFAULT 'undercut',
    severity TEXT NOT NULL DEFAULT 'medium',
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_unresolved
ON competitor_price_alerts (is_resolved, created_at DESC);

-- Add performance indexes for commonly filtered fields

-- Client name (used in ORDER BY and search)
CREATE INDEX IF NOT EXISTS "clients_name_idx" ON "clients"("name");

-- Product family and supplier (used in WHERE filters)
CREATE INDEX IF NOT EXISTS "products_family_idx" ON "products"("family");
CREATE INDEX IF NOT EXISTS "products_supplier_idx" ON "products"("supplier");

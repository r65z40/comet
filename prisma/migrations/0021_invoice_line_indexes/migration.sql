-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoice_lines_invoiceId_idx" ON "invoice_lines"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoice_lines_productId_idx" ON "invoice_lines"("productId");

-- EmailLog.payload: props do template para retry-emails (limpo após SENT em produção).
ALTER TABLE "EmailLog" ADD COLUMN "payload" JSONB;

-- Índices para queries do dashboard admin (funil, KPIs mensais, série 90d).
-- Click(createdAt): contagem global de cliques no funil / purge.
CREATE INDEX "Click_createdAt_idx" ON "Click"("createdAt");

-- Order(status, paidAt): vendas PAID no mês e série de receita.
CREATE INDEX "Order_status_paidAt_idx" ON "Order"("status", "paidAt");

-- Order(affiliateId, status, paidAt): top afiliados por receita paga.
CREATE INDEX "Order_affiliateId_status_paidAt_idx" ON "Order"("affiliateId", "status", "paidAt");

-- Commission(createdAt): comissões geradas no mês / série.
CREATE INDEX "Commission_createdAt_idx" ON "Commission"("createdAt");

-- Aumento manual sobre el precio de lista del lavado (Gerencia 2026-11-09),
-- para clientes que exigen el trabajo "a todo costo".
ALTER TABLE "CotizacionPuntual" ADD COLUMN "ajustePct" DOUBLE PRECISION;

-- Trabajo especializado (Gerencia 2026-11-11, caso impermeabilización Maloka):
-- un trabajo que KTV vende y factura pero que ejecuta un tercero — no tiene m²
-- de fachada, ni días de dron, ni informe. La comercial escribe la descripción
-- que verá el cliente, el costo real que nos cobra el tercero, y el fee que le
-- carga encima. El costo y el fee son CONFIDENCIALES (Regla A): el cliente solo
-- ve la descripción y el precio.
--
-- Postgres no deja usar un valor de enum recién agregado dentro de la misma
-- transacción que lo agrega, así que esto va en DOS ejecuciones separadas.

-- 1) Ejecutar SOLA, y esperar a que termine:
ALTER TYPE "ServicioPuntual" ADD VALUE IF NOT EXISTS 'TRABAJO_ESPECIALIZADO';

-- 2) Ejecutar después:
ALTER TABLE "CotizacionPuntual" ADD COLUMN "trabajoDescripcion" TEXT;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "trabajoCostoReal" DOUBLE PRECISION;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "trabajoFeePct" DOUBLE PRECISION;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "trabajoPrecio" DOUBLE PRECISION;

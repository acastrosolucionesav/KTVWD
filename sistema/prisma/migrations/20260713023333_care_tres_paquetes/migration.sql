-- Regla Gerencia 2026-07-13: KTV Care siempre muestra los 3 paquetes juntos
-- (Inspect/Essential/Complete), nunca uno solo. `plan` pasa a llamarse
-- `planRecomendado` (solo indica cuál lleva la insignia "RECOMENDADO"), y se
-- agregan 3 pares de columnas de precio (uno por paquete). Con DEFAULT 0
-- temporal para no romper si ya existiera alguna fila; se hace backfill
-- best-effort desde los valores viejos y luego se retira el DEFAULT.

ALTER TABLE "CotizacionCare" ADD COLUMN "planRecomendado" "PlanCare";
UPDATE "CotizacionCare" SET "planRecomendado" = "plan";
ALTER TABLE "CotizacionCare" ALTER COLUMN "planRecomendado" SET NOT NULL;
ALTER TABLE "CotizacionCare" DROP COLUMN "plan";

ALTER TABLE "CotizacionCare" ADD COLUMN "valorAnualInspect" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CotizacionCare" ADD COLUMN "valorMensualInspect" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CotizacionCare" ADD COLUMN "valorAnualEssential" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CotizacionCare" ADD COLUMN "valorMensualEssential" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CotizacionCare" ADD COLUMN "valorAnualComplete" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CotizacionCare" ADD COLUMN "valorMensualComplete" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "CotizacionCare" SET "valorAnualInspect" = "valorAnual", "valorMensualInspect" = "valorMensual" WHERE "planRecomendado" = 'INSPECT';
UPDATE "CotizacionCare" SET "valorAnualEssential" = "valorAnual", "valorMensualEssential" = "valorMensual" WHERE "planRecomendado" = 'ESSENTIAL';
UPDATE "CotizacionCare" SET "valorAnualComplete" = "valorAnual", "valorMensualComplete" = "valorMensual" WHERE "planRecomendado" = 'COMPLETE';

ALTER TABLE "CotizacionCare" DROP COLUMN "valorAnual";
ALTER TABLE "CotizacionCare" DROP COLUMN "valorMensual";

ALTER TABLE "CotizacionCare" ALTER COLUMN "valorAnualInspect" DROP DEFAULT;
ALTER TABLE "CotizacionCare" ALTER COLUMN "valorMensualInspect" DROP DEFAULT;
ALTER TABLE "CotizacionCare" ALTER COLUMN "valorAnualEssential" DROP DEFAULT;
ALTER TABLE "CotizacionCare" ALTER COLUMN "valorMensualEssential" DROP DEFAULT;
ALTER TABLE "CotizacionCare" ALTER COLUMN "valorAnualComplete" DROP DEFAULT;
ALTER TABLE "CotizacionCare" ALTER COLUMN "valorMensualComplete" DROP DEFAULT;

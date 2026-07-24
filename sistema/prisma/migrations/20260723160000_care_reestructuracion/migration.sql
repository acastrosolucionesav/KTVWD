-- Reestructuración KTV Care (spec_reestructuracion_care_20260723.md)
-- 1) Enum PlanCare: INSPECT/ESSENTIAL/COMPLETE -> BASIC/ESSENTIAL/COMPLETE.
--    Se retira "Inspect". Datos viejos se remapean por texto: INSPECT y el
--    ESSENTIAL anterior (que pasa a llamarse Basic) -> BASIC; COMPLETE queda.
--    Se recrea el tipo para dejarlo EXACTO en los 3 valores nuevos (no se
--    puede quitar un valor de un enum existente en Postgres de otra forma).
CREATE TYPE "PlanCare_new" AS ENUM ('BASIC', 'ESSENTIAL', 'COMPLETE');

ALTER TABLE "CotizacionCare"
  ALTER COLUMN "planRecomendado" TYPE "PlanCare_new"
  USING (
    CASE "planRecomendado"::text
      WHEN 'COMPLETE' THEN 'COMPLETE'
      ELSE 'BASIC'
    END::"PlanCare_new"
  );

DROP TYPE "PlanCare";
ALTER TYPE "PlanCare_new" RENAME TO "PlanCare";

-- 2) Renombrar las columnas de valor del antiguo Inspect -> Basic. Se preserva
--    el dato por posición (una cotización vieja de Inspect conserva su número
--    en la columna Basic). Las columnas Essential/Complete se mantienen.
ALTER TABLE "CotizacionCare" RENAME COLUMN "valorAnualInspect" TO "valorAnualBasic";
ALTER TABLE "CotizacionCare" RENAME COLUMN "valorMensualInspect" TO "valorMensualBasic";

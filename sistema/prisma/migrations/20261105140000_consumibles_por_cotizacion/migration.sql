-- El filtro de agua no siempre se monta; cuando no, sus insumos no se gastan
-- (así lo calcula la matriz 2026). El resto de consumibles va por día.
ALTER TABLE "CotizacionPuntual" ADD COLUMN "filtroAgua" BOOLEAN NOT NULL DEFAULT true;

-- Costos internos de la cotización (transporte, viáticos): cuestan y suben el
-- precio, pero nunca se le muestran al cliente como línea.
ALTER TABLE "CotizacionPuntual" ADD COLUMN "costosInternos" DOUBLE PRECISION;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "costosInternosNota" TEXT;

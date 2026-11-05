-- Consumibles que dependen de la cotización y no del día (matriz 2026).
ALTER TABLE "CotizacionPuntual" ADD COLUMN "filtroAgua" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "galonesQuimico" DOUBLE PRECISION;

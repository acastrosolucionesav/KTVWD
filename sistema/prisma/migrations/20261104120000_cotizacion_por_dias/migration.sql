-- Cotización POR DÍAS (matriz de costeo 2026, Gerencia 2026-11-04).
-- Todas las columnas son opcionales: las cotizaciones existentes quedan con
-- modoCotizacion NULL, que se lee como METROS (como se cotizó hasta hoy).
ALTER TABLE "CotizacionPuntual" ADD COLUMN "modoCotizacion" TEXT;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "diasEstimados" DOUBLE PRECISION;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "equipoAlturas" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "nochesAlojamiento" INTEGER;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "trayectosIntermunicipales" INTEGER;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "horasExtraPiloto" DOUBLE PRECISION;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "horasExtraAsistente" DOUBLE PRECISION;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "diasApoyoExterno" DOUBLE PRECISION;
ALTER TABLE "CotizacionPuntual" ADD COLUMN "margenObjetivo" DOUBLE PRECISION;

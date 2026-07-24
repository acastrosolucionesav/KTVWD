-- CreateEnum
CREATE TYPE "ConceptoLavado" AS ENUM ('SOLO_VENTANAS', 'SOLO_FACHADA', 'FACHADA_Y_VENTANAS');

-- AlterTable
ALTER TABLE "CotizacionPuntual" ADD COLUMN     "concepto" "ConceptoLavado",
ADD COLUMN     "m2Vidrio" DOUBLE PRECISION,
ADD COLUMN     "m2Opaca" DOUBLE PRECISION,
ADD COLUMN     "diasEjecucionSistema" DOUBLE PRECISION,
ADD COLUMN     "diasEjecucion" DOUBLE PRECISION;

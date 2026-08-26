-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "pipedriveDealId" TEXT;

-- CreateIndex
CREATE INDEX "Cotizacion_pipedriveDealId_idx" ON "Cotizacion"("pipedriveDealId");

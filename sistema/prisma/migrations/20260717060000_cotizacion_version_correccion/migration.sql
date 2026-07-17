-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "versionAnteriorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_versionAnteriorId_key" ON "Cotizacion"("versionAnteriorId");

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_versionAnteriorId_fkey" FOREIGN KEY ("versionAnteriorId") REFERENCES "Cotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

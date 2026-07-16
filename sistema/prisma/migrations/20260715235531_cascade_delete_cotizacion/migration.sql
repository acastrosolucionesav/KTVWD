-- DropForeignKey
ALTER TABLE "Apertura" DROP CONSTRAINT "Apertura_cotizacionId_fkey";

-- DropForeignKey
ALTER TABLE "Auditoria" DROP CONSTRAINT "Auditoria_cotizacionId_fkey";

-- DropForeignKey
ALTER TABLE "OrdenServicio" DROP CONSTRAINT "OrdenServicio_cotizacionId_fkey";

-- AddForeignKey
ALTER TABLE "OrdenServicio" ADD CONSTRAINT "OrdenServicio_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apertura" ADD CONSTRAINT "Apertura_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

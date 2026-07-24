-- CreateEnum
CREATE TYPE "TipoItemTercero" AS ENUM ('PRODUCTO', 'SERVICIO');

-- CreateTable
CREATE TABLE "ItemTercero" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "descripcionCliente" TEXT NOT NULL,
    "notaInterna" TEXT,
    "tipo" "TipoItemTercero" NOT NULL,
    "costoReal" DOUBLE PRECISION NOT NULL,
    "margenNetoDeseado" DOUBLE PRECISION NOT NULL,
    "precioVenta" DOUBLE PRECISION NOT NULL,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemTercero_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ItemTercero" ADD CONSTRAINT "ItemTercero_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

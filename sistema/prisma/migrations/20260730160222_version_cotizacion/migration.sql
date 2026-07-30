-- CreateTable
CREATE TABLE "VersionCotizacion" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "editadoPorId" TEXT NOT NULL,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionCotizacion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VersionCotizacion" ADD CONSTRAINT "VersionCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionCotizacion" ADD CONSTRAINT "VersionCotizacion_editadoPorId_fkey" FOREIGN KEY ("editadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

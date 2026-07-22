-- CreateTable
CREATE TABLE "ItemLavado" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "nombre" TEXT NOT NULL,
    "concepto" "ConceptoLavado" NOT NULL,
    "m2Vidrio" DOUBLE PRECISION NOT NULL,
    "m2Opaca" DOUBLE PRECISION NOT NULL,
    "superficie" "Superficie" NOT NULL,
    "tipoEdificio" "NivelRecargo" NOT NULL,
    "dificultad" "NivelRecargo" NOT NULL,
    "costoOperacion" DOUBLE PRECISION NOT NULL,
    "feeNoruega" DOUBLE PRECISION NOT NULL,
    "precioLavado" DOUBLE PRECISION NOT NULL,
    "diasEjecucionSistema" DOUBLE PRECISION NOT NULL,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemLavado_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ItemLavado" ADD CONSTRAINT "ItemLavado_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

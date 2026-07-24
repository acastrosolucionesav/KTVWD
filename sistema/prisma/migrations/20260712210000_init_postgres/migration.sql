-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('COMERCIAL', 'DIRECTOR_COMERCIAL', 'GERENCIA');

-- CreateEnum
CREATE TYPE "Familia" AS ENUM ('PUNTUAL', 'CARE');

-- CreateEnum
CREATE TYPE "EstadoCotizacion" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA', 'ENVIADA');

-- CreateEnum
CREATE TYPE "ServicioPuntual" AS ENUM ('INSPECCION_SOLA', 'LAVADO_MAS_INSPECCION', 'SOLO_LAVADO');

-- CreateEnum
CREATE TYPE "TipoInforme" AS ENUM ('DIAGNOSTICO_VISUAL', 'INTERNACIONAL');

-- CreateEnum
CREATE TYPE "Superficie" AS ENUM ('VIDRIO', 'MIXTA', 'DIFICIL');

-- CreateEnum
CREATE TYPE "NivelRecargo" AS ENUM ('BAJO', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "PlanCare" AS ENUM ('INSPECT', 'ESSENTIAL', 'COMPLETE');

-- CreateEnum
CREATE TYPE "FormaPago" AS ENUM ('CONTADO', 'DIFERIDO_12');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametro" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "actualizadoPor" TEXT,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parametro_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "ClienteProspecto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "empresa" TEXT,
    "contacto" TEXT,
    "canalOrigen" TEXT,
    "pipedrivePersonId" TEXT,
    "pipedriveDealId" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClienteProspecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" TEXT NOT NULL,
    "idTrazabilidad" TEXT NOT NULL,
    "linkToken" TEXT NOT NULL,
    "linkActivo" BOOLEAN NOT NULL DEFAULT true,
    "familia" "Familia" NOT NULL,
    "clienteId" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "estado" "EstadoCotizacion" NOT NULL DEFAULT 'BORRADOR',
    "requiereAprobacion" BOOLEAN NOT NULL DEFAULT false,
    "aprobadoPorId" TEXT,
    "aprobadoAt" TIMESTAMP(3),
    "enviadoAt" TIMESTAMP(3),
    "vigenteHasta" TIMESTAMP(3),
    "snapshotParametros" TEXT NOT NULL,
    "totalCliente" DOUBLE PRECISION NOT NULL,
    "observaciones" TEXT,
    "aceptadaPorCliente" BOOLEAN NOT NULL DEFAULT false,
    "aceptadaAt" TIMESTAMP(3),
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionPuntual" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "servicio" "ServicioPuntual" NOT NULL,
    "tipoInformeBase" "TipoInforme",
    "mostrarInformeInternacional" BOOLEAN NOT NULL DEFAULT false,
    "m2Fachada" DOUBLE PRECISION,
    "superficie" "Superficie",
    "tipoEdificio" "NivelRecargo",
    "dificultad" "NivelRecargo",
    "ciudadFuera" BOOLEAN NOT NULL DEFAULT false,
    "movilizacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rangoTecho" DOUBLE PRECISION,
    "diasOperacion" DOUBLE PRECISION,
    "costoOperacion" DOUBLE PRECISION,
    "feeNoruega" DOUBLE PRECISION,
    "margenPct" DOUBLE PRECISION,
    "precioLavado" DOUBLE PRECISION,
    "precioInformeBase" DOUBLE PRECISION,
    "precioInformeAdicional" DOUBLE PRECISION,
    "anticipoPct" INTEGER,
    "saldoPct" INTEGER,
    "condicionPagoNota" TEXT,
    "permisoAerocivil" TEXT,
    "ejecucionSitio" TEXT,

    CONSTRAINT "CotizacionPuntual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionCare" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "plan" "PlanCare" NOT NULL,
    "contratoAnios" INTEGER NOT NULL DEFAULT 1,
    "formaPago" "FormaPago" NOT NULL DEFAULT 'CONTADO',
    "m2Fachada" DOUBLE PRECISION,
    "rangoTecho" DOUBLE PRECISION,
    "valorAnual" DOUBLE PRECISION NOT NULL,
    "valorMensual" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CotizacionCare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenServicio" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "anticipoConfirmado" BOOLEAN NOT NULL DEFAULT false,
    "notasOperativas" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenServicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apertura" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Apertura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_idTrazabilidad_key" ON "Cotizacion"("idTrazabilidad");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_linkToken_key" ON "Cotizacion"("linkToken");

-- CreateIndex
CREATE UNIQUE INDEX "CotizacionPuntual_cotizacionId_key" ON "CotizacionPuntual"("cotizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "CotizacionCare_cotizacionId_key" ON "CotizacionCare"("cotizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenServicio_cotizacionId_key" ON "OrdenServicio"("cotizacionId");

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "ClienteProspecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionPuntual" ADD CONSTRAINT "CotizacionPuntual_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionCare" ADD CONSTRAINT "CotizacionCare_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenServicio" ADD CONSTRAINT "OrdenServicio_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apertura" ADD CONSTRAINT "Apertura_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


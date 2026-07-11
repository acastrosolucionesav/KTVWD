-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Parametro" (
    "clave" TEXT NOT NULL PRIMARY KEY,
    "valor" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "actualizadoPor" TEXT,
    "actualizadoAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClienteProspecto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "empresa" TEXT,
    "contacto" TEXT,
    "canalOrigen" TEXT,
    "pipedrivePersonId" TEXT,
    "pipedriveDealId" TEXT,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idTrazabilidad" TEXT NOT NULL,
    "familia" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "requiereAprobacion" BOOLEAN NOT NULL DEFAULT false,
    "aprobadoPorId" TEXT,
    "aprobadoAt" DATETIME,
    "enviadoAt" DATETIME,
    "vigenteHasta" DATETIME,
    "snapshotParametros" TEXT NOT NULL,
    "totalCliente" REAL NOT NULL,
    "observaciones" TEXT,
    "aceptadaPorCliente" BOOLEAN NOT NULL DEFAULT false,
    "aceptadaAt" DATETIME,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "ClienteProspecto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cotizacion_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cotizacion_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CotizacionPuntual" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cotizacionId" TEXT NOT NULL,
    "servicio" TEXT NOT NULL,
    "tipoInformeBase" TEXT,
    "mostrarInformeInternacional" BOOLEAN NOT NULL DEFAULT false,
    "m2Fachada" REAL,
    "superficie" TEXT,
    "tipoEdificio" TEXT,
    "dificultad" TEXT,
    "ciudadFuera" BOOLEAN NOT NULL DEFAULT false,
    "movilizacion" REAL NOT NULL DEFAULT 0,
    "rangoTecho" REAL,
    "diasOperacion" REAL,
    "costoOperacion" REAL,
    "feeNoruega" REAL,
    "margenPct" REAL,
    "precioLavado" REAL,
    "precioInformeBase" REAL,
    "precioInformeAdicional" REAL,
    CONSTRAINT "CotizacionPuntual_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CotizacionCare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cotizacionId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "contratoAnios" INTEGER NOT NULL DEFAULT 1,
    "formaPago" TEXT NOT NULL DEFAULT 'CONTADO',
    "m2Fachada" REAL,
    "rangoTecho" REAL,
    "valorAnual" REAL NOT NULL,
    "valorMensual" REAL NOT NULL,
    CONSTRAINT "CotizacionCare_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrdenServicio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cotizacionId" TEXT NOT NULL,
    "anticipoConfirmado" BOOLEAN NOT NULL DEFAULT false,
    "notasOperativas" TEXT,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrdenServicio_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cotizacionId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Auditoria_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Apertura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cotizacionId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Apertura_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_idTrazabilidad_key" ON "Cotizacion"("idTrazabilidad");

-- CreateIndex
CREATE UNIQUE INDEX "CotizacionPuntual_cotizacionId_key" ON "CotizacionPuntual"("cotizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "CotizacionCare_cotizacionId_key" ON "CotizacionCare"("cotizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenServicio_cotizacionId_key" ON "OrdenServicio"("cotizacionId");

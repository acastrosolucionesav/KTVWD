-- linkToken: las filas existentes reciben un token aleatorio de 32 hex
-- (backfill con randomblob — mismo nivel de no-adivinable que un cuid).
-- AlterTable
ALTER TABLE "Apertura" ADD COLUMN "userAgent" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cotizacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idTrazabilidad" TEXT NOT NULL,
    "linkToken" TEXT NOT NULL,
    "linkActivo" BOOLEAN NOT NULL DEFAULT true,
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
INSERT INTO "new_Cotizacion" ("aceptadaAt", "aceptadaPorCliente", "aprobadoAt", "aprobadoPorId", "clienteId", "creadoAt", "creadoPorId", "enviadoAt", "estado", "familia", "id", "idTrazabilidad", "linkToken", "observaciones", "requiereAprobacion", "snapshotParametros", "totalCliente", "vigenteHasta") SELECT "aceptadaAt", "aceptadaPorCliente", "aprobadoAt", "aprobadoPorId", "clienteId", "creadoAt", "creadoPorId", "enviadoAt", "estado", "familia", "id", "idTrazabilidad", lower(hex(randomblob(16))), "observaciones", "requiereAprobacion", "snapshotParametros", "totalCliente", "vigenteHasta" FROM "Cotizacion";
DROP TABLE "Cotizacion";
ALTER TABLE "new_Cotizacion" RENAME TO "Cotizacion";
CREATE UNIQUE INDEX "Cotizacion_idTrazabilidad_key" ON "Cotizacion"("idTrazabilidad");
CREATE UNIQUE INDEX "Cotizacion_linkToken_key" ON "Cotizacion"("linkToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

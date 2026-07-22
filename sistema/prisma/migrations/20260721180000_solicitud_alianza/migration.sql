-- CreateTable
CREATE TABLE "SolicitudAlianza" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "empresa" TEXT,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "ciudad" TEXT,
    "mensaje" TEXT,
    "pipedriveLeadId" TEXT,
    "atendida" BOOLEAN NOT NULL DEFAULT false,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudAlianza_pkey" PRIMARY KEY ("id")
);

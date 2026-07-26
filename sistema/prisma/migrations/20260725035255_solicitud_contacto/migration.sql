-- CreateTable
CREATE TABLE "SolicitudContacto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "compania" TEXT,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "mensaje" TEXT,
    "pipedriveLeadId" TEXT,
    "atendida" BOOLEAN NOT NULL DEFAULT false,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudContacto_pkey" PRIMARY KEY ("id")
);

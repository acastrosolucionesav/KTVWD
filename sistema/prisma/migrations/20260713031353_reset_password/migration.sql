-- "Olvidé mi contraseña": token de un solo uso enviado por correo (1h de
-- vencimiento). Columnas nullable — no afecta filas existentes de Usuario.

ALTER TABLE "Usuario" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_resetToken_key" ON "Usuario"("resetToken");

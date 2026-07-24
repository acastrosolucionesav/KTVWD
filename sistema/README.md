# KTV — Sistema Comercial (Fase 2)

Módulo 1 (Cotizador) del sistema comercial descrito en `KWD-SIS-PROMPT-001 v2`.
Reemplaza a `cotizador.html` como herramienta operativa — ese archivo queda solo
como referencia de fórmulas y estética ya validadas por Gerencia.

## Qué ya funciona (Módulo 1)

- Login con 3 roles: `COMERCIAL`, `DIRECTOR_COMERCIAL`, `GERENCIA`.
- Cotizador Familia 1 (servicios puntuales): Solo lavado / Lavado + Inspección
  KTV Colombia / Solo inspección — el motor pone automáticamente el
  Diagnóstico Visual como base gratis (combo) o cobrado (inspección sola), y el
  Informe Internacional KTV como adicional activable (**Regla B**, por cotización).
- **Regla A (confidencialidad) real, no cosmética:** el documento de cliente se
  arma desde un DTO (`src/lib/dto.ts`) que estructuralmente NO tiene fee ni
  margen — no es que se oculten con CSS, es que el tipo de dato no los
  contiene. Solo el rol `GERENCIA` ve el desglose de costos, y solo en el
  panel interno (`/cotizaciones/[id]`), nunca en el documento exportable.
- Aprobación: si el margen cae bajo el mínimo autorizado, la cotización queda
  `PENDIENTE_APROBACION` y solo Gerencia puede aprobar/rechazar.
- Propuesta pública (`/propuesta/[idTrazabilidad]`, sin login) con el naming
  correcto ("Informe Internacional KTV", nunca "certificado"; "Diagnóstico
  Visual KTV" con mención de IA), sin m², con botón de aceptación.
- **Al aceptar, se genera automáticamente la Orden de Servicio interna SIN
  CIFRAS** (solo `anticipoConfirmado: Sí/No`) y queda auditado quién aceptó y
  cuándo — probado de punta a punta con Playwright.

## Pendiente de este módulo (antes de pasar al Módulo 2)

- Familia 2 (KTV Care) — el motor de precios ya existe (`calcularCare` en
  `pricing.ts`), falta el formulario y las páginas de creación/detalle
  (mismo patrón que Familia 1).
- Panel de administración de `parametros` (hoy se editan solo por SQL/seed;
  falta la UI para que Gerencia los edite sin tocar código).
- Notificación real a Operaciones cuando se crea la Orden de Servicio (hoy
  solo queda el registro en base de datos).

## Cómo correrlo local

```bash
cd sistema
npm install
npx prisma migrate dev   # crea/actualiza dev.db (SQLite local)
npm run seed             # 3 usuarios + parámetros iniciales + 1 cliente demo
npm run dev              # http://localhost:3000
```

Usuarios de prueba (clave `ktv2026` para los 3):
`comercial@ktvworkingdrone.com.co`, `director@ktvworkingdrone.com.co`,
`gerencia@ktvworkingdrone.com.co`.

## Stack y decisiones de infraestructura

- **Next.js 16** (App Router) + TypeScript. Ojo: Next 16 renombró
  `middleware.ts` a `proxy.ts` y varias convenciones cambiaron — este proyecto
  ya sigue las nuevas. No asumas que training data de Next 14/15 aplica igual.
- **Auth casera con `jose` (JWT en cookie httpOnly) + Data Access Layer**, NO
  NextAuth — la documentación oficial de Next 16 recomienda este patrón
  directamente, y NextAuth v5 sigue en beta con soporte incierto para Next 16.
- **Prisma 7** como ORM. Prisma 7 exige un *driver adapter* explícito (ya no
  basta con la URL en el schema). En desarrollo se usa
  `@prisma/adapter-better-sqlite3` sobre un archivo SQLite local
  (`sistema/dev.db`, en `.gitignore`, nunca se commitea).
- **Para producción:** cambiar el adapter en `src/lib/prisma.ts` y
  `prisma/seed.ts` de `@prisma/adapter-better-sqlite3` a `@prisma/adapter-pg`
  apuntando a Neon Postgres (o el proveedor que se confirme), y el
  `datasource provider` del schema de `sqlite` a `postgresql`. Recomendación
  de hosting: Vercel + Neon Postgres (mínimo mantenimiento, se integra nativo
  con el flujo `git push` que ya usan). Desplegar como proyecto Vercel
  **separado** del landing público, en un subdominio propio (ej.
  `app.ktvworkingdrone.com.co`) — nunca en el mismo origen que el sitio
  público sin login.

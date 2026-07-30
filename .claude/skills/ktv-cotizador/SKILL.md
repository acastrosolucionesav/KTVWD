---
name: ktv-cotizador
description: Conocimiento técnico del Sistema Comercial de KTV Working Drone (carpeta sistema/ del repo KTVWD — Next.js 16 + Prisma 7, desplegado en Vercel como propuestas.ktvworkingdrone.com.co). Usar esta skill SIEMPRE que se vaya a tocar código dentro de sistema/ — el cotizador, las cotizaciones Puntual o Care, el motor de precios (pricing.ts), el DTO de cliente, el panel interno de Gerencia, el listado de cotizaciones, el link público de propuestas, las notificaciones por correo, o cualquier migración de Prisma — incluso si el usuario solo dice "el cotizador", "el sistema", "una cotización" o "la propuesta" sin mencionar archivos. Es la contraparte TÉCNICA de la skill ktv-working-drone (que cubre reglas de negocio/tarifas/franquicia) — cárgalas juntas cuando la tarea toca el sistema comercial.
---

# Sistema Comercial KTV — Skill técnica del cotizador

Esta skill documenta CÓMO está construido `sistema/` para que una sesión nueva de Claude
pueda seguir trabajando ahí sin tener que redescubrir el código, y sobre todo sin repetir
errores operativos ya conocidos (la migración manual de producción es el más caro). Para
tarifas, márgenes, reglas comerciales y contexto de la empresa, ver la skill hermana
`ktv-working-drone` — aquí solo se documenta la implementación.

## 1. Arquitectura

- **Next.js 16 (App Router) + TypeScript**, Prisma 7 con **adaptador explícito**
  (`@prisma/adapter-pg`, ver `src/lib/prisma.ts`) — Prisma 7 exige un driver adapter,
  no acepta URL implícita. Mismo adaptador en dev y en producción: Postgres estándar por
  TCP tanto local como Neon, solo cambia `DATABASE_URL`. Auth propia con `jose` (JWT),
  **sin NextAuth**.
- Esta app (`sistema/`) es un proyecto de Vercel **separado** del sitio estático público
  (`web/`, que es el brochure de ktvworkingdrone.com.co en Hostinger). No confundirlos:
  distinto dominio (`propuestas.ktvworkingdrone.com.co` vs `ktvworkingdrone.com.co`),
  distinto stack (Next.js+Postgres vs HTML estático+PHP), distinto hosting.
- Producción: Vercel + **Neon Postgres**. El proyecto de Vercel se llama `ktv_propuestas`.
- AGENTS.md del propio `sistema/` advierte: esta versión de Next.js tiene cambios que
  rompen compatibilidad con lo que un modelo puede saber de su entrenamiento — revisar
  `node_modules/next/dist/docs/` antes de asumir una API.

## 2. ⚠️ RIESGO OPERATIVO CRÍTICO — las migraciones NO son automáticas

El script de build (`package.json`) solo corre `prisma generate`, **nunca**
`prisma migrate deploy`. Esto significa que cualquier cambio de schema (`prisma/schema.prisma`
+ una carpeta nueva en `prisma/migrations/`) se despliega a Vercel con el código, pero **la
tabla real en Neon no cambia sola**. Si alguien usa una funcionalidad que depende de una
columna nueva antes de correr la migración a mano, la app truena en producción.

**Cada vez que un cambio toque el schema:**
1. Commitear la migración igual que el resto del código (ya queda versionada en el repo).
2. Después de que Vercel despliegue, correr manualmente contra Neon:
   ```
   cd sistema && npx prisma migrate deploy
   ```
   (usa la `DATABASE_URL` de producción — normalmente hay que exportarla o usar el `.env`
   de producción temporalmente, nunca commitear esa URL).
3. Si el cambio es solo de código (sin tocar `schema.prisma`), este paso no aplica.

Este olvido ya costó tiempo real en esta sesión más de una vez — no asumir nunca que un
`git push` deja la base de datos al día.

## 3. Modelo de datos — lo esencial

Dos "familias" de cotización, en tablas **separadas**, unidas por `Cotizacion` — nunca se
mezclan los datos de una familia con la otra (regla KWD-SIS-PROMPT-001 v2):

- **`Cotizacion`** — la fila central. Campos clave:
  - `idTrazabilidad`: el ID secuencial que ve el cliente en el documento (`KTV-YYYYMMDD-NNNN`).
  - `linkToken`: un cuid **no adivinable**, distinto del anterior — es lo que usa el link
    público (`/propuesta/[linkToken]`). Nunca usar `idTrazabilidad` para el link público:
    sería enumerable por terceros.
  - `estado`: `BORRADOR` / `PENDIENTE_APROBACION` / `APROBADA` / `RECHAZADA` / `ENVIADA`.
  - `aceptadaPorCliente` / `aceptadaAt`: si el cliente ya aceptó desde la página pública.
  - `versionAnteriorId` / `versionNueva`: mecanismo de "corrección" — ver §5.
  - `creadoPorId` / `creadoPor`: el comercial dueño — determina qué ve cada rol (§7).
  - `aperturas`: relación con `Apertura`, tracking de visitas al link público (§6).
- **`CotizacionPuntual`** (Familia 1 — servicio puntual: lavado / inspección / ambos).
  Tiene `descuentoPct` (manual, 0-99%) + `precioLavadoSinDescuento` (referencia interna).
- **`CotizacionCare`** (Familia 2 — programa recurrente Basic/Essential/Complete). Tiene
  `descuentoManualPct` (mismo patrón que el de Puntual, ver §4).
- **`ItemLavado`**: varios ítems de lavado por cotización puntual (varios edificios/
  superficies), reemplaza los campos viejos de un solo ítem en `CotizacionPuntual`
  (esos campos quedan solo para leer cotizaciones antiguas, nunca se escriben ni migran).
- **`ItemTercero`**: productos/servicios subcontratados, margen neto fijo (15% producto /
  25% servicio), nunca se absorben al costo.
- **`Apertura`**: una fila por visita del cliente (sin sesión) al link público.
- **`VersionCotizacion`**: foto (JSON) de los datos justo antes de cada edición en el
  mismo registro — ver §5, es el historial de consulta, no genera cotizaciones nuevas.

## 4. Motor de precios (`src/lib/pricing.ts`) — reglas que no se deben romper

- **Regla A (confidencialidad):** el DTO de cliente (`src/lib/dto.ts`,
  `getCotizacionClienteDTO`) **estructuralmente nunca** trae fee/costo/margen — ese dato
  solo lo ve el rol `GERENCIA`, y solo en el panel interno (`/cotizaciones/[id]`), jamás
  en el documento exportable/público. Si se agrega un campo nuevo al DTO, revisar dos
  veces que no se filtre nada confidencial.
- **Regla B:** el Informe Internacional **nunca** se descuenta, bajo ninguna combinación.
- **Piso de margen 35%** (`MARGEN_MINIMO`) es un piso **absoluto** en todos los caminos de
  precio (Care y Puntual) — no hay excepción automática, solo aprobación explícita de
  Gerencia (`requiereAprobacion` → estado `PENDIENTE_APROBACION`).
- **Descuentos de Care** (`calcularCare`/`calcularCareTodos`): compromiso por plan fijo
  (Basic 5% / Essential 7.5% / Complete 10%) + volumen (`descuentoVolumen(m2)`, **solo**
  Essential/Complete, nunca Basic — es el incentivo para comprometerse a 3 años) + manual
  (`descuentoManualPct`, agregado 2026-07-28). Los tres candidatos **nunca se suman** —
  siempre `Math.max(compromiso, volumen, manual)`, y si el resultado rompe el 35% cae
  automáticamente al de compromiso (que por diseño ya cumple). El de volumen además tiene
  un tope de escalón (`GAP_ESCALON`) para que nunca alcance el compromiso del plan
  siguiente y borre la diferencia de tarifa entre Essential y Complete.
- Mismo patrón (max, nunca suma, piso 35%) para el descuento manual de lavado puntual
  (`CotizacionPuntual.descuentoPct`, vía `calcularLavadoMultiItem`).
- El panel interno (`cotizaciones/[id]/page.tsx`) **recalcula todo en vivo** desde
  `snapshotParametros` (los parámetros congelados al crear la cotización) + los campos
  guardados (m2, techo, superficie, plan, descuentoManualPct) — nunca lee un precio
  guardado directamente, así que agregar un campo de precio nuevo casi siempre implica
  tocar tanto el schema como esta página de recálculo.

## 5. Editar vs. "corregir" (crear versión nueva)

Decisión 2026-07-28, para no acumular filas en cada ronda de negociación: mientras
`aceptadaPorCliente === false`, **cualquier edición se guarda en el mismo registro**, sin
importar el `estado` (aunque ya esté Enviada, Aprobada o Pendiente de aprobación) — el
`estado` se recalcula solo en cada guardado (vuelve a `BORRADOR` o `PENDIENTE_APROBACION`
según el margen resultante), para forzar que el comercial vuelva a marcarla como enviada a
propósito si de verdad ya se lo mandó al cliente con los números nuevos.

Solo en el momento en que `aceptadaPorCliente === true`, una edición posterior crea una
cotización **nueva** (`versionAnteriorId` apunta a la vieja, `versionNueva` es la relación
inversa), y desactiva el link de la anterior (`linkActivo: false`) — es el único punto
donde de verdad hay que preservar intacto lo que el cliente ya aceptó.

Esta lógica vive en `src/app/actions/cotizaciones.ts`, al principio de
`crearCotizacionPuntual`/`crearCotizacionCare`: revisar el bloque `if (cotizacionExistenteId)`.
El listado (`src/app/cotizaciones/page.tsx`) oculta por defecto las cotizaciones con
`versionNueva` no nulo bajo un desplegable "Ver historial de correcciones", para que un
cliente con varias rondas no sature la vista de cuál es la vigente.

**Efecto secundario ya encontrado en producción (caso Pfizer, 2026-07-30):** al editar en
el mismo registro se sobreescribe todo — sin nada más, se pierde para siempre lo que ya se
le había enviado al cliente antes del cambio. Se corrigió con el modelo
`VersionCotizacion`: cada edición de una cotización existente guarda ANTES de sobreescribir
una foto en JSON (`snapshot`) de los datos de la familia (puntual o care) + cliente/total/
estado/observaciones, con quién editó y cuándo. Se arma en el mismo bloque
`if (cotizacionExistenteId)` (variable `snapshotAnterior`) y se persiste dentro del mismo
`prisma.cotizacion.update(...)` vía `versiones: { create: { snapshot, editadoPorId } }`. El
detalle interno (`cotizaciones/[id]/page.tsx`) las lista en una sección colapsable
"Versiones anteriores", con el margen visible solo para `GERENCIA` (misma Regla A del resto
del panel). Si se agrega un campo nuevo a `CotizacionPuntual`/`CotizacionCare`, no hace
falta tocar el snapshot — se guarda el objeto completo tal cual venía de la base.

## 6. Notificaciones por correo (`src/lib/email.ts`)

Gmail/Google Workspace vía `nodemailer` (reemplazó a SendGrid). Variables de entorno:
`GMAIL_USER` (la cuenta que envía) y `GMAIL_APP_PASSWORD` (una "contraseña de aplicación"
de 16 caracteres — requiere verificación en 2 pasos activa en esa cuenta, **no** es la
contraseña normal). Sin estas dos variables, `enviar()` no lanza error — solo hace
`console.error` y no manda nada (revisar `emailHabilitado()`).

**Confirmado 2026-07-28:** estas variables **no estaban** configuradas en Vercel
producción — verificar de nuevo antes de asumir que están, porque si no lo están, ningún
correo del sistema ha funcionado nunca ahí (recuperación de contraseña, bienvenida, alerta
de aprobación pendiente, ni la notificación de apertura de propuesta).

Funciones existentes: `enviarCorreoRecuperacion`, `enviarCorreoAprobacionPendiente`,
`enviarCorreoBienvenida`, `enviarCorreoPropuestaAbierta` (nueva). Esta última se dispara
**cada vez** (no solo la primera) que un visitante sin sesión abre el link público de una
propuesta (`src/app/propuesta/[id]/page.tsx`), notificando al comercial que la creó
(`creadoPor`). El tracking de apertura (fila en `Apertura`) y el envío del correo viven en
el mismo bloque `if (!session)` de esa página — no separarlos sin querer.

## 7. Roles y visibilidad

`GERENCIA` ve todas las cotizaciones y el desglose de costos/margen; `COMERCIAL` solo ve
las que él mismo creó (`creadoPorId`), tanto en el listado como en el detalle (el detalle
hace su propio chequeo con `notFound()` en vez de un 403, para no confirmar que el ID
existe si alguien adivina/comparte un link interno).

## 8. Comandos útiles (dentro de `sistema/`)

```
npx tsc --noEmit          # typecheck rápido
npm run build              # check-naming.mjs + prisma generate + next build (el real antes de push)
npx prisma migrate deploy  # aplicar migraciones pendientes (local o, con la URL correcta, producción)
npx prisma generate        # regenerar el client tras tocar schema.prisma
```

Postgres local para dev: si `npx prisma migrate deploy`/`generate` fallan con
`Can't reach database server at localhost:5432`, el cluster local no está arrancado —
`service postgresql start` (cluster `16/main` en este entorno de desarrollo).

## 9. Mapa de archivos clave

| Archivo | Qué hace |
|---|---|
| `prisma/schema.prisma` | Todo el modelo de datos |
| `src/lib/pricing.ts` | Motor de precios — `calcularLavado(MultiItem)`, `calcularInspeccion`, `calcularCare(Todos)`, `descuentoVolumen` |
| `src/lib/dto.ts` | `getCotizacionClienteDTO` — Regla A vive acá |
| `src/lib/email.ts` | Envío de correo (Gmail/nodemailer) |
| `src/app/actions/cotizaciones.ts` | Server actions: `computarPuntual`/`crearCotizacionPuntual`, `computarCare`/`crearCotizacionCare`, `previsualizar*`, `aprobarCotizacion`/`rechazarCotizacion`/`marcarEnviada` |
| `src/app/propuesta/[id]/page.tsx` | Página pública que ve el cliente (por `linkToken`) — tracking de apertura + notificación |
| `src/app/propuesta/[id]/AceptarButton.tsx` | Botón de aceptación del cliente |
| `src/app/cotizaciones/[id]/page.tsx` | Panel interno — recalcula precios en vivo desde el snapshot |
| `src/app/cotizaciones/page.tsx` | Listado agrupado por cliente, con historial de correcciones colapsado |
| `src/app/cotizador/CotizadorForm.tsx` | Formulario Familia 1 (puntual) |
| `src/app/care/CareForm.tsx` | Formulario Familia 2 (Care) |

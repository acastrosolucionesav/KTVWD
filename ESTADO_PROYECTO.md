# ESTADO DEL PROYECTO — Sistema Comercial KTV Working Drone

> Documento de continuidad. Si eres un nuevo asistente de Claude Code retomando este
> repositorio: **lee primero la skill** `.claude/skills/ktv-working-drone/SKILL.md`
> (reglas de negocio) y luego este archivo (dónde vamos). Todo el trabajo está en este
> repo — nada depende de un chat anterior.

Última actualización: julio 2026.

---

## 1. Qué estamos construyendo
El motor comercial digital de KTV: páginas públicas de venta + un cotizador interno que
genera propuestas sin errores.

**Paleta (azul DEFINITIVO de marca — CONFIRMADO Y CERRADO por Gerencia 2026-07-11):** UN SOLO
azul corporativo **#66C3F8 (RGB 102,195,248)** — medido por Gerencia con cuentagotas del
PowerPoint oficial de marca. No hay un segundo azul "oscuro"; es el único. Carbón **#171E27**
únicamente para el fondo de zonas neutras oscuras (hero/encabezado con video) y para el TEXTO de
títulos de sección sobre blanco. Fondos claros #EBF8FF/#F7FBFF.
**Regla de aplicación:** toda caja destacada (filas de TOTAL, encabezados de tabla, tarjeta
"Recomendado", botones CTA) lleva el azul **como relleno sólido** (fondo azul + texto blanco) —
el carbón nunca reemplaza al azul en un elemento prominente, solo es color de texto/neutro.
⚠️ HISTORIA DE COLOR (pasamos por 5 azules — no repetir): #2E75B6 (error inicial) → #34C7FF
("web code" del manual, pastel) → #02BEFD (portada PDF KTV Care) → #41B6E6 (sRGB declarado del
manual) → **#66C3F8 DEFINITIVO (medido del PPT por Gerencia y confirmado)**. El manual es
inconsistente entre sus propios valores; ante cualquier nuevo material con otro tono, preguntar
a Gerencia ANTES de cambiar. Todo (landing, brochure, cotizador, ambos formatos) está en #66C3F8.

## 2. Hosting y arquitectura (IMPORTANTE)
- **Repo:** `acastrosolucionesav/KTVWD`. Debe ser **PRIVADO** (contiene costos, márgenes,
  estudio de mercado y el cotizador = confidencial de Gerencia).
- **Aislamiento por carpeta + Output Directory explícito (2026-07-12 — INCIDENTE DE
  SEGURIDAD REAL, cerrado el mismo día):** cada proyecto de Vercel conectado a este
  repo tiene su PROPIA carpeta como "Root Directory" — pero **eso solo no basta**.
  Ya NO se depende de `.vercelignore` (se eliminó por completo).
  - **`landing/`** → proyecto Vercel `ktvbrochure`, Root Directory = `landing`,
    Output Directory = `.` (explícito, ver abajo por qué), publica en
    `landing.ktvworkingdrone.com.co`. Contiene SOLO `index.html`, `planes.html`,
    `videos/`, `img/`.
  - **`sistema/`** → proyecto Vercel `ktv_propuestas`, Root Directory = `sistema`,
    publica en `propuestas.ktvworkingdrone.com.co`.
  - **⚠️ EL INCIDENTE:** al quitar `.vercelignore` y confiar solo en "Root
    Directory", `ktvbrochure` (framework "Other", sin Build Command, Output
    Directory vacío) siguió sirviendo **el repositorio COMPLETO** — se confirmó en
    vivo que `landing.ktvworkingdrone.com.co/cotizador.html` abría el cotizador
    interno completo (motor de precios, fees, márgenes) al público, y `sistema/`
    también habría sido alcanzable. Root Directory solo cambia el directorio de
    trabajo para instalar/construir; **NO restringe qué se sirve** si Output
    Directory queda vacío — para un proyecto "Other" sin build, Vercel por defecto
    sirve el checkout completo, no la carpeta de Root Directory.
  - **Contención inmediata:** se quitaron los dos dominios de `ktvbrochure`
    (`landing.ktvworkingdrone.com.co` y `ktvbrochure.vercel.app`) hasta corregir.
  - **Corrección real:** Output Directory de `ktvbrochure` puesto EXPLÍCITAMENTE en
    `.` (override activado) — con Root Directory=`landing` + Output Directory=`.`
    juntos, Vercel sí sirve SOLO esa carpeta. Verificado en vivo tras redeploy:
    `/cotizador.html` → 404, `/` y `/planes.html` → cargan bien. Dominios
    reactivados y confirmados correctos.
  - **Regla para cualquier proyecto nuevo de Vercel conectado a este repo:**
    Root Directory Y Output Directory deben configurarse juntos, explícitamente,
    ANTES de asignarle un dominio — nunca asumir que Root Directory solo alcanza
    para aislar contenido confidencial. Verificar SIEMPRE con la URL `.vercel.app`
    de la build (no el dominio real) antes de reactivar cualquier dominio público.
  - Cada push a `main` despliega ambos proyectos automáticamente (cada uno solo
    reconstruye si cambió algo dentro de su propia carpeta).
- **El cotizador (`cotizador.html`, en la raíz del repo) sigue siendo una herramienta
  de REFERENCIA interna** — no se publica en ningún proyecto (no vive dentro de
  `landing/` ni de `sistema/`), se abre local en el computador de Gerencia.

## 3. Archivos
| Archivo | Qué es | Estado |
|---|---|---|
| `landing/index.html` | Landing de prospección fría (pública) | ✅ liviano (videos externos) |
| `landing/planes.html` | Brochure de planes para cuentas clave (público, SIN precios) | ✅ terminado |
| `cotizador.html` | Cotizador interno: motor de precios + genera propuestas (referencia, no se publica) | 🔨 en desarrollo |
| `landing/videos/` | Videos compartidos (hero.mp4, accion-1, accion-2, hero-side.mp4) | ✅ |
| `landing/img/` | Logos (logo-nav.png negro, logo-footer.png blanco = ktvwd23) | ✅ |
| `ktvwd23.png` / `_white.png` | Logos oficiales master (raíz del repo, no publicados) | ✅ |
| `files (3).zip` + `files (3)/` | Paquete comercial (docx/xlsx) confidencial | referencia |
| `Propuesta Lavado...Plaza Claro.pdf` | Cotización actual de referencia (formato a replicar en web) | referencia |

## 4. Decisiones de negocio ya tomadas (NO re-litigar)
- **Tarifa lista lavado:** $6.000/m². Escalones de negociación puntual: comercial libre
  hasta −2% ($5.880); −2% a −4% ($5.760) requiere Gerencia; bajo −4% doble aprobación.
- **El control real es por MARGEN**, no por precio: alerta amarilla bajo 40%, roja (bloquea,
  requiere aprobación de Gerencia) bajo **35%** — corregido 2026-07-12: el 25% que estaba
  como piso en el código NUNCA se trabaja salvo excepción forzada; el mínimo real es 35%.
  Ya corregido en `pricing.ts` (`PARAMETROS_INICIALES.MARGEN_MINIMO`), en el `Parametro`
  de la BD de dev, y en `cotizador.html` (`P.MARGEN_MIN`).
- **USD 1,5/m²** ya NO bloquea (Noruega confirmó que se puede vender a cualquier precio
  pagando el fee 3,5%); queda solo como referencia.
- **Planes Care:** Inspect (0 lavadas) / Essential ($5.640/m², 1 lavada, "Más popular") /
  Complete ($5.400/m², 2 lavadas, "Máximo valor"). Cada plan incluye NUESTRO informe propio
  (Diagnóstico Visual). El Informe Certificado de Noruega es un **adicional opcional**.
- **Inspección:** por área de TECHO. Fees Noruega 798/1.198/1.598 € (rangos 0-10k / 10-25k /
  25-40k m²). Certificada = 2×fee×EUR + costo día inspección ($814.381). DV propio = $3,5/4,5/5,5M.
  **La inspección es OPCIONAL en el cotizador** (switch): si no hay medida de techo, se cotiza
  "tras medición" y no frena la cotización.
- **TRM y EUR editables** (manual, no automático — para que la cotización sea foto congelada).
- **Cotización puntual:** tiempo Aerocivil, tiempo de ejecución y condiciones de pago son
  **campos MANUALES** (varían por operación / los define el Jefe de Pilotos).
- **Confidencialidad:** fees, márgenes y costeo son de Gerencia. Propuestas al cliente llevan
  marca de agua con nombre + ID de trazabilidad.
- **Costeo — hueco abierto:** el dron de inspección (Matrice 4T) cuesta EUR 8.900 SIN
  transporte ni nacionalización; falta sumar la importación al valor depreciado (confirmar
  con agente de aduana).

## 5. Hecho ✅ / Pendiente 🔲
**Hecho:**
- Landing corregida (3-5×, sin fumigación, con impermeabilización) y aligerada.
- Brochure de planes terminado: hero premium con video al costado, logo real, planes
  protagonistas con frases-gancho y jerarquía, footer con redes + WhatsApp flotante.
- Cotizador: motor de lavado + alertas de margen/negociación + generador de propuesta web
  (Documento B, con marca de agua) + **motor de inspección por techo con switch opcional +
  TRM/EUR editables** (paso 1).
- **Paso 2 — Cotización puntual** (1 lavado + inspección opcional) en web: botón
  "Descargar cotización puntual" → documento tipo Plaza Claro pero HTML, con campos manuales
  (Aerocivil, ejecución, condiciones de pago anticipo/saldo). Función `descargarCotizacionPuntual()`.
- **Paso 3 — Propuesta de paquetes:** cada plan (Inspect/Essential/Complete) muestra debajo del
  precio el **valor del Diagnóstico Visual KTV** (informe propio, ya incluido) y, si el switch de
  inspección está activo, un bloque **"Informe Certificado (adicional opcional)"** con su valor
  propio — nunca incluido en el plan, nunca descontado, sin prometer validez ante aseguradoras.
  De paso se corrigió el plan Complete: antes su texto decía que traía el "informe certificado
  institucional" incluido, lo cual contradecía la regla de negocio (el Certificado SIEMPRE es
  adicional; lo incluido en todos los planes es el Diagnóstico Visual). Aplicado en
  `generarPropuesta()` (vista en pantalla) y `descargarPropuestaHTML()` (documento que recibe el
  cliente) en cotizador.html — probado en navegador real con Playwright.
- **Paso 4 — DOS formatos de alto impacto (2026-07-11, rediseñado con feedback de Gerencia):**
  - **Formato 1 — Cotización sencilla:** el comercial escoge UN producto en el selector
    `cpProducto`: (1) Solo lavado · (2) Lavado + Inspección KTV Colombia (Diagnóstico Visual
    INCLUIDO sin costo, recuadro gancho con su valor; Informe estándar internacional como
    adicional opcional) · (3) Solo inspección con informe bajo estándar internacional.
    El documento sale enfocado en el producto elegido (subtítulo del encabezado cambia).
  - **Formato 2 — Propuesta de paquetes KTV Care** (Inspect/Essential/Complete, valor mensual).
  - **Diseño de ambos:** paleta carbón (#171E27) + cian de marca #34C7FF (Pantone 299C) como
    único azul; **logo blanco INCRUSTADO en base64** (los docs descargados lo muestran siempre);
    **video del encabezado con URL pública** (landing.ktvworkingdrone.com.co/videos/hero.mp4,
    con fallback local) — así el video sí se ve al abrir el documento en cualquier parte;
    **textos justificados**; títulos de sección con barra cian.
  - **Textos:** lavado = "agua a alta presión" (sin "pura", sin "temperatura controlada");
    eliminado "informe propio" en todas partes (queda "Diagnóstico Visual KTV").
  - **Sin m² al cliente** en ningún documento; campo **Observaciones** (lo escribe el comercial).
    Condiciones de pago, días Aerocivil y ejecución = campos manuales del comercial.
  - **Precio del informe estándar alineado al Excel KWD-FIN-MPV-001 v1.5:** la inspección usa
    MEDIO día de operación (nuevo parámetro `DIAS_INSPECCION: 0.5`) → Certificada = 2×fee×EUR +
    $407.190 (antes sumaba el día completo $814.381 de más). Valores: ~$7,43M / $10,95M / $14,47M.
    El Excel también confirma márgenes: DV ~85-89%, Certificada ~44-45%.
  - Probado con Playwright los 3 productos del F1 + F2 sin errores de consola.
- **Paso 5 — Naming correcto según KWD-SIS-PROMPT-001 v2 (2026-07-11):**
  - Renombrado en TODO cotizador.html: nunca decir "Certificado"/"Inspección Certificada" →
    ahora **"Informe Internacional KTV"**. Nunca prometer validez ante aseguradoras (se quitó
    esa mención de un texto interno que la tenía).
  - **Diagnóstico Visual KTV** ahora se presenta siempre como *"elaborado con apoyo de
    inteligencia artificial"* (descripción completa) / *"(con IA)"* (etiquetas cortas) —
    decisión de posicionamiento que se mantiene siempre, por instrucción de Gerencia.
  - "Certificado de Explotador UAS" (Aerocivil) NO se tocó — es un producto real distinto,
    no es el informe.
- **Paso 6 — Correcciones de flujo (2026-07-11):**
  - **"Solo inspección" estaba mal armada:** vendía directo el Informe Internacional KTV como
    único producto. Corregido según v2: la base pagada es el **Diagnóstico Visual KTV**
    (cobrado, no hay lavado con qué regalarlo) + el **Informe Internacional KTV como adicional
    activable** (mismo switch `inclInsp` + techo que ya usan las otras 2 opciones).
  - **Paquetes ya no dice "Agendar inspección sin costo":** ese CTA era de prospección fría;
    la propuesta de paquetes se presenta DESPUÉS de la cotización/inspección inicial. Ahora
    tiene un bloque **"Aceptación de la propuesta"** con el número de propuesta y un enlace de
    WhatsApp para "Confirmar aceptación" — sin firma física (no hay documentos físicos). La
    condición "inspección técnica inicial sin costo" se cambió por "alcance y valor definitivo
    ya confirmados con la inspección inicial realizada".
  - **Pendiente para Fase 2 (anotado, no implementado aún):** cuando el cliente acepte desde el
    link real de la propuesta, el sistema debe (a) marcar la cotización como
    `aceptada_por_cliente` con fecha/hora, (b) generar automáticamente la **Orden de Servicio
    Comercial interna para Operaciones — SIN cifras** (ya definido en skill: solo "Anticipo
    confirmado Sí/No"), (c) quedar en auditoría quién aceptó y cuándo. Un HTML descargado no
    puede disparar esto — necesita el backend de Fase 2 (Módulo 2).

**Fase 2 — sistema con backend (KWD-SIS-PROMPT-001 v2): Módulo 1 EN PROGRESO, demo funcionando**
- Nace `sistema/` (Next.js 16 + TypeScript + Prisma 7 + Postgres) — un sistema NUEVO,
  no una extensión de `cotizador.html` (que queda solo como referencia de fórmulas/estética).
  Ver `sistema/README.md` para cómo correrlo y las decisiones de stack en detalle.
- **Hosting: EN PROGRESO (2026-07-12).** Gerencia ya tenía Vercel (con el sitio público,
  proyecto `ktvbrochure`) y un segundo proyecto reservado sin conectar: `ktv_propuestas`
  → dominio **`propuestas.ktvworkingdrone.com.co`** (ya asignado, DNS ya apuntando). Base
  de datos: **Neon Postgres** (proyecto `ktv-sistema-comercial`, plan Free), cuenta creada
  por Gerencia con guía paso a paso. Falta: conectar `ktv_propuestas` al repo (Root
  Directory = `sistema`), variables de entorno, y el primer deploy.
- **Migración de SQLite a Postgres — HECHA (2026-07-12).** El motor corre 100% en Postgres
  ahora (`datasource db { provider = "postgresql" }`), tanto en desarrollo como en
  producción — ya no hay SQLite en el proyecto. Adaptador: `@prisma/adapter-pg` (Postgres
  estándar por TCP), reemplaza a `@prisma/adapter-better-sqlite3`.
  - ⚠️ **Restricción de red del entorno de este agente:** no puede conectar directo a Neon
    (ni por TCP puerto 5432 ni por el endpoint HTTP de `@neondatabase/serverless` — ambos
    bloqueados por la política de salida de red de este entorno, no es un problema de
    Neon ni del código). Por eso `prisma migrate deploy` no se puede correr desde aquí
    contra la base de producción.
  - **Solución adoptada:** las migraciones se generan sin conexión (`prisma migrate diff
    --from-empty --to-schema`, que solo lee el schema, no conecta a ninguna base) y el SQL
    resultante se ejecuta manualmente en el **SQL Editor de Neon** (acceso desde el
    navegador de Gerencia, sin la restricción). Se generó también el seed de producción
    (3 usuarios + parámetros) como SQL plano con los hashes de contraseña ya calculados
    (bcrypt no necesita red) — un solo archivo `00_inicializar_produccion.sql` para pegar
    y correr una vez. Mismo procedimiento para cualquier cambio de schema futuro, hasta
    que se confirme que Vercel sí puede correr `prisma migrate deploy` automáticamente en
    su build (Vercel no tiene la restricción de red de este agente, así que debería
    funcionar — pendiente de confirmar en el primer deploy real).
  - **Para las pruebas de este agente:** se instaló PostgreSQL 16 local dentro del propio
    entorno (base `ktv_dev`, sin salida a internet — cumple lo acordado de nunca tocar la
    base real para pruebas). Todo el flujo (Familia 1, Familia 2, aceptación de propuesta,
    parámetros) se reverificó de punta a punta contra Postgres real y pasó limpio (10/10).
  - **Nota de depuración:** durante esta verificación apareció un falso positivo (un
    `textContent('body')` capturaba el payload interno de React, no el texto visible) y un
    bloqueo real de Next.js 16 al acceder por `127.0.0.1` en vez de `localhost` (política
    `allowedDevOrigins`) — ambos eran del método de prueba, no del sistema; ya identificados
    y evitados.
- **Módulo 1 (Cotizador) — lo que YA funciona, probado de punta a punta con Playwright:**
  - Login con 3 roles (Comercial/Director Comercial/Gerencia), sesión con `jose`+cookie
    httpOnly (NextAuth v5 seguía en beta con soporte incierto en Next 16 — se optó por el
    patrón que la propia documentación oficial de Next 16 recomienda: DAL + DTO).
  - Cotizador Familia 1 completo (los 3 servicios puntuales), con el motor de precios
    portado 1:1 de `cotizador.html`/Excel (`src/lib/pricing.ts`).
  - **Regla A real (no cosmética):** el documento de cliente sale de un DTO
    (`src/lib/dto.ts`) que estructuralmente no tiene fee/costo/margen — verificado que el
    rol Comercial NO ve "Fee Noruega" en ninguna pantalla, y que Gerencia sí lo ve en el
    panel interno.
  - **Regla B** (mostrar/no mostrar Informe Internacional) funcionando por cotización.
  - Aprobación: cotizaciones bajo el margen mínimo quedan `PENDIENTE_APROBACION`, solo
    Gerencia aprueba/rechaza.
  - Propuesta pública sin login (`/propuesta/[id]`) con el naming correcto y sin m².
  - **Al aceptar el cliente, se genera automáticamente la Orden de Servicio interna SIN
    CIFRAS** (verificado en base de datos: solo `anticipoConfirmado: false`) + auditoría
    completa (creó → envió → aceptó_cliente).
- **Familia 2 (Care) — YA construida y probada (2026-07-12):** formulario `/care` (plan,
  cliente, m², techo, contrato 1/3 años, forma de pago, observaciones), página de detalle
  y propuesta pública funcionando. El DTO recalcula el valor del Diagnóstico Visual incluido
  desde el `snapshotParametros` CONGELADO de la cotización (nunca de parámetros vigentes hoy).
  Probado con Playwright: crear cotización Care Complete, ver detalle (Comercial no ve
  costos), ver propuesta pública (muestra "Diagnóstico Visual KTV (con IA) · valor de
  referencia", sin m², con aceptación) — todo correcto.
  - ✅ **Motor de costo/margen real para Care — HECHO (2026-07-12):** `calcularCare` ahora
    devuelve el desglose completo año 1 (costo lavadas con productividad MIXTA conservadora,
    costo inspección/DV, fee Noruega 3,5% sobre valor anual, comisión 5% año 1, margen $ y %).
    Las cotizaciones Care pasan por el MISMO control que Familia 1: bajo el 35% nacen en
    `PENDIENTE_APROBACION`. El panel de Gerencia en el detalle muestra el desglose real,
    recalculado SIEMPRE desde el `snapshotParametros` congelado (nunca de los parámetros de
    hoy). Verificado numéricamente (márgenes 37-77% en todos los planes/tamaños) y con
    Playwright de punta a punta: Comercial crea Care Essential (150 m², techo 8.000) y NO ve
    ningún costo; Gerencia ve el desglose con margen 60,7% (coincide exacto con el numérico).
    De paso se corrigió `CARE_ESSENTIAL_DESC` de 0,06 a 0,05: la regla de negocio siempre
    dijo Essential = $5.700/m² y el código tenía $5.640 por error (también en cotizador.html,
    incluido el texto visible del plan).
- ✅ **Panel de administración de parámetros — HECHO (2026-07-12). MÓDULO 1 COMPLETO.**
  Ruta `/parametros`, SOLO Gerencia (otros roles redirigen a /cotizador; link en NavBar
  solo visible para Gerencia). Todos los parámetros del motor editables desde pantalla,
  agrupados con etiquetas en español (Lavado / Costos de operación / Inspección / Care /
  Financieros), con notas en los sensibles (fee Noruega confidencial, placeholders
  pendientes). Guarda con rastro (`actualizadoPor`/`actualizadoAt`). Los cambios rigen
  SOLO para cotizaciones futuras (las creadas conservan su snapshot congelado — el aviso
  está en la propia pantalla). Probado e2e con Playwright: Gerencia cambia tarifa
  6000→6500 → cotización nueva sale a $9.750.000 (1.500 m²) → restaurada a 6000;
  Comercial no puede entrar a /parametros.
- ✅ **Módulo 2 (presentador de propuestas) — HECHO (2026-07-12):**
  - **Link único NO adivinable:** cada cotización tiene un `linkToken` (cuid) y la página
    pública `/propuesta/[token]` busca SOLO por ese token — nunca por `idTrazabilidad`
    (que es secuencial por fecha y un tercero podría enumerar). Migración
    `modulo2_presentador` con backfill de tokens aleatorios para filas existentes
    (producción-segura, sin reset).
  - **Desactivación:** botón Desactivar/Reactivar link en el detalle (cualquier usuario,
    queda en auditoría `desactivo_link`/`reactivo_link`). Link inactivo → el cliente ve
    un mensaje amable SIN ningún dato de la propuesta, y `aceptarPropuesta` se bloquea.
  - **Tracking de apertura:** cada visita SIN sesión registra `Apertura` (con user-agent);
    las vistas del equipo logueado NO cuentan. El detalle muestra el contador y las
    últimas 5 aperturas.
  - **Catálogos integrados al recorrido** (instrucción de Gerencia): la propuesta pública
    de Familia 1 incluye el bloque de calentamiento "Programa KTV Care" con link al
    catálogo de planes (colombia.ktvworkingdrone.com.co/planes.html), y toda propuesta
    lleva el pie institucional con link a la landing de prospección en frío. Recorrido:
    frío → calentamiento → propuesta con precios.
  - Probado e2e con Playwright (5 flujos): link generado ≠ idTrazabilidad; vista interna
    no cuenta apertura; cliente sin sesión cuenta (2 aperturas); desactivar oculta TODO y
    reactivar restaura; aceptación del cliente dispara Orden de Servicio + auditoría.
  - Para producción: definir `NEXT_PUBLIC_APP_URL` (el detalle lo usa para mostrar el
    link completo a copiar).
- **Siguiente: Módulo 3 (Pipedrive — pedir token API a Gerencia en ese momento)**, luego
  Módulo 4 (alertas). En paralelo: preparación de despliegue (Vercel + Neon Postgres +
  subdominio app.ktvworkingdrone.com.co).

**Costeo de la inspección propia (Diagnóstico Visual) — CERRADO 2026-07-12**
Las 3 respuestas de Gerencia que faltaban ya están aplicadas en **ambos** motores
(`cotizador.html` y `sistema/src/lib/pricing.ts`):
1. **Dron 4T puesto en Colombia:** EUR 8.900 (precio base confirmado en BlueTag, ref.
   WS00000236) **× 1,5** (import + transporte = 50% del valor del dron, confirmado por
   Gerencia) → depreciado con la misma convención que el resto de equipos (valor/vida/366,
   vida útil 2 años). Parámetros nuevos: `DRON_4T_EUR`, `FACTOR_IMPORT_TRANSPORTE`,
   `DRON_4T_VIDA_ANIOS`.
2. **Días de campo:** ya NO es medio día fijo — escala con el área de techo
   (`PROD_INSPECCION_M2_DIA`, redondeo a medio día, mínimo medio día). ⚠️ El valor de
   productividad (20.000 m²/día) es un **placeholder** — falta calibrarlo con Órdenes de
   Vuelo reales, igual que se hace con la productividad del lavado.
3. **Costo de construir el informe** (análisis + edición de videos): Gerencia aclaró que
   esto se construye junto con este proyecto y todavía no hay una cifra — el parámetro
   `COSTO_INFORME_ANALISIS` queda en **0, marcado como pendiente explícito** (no se inventó
   un número; cuando se defina, sumarlo ahí).

**Resultado con los datos reales** (antes vs. después, techo 15.000 m²): margen del
Diagnóstico Visual baja de ~87% a **74,4%**, margen del Informe Internacional sube
ligeramente a **~42%** (sigue sobre el objetivo de 40%). El motor ahora sí costea y muestra
el margen de la inspección (antes solo costeaba el lavado) — visible en el panel interno de
`cotizador.html` y en el detalle de cotización de `sistema/`.

**Bug corregido — margen real de "Lavado + Inspección" en `sistema/` (2026-07-12):**
Gerencia preguntó si el Diagnóstico Visual que se regala en el combo Lavado+Inspección se
está costeando internamente aunque al cliente se le presente como gratis. Al verificar el
código de `crearCotizacionPuntual` se encontró que SÍ tenía un hueco real: el cálculo de
margen para `LAVADO_MAS_INSPECCION` ignoraba por completo el costo de producir el DV
regalado (dron + cuadrilla), solo restaba el costo del lavado. Corregido: ahora
`costoOperacionTotal` para ese caso = costo del lavado + `costoOperacionInsp` del DV
regalado (el DV gratis no genera fee Noruega porque no factura esa parte). Verificado con
números reales (300 m² fachada + techo 8.000 m²): el margen reportado ANTES del fix era
44,6% (pasaba como BORRADOR sin revisión); el margen REAL después del fix es 17,0% —
por debajo del mínimo (25%), por lo que esa cotización debería quedar
`PENDIENTE_APROBACION` y antes no quedaba. Es decir: sin este fix se estaban aprobando
automáticamente combos que en la práctica no cumplían el margen mínimo. Build verificado
(`npm run build` OK, 8 rutas). Push hecho a `claude/ktv-working-drone-system-ms0e2u`.

**Corrección del piso de margen mínimo: 25% → 35% (2026-07-12, mismo día):**
Gerencia aclaró, tras ver el ejemplo del 17%, que el 25% que estaba como piso NUNCA se
trabaja salvo excepción forzada — el mínimo real establecido es **35%**. Corregido
`MARGEN_MINIMO` de 0,25 a 0,35 en `sistema/src/lib/pricing.ts` (con su comentario de
origen), en el registro `Parametro` de la base de datos de desarrollo (ya estaba
sembrado con 0,25 y el seed no lo sobreescribe — se actualizó directo en la BD), y en
`cotizador.html` (`P.MARGEN_MIN`). Se confirmó además que la tarifa de lavado en
`sistema/` siempre usa `TARIFA_LISTA` ($6.000/m²) sin ningún campo de descuento en el
formulario — no hace falta cambio de código para "trabajar el metro a 6.000", ya es así.
Build verificado de nuevo tras el cambio (OK, 8 rutas).
- ⚠️ **Hallazgo pendiente de decisión de Gerencia (no corregido todavía):** el
  `cotizador.html` viejo (Formato 1, "Opción B: Lavado + Diagnóstico") todavía SUMA el
  valor del DV al precio total (lo cobra), no lo regala como gancho — es decir, no sigue
  la regla de "Lavado + Inspección KTV Colombia" del Paso 4/KWD-SIS-PROMPT-001 v2 donde el
  DV va incluido sin costo. `cotizador.html` es solo la herramienta de referencia (el
  sistema real que se está usando para cotizar es `sistema/`), así que esto no bloquea
  nada hoy, pero si Gerencia sigue usando ese HTML para cotizar en paralelo hay que
  decidir si se alinea o se retira de uso.

**Auditoría completa de precios + 3 decisiones de Gerencia aplicadas (2026-07-12):**
Se auditó TODO el motor (los 3 productos puntuales + los 3 planes Care, edificios de 30 a
5.000 m² de fachada y techos de 3.000 a 50.000 m²). Hallazgos y decisiones:
1. **Cargo mínimo por proyecto de lavado = $1.500.000** (`MINIMO_PROYECTO_LAVADO`):
   sin piso, las fachadas chicas daban margen negativo (30 m² → -377%; en combo hasta
   -1.481%) porque el costo de operar no baja de medio día. Con el piso, Solo Lavado queda
   en ≥35,3% en TODOS los tamaños. Aplicado en ambos motores.
2. **Piso de mercado del Informe Internacional = $9.000.000** (`INT_PISO_MERCADO`):
   el estudio de mercado (jul-2026, YAM/CYPE/Aerially) recomendó $9M-$18M; nuestra fórmula
   daba $7,5M en el tramo pequeño. Con el piso: $9M (margen 52%) / $11,5-12M / $15,5-16M —
   todos dentro del rango de mercado. Los tramos mediano/grande no cambian.
3. **Brecha corta Inspect↔Essential es INTENCIONAL** (decisión previa de Gerencia,
   reconfirmada): Essential cuesta poco más que Inspect a propósito para empujar la venta
   hacia Essential. Se DESCARTÓ la propuesta de pisos de brecha mínima entre planes. No
   tocar.
   También se corrigieron los "25%" quemados que quedaban en pantallas (alerta y "precio
   mín. autorizado" de cotizador.html, semáforo del detalle en sistema/) → ahora 35%.
   **Nota comercial que queda de la auditoría:** el combo Lavado+Inspección con DV
   regalado en fachadas chicas (< ~1.000 m²) sigue dando margen bajo/negativo aunque con
   el cargo mínimo — es estructural (se regala un DV que cuesta ~$0,5-1,5M sobre una
   venta de $1,5-3M). El sistema los bloquea en PENDIENTE_APROBACION; la regla comercial
   sana es: en edificios chicos NO regalar el DV (vender Solo Lavado, o Solo Inspección,
   o Care), el combo con regalo es para fachadas grandes.

**Pendiente (fase de precios) — ya no crítico, son ajustes finos:**
- 🔲 Calibrar `PROD_INSPECCION_M2_DIA` con datos reales de Órdenes de Vuelo.
- 🔲 Definir `COSTO_INFORME_ANALISIS` cuando se construya el proceso de análisis/edición.
- ✅ Extender `calcularCare` (Familia 2) para costo/margen en vivo — HECHO 2026-07-12 (ver arriba).
- 🔲 Panel de administración de `parametros` (siguiente paso del checklist).
- 🔲 Módulo 2 (backend): links únicos, desactivación, tracking de apertura, Pipedrive (futuro).

## 6. Cómo retomar (para el próximo Claude)
1. Lee `.claude/skills/ktv-working-drone/SKILL.md` (reglas) y este archivo (estado).
2. El cotizador se prueba abriéndolo local; los videos no decodifican en navegador headless
   (códec H.264) pero sí en un navegador real.
3. Para editar video hay ffmpeg completo vía `pip install imageio-ffmpeg`.
4. Cada push a `main` despliega el sitio público en Vercel automáticamente.
5. Continúa cerrando el costeo del dron de inspección (importación/nacionalización) o el
   Módulo 2 (backend: links únicos, tracking, Pipedrive).

## 7. Fondos oscuros con tinte azul — corregido (2026-07-12)
Gerencia detectó, viendo capturas reales del sistema y un documento suyo (`v3soloinspeccion.html`,
propio Downloads), que los encabezados oscuros y el bloque "¿Y después del servicio?" se veían
**"azul oscuro"** en vez de carbón. Causa: usaban degradado `linear-gradient(#222C38, #0B0F14)`
(y en `cotizador.html` un overlay con azul de marca al 30% sobre el video del hero) — ninguno
de los dos es un azul de marca prohibido, pero el resultado visual leía a "marino", no a carbón.
**Corregido a `#171E27` sólido, sin degradado**, en `sistema/src/app/propuesta/[id]/page.tsx`
(encabezado + bloque Care) y en `cotizador.html` (`.hero`, `.hd`, overlay de video). Verificado
con el color computado real del pixel (`rgb(23,30,39)` exacto). Regla añadida a la skill: fondos
oscuros SIEMPRE carbón plano, nunca degradado ni mezcla con el azul.

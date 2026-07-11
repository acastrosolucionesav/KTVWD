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
- **Público (Vercel):** el proyecto `ktvbrochure` en Vercel está **conectado a este repo**
  (rama `main`) y publica en `landing.ktvworkingdrone.com.co`. Cada push despliega solo.
- **`.vercelignore`** hace que Vercel publique SOLO lo público: `index.html`, `planes.html`,
  `videos/`, `img/`. **El cotizador y todo lo demás NO se publican** (quedan internos).
- **El cotizador (`cotizador.html`) es una herramienta INTERNA** — se abre local en el
  computador de Gerencia, nunca se sube a un link público.

## 3. Archivos
| Archivo | Qué es | Estado |
|---|---|---|
| `index.html` | Landing de prospección fría (pública) | ✅ liviano (videos externos) |
| `planes.html` | Brochure de planes para cuentas clave (público, SIN precios) | ✅ terminado |
| `cotizador.html` | Cotizador interno: motor de precios + genera propuestas | 🔨 en desarrollo |
| `videos/` | Videos compartidos (hero.mp4, accion-1, accion-2, hero-side.mp4) | ✅ |
| `img/` | Logos (logo-nav.png negro, logo-footer.png blanco = ktvwd23) | ✅ |
| `ktvwd23.png` / `_white.png` | Logos oficiales master | ✅ |
| `files (3).zip` + `files (3)/` | Paquete comercial (docx/xlsx) confidencial | referencia |
| `Propuesta Lavado...Plaza Claro.pdf` | Cotización actual de referencia (formato a replicar en web) | referencia |

## 4. Decisiones de negocio ya tomadas (NO re-litigar)
- **Tarifa lista lavado:** $6.000/m². Escalones de negociación puntual: comercial libre
  hasta −2% ($5.880); −2% a −4% ($5.760) requiere Gerencia; bajo −4% doble aprobación.
- **El control real es por MARGEN**, no por precio: alerta amarilla bajo 40%, roja bajo 25%.
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

**Pendiente (fase de precios):**
- 🔲 **CRÍTICO antes de dar por terminado el cotizador — costear la INSPECCIÓN PROPIA
  (Diagnóstico Visual).** Aclaración de Gerencia (2026-07-11):
  - El **Informe Certificado de Noruega** SÍ está costeado: los 798/1.198/1.598 EUR son lo que
    Noruega nos cobra **por generar el informe con su ingeniero** (ya incluye ese trabajo).
    Nuestro fee/margen va ENCIMA de ese valor. (El "2×" actual es nuestro markup sobre ese costo.)
  - El **Diagnóstico Visual** (informe PROPIO que construiremos juntos, donde el cliente entra a
    ver los videos) NO está costeado de verdad: hoy `dvPrecio` = $3,5/4,5/5,5M son números fijos
    anclados al precio de referencia, sin verificación. Falta construir el costo real: **valor del
    dron de inspección (Matrice 4T) depreciado + construcción del informe (hora-ingeniero/edición
    de videos) + día(s) de campo + 3,5% Noruega**, y que el motor calcule y muestre su MARGEN
    (hoy `calc()` solo costea el lavado, la inspección no tiene costo ni margen en el motor).
- 🔲 Cerrar el costeo del dron con importación/nacionalización (Matrice 4T EUR 8.900 sin
  transporte ni nacionalización) — es insumo del punto anterior.
- 🔲 Módulo 2 (backend): links únicos, desactivación, tracking de apertura, Pipedrive (futuro).

## 6. Cómo retomar (para el próximo Claude)
1. Lee `.claude/skills/ktv-working-drone/SKILL.md` (reglas) y este archivo (estado).
2. El cotizador se prueba abriéndolo local; los videos no decodifican en navegador headless
   (códec H.264) pero sí en un navegador real.
3. Para editar video hay ffmpeg completo vía `pip install imageio-ffmpeg`.
4. Cada push a `main` despliega el sitio público en Vercel automáticamente.
5. Continúa cerrando el costeo del dron de inspección (importación/nacionalización) o el
   Módulo 2 (backend: links únicos, tracking, Pipedrive).

## 7. Nota de paleta pendiente (no bloqueante)
El **panel interno del cotizador** (`:root` en cotizador.html, línea ~9) todavía define
`--blue:#34C7FF` (cian, diseño original) en vez de `#2E75B6`. No afecta al cliente: el
**documento que se descarga y se envía** (`descargarPropuestaHTML()` / `descargarCotizacionPuntual()`)
ya tiene su propia paleta correcta embebida (`#2E75B6` / `#245E92` / `#1F4E78`), verificado en
pantalla. Solo la vista previa en pantalla del cotizador (uso exclusivo de Gerencia, nunca se
publica) conserva el azul cian heredado. Pendiente decidir si vale la pena alinearlo también
(cambio cosmético, sin impacto en lo que ve el cliente).

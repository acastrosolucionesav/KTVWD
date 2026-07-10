# ESTADO DEL PROYECTO — Sistema Comercial KTV Working Drone

> Documento de continuidad. Si eres un nuevo asistente de Claude Code retomando este
> repositorio: **lee primero la skill** `.claude/skills/ktv-working-drone/SKILL.md`
> (reglas de negocio) y luego este archivo (dónde vamos). Todo el trabajo está en este
> repo — nada depende de un chat anterior.

Última actualización: julio 2026.

---

## 1. Qué estamos construyendo
El motor comercial digital de KTV: páginas públicas de venta + un cotizador interno que
genera propuestas sin errores. Todo con la línea gráfica de la marca (azul #34C7FF / navy #1F4E78).

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
  TRM/EUR editables** (paso 1 de la fase de precios).

**Pendiente (fase de precios):**
- 🔲 **Paso 2 — Cotización puntual** (1 lavado o 1 inspección) en web espectacular, tipo el
  PDF de Plaza Claro pero HTML, con los campos manuales (Aerocivil, ejecución, pago).
- 🔲 **Paso 3 — Propuesta de paquetes:** mostrar el **valor del informe KTV debajo de cada
  plan** + el Certificado como adicional (usando el switch de inspección).
- 🔲 Cerrar el costeo del dron con importación/nacionalización.
- 🔲 Módulo 2 (backend): links únicos, desactivación, tracking de apertura, Pipedrive (futuro).

## 6. Cómo retomar (para el próximo Claude)
1. Lee `.claude/skills/ktv-working-drone/SKILL.md` (reglas) y este archivo (estado).
2. El cotizador se prueba abriéndolo local; los videos no decodifican en navegador headless
   (códec H.264) pero sí en un navegador real.
3. Para editar video hay ffmpeg completo vía `pip install imageio-ffmpeg`.
4. Cada push a `main` despliega el sitio público en Vercel automáticamente.
5. Continúa por el Paso 2.

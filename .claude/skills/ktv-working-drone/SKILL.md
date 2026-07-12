---
name: ktv-working-drone
description: Contexto completo y reglas de negocio de KTV Working Drone Colombia S.A.S. Usar esta skill SIEMPRE que la conversación trate sobre KTV, lavado de fachadas con drones, cotizaciones, precios, paquetes KTV Care, inspecciones, impermeabilización, alianzas, subfranquicias, documentos KWD, el costeo, Aerocivil, el franquiciante Noruega, BlueTag, Pipedrive, o cualquier tarea comercial, financiera o documental de la empresa — incluso si el usuario no menciona "KTV" explícitamente pero habla de drones de lavado, fachadas, o su empresa.
---

# KTV Working Drone Colombia — Skill de contexto y reglas de negocio

Skill privada de Gerencia. Contiene el contexto validado y las decisiones vigentes de la empresa
para que Claude trabaje sin re-explicar nada y sin contradecir decisiones ya tomadas.

## 1. Identidad

- **Empresa:** KTV Working Drone Colombia S.A.S. — NIT 901.830.814-8 (antes "Lion Clean"/"LionCleaning S.A.S.", rebranding 2026; auditar documentos heredados por contaminación de marca, códigos LC- y azul incorrecto #17365D).
- **Franquicia master** de KTV Working Drone AS (Noruega), grupo presente en 68 países. Territorio exclusivo: Colombia. Inversión: USD 60.000 fee inicial + EUR 100.000 en cuotas 2026.
- **Servicios:** lavado, inspección e impermeabilización de fachadas con drones (UAS).
- **Ventaja regulatoria:** único operador con Certificado de Explotador UAS vigente de Aerocivil en su categoría (proceso de 2 años; RAC 100). Manuales MO, MCM y MSMS aprobados en Biblioteca Técnica.
- **Flota:** DJI Matrice 350 RTK + Autel EVO II Pro V3; robot J1 (X-Human) — **el robot es capacidad interna RESERVADA, nunca se ofrece comercialmente** (ventaja competitiva, pendiente OK escrito de Noruega).
- **Personas clave:** Aura Alexandra Castro Díaz (Gerente Responsable/Rep. Legal), Ing. Jhon Sebastián Rodríguez López (Seguridad Operacional), Daniel Velásquez Melo (Jefe de Pilotos).
- **Plataformas:** BlueTag (obligatoria, USD 350/mes, toda facturación pasa por ahí), Pipedrive (CRM).

## 2. Estándares de documentos (obligatorios)

- Código de documentos: prefijo **KWD-**. **Azul corporativo oficial: #66C3F8 (RGB 102,195,248)** — medido por Gerencia con el cuentagotas directamente del PowerPoint oficial de marca (2026-07-11). **CONFIRMADO Y CERRADO por Gerencia el mismo día** ("por fin lo lograste"). Es el ÚNICO azul de marca, no hay un segundo tono "oscuro" distinto. Carbón/negro **#171E27** solo para: fondo de zonas neutras oscuras (hero/encabezado con video) y para el TEXTO de los títulos de sección sobre blanco. Logo ktvwd23. Español.
  - **Regla de aplicación (para que no se repita el error del carbón):** toda caja destacada — filas de "TOTAL", encabezados de tabla, tarjeta "Recomendado", botones de llamado a la acción — lleva el **azul #66C3F8 como relleno SÓLIDO** (fondo azul, texto blanco), nunca carbón. El carbón NO reemplaza al azul en ningún elemento prominente; solo se usa como color de texto/neutro de fondo, nunca donde debería resaltar la marca.
  - ⚠️ HISTORIA (no repetir): el manual da valores inconsistentes entre sí — texto "web code #34C7FF", sRGB declarado 65/182/230 (#41B6E6), portada del PDF #02BEFD — y ninguno coincidía con lo que Gerencia reconoce como su marca. El cierre fue medir el PPT oficial: **#66C3F8**. NO usar #34C7FF, #41B6E6, #02BEFD ni #2E75B6. Si aparece otro material con otro tono, preguntar a Gerencia ANTES de cambiar nada.
- **Protocolo de trabajo:** pausar antes de generar cualquier documento; confirmar alcance con preguntas de opción múltiple; trabajar un punto a la vez; documentos separados, nunca combinados; versionar (v1.0, v1.1...) y actualizar el **Índice Maestro KWD-GES-IDX-001**, que es la única fuente de verdad sobre qué documento está vigente.
- Al corregir un documento, retirar la versión obsoleta y registrar en el índice el porqué del reemplazo.
- Documentos vigentes: KWD-EST-EMC-001 (+A1) estudio de mercado; KWD-COM-PSV-001 v1.2 (+A1 v1.1) portafolio y KTV Care; KWD-FIN-MPV-001 v1.5 modelo de precios; KWD-EXP-MOD-001 v1.0 expansión; KWD-COM-PCM-001 v1.0 plan de comisiones y metas; KWD-JUR-ANC-001 y KWD-JUR-AMA-001 (borradores para Aseo Diamante, sujetos a revisión legal); KWD-COM-BRO-001 brochure de paquetes con precios (cuentas clave); KWD-COM-WEB-001 correcciones del brochure público; KWD-SIS-PROMPT-001 prompt maestro para Claude Code; KWD-GES-IDX-001 índice maestro.

## 3. Parámetros económicos vigentes (validados con datos reales)

| Parámetro | Valor |
|---|---|
| Tarifa de lista lavado | $6.000 COP/m² + IVA (centro de la banda del franquiciante) |
| Banda del franquiciante | USD 1,5–2,0 por m² (~$5.590–$7.450) |
| Fee a Noruega | **3,5% de toda la facturación** (el "Royalty 10% + Comisión 7%" del costeo viejo era error de plantilla Chile) |
| Comisiones comerciales | 5% venta en frío / 3% referido-redes-web / 1% renovación — sin IVA, contra recaudo. Básico $2M prestacional + bono $500K |
| Cuadrilla por día | $524.049 (2 pilotos $171.435 c/u + conductor $181.179; conductor: $2M base + $500K bono) |
| Consumibles por día | $260.034 (incluye combustible ~$150.172/día — **la gasolina NUNCA se cobra aparte**, ya está aquí) |
| Depreciación equipos/día | $683.118 (flota total $587.765.596; dep = valor/vida/366) |
| Costo operativo por día | ~$1.687.281 (directo × 1,15 de admin+imprevistos) |
| Estructura (NO va al costo por proyecto) | Jefe de Pilotos $4,93M/mes, Líder Operaciones $4,93M/mes, Gerente SMS $3,12M/mes → costos fijos |
| Productividades de partida | vidrio 1.350 / mixta 900 / difícil 600 m²/día — calibrar con m²/día real de cada Orden de Vuelo |
| Recargos | Tipo edificio y dificultad: Bajo 0% / Medio 5% / Alto 10% |
| Margen mínimo sin aprobación | **35%** (confirmado por Gerencia 2026-07-12 — el 25% NUNCA se trabaja salvo excepción forzada; no confundir con el piso de tarifa). Bajo 35%: aprobación Gerencia. Bajo USD 1,5/m²: doble aprobación |
| Fijos mensuales | ~$20,7M (BlueTag + comercial + estructura + admin). Punto de equilibrio ~7.660 m²/mes |
| Inversión franquicia a recuperar | ~$663,6M (los equipos NO: se recuperan vía depreciación por proyecto) |

## 4. Reglas de negocio innegociables

1. **Se cotiza al cliente POR METRO; el costo se verifica POR DÍAS.** Puente: días = m² ÷ productividad (redondeo a medio día). Nunca cotizar por días al cliente (traslada el riesgo de productividad, que es nuestra ventaja).
2. **La cotización siempre muestra el VALOR TOTAL del proyecto primero**; el m² va en anexo. Formato estándar: menú de 3 opciones (A puntual / B lavado+diagnóstico / C KTV Care) para desplazar la conversación de "¿cuánto el metro?" a "¿cuál opción?".
3. **Inspección: se cobra por SITIO según área de TECHO** (798/1.198/1.598 EUR son lo que Noruega COBRA a KTV por informe, no precio de venta). Dos niveles: **Diagnóstico Visual KTV** (informe propio, ~$3–5,5M según techo, el único producto regalable como gancho) e **Inspección Certificada** (precio = 2× fee Noruega + operación, ~$8–15M, NUNCA se descuenta). El informe certificado se vende como "soporte técnico bajo estándar internacional" — **sin prometer validez ante aseguradoras** hasta verificarla.
4. **Impermeabilización = DOS pasadas** (lavar, secar, aplicar) + material. Se cotiza como línea separada del lavado, nunca como "el doble de metros". El Sika se cotiza por edificio.
5. **Terceros y materiales: NUNCA se absorben al costo** — se facturan al cliente con +15% de administración.
6. **Pago diferido a 12 meses NO es descuento** (mismo precio, solo se difiere el cobro). Descuento solo por pago anticipado. Nunca acumular descuento Care + descuento por diferir.
7. **Paquetes KTV Care:** Inspect (informe a elección DV o Certificado) / Essential (DV incluido + 1 lavada a $5.700/m²) / Complete (DV incluido, Certificado en versión institucional, + 2 lavadas a $5.400/m²). Contrato 3 años sin descuento adicional: congela precio año 1 + IPC. Márgenes ~54–63%.
   - **La brecha corta entre Inspect y Essential es INTENCIONAL** (confirmado por Gerencia 2026-07-12): en edificios chicos Essential cuesta apenas ~8-25% más que Inspect a propósito, para empujar la venta hacia Essential. NO "corregir" esto con pisos de diferencia entre planes.
8. **Cargo mínimo por proyecto de lavado: $1.500.000** (`MINIMO_PROYECTO_LAVADO`, aprobado por Gerencia 2026-07-12). El precio del lavado nunca baja de ahí aunque los m² den menos — el costo de salir a operar no baja de medio día, y sin este piso las fachadas chicas daban margen negativo (hasta -377%).
9. **Piso de mercado del Informe Internacional: $9.000.000** (`INT_PISO_MERCADO`, aprobado por Gerencia 2026-07-12 con base en el estudio de mercado de julio 2026: firmas colombianas de patología cobran $8-20M por edificio mediano). Solo afecta el tramo pequeño (la fórmula 2×fee+operación daba $7,5M ahí); los tramos mediano/grande ya lo superan.
8. **Mercado excluido:** condominios residenciales habitados (directriz del franquiciante). Edificios residenciales EN CONSTRUCCIÓN sí, vía constructora.
9. **Competencia de precio bajo** (XDroneCleaner B/quilla $1.500–4.500): nunca seguir el $1.500 (bajo el piso de cualquiera); el $4.500 es peleable desde ~750 m²/día. La venta se gana con costo total y riesgo (SST Res. 4272/2021, días de interferencia, daño de fachada, certificación verificable en el listado público de Aerocivil), no bajando precio.
10. **Nadie opera jamás bajo el certificado UAS de KTV.** Sin excepciones.

## 5. Modelo de expansión (KWD-EXP-MOD-001)

Escalera de 4 modelos — el producto es el catálogo de la Fase 2; esto define el canal:
- **A. Aliado Comercial** (referido): 8–10% por proyecto, contra recaudo.
- **B. Aliado Operador-Comercial** (empresas de aseo): B1 el aliado factura y paga a KTV → fee por plazo de pago: contado 20% / 30d 18% / 60d 15% / 90d 12% (piso), liquidado contra pago efectivo. B2 KTV factura → fee fijo 10%.
- **C. Subfranquicia:** fee entrada USD 25–50K + 7% de su facturación (3,5% Noruega / 3,5% KTV). **SUJETO a confirmación ESCRITA de Noruega** (contrato dice mínimo 10% 50/50 salvo acuerdo escrito). Requiere permiso propio del subfranquiciado y aprobación previa de Noruega (cláusula 5.4). Producto: "llave en mano regulatorio".
- **D. JV regional:** sociedad NUEVA por territorio (nunca participación en KTV Colombia), KTV 30–49% sin capital.
- **Política de precios de red:** KTV nunca vende directo por debajo del aliado en su territorio; precio mínimo de red = pisos de KWD-FIN-MPV-001; catálogo único; sin guerras internas de precio.

## 6. Pendientes vigentes (verificar estado antes de asumir)

- **Correo a Noruega (6 preguntas):** (a) confirmar fee 3,5% por escrito, (b) informes propios sin pasar por su app, (c) estándar que referencia el informe certificado, (d) autorización robots como servicio complementario vía BlueTag, (e) confirmación escrita subfranquicia 7% split 3,5/3,5, (f) producto de impermeabilización/Sika/compresor.
- Batería: 12 unidades sin calibrar (crítico). GO/NO-GO del EVO pendiente (hallazgos Galileo).
- Sistema de gestión/compliance: DIFERIDO hasta pasar inspección de Aerocivil (los manuales cambiarán). Solo se desarrolla ya el cotizador web + presentador de propuestas (prompt para Claude Code ya entregado: aprobación de Gerencia para TODO envío, portafolio público sin precios + propuesta confidencial con marca de agua, tracking de apertura, integración Pipedrive).
- Verificación con aseguradoras colombianas + posible aval de ingeniero matriculado COPNIA para el informe certificado.

## 7. Canales digitales y sistema comercial

- **Brochure de prospección en frío (landing pública):** colombia.ktvworkingdrone.com.co — SIN precios, para difusión amplia. No incluye robot J1 ni fumigación (esta última no desarrollada). Cifra de velocidad defendible: "3 a 5 veces más rápido" (NO "10x"). Correcciones pendientes en KWD-COM-WEB-001.
- **Brochure de paquetes (KWD-COM-BRO-001):** CON precios, solo para cuentas clave del estudio de mercado; se envía controladamente.
- **Sistema comercial (cotizador web + presentador + Pipedrive + agente de alertas):** especificado en KWD-SIS-PROMPT-001 para Claude Code. Se desarrolla por etapas; Gerencia aprueba toda cotización antes de enviar. NO automatizar procesos operativos hasta pasar la inspección de Aerocivil.
- **Pipedrive:** el registro de llamadas y las alertas básicas ya existen nativas; activar desde Marketplace. El agente a medida se construye vía API.

## 8. Confidencialidad

Los fees internos, márgenes, el costeo y el modelo de expansión son confidenciales de Gerencia.
La Orden de Servicio Comercial no lleva cifras (solo "Anticipo confirmado Sí/No").
A un candidato de alianza solo se le muestra SU propuesta económica, nunca la estructura completa.
El portafolio con precios se envía únicamente a empresas clave, con trazabilidad.

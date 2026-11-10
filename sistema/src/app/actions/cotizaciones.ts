'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { verifySession, requireRol } from '@/lib/dal';
import { getParametrosVigentes } from '@/lib/parametros';
import { calcularLavadoMultiItem, calcularInspeccion, calcularCareTodos, calcularPorDias, calcularItemTercero, descuentoVolumen, type NivelRecargo, type Superficie, type ConceptoLavado, type Parametros, type TipoItemTercero } from '@/lib/pricing';
import { generarIdTrazabilidad } from '@/lib/trazabilidad';
import { registrarPropuestaEnviada, registrarCotizacionCreada, actualizarTratoCotizacion, type CamposComercialesTrato } from '@/lib/pipedrive';
import { verificarTokenModal, resolverUsuarioPipedrive } from '@/lib/pipedriveModalAuth';
import { enviarCorreoAprobacionPendiente, enviarCorreoOrdenServicio } from '@/lib/email';
import { datosOperativos } from '@/lib/ordenServicio';

export type CrearPuntualState = { error?: string; ok?: boolean } | undefined;
export type CrearCareState = { error?: string; ok?: boolean } | undefined;

// ============================================================================
// Crear (o editar, si formData trae cotizacionId) cotización puntual (Familia 1).
// Aquí se calcula TODO (incluido fee y margen — Regla A no se aplica acá, se
// aplica en dto.ts al armar el documento de cliente). El comercial que llama
// esta acción SÍ puede crear la cotización aunque su rol nunca vea el
// desglose después.
//
// Edición: solo mientras la cotización esté en BORRADOR (nunca algo ya
// aprobado, rechazado o enviado a un cliente real) — evita que un comercial
// tenga que borrar y volver a crear por un dato mal digitado (m², días de
// Aerocivil, etc.).
// ============================================================================
type PuntualData = {
  servicio: 'INSPECCION_SOLA' | 'LAVADO_MAS_INSPECCION' | 'SOLO_LAVADO';
  tipoInformeBase: 'DIAGNOSTICO_VISUAL' | 'INTERNACIONAL' | null;
  mostrarInformeInternacional: boolean;
  m2Fachada: number | null;
  rangoTecho: number | null;
  diasOperacion: number;
  costoOperacion: number;
  feeNoruega: number;
  margenPct: number;
  descuentoPct: number | null;
  ajustePct: number | null;
  costosInternos: number | null;
  costosInternosNota: string | null;
  precioLavadoSinDescuento: number | null;
  precioLavado: number | null;
  precioInformeBase: number | null;
  precioInformeAdicional: number | null;
  anticipoPct: number | null;
  saldoPct: number | null;
  condicionPagoNota: string | null;
  permisoAerocivil: string | null;
  diasEjecucionSistema: number | null;
  diasEjecucion: number | null;
  ejecucionSitio: string | null;
  // Modo por días (Gerencia 2026-11-04)
  modoCotizacion: string;
  diasEstimados: number | null;
  equipoAlturas: boolean;
  ciudadFuera: boolean;
  nochesAlojamiento: number | null;
  trayectosIntermunicipales: number | null;
  horasExtraPiloto: number | null;
  horasExtraAsistente: number | null;
  diasApoyoExterno: number | null;
  margenObjetivo: number | null;
};
// Datos que el trato de Pipedrive necesita reflejar de la cotización — son los
// mismos que Gerencia dejó como obligatorios para entrar a la etapa "Propuesta
// Enviada", y todos salen de lo que el comercial ya llenó en el cotizador. Care
// no tiene anticipo/saldo/Aerocivil/días de ejecución (es un programa
// recurrente, no una operación puntual con fecha): ahí solo viaja la vigencia.
function camposTratoPuntual(p: PuntualData, vigenteHasta: Date | null): CamposComercialesTrato {
  return {
    anticipoPct: p.anticipoPct,
    saldoPct: p.saldoPct,
    aerocivil: p.permisoAerocivil,
    diasEjecucion: p.diasEjecucion ?? p.diasEjecucionSistema,
    vigenteHasta,
  };
}

// Insumos extra o trabajos subcontratados que el comercial agrega AL COTIZAR
// (antes solo se podían agregar después, desde el detalle interno — y eso se
// olvidaba, dejando el subcontrato sin cobrar). Nunca se absorben al costo:
// llevan su margen neto fijo encima (15% producto / 25% servicio).
type ItemTerceroData = {
  descripcionCliente: string; notaInterna: string | null;
  tipo: TipoItemTercero; costoReal: number; margenNetoDeseado: number; precioVenta: number;
};
type ItemLavadoData = {
  orden: number; nombre: string; concepto: ConceptoLavado;
  m2Vidrio: number; m2Opaca: number; superficie: Superficie; tipoEdificio: NivelRecargo; dificultad: NivelRecargo;
  costoOperacion: number; feeNoruega: number; precioLavado: number; diasEjecucionSistema: number;
};
type ResultadoPuntual =
  | { error: string }
  | {
      error?: undefined;
      clienteNombre: string; clienteContacto: string | null; pipedriveDealId: string | null;
      observaciones: string | null; totalCliente: number; margenP: number; requiereAprobacion: boolean;
      puntualData: PuntualData; itemsLavadoData: ItemLavadoData[]; itemsTercerosData: ItemTerceroData[];
    };

// Cálculo y validación PUROS de una cotización puntual — no toca la base de
// datos. Es la ÚNICA fuente de verdad del número: crearCotizacionPuntual la usa
// justo antes de persistir, y previsualizarPuntual la usa solo para mostrarle el
// precio al comercial sin guardar nada. Así lo que se previsualiza es EXACTO lo
// que se termina guardando — nunca dos fórmulas que se puedan desalinear.
function computarPuntual(formData: FormData, parametros: Parametros): ResultadoPuntual {
  const servicio = String(formData.get('servicio')) as 'INSPECCION_SOLA' | 'LAVADO_MAS_INSPECCION' | 'SOLO_LAVADO';
  const clienteNombre = String(formData.get('clienteNombre') || '').trim();
  const clienteContacto = String(formData.get('clienteContacto') || '').trim() || null;
  if (!clienteNombre) return { error: 'El nombre del cliente es obligatorio.' };
  const pipedriveDealId = String(formData.get('pipedriveDealId') || '').trim() || null;

  const incluyeLavado = servicio !== 'INSPECCION_SOLA';

  // Modo de cotización (Gerencia 2026-11-04). METROS es el de siempre: tarifa
  // por m² de fachada. DIAS existe porque muchos clientes no tienen el área de
  // su fachada — sin metros no hay nada que multiplicar — y entonces el piloto
  // estima los días y el precio se arma desde el costo diario de la matriz 2026.
  const modoCotizacion = String(formData.get('modoCotizacion') || 'METROS') === 'DIAS' ? 'DIAS' : 'METROS';
  const porDiasActivo = modoCotizacion === 'DIAS' && incluyeLavado;
  if (modoCotizacion === 'DIAS' && !incluyeLavado) {
    return { error: 'La inspección sola se cotiza por área de techo, no por días — es el techo lo que fija el valor del informe.' };
  }
  // Múltiples ítems de lavado por cotización (spec_multi_item_lavado_20260722.md):
  // un cliente puede pedir varios edificios/superficies distintos en un solo
  // documento (ej. torre + fachada Alucobond + letreros). Cada fila del
  // formulario llega como una posición más en estos arreglos paralelos (mismo
  // orden que se renderizaron los inputs — ver CotizadorForm).
  const itemNombres = formData.getAll('itemNombre').map((v) => String(v).trim());
  const itemConceptos = formData.getAll('itemConcepto').map((v) => String(v) as ConceptoLavado);
  const itemM2VidrioInput = formData.getAll('itemM2Vidrio').map((v) => Number(v) || 0);
  const itemM2OpacaInput = formData.getAll('itemM2Opaca').map((v) => Number(v) || 0);
  const itemSuperficies = formData.getAll('itemSuperficie').map((v) => String(v) as Superficie);
  const itemTiposEdificio = formData.getAll('itemTipoEdificio').map((v) => String(v) as NivelRecargo);
  const itemDificultades = formData.getAll('itemDificultad').map((v) => String(v) as NivelRecargo);

  const itemsLavadoInput = incluyeLavado && !porDiasActivo
    ? itemNombres.map((nombre, i) => {
        const concepto = itemConceptos[i] ?? 'FACHADA_Y_VENTANAS';
        const m2Vidrio = concepto === 'SOLO_FACHADA' ? 0 : itemM2VidrioInput[i] ?? 0;
        const m2Opaca = concepto === 'SOLO_VENTANAS' ? 0 : itemM2OpacaInput[i] ?? 0;
        return {
          nombre,
          concepto,
          m2Vidrio, m2Opaca,
          superficie: itemSuperficies[i] ?? 'MIXTA',
          tipoEdificio: itemTiposEdificio[i] ?? 'BAJO',
          dificultad: itemDificultades[i] ?? 'BAJO',
        };
      })
    : [];
  if (incluyeLavado && !porDiasActivo && itemsLavadoInput.length === 0) return { error: 'Agregue al menos un ítem de lavado (edificio, fachada o superficie a cotizar).' };
  for (const it of itemsLavadoInput) {
    if (!it.nombre) return { error: 'Cada ítem de lavado necesita un nombre visible para el cliente (ej. "Torre 14 pisos").' };
    if (it.m2Vidrio + it.m2Opaca <= 0) return { error: `Ingrese el área a lavar de "${it.nombre}" (fachada y/o vidrios) según el concepto elegido.` };
  }
  const m2 = itemsLavadoInput.reduce((s, it) => s + it.m2Vidrio + it.m2Opaca, 0);

  // El techo se lee acá arriba porque el modo por días también lo necesita:
  // en el combo, el Diagnóstico Visual que se regala cuesta según el techo.
  const techo = Number(formData.get('techo') || 0);

  // Costos internos: el trabajo los paga, el cliente no los ve desglosados.
  const costosInternos = Math.max(0, Number(formData.get('costosInternos') || 0));
  const costosInternosNota = String(formData.get('costosInternosNota') || '').trim() || null;

  // --- Entradas propias del modo POR DÍAS ---
  // Son las mismas variables de la matriz de Excel: días estimados, altura,
  // dificultad, si hace falta el equipo de alturas, si el trabajo es fuera de
  // la ciudad y el margen objetivo. Todo lo demás (consumibles, equipos,
  // cuadrilla) sale de los parámetros, no se digita.
  const diasEstimados = Number(formData.get('diasEstimados') || 0);
  const nombreTrabajo = String(formData.get('nombreTrabajo') || '').trim();
  const tipoEdificioDias = (String(formData.get('tipoEdificioDias') || 'BAJO') as NivelRecargo);
  const dificultadDias = (String(formData.get('dificultadDias') || 'BAJO') as NivelRecargo);
  const equipoAlturas = formData.get('equipoAlturas') === 'on';
  const fueraDeCiudad = formData.get('fueraDeCiudad') === 'on';
  const nochesAlojamiento = formData.get('nochesAlojamiento') ? Number(formData.get('nochesAlojamiento')) : null;
  const trayectosIntermunicipales = formData.get('trayectosIntermunicipales') ? Number(formData.get('trayectosIntermunicipales')) : null;
  const horasExtraPiloto = Number(formData.get('horasExtraPiloto') || 0);
  const horasExtraAsistente = Number(formData.get('horasExtraAsistente') || 0);
  const diasApoyoExterno = Number(formData.get('diasApoyoExterno') || 0);
  const margenObjetivoInput = formData.get('margenObjetivo') ? Number(formData.get('margenObjetivo')) : null;
  const margenObjetivo = margenObjetivoInput !== null ? margenObjetivoInput / 100 : parametros.MARGEN_MINIMO;

  if (porDiasActivo) {
    if (!(diasEstimados > 0)) return { error: 'Ingrese los días estimados de trabajo — los estima el piloto.' };
    if (!nombreTrabajo) return { error: 'Escriba el nombre del trabajo como lo verá el cliente (ej. "Lavado de fachada — Torre Norte").' };
    if (margenObjetivo < parametros.MARGEN_MINIMO) {
      return { error: `El margen objetivo no puede ser menor al mínimo de ${(parametros.MARGEN_MINIMO * 100).toFixed(0)}%. Para cotizar por debajo, Gerencia debe aprobarlo sobre la cotización ya creada.` };
    }
  }

  const porDias = porDiasActivo
    ? calcularPorDias(parametros, {
        dias: diasEstimados,
        tipoEdificio: tipoEdificioDias,
        dificultad: dificultadDias,
        equipoAlturas,
        fueraDeCiudad,
        noches: nochesAlojamiento ?? undefined,
        trayectos: trayectosIntermunicipales ?? undefined,
        horasExtraPiloto,
        horasExtraAsistente,
        diasApoyoExterno,
        margenObjetivo,
        comisionPct: 0.05,
        // El DV del combo se regala al cliente pero cuesta producirlo: el
        // precio tiene que cubrirlo o el margen objetivo no se cumple. Los
        // costos internos (transporte, viáticos) entran por el mismo lado.
        costoAdicional: (servicio === 'LAVADO_MAS_INSPECCION' ? calcularInspeccion(parametros, techo).costoOperacionInsp : 0) + costosInternos,
      })
    : null;
  if (porDias?.imposible) {
    return { error: 'El margen objetivo es tan alto que no queda nada para cubrir los costos. Bájelo.' };
  }

  if (servicio === 'INSPECCION_SOLA' && techo <= 0) {
    return { error: 'Ingrese el área de techo (m²) para cotizar el Diagnóstico Visual KTV.' };
  }

  const mostrarInformeInternacional = formData.get('mostrarInformeInternacional') === 'on';
  const observaciones = String(formData.get('observaciones') || '').trim() || null;

  // Condiciones, permisos y plazos — texto libre que llena el comercial a
  // mano (varían por operación, no se calculan). Se muestran al cliente.
  const anticipoPct = formData.get('anticipoPct') ? Number(formData.get('anticipoPct')) : null;
  const saldoPct = formData.get('saldoPct') ? Number(formData.get('saldoPct')) : null;
  const condicionPagoNota = String(formData.get('condicionPagoNota') || '').trim() || null;
  const permisoAerocivil = String(formData.get('permisoAerocivil') || '').trim() || null;

  // Descuento manual sobre el lavado (Gerencia 2026-07-17): cualquier valor
  // distinto de 0 dispara aprobación de Gerencia sin excepción, y nunca puede
  // bajar el margen general de la cotización de 35%. Se aplica sobre el TOTAL
  // del proyecto (todos los ítems), no por ítem individual.
  const descuentoManualPct = Number(formData.get('descuentoPct') || 0);
  if (descuentoManualPct < 0 || descuentoManualPct >= 100) return { error: 'El descuento debe estar entre 0% y 99%.' };

  // Aumento manual sobre la tarifa (Gerencia 2026-11-09) — para los clientes
  // que exigen el trabajo "a todo costo", donde el metro de lista no alcanza.
  // No dispara aprobación: subir el precio nunca pone en riesgo el margen.
  const ajustePct = Number(formData.get('ajustePct') || 0);
  if (ajustePct < 0 || ajustePct > 200) return { error: 'El aumento manual debe estar entre 0% y 200%.' };
  if (ajustePct > 0 && descuentoManualPct > 0) {
    return { error: 'No se puede pedir descuento y aumento a la vez — deje uno de los dos en 0.' };
  }

  // Descuento por volumen (spec_reestructuracion_care_20260723.md): automático
  // según el total de m² de fachada de todos los ítems, sobre la tarifa de
  // lista. NO se multiplica con el descuento manual: se aplica el MAYOR de los
  // dos. El de volumen es una política publicada (no requiere aprobación); el
  // manual, si supera al de volumen, sigue disparando aprobación de Gerencia.
  // En modo por días no hay tarifa de lista sobre la cual descontar: el precio
  // sale del costo más el margen objetivo. Negociar ahí es bajar el margen.
  const descuentoVolumenPct = incluyeLavado && !porDiasActivo ? descuentoVolumen(m2) * 100 : 0;
  const descuentoEfectivoPct = Math.max(descuentoVolumenPct, descuentoManualPct);

  // Múltiples ítems de lavado (spec_multi_item_lavado_20260722.md): el piso de
  // proyecto y el piso de margen se evalúan UNA vez sobre la suma de todos los
  // ítems (una sola movilización), y el precio final se reparte de vuelta a
  // cada ítem a prorrata — ver calcularLavadoMultiItem.
  const lavado = incluyeLavado && !porDiasActivo
    ? calcularLavadoMultiItem(parametros, { items: itemsLavadoInput, comisionPct: 0.05, descuentoPct: descuentoEfectivoPct, ajustePct, costosInternos })
    : null;
  const insp = calcularInspeccion(parametros, techo);

  // El descuento manual nunca puede perforar el 35%: si el comercial pide un
  // descuento manual mayor al de volumen y el piso de margen tuvo que recortarlo
  // (pisoAplicado), se bloquea para que lo reduzca. El de volumen, en cambio, se
  // recorta solo en silencio (es política, no negociación).
  if (incluyeLavado && !porDiasActivo && descuentoManualPct > descuentoVolumenPct && lavado!.pisoAplicado) {
    return { error: `Con este descuento manual el margen del lavado cae por debajo del mínimo permitido (35%). Redúzcalo — el edificio ya recibe ${descuentoVolumenPct}% automático por volumen.` };
  }

  // Días de ejecución reales (spec_lavado_items_dias_20260717.md): el sistema
  // calcula con productividad real (sumada de todos los ítems); aumentar es
  // libre, reducir por debajo del cálculo dispara aprobación de Gerencia
  // (mismo mecanismo que el descuento).
  // En modo por días no hay cálculo de productividad que contradecir: los días
  // que estimó el piloto SON los del costeo, así que sistema y final coinciden
  // y nunca se dispara la aprobación por recorte de días.
  const diasEjecucionSistema = porDias ? porDias.dias : lavado ? lavado.diasEjecucionSistema : null;
  const diasEjecucionInput = formData.get('diasEjecucion') ? Number(formData.get('diasEjecucion')) : null;
  const diasEjecucion = porDias ? porDias.dias : incluyeLavado ? (diasEjecucionInput ?? diasEjecucionSistema!) : null;
  const requiereAprobacionPorDias = diasEjecucionSistema !== null && diasEjecucion !== null && diasEjecucion < diasEjecucionSistema;
  const ejecucionSitio = incluyeLavado
    ? `${diasEjecucion} día${diasEjecucion === 1 ? '' : 's'} hábil${diasEjecucion === 1 ? '' : 'es'}. Una vez aprobados permisos y recibido el anticipo.`
    : String(formData.get('ejecucionSitio') || '').trim() || null;

  // --- Regla de producto (KWD-SIS-PROMPT-001 v2) ---
  // INSPECCION_SOLA: base = Diagnóstico Visual (cobrado, no hay lavado con qué regalarlo).
  // LAVADO_MAS_INSPECCION: base = Diagnóstico Visual (gratis, gancho).
  // SOLO_LAVADO: sin informe base.
  let tipoInformeBase: 'DIAGNOSTICO_VISUAL' | 'INTERNACIONAL' | null = null;
  let precioInformeBase: number | null = null;
  if (servicio !== 'SOLO_LAVADO') {
    tipoInformeBase = 'DIAGNOSTICO_VISUAL';
    precioInformeBase = insp.dvPrecio;
  }
  const precioInformeAdicional = mostrarInformeInternacional && insp.precioInternacional !== null
    ? insp.precioInternacional
    : null;

  const precioLavado = porDias ? porDias.precio : lavado ? lavado.precioLavado : null;
  const totalCliente = (precioLavado ?? 0)
    + (servicio === 'INSPECCION_SOLA' ? (precioInformeBase ?? 0) : 0); // el DV gratis en combo no suma al total

  // ------------------------------------------------------------------------
  // Costo y margen REALES del trato. Cuando el Diagnóstico Visual va de regalo
  // (LAVADO_MAS_INSPECCION), al cliente no se le cobra — pero SÍ nos cuesta
  // producirlo (dron + cuadrilla), y ese costo se absorbe aquí para que el
  // margen reportado no quede inflado: "se lo regalamos al cliente, pero
  // internamente sí lo costeamos para no perder margen sin darnos cuenta".
  // ------------------------------------------------------------------------
  let costoOperacionTotal: number;
  let feeNoruegaTotal: number;
  let comisionTotal: number;
  if (porDias) {
    // Modo por días: el costo ya viene armado de la matriz (costo directo C,
    // con administración, imprevistos y recargos de altura y dificultad
    // adentro). El DV regalado del combo se suma igual que en modo metros.
    // costoC ya trae adentro el DV regalado (costoAdicional), no se suma otra vez.
    costoOperacionTotal = porDias.costoC;
    feeNoruegaTotal = porDias.feeNoruega;
    comisionTotal = porDias.comision;
  } else if (servicio === 'SOLO_LAVADO') {
    costoOperacionTotal = lavado!.costoOperacion;
    feeNoruegaTotal = lavado!.feeNoruega;
    comisionTotal = lavado!.comision;
  } else if (servicio === 'LAVADO_MAS_INSPECCION') {
    costoOperacionTotal = lavado!.costoOperacion + insp.costoOperacionInsp; // + costo del DV regalado
    feeNoruegaTotal = lavado!.feeNoruega; // el DV gratis no factura, no genera fee sobre esa parte
    comisionTotal = lavado!.comision;
  } else {
    // INSPECCION_SOLA: el DV se cobra, su propio costo/fee ya vienen de calcularInspeccion
    costoOperacionTotal = insp.costoOperacionInsp;
    feeNoruegaTotal = insp.dvPrecio * parametros.FEE_NORUEGA;
    comisionTotal = 0;
  }
  const costoTotalTrato = costoOperacionTotal + feeNoruegaTotal + comisionTotal;
  const margenD = totalCliente - costoTotalTrato;
  const margenP = totalCliente > 0 ? margenD / totalCliente : 0;

  // Piso de margen del 35% (decisión Gerencia 2026-07-25): baja de 35% SOLO con
  // autorización explícita de Gerencia — nunca en automático, ni el sistema ni el
  // comercial la activan solos. El mecanismo es el mismo que ya existe para el
  // descuento manual y los días recortados: la cotización queda en
  // PENDIENTE_APROBACION y solo Gerencia (rol GERENCIA) puede aprobarla o
  // rechazarla desde el detalle — nunca un bloqueo ciego que no se pueda destrabar.
  const requiereAprobacion =
    descuentoManualPct > descuentoVolumenPct
    || requiereAprobacionPorDias
    || !!lavado?.sobreTarifaLista // tope $6.000/m² incompatible con el 35% (superficie difícil + recargo alto)
    || margenP < parametros.MARGEN_MINIMO;

  // Ítems de lavado a persistir (Cotizacion.itemsLavado) — cada fila conserva
  // su nombre editable y su propio desglose de costo/fee/precio ya repartido
  // (ver calcularLavadoMultiItem). concepto/m2Vidrio/m2Opaca/superficie/
  // tipoEdificio/dificultad YA NO se escriben en CotizacionPuntual (deprecados,
  // ver schema.prisma) — viven únicamente en cada ItemLavado.
  // En modo por días el trabajo es UNO solo (no hay desglose por superficie),
  // así que se guarda un único ítem con el nombre que escribió el comercial y
  // el precio total. Así toda la cadena de abajo —propuesta al cliente, panel
  // interno, Orden de Servicio— funciona igual sin saber en qué modo se cotizó.
  const itemsLavadoData = porDias
    ? [{
        orden: 0,
        nombre: nombreTrabajo,
        concepto: 'FACHADA_Y_VENTANAS' as ConceptoLavado,
        m2Vidrio: 0, m2Opaca: 0,
        superficie: 'MIXTA' as Superficie,
        tipoEdificio: tipoEdificioDias,
        dificultad: dificultadDias,
        costoOperacion: porDias.costoC,
        feeNoruega: porDias.feeNoruega,
        precioLavado: porDias.precio,
        diasEjecucionSistema: porDias.dias,
      }]
    : lavado
    ? lavado.items.map((it, orden) => ({
        orden,
        nombre: it.nombre,
        concepto: it.concepto,
        m2Vidrio: it.m2Vidrio,
        m2Opaca: it.m2Opaca,
        superficie: it.superficie,
        tipoEdificio: it.tipoEdificio,
        dificultad: it.dificultad,
        costoOperacion: it.costoOperacion,
        feeNoruega: it.feeNoruega,
        precioLavado: it.precioLavado,
        diasEjecucionSistema: it.diasEjecucionSistema,
      }))
    : [];

  // Insumos adicionales y trabajos de terceros, agregados desde el formulario.
  // Llegan como arreglos paralelos, igual que los ítems de lavado.
  const terceroDescripciones = formData.getAll('terceroDescripcion').map((v) => String(v).trim());
  const terceroTipos = formData.getAll('terceroTipo').map((v) => String(v) as TipoItemTercero);
  const terceroCostos = formData.getAll('terceroCosto').map((v) => Number(v) || 0);
  const terceroNotas = formData.getAll('terceroNota').map((v) => String(v).trim());
  const itemsTercerosData: ItemTerceroData[] = [];
  for (let i = 0; i < terceroDescripciones.length; i++) {
    const descripcionCliente = terceroDescripciones[i];
    const costoReal = terceroCostos[i] ?? 0;
    // Una fila vacía no es un error: el formulario puede dejar filas sin llenar.
    if (!descripcionCliente && costoReal <= 0) continue;
    if (!descripcionCliente) return { error: 'Cada insumo o trabajo de tercero necesita una descripción para el cliente.' };
    if (!(costoReal > 0)) return { error: `Ingrese el costo real de "${descripcionCliente}".` };
    const tipo = terceroTipos[i] === 'PRODUCTO' ? 'PRODUCTO' : 'SERVICIO';
    const { margenNetoDeseado, precioVenta } = calcularItemTercero(parametros, { tipo, costoReal });
    itemsTercerosData.push({
      descripcionCliente,
      notaInterna: terceroNotas[i] || null,
      tipo, costoReal, margenNetoDeseado, precioVenta,
    });
  }

  const puntualData = {
    servicio,
    tipoInformeBase,
    mostrarInformeInternacional,
    m2Fachada: incluyeLavado && !porDiasActivo ? m2 : null,
    rangoTecho: techo || null,
    diasOperacion: (porDias?.dias ?? lavado?.dias ?? 0) + (servicio !== 'SOLO_LAVADO' ? insp.diasOperacionInsp : 0),
    costoOperacion: costoOperacionTotal,
    feeNoruega: feeNoruegaTotal,
    margenPct: margenP,
    descuentoPct: incluyeLavado && descuentoManualPct > 0 ? descuentoManualPct : null,
    ajustePct: incluyeLavado && ajustePct > 0 ? ajustePct : null,
    costosInternos: costosInternos > 0 ? costosInternos : null,
    costosInternosNota: costosInternos > 0 ? costosInternosNota : null,
    precioLavadoSinDescuento: lavado?.precioListaSinDescuento ?? null,
    precioLavado,
    precioInformeBase,
    precioInformeAdicional,
    anticipoPct,
    saldoPct,
    condicionPagoNota,
    permisoAerocivil,
    diasEjecucionSistema,
    diasEjecucion,
    ejecucionSitio,
    // Modo por días — null/false en las cotizaciones por metros, que es como
    // se cotizó todo hasta 2026-11-04.
    modoCotizacion,
    diasEstimados: porDias ? porDias.dias : null,
    equipoAlturas: porDiasActivo ? equipoAlturas : false,
    ciudadFuera: porDiasActivo ? fueraDeCiudad : false,
    nochesAlojamiento: porDias ? porDias.noches : null,
    trayectosIntermunicipales: porDias ? porDias.trayectos : null,
    horasExtraPiloto: porDiasActivo && horasExtraPiloto > 0 ? horasExtraPiloto : null,
    horasExtraAsistente: porDiasActivo && horasExtraAsistente > 0 ? horasExtraAsistente : null,
    diasApoyoExterno: porDiasActivo && diasApoyoExterno > 0 ? diasApoyoExterno : null,
    margenObjetivo: porDias ? porDias.margenObjetivo : null,
  };

  return {
    clienteNombre, clienteContacto, pipedriveDealId, observaciones,
    totalCliente, margenP, requiereAprobacion,
    puntualData, itemsLavadoData, itemsTercerosData,
  };
}

// Núcleo que persiste (crear o editar) una cotización puntual — recibe el
// usuarioId ya resuelto en vez de leer la sesión de cookie de KTV, para poder
// reusarse tanto desde el formulario normal (crearCotizacionPuntual, sesión
// por cookie) como desde el modal embebido en Pipedrive
// (crearCotizacionPuntualPipedrive, sesión por el JWT de Pipedrive — ver
// src/lib/pipedriveModalAuth.ts, la cookie de KTV no llega dentro del iframe).
// Nunca hace redirect() ni toca cookies: el que redirige es cada wrapper,
// porque el modal de Pipedrive no puede navegar a páginas que requieren el
// login normal de KTV.
type ResultadoGuardarPuntual = { error: string } | { error?: undefined; cotizacionId: string };

async function guardarCotizacionPuntual(
  usuarioId: string, formData: FormData,
  // dealIdModal: el trato de Pipedrive cuando esto se llama desde el modal
  // embebido (/pipedrive) — distinto del pipedriveDealId de más abajo, que es
  // el que ya existía en ClienteProspecto (viene del buscador manual del
  // formulario normal). undefined en el flujo normal: no toca esa columna.
  dealIdModal?: string,
): Promise<ResultadoGuardarPuntual> {
  const { parametros, snapshotJson } = await getParametrosVigentes();

  const cotizacionExistenteId = String(formData.get('cotizacionId') || '').trim() || null;
  let existente: { clienteId: string; idTrazabilidad: string; linkToken: string; vigenteHasta: Date | null } | null = null;
  let anterior: { id: string; idTrazabilidad: string; clienteId: string } | null = null;
  // Foto de cómo estaba ANTES de esta edición — se guarda como VersionCotizacion
  // (decisión Gerencia 2026-07-30, caso Pfizer: al editar en el mismo registro se
  // perdió lo que ya se le había enviado al cliente y no había forma de volver a
  // verlo). Null cuando esto es una creación nueva, no una edición.
  let snapshotAnterior: string | null = null;
  if (cotizacionExistenteId) {
    const c = await prisma.cotizacion.findUnique({
      where: { id: cotizacionExistenteId },
      include: {
        versionNueva: { select: { idTrazabilidad: true } },
        cliente: true, puntual: true, itemsLavado: { orderBy: { orden: 'asc' } },
      },
    });
    if (!c) return { error: 'La cotización ya no existe.' };
    if (c.versionNueva) {
      return { error: `Esta cotización ya fue corregida — edite la versión nueva (${c.versionNueva.idTrazabilidad}).` };
    } else if (!c.aceptadaPorCliente) {
      // Editable en el mismo registro mientras el cliente no la haya aceptado
      // (decisión Gerencia 2026-07-28): antes de eso todo es negociación — el
      // estado se recalcula solo (vuelve a Borrador/Pendiente de aprobación) para
      // que el comercial tenga que volver a marcarla como enviada a propósito,
      // nunca quede diciendo "Enviada" con números que el cliente no vio.
      existente = c;
      snapshotAnterior = JSON.stringify({
        familia: 'PUNTUAL',
        totalCliente: c.totalCliente, observaciones: c.observaciones, estado: c.estado,
        clienteNombre: c.cliente.nombre, clienteContacto: c.cliente.contacto,
        puntual: c.puntual, itemsLavado: c.itemsLavado,
      });
    } else {
      // Ya aceptada por el cliente: no se edita en el mismo registro — se
      // corrige creando una versión nueva, ver bloque de corrección más abajo.
      anterior = c;
    }
  }

  const r = computarPuntual(formData, parametros);
  if (r.error !== undefined) return { error: r.error };
  const { clienteNombre, clienteContacto, pipedriveDealId, observaciones, totalCliente, margenP, requiereAprobacion, puntualData, itemsLavadoData, itemsTercerosData } = r;

  if (existente) {
    await prisma.clienteProspecto.update({
      where: { id: existente.clienteId },
      data: { nombre: clienteNombre, contacto: clienteContacto, pipedriveDealId },
    });
    await prisma.cotizacion.update({
      where: { id: cotizacionExistenteId! },
      data: {
        estado: requiereAprobacion ? 'PENDIENTE_APROBACION' : 'BORRADOR',
        requiereAprobacion,
        snapshotParametros: snapshotJson,
        totalCliente,
        observaciones,
        puntual: { update: puntualData },
        // Se reemplazan por completo — más simple y seguro que diffear filas
        // (una edición en Borrador puede agregar/quitar/reordenar ítems libremente).
        itemsLavado: { deleteMany: {}, create: itemsLavadoData },
        // Se reemplazan igual que los ítems de lavado: el formulario trae la
        // lista completa, incluidos los que ya existían (se cargan al editar).
        itemsTerceros: { deleteMany: {}, create: itemsTercerosData },
        ...(dealIdModal ? { pipedriveDealId: dealIdModal } : {}),
        ...(snapshotAnterior ? { versiones: { create: { snapshot: snapshotAnterior, editadoPorId: usuarioId } } } : {}),
      },
    });
    await prisma.auditoria.create({ data: { cotizacionId: cotizacionExistenteId!, usuarioId, accion: 'edito' } });

    // El trato es un espejo de la cotización: si se ajusta el precio en una
    // ronda de negociación, el valor del trato tiene que moverse con él (antes
    // solo se escribía al crear, así que un trato ajustado quedaba mostrando
    // la cifra vieja). Sin nota, para no llenar el historial en cada ajuste.
    if (pipedriveDealId) {
      await actualizarTratoCotizacion(Number(pipedriveDealId), {
        valor: totalCliente,
        urlPropuesta: `${process.env.NEXT_PUBLIC_APP_URL || ''}/propuesta/${existente.linkToken}`,
        campos: camposTratoPuntual(puntualData, existente.vigenteHasta),
      }).catch((e) => console.error('Pipedrive: error actualizando el trato tras editar', e));
    }

    if (requiereAprobacion) {
      await enviarCorreoAprobacionPendiente({
        idTrazabilidad: existente.idTrazabilidad,
        clienteNombre,
        margenPct: margenP,
        urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL || ''}/cotizaciones/${cotizacionExistenteId}`,
      }).catch((e) => console.error('Error enviando alerta de aprobación', e));
    }
    revalidatePath('/cotizaciones');
    revalidatePath(`/cotizaciones/${cotizacionExistenteId}`);
    // La propuesta pública también: si no, el cliente (y el comercial que la
    // revisa) siguen viendo el precio anterior después de editar. Las demás
    // acciones sobre la propuesta ya lo hacían; esta se había quedado por fuera.
    revalidatePath(`/propuesta/${existente.linkToken}`);
    return { cotizacionId: cotizacionExistenteId! };
  }

  // Corrección de una cotización ya enviada/aprobada/rechazada: se reutiliza
  // el mismo cliente, pero se crea una cotización NUEVA (versión) — nunca se
  // edita el registro original, que queda con linkActivo:false para que el
  // cliente no siga viendo el número viejo/equivocado.
  const clienteId = anterior
    ? (await prisma.clienteProspecto.update({
        where: { id: anterior.clienteId },
        data: { nombre: clienteNombre, contacto: clienteContacto, pipedriveDealId },
      })).id
    : (await prisma.clienteProspecto.create({
        data: { nombre: clienteNombre, contacto: clienteContacto, pipedriveDealId },
      })).id;

  const vigenteHasta = new Date();
  vigenteHasta.setDate(vigenteHasta.getDate() + 30);

  const cotizacion = await prisma.cotizacion.create({
    data: {
      idTrazabilidad: generarIdTrazabilidad(),
      familia: 'PUNTUAL',
      clienteId,
      creadoPorId: usuarioId,
      pipedriveDealId: dealIdModal ?? null,
      estado: requiereAprobacion ? 'PENDIENTE_APROBACION' : 'BORRADOR',
      requiereAprobacion,
      vigenteHasta,
      snapshotParametros: snapshotJson,
      totalCliente,
      observaciones,
      versionAnteriorId: anterior?.id,
      puntual: { create: puntualData },
      itemsLavado: { create: itemsLavadoData },
      itemsTerceros: { create: itemsTercerosData },
      auditorias: { create: { usuarioId, accion: anterior ? 'creo_correccion' : 'creo' } },
    },
  });

  if (anterior) {
    await prisma.cotizacion.update({ where: { id: anterior.id }, data: { linkActivo: false } });
    await prisma.auditoria.create({
      data: { cotizacionId: anterior.id, usuarioId, accion: 'corrigio', detalle: cotizacion.idTrazabilidad },
    });
    revalidatePath(`/cotizaciones/${anterior.id}`);
  }

  if (requiereAprobacion) {
    await enviarCorreoAprobacionPendiente({
      idTrazabilidad: cotizacion.idTrazabilidad,
      clienteNombre,
      margenPct: margenP,
      urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL || ''}/cotizaciones/${cotizacion.id}`,
    }).catch((e) => console.error('Error enviando alerta de aprobación', e));
  }

  // Viaje de vuelta a Pipedrive: nota en el trato + link de la propuesta en
  // el campo "Cotizador". Nunca bloquea la creación si Pipedrive falla.
  if (pipedriveDealId) {
    await registrarCotizacionCreada(Number(pipedriveDealId), {
      idTrazabilidad: cotizacion.idTrazabilidad,
      clienteNombre,
      urlPropuesta: `${process.env.NEXT_PUBLIC_APP_URL || ''}/propuesta/${cotizacion.linkToken}`,
      familia: 'PUNTUAL',
      requiereAprobacion,
      valor: totalCliente,
      campos: camposTratoPuntual(puntualData, vigenteHasta),
    }).catch((e) => console.error('Pipedrive: error registrando cotización creada', e));
  }

  revalidatePath('/cotizaciones');
  return { cotizacionId: cotizacion.id };
}

// Entrada normal (formulario del cotizador, sesión por cookie de KTV) — igual
// comportamiento de siempre: si falla, el formulario ve el error; si funciona,
// navega al detalle. El guardado en sí vive en guardarCotizacionPuntual.
export async function crearCotizacionPuntual(_state: CrearPuntualState, formData: FormData): Promise<CrearPuntualState> {
  const session = await verifySession();
  const r = await guardarCotizacionPuntual(session.userId, formData);
  if (r.error !== undefined) return { error: r.error };
  redirect(`/cotizaciones/${r.cotizacionId}`);
}

// Entrada desde el modal embebido en Pipedrive (App Extension, ver skill
// ktv-cotizador y src/lib/pipedriveModalAuth.ts) — sin cookie de sesión de
// KTV: la identidad se revalida AQUÍ MISMO con el JWT de Pipedrive (nunca se
// confía en un usuarioId que mande el llamador — una Server Action es un
// endpoint invocable directo, no solo un botón del modal) y se resuelve
// contra los Usuario de KTV por correo (resolverUsuarioPipedrive). No hace
// redirect (el modal no puede navegar a páginas que exigen el login normal
// de KTV) — el llamador decide qué mostrar dentro del propio iframe.
export type GuardarPipedriveState = { error?: string; cotizacionId?: string };
export async function crearCotizacionPuntualPipedrive(
  token: string, dealIdParam: string, userIdParam: string, formData: FormData,
): Promise<GuardarPipedriveState> {
  const r = await verificarTokenModal(token, dealIdParam, userIdParam);
  if (!r.ok) return { error: `Sesión de Pipedrive inválida — cierra este modal y vuelve a abrirlo desde el trato. (${r.motivo})` };
  const usuario = await resolverUsuarioPipedrive(r.sesion.userId);
  if (!usuario) return { error: 'Tu usuario de Pipedrive no tiene una cuenta correspondiente en el Sistema Comercial KTV — pide a Gerencia que te cree una con el mismo correo.' };
  return guardarCotizacionPuntual(usuario.id, formData, String(r.sesion.dealId));
}

// Vista previa SIN GUARDAR (decisión Gerencia 2026-07-25): antes, el único botón
// del cotizador calculaba Y persistía a la vez — cualquier intento de ver el
// precio (ajustar m², probar otro tipo de edificio) creaba una cotización real
// en BORRADOR, acumulando decenas de registros por cada una que de verdad se
// enviaba. Esta acción usa la MISMA fórmula (computarPuntual) pero no toca la
// base de datos — se llama desde el botón "Calcular" del formulario; "Crear
// cotización" sigue siendo el único botón que persiste.
//
// Regla A: el margen/costo real solo se muestra si la sesión es GERENCIA — un
// comercial ve el total y si haría falta aprobación, nunca el margen.
export type PreviewPuntualState = {
  error?: string; ok?: boolean;
  totalCliente?: number; requiereAprobacion?: boolean;
  margenPct?: number;
  // Los insumos/terceros se facturan aparte del lavado (llevan su propio
  // margen neto y nunca se absorben), así que se muestran por separado — si
  // no, el comercial agrega uno y ve el total igual y cree que se perdió.
  totalTerceros?: number;
} | undefined;

// Núcleo del cálculo — recibe el rol ya resuelto (Regla A: el margen solo se
// devuelve si es GERENCIA), para servir tanto a la sesión normal por cookie
// como al modal de Pipedrive, que se autentica con el JWT.
async function calcularPreviewPuntual(rol: string, formData: FormData): Promise<PreviewPuntualState> {
  const { parametros } = await getParametrosVigentes();
  const r = computarPuntual(formData, parametros);
  if (r.error !== undefined) return { error: r.error };
  return {
    ok: true,
    totalCliente: r.totalCliente,
    requiereAprobacion: r.requiereAprobacion,
    totalTerceros: r.itemsTercerosData.reduce((sa, t) => sa + t.precioVenta, 0),
    ...(rol === 'GERENCIA' ? { margenPct: r.margenP } : {}),
  };
}

export async function previsualizarPuntual(_state: PreviewPuntualState, formData: FormData): Promise<PreviewPuntualState> {
  const session = await verifySession();
  return calcularPreviewPuntual(session.rol, formData);
}

// Misma vista previa, pero desde el modal embebido en Pipedrive: no hay cookie
// de KTV, así que la identidad se revalida con el JWT en cada llamada (una
// Server Action es un endpoint invocable directo, no solo un botón del modal).
export async function previsualizarPuntualPipedrive(
  token: string, dealIdParam: string, userIdParam: string,
  _state: PreviewPuntualState, formData: FormData,
): Promise<PreviewPuntualState> {
  const r = await verificarTokenModal(token, dealIdParam, userIdParam);
  if (!r.ok) return { error: `Sesión de Pipedrive inválida — cierra este modal y vuelve a abrirlo desde el trato. (${r.motivo})` };
  const usuario = await resolverUsuarioPipedrive(r.sesion.userId);
  if (!usuario) return { error: 'Tu usuario de Pipedrive no tiene una cuenta correspondiente en el Sistema Comercial KTV.' };
  return calcularPreviewPuntual(usuario.rol, formData);
}

export async function aprobarCotizacion(cotizacionId: string) {
  const session = await requireRol('GERENCIA');
  await prisma.cotizacion.update({
    where: { id: cotizacionId },
    data: { estado: 'APROBADA', aprobadoPorId: session.userId, aprobadoAt: new Date() },
  });
  await prisma.auditoria.create({ data: { cotizacionId, usuarioId: session.userId, accion: 'aprobo' } });
  revalidatePath(`/cotizaciones/${cotizacionId}`);
  revalidatePath('/cotizaciones');
}

export async function rechazarCotizacion(cotizacionId: string) {
  const session = await requireRol('GERENCIA');
  // Por seguridad se desactiva también el link público (nunca debió estar
  // activo — "Marcar como enviada" no aplica a PENDIENTE_APROBACION/RECHAZADA
  // — pero así queda cerrado incluso si el estado cambiara por otra vía).
  // Se reactiva con el mismo botón "Reactivar link" del detalle si se reconsidera.
  await prisma.cotizacion.update({ where: { id: cotizacionId }, data: { estado: 'RECHAZADA', linkActivo: false } });
  await prisma.auditoria.create({ data: { cotizacionId, usuarioId: session.userId, accion: 'rechazo' } });
  revalidatePath(`/cotizaciones/${cotizacionId}`);
  revalidatePath('/cotizaciones');
}

export async function marcarEnviada(cotizacionId: string) {
  const session = await verifySession();
  await marcarEnviadaCore(session.userId, cotizacionId);
}

// Desde el modal embebido en Pipedrive — mismo mecanismo de autenticación que
// crearCotizacionPuntualPipedrive (el JWT se revalida acá, nunca se confía en
// un usuarioId que mande el llamador). Existe porque el comercial escribe el
// correo con la plantilla dentro del propio trato: si "marcar como enviada"
// solo viviera en el panel interno de KTV, el trato se quedaría siempre en la
// etapa anterior con el valor en cero (encontrado en producción, Petrometal).
export async function marcarEnviadaPipedrive(
  token: string, dealIdParam: string, userIdParam: string, cotizacionId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const r = await verificarTokenModal(token, dealIdParam, userIdParam);
  if (!r.ok) return { error: `Sesión de Pipedrive inválida — cierra este modal y vuelve a abrirlo desde el trato. (${r.motivo})` };
  const usuario = await resolverUsuarioPipedrive(r.sesion.userId);
  if (!usuario) return { error: 'Tu usuario de Pipedrive no tiene una cuenta correspondiente en el Sistema Comercial KTV.' };
  // La cotización tiene que ser la de ESTE trato: el id viaja desde el cliente
  // y una Server Action es invocable directo, así que sin este cruce alguien
  // podría marcar como enviada una cotización de otro trato.
  const c = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: { pipedriveDealId: true, cliente: { select: { pipedriveDealId: true } } },
  });
  if (!c) return { error: 'La cotización ya no existe.' };
  const deLaCotizacion = c.pipedriveDealId ?? c.cliente.pipedriveDealId;
  if (deLaCotizacion !== String(r.sesion.dealId)) return { error: 'Esa cotización no pertenece a este trato.' };
  await marcarEnviadaCore(usuario.id, cotizacionId);
  return { ok: true };
}

async function marcarEnviadaCore(usuarioId: string, cotizacionId: string) {
  const c = await prisma.cotizacion.update({
    where: { id: cotizacionId },
    data: { estado: 'ENVIADA', enviadoAt: new Date() },
    include: { cliente: true, itemsTerceros: true, puntual: true },
  });
  await prisma.auditoria.create({ data: { cotizacionId, usuarioId, accion: 'envio' } });
  revalidatePath(`/cotizaciones/${cotizacionId}`);

  // Integración Pipedrive: si la cotización quedó vinculada a un trato, se
  // registra la nota + valor + cambio de etapa. Nunca bloquea el envío real
  // de la propuesta si Pipedrive falla o no está configurado.
  // Cotizacion.pipedriveDealId lo escribe el modal embebido (el trato desde el
  // que se abrió); cliente.pipedriveDealId, el buscador de tratos del
  // formulario normal. Cualquiera de los dos sirve para escribir de vuelta.
  const dealIdTrato = c.pipedriveDealId ?? c.cliente.pipedriveDealId;
  if (dealIdTrato) {
    // Familia 1: el total único ya incluye los ítems de terceros (mismo
    // criterio que el DTO de cliente y el panel interno) — Care no, ahí se
    // muestran aparte del valor anual recurrente del plan.
    const sumaItemsTerceros = c.itemsTerceros.reduce((s, it) => s + it.precioVenta, 0);
    const valor = c.familia === 'PUNTUAL' ? c.totalCliente + sumaItemsTerceros : c.totalCliente;
    const urlPropuesta = `${process.env.NEXT_PUBLIC_APP_URL || ''}/propuesta/${c.linkToken}`;
    await registrarPropuestaEnviada(Number(dealIdTrato), {
      urlPropuesta, valor, familia: c.familia,
      // Sin estos campos Pipedrive rechaza el paso a "Propuesta Enviada"
      // cuando Gerencia los dejó como obligatorios de esa etapa.
      campos: c.puntual
        ? {
            anticipoPct: c.puntual.anticipoPct, saldoPct: c.puntual.saldoPct,
            aerocivil: c.puntual.permisoAerocivil,
            diasEjecucion: c.puntual.diasEjecucion ?? c.puntual.diasEjecucionSistema,
            vigenteHasta: c.vigenteHasta,
          }
        : { vigenteHasta: c.vigenteHasta },
    }).catch((e) => console.error('Pipedrive: error registrando propuesta enviada', e));
  }
}

// ============================================================================
// Aceptación del cliente — dispara la Orden de Servicio interna SIN CIFRAS
// (KWD-SIS-PROMPT-001 v2). Esta acción la invoca la página pública /propuesta.
// ============================================================================
export async function aceptarPropuesta(linkToken: string) {
  const c = await prisma.cotizacion.findUnique({ where: { linkToken } });
  if (!c || !c.linkActivo || c.aceptadaPorCliente) return; // link desactivado = no se puede aceptar
  // Vencida: pasada la fecha de vigencia y aún sin aceptar, no se puede aceptar
  // (guard de servidor — un link viejo/cacheado no debe poder colarse). Gerencia
  // puede extender la vigencia si el cliente pide más plazo.
  if (c.vigenteHasta && c.vigenteHasta < new Date()) return;

  await prisma.$transaction([
    prisma.cotizacion.update({
      where: { id: c.id },
      data: { aceptadaPorCliente: true, aceptadaAt: new Date() },
    }),
    prisma.ordenServicio.create({
      data: { cotizacionId: c.id, anticipoConfirmado: false },
    }),
    prisma.auditoria.create({
      data: { cotizacionId: c.id, usuarioId: c.creadoPorId, accion: 'acepto_cliente', detalle: 'Aceptada desde el link público de la propuesta' },
    }),
  ]);
  // Operaciones se entera acá: no tiene usuario en el sistema y nadie le avisa
  // manualmente, así que sin este correo la Orden de Servicio se quedaba
  // creada en la base sin que nadie la viera nunca. Va SIN CIFRAS — solo lo
  // necesario para planear el trabajo (ver src/lib/ordenServicio.ts).
  const completa = await prisma.cotizacion.findUnique({
    where: { id: c.id },
    include: { cliente: true, puntual: true, care: true, itemsLavado: true, itemsTerceros: true, creadoPor: true },
  });
  if (completa) {
    const { servicio, lineas } = datosOperativos(completa);
    await enviarCorreoOrdenServicio({
      idTrazabilidad: completa.idTrazabilidad,
      clienteNombre: completa.cliente.nombre,
      clienteContacto: completa.cliente.contacto,
      servicio,
      detalleOperativo: lineas,
      comercialNombre: completa.creadoPor.nombre,
      urlOrden: `${process.env.NEXT_PUBLIC_APP_URL || ''}/ordenes/${completa.id}`,
    }).catch((e) => console.error('Error enviando la Orden de Servicio a Operaciones', e));
  }

  revalidatePath(`/propuesta/${linkToken}`);
  revalidatePath('/cotizaciones');
  revalidatePath('/ordenes');
}

// Módulo 2 — activar/desactivar el link público de una propuesta. Cualquier
// usuario del sistema puede hacerlo (queda en auditoría quién y cuándo).
export async function toggleLinkPropuesta(cotizacionId: string) {
  const session = await verifySession();
  const c = await prisma.cotizacion.findUnique({ where: { id: cotizacionId } });
  if (!c) return;
  await prisma.cotizacion.update({ where: { id: c.id }, data: { linkActivo: !c.linkActivo } });
  await prisma.auditoria.create({
    data: { cotizacionId: c.id, usuarioId: session.userId, accion: c.linkActivo ? 'desactivo_link' : 'reactivo_link' },
  });
  revalidatePath(`/cotizaciones/${c.id}`);
  revalidatePath(`/propuesta/${c.linkToken}`);
}

// Extender la vigencia 30 días más desde hoy — para cuando el cliente pide más
// plazo y la propuesta ya venció (o está por vencer). Reactiva el link por si
// estaba desactivado. Cualquier usuario del sistema puede hacerlo; queda auditado.
export async function extenderVigencia(cotizacionId: string) {
  const session = await verifySession();
  const c = await prisma.cotizacion.findUnique({ where: { id: cotizacionId } });
  if (!c) return;
  const nuevaVigencia = new Date();
  nuevaVigencia.setDate(nuevaVigencia.getDate() + 30);
  await prisma.cotizacion.update({ where: { id: c.id }, data: { vigenteHasta: nuevaVigencia, linkActivo: true } });
  await prisma.auditoria.create({ data: { cotizacionId: c.id, usuarioId: session.userId, accion: 'extendio_vigencia' } });
  revalidatePath(`/cotizaciones/${c.id}`);
  revalidatePath(`/propuesta/${c.linkToken}`);
}

// Borrado — solo GERENCIA. Permitido en BORRADOR (nunca se mostró a nadie) y
// en RECHAZADA (Gerencia la rechazó antes de que el link se activara — nunca
// llegó a un cliente real, ver rechazarCotizacion). Nunca en ENVIADA/APROBADA/
// PENDIENTE_APROBACION: esas si pudieron llegar a un cliente y no se puede
// perder esa trazabilidad (decisión Gerencia 2026-07-25).
export async function eliminarCotizacion(cotizacionId: string) {
  await requireRol('GERENCIA');
  const c = await prisma.cotizacion.findUnique({ where: { id: cotizacionId } });
  if (!c) return { error: 'La cotización ya no existe.' };
  if (c.estado !== 'BORRADOR' && c.estado !== 'RECHAZADA') {
    return { error: 'Solo se pueden borrar cotizaciones en Borrador o Rechazadas — esta ya fue aprobada o enviada a un cliente.' };
  }
  await prisma.cotizacion.delete({ where: { id: cotizacionId } });
  revalidatePath('/cotizaciones');
}

// ============================================================================
// Crear (o editar, si formData trae cotizacionId) cotización Care (Familia 2 —
// programa recurrente). Tabla SEPARADA de CotizacionPuntual, tal como exige
// KWD-SIS-PROMPT-001 v2: nunca se mezclan los datos de las 2 familias.
//
// Edición: solo mientras la cotización esté en BORRADOR — mismo criterio que
// crearCotizacionPuntual.
// ============================================================================
type CareData = {
  planRecomendado: 'BASIC' | 'ESSENTIAL' | 'COMPLETE'; contratoAnios: number; formaPago: 'CONTADO' | 'DIFERIDO_12';
  m2Fachada: number; rangoTecho: number | null;
  superficie: Superficie; tipoEdificio: NivelRecargo; dificultad: NivelRecargo;
  valorAnualBasic: number; valorMensualBasic: number;
  valorAnualEssential: number; valorMensualEssential: number;
  valorAnualComplete: number; valorMensualComplete: number;
  descuentoManualPct: number | null;
};
type ResultadoCare =
  | { error: string }
  | {
      error?: undefined;
      clienteNombre: string; clienteContacto: string | null; pipedriveDealId: string | null;
      observaciones: string | null;
      planRecomendado: 'BASIC' | 'ESSENTIAL' | 'COMPLETE';
      todos: ReturnType<typeof calcularCareTodos>;
      requiereAprobacion: boolean; peorMargen: number;
      careData: CareData;
    };

// Cálculo y validación PUROS de una cotización Care — no toca la base de datos.
// Misma disciplina que computarPuntual: única fuente de verdad compartida entre
// crearCotizacionCare (persiste) y previsualizarCare (solo muestra, nunca guarda).
function computarCare(formData: FormData, parametros: Parametros): ResultadoCare {
  const planRecomendado = String(formData.get('plan')) as 'BASIC' | 'ESSENTIAL' | 'COMPLETE';
  const clienteNombre = String(formData.get('clienteNombre') || '').trim();
  const clienteContacto = String(formData.get('clienteContacto') || '').trim() || null;
  if (!clienteNombre) return { error: 'El nombre del cliente es obligatorio.' };
  const pipedriveDealId = String(formData.get('pipedriveDealId') || '').trim() || null;

  // Los 3 paquetes se cotizan siempre juntos, así que el área de fachada es
  // obligatoria aunque el plan destacado sea Basic (Essential/Complete la necesitan).
  const m2 = Number(formData.get('m2') || 0);
  if (m2 <= 0) return { error: 'Ingrese el área de fachada (m²) — se usa para calcular los 3 planes.' };

  const techo = Number(formData.get('techo') || 0);
  // La duración ya no la elige el comercial: es fija por plan (reestructuración
  // 2026-07-23) — Basic 1 año, Essential y Complete 3 años. Se guarda la del
  // plan recomendado como referencia del registro.
  const contratoAnios = planRecomendado === 'BASIC' ? 1 : 3;
  const formaPago = String(formData.get('formaPago') || 'CONTADO') as 'CONTADO' | 'DIFERIDO_12';
  const observaciones = String(formData.get('observaciones') || '').trim() || null;

  // Mismas variables de recargo que Familia 1 — corrección 2026-07-16, antes
  // calcularCare siempre asumía MIXTA/BAJO/BAJO sin importar el edificio real.
  const superficie = String(formData.get('superficie') || 'MIXTA') as Superficie;
  const tipoEdificio = String(formData.get('tipoEdificio') || 'BAJO') as NivelRecargo;
  const dificultad = String(formData.get('dificultad') || 'BAJO') as NivelRecargo;

  // Descuento manual sobre los 3 paquetes (Gerencia 2026-07-28) — mismo
  // mecanismo que el descuento manual de Familia 1: se aplica por igual a los
  // 3 planes, NUNCA se suma al de compromiso/volumen (se toma el mayor, ver
  // calcularCare), y el piso de margen de 35% se protege ahí mismo.
  const descuentoManualPct = Number(formData.get('descuentoPct') || 0);
  if (descuentoManualPct < 0 || descuentoManualPct >= 100) return { error: 'El descuento debe estar entre 0% y 99%.' };

  const todos = calcularCareTodos(parametros, { m2, techo, superficie, tipoEdificio, dificultad, descuentoManualPct });
  // Piso de margen del 35% (decisión Gerencia 2026-07-25): baja de 35% SOLO con
  // autorización explícita de Gerencia — igual mecanismo que Familia 1, nunca un
  // bloqueo ciego. Para Essential y Complete cuenta el margen de CADA año del
  // contrato (el peor, nunca un promedio que esconda el año más ajustado), y en
  // Complete cuenta además la línea del Informe Internacional, que se factura
  // aparte y por lo tanto tiene su propio margen.
  const margenesMinimos = Object.values(todos).map((t) =>
    Math.min(t.margenP, t.internacionalAparte?.margenP ?? 1),
  );
  const peorMargen = Math.min(...margenesMinimos);

  // El descuento manual solo dispara aprobación de Gerencia cuando de verdad
  // cambia el precio de algún plan frente a lo que ya aplicaría por política
  // (compromiso del plan + volumen) — igual criterio que Familia 1: si el
  // manual queda por debajo de lo que el edificio ya recibía automáticamente,
  // no hay nada que aprobar.
  const todosSinManual = calcularCareTodos(parametros, { m2, techo, superficie, tipoEdificio, dificultad });
  const requiereAprobacionPorDescuentoManual = descuentoManualPct > 0 && (['BASIC', 'ESSENTIAL', 'COMPLETE'] as const)
    .some((plan) => todos[plan].descuentoAplicado > todosSinManual[plan].descuentoAplicado);
  const requiereAprobacion = peorMargen < parametros.MARGEN_MINIMO || requiereAprobacionPorDescuentoManual;

  const careData: CareData = {
    planRecomendado, contratoAnios, formaPago, m2Fachada: m2, rangoTecho: techo || null,
    superficie, tipoEdificio, dificultad,
    valorAnualBasic: todos.BASIC.valorAnual, valorMensualBasic: todos.BASIC.valorMensual,
    valorAnualEssential: todos.ESSENTIAL.valorAnual, valorMensualEssential: todos.ESSENTIAL.valorMensual,
    valorAnualComplete: todos.COMPLETE.valorAnual, valorMensualComplete: todos.COMPLETE.valorMensual,
    descuentoManualPct: descuentoManualPct > 0 ? descuentoManualPct : null,
  };

  return {
    clienteNombre, clienteContacto, pipedriveDealId, observaciones,
    planRecomendado, todos, requiereAprobacion, peorMargen, careData,
  };
}

// Mismo mecanismo que guardarCotizacionPuntual (ver comentario ahí): núcleo
// reusado por el formulario normal (sesión por cookie) y por el modal de
// Pipedrive (sesión por JWT) — nunca redirige, el llamador decide.
type ResultadoGuardarCare = { error: string } | { error?: undefined; cotizacionId: string };

async function guardarCotizacionCare(usuarioId: string, formData: FormData, dealIdModal?: string): Promise<ResultadoGuardarCare> {
  const { parametros, snapshotJson } = await getParametrosVigentes();

  const cotizacionExistenteId = String(formData.get('cotizacionId') || '').trim() || null;
  let existente: { clienteId: string; idTrazabilidad: string; linkToken: string; vigenteHasta: Date | null } | null = null;
  let anterior: { id: string; idTrazabilidad: string; clienteId: string } | null = null;
  // Ver el mismo mecanismo en crearCotizacionPuntual (decisión Gerencia 2026-07-30).
  let snapshotAnterior: string | null = null;
  if (cotizacionExistenteId) {
    const c = await prisma.cotizacion.findUnique({
      where: { id: cotizacionExistenteId },
      include: { versionNueva: { select: { idTrazabilidad: true } }, cliente: true, care: true },
    });
    if (!c) return { error: 'La cotización ya no existe.' };
    if (c.versionNueva) {
      return { error: `Esta cotización ya fue corregida — edite la versión nueva (${c.versionNueva.idTrazabilidad}).` };
    } else if (!c.aceptadaPorCliente) {
      // Editable en el mismo registro mientras el cliente no la haya aceptado
      // (decisión Gerencia 2026-07-28) — ver el mismo mecanismo en crearCotizacionPuntual.
      existente = c;
      snapshotAnterior = JSON.stringify({
        familia: 'CARE',
        totalCliente: c.totalCliente, observaciones: c.observaciones, estado: c.estado,
        clienteNombre: c.cliente.nombre, clienteContacto: c.cliente.contacto,
        care: c.care,
      });
    } else {
      anterior = c;
    }
  }

  const r = computarCare(formData, parametros);
  if (r.error !== undefined) return { error: r.error };
  const { clienteNombre, clienteContacto, pipedriveDealId, observaciones, planRecomendado, todos, requiereAprobacion, peorMargen, careData } = r;

  if (existente) {
    await prisma.clienteProspecto.update({
      where: { id: existente.clienteId },
      data: { nombre: clienteNombre, contacto: clienteContacto, pipedriveDealId },
    });
    await prisma.cotizacion.update({
      where: { id: cotizacionExistenteId! },
      data: {
        estado: requiereAprobacion ? 'PENDIENTE_APROBACION' : 'BORRADOR',
        requiereAprobacion,
        snapshotParametros: snapshotJson,
        totalCliente: todos[planRecomendado].valorAnual,
        observaciones,
        care: { update: careData },
        ...(dealIdModal ? { pipedriveDealId: dealIdModal } : {}),
        ...(snapshotAnterior ? { versiones: { create: { snapshot: snapshotAnterior, editadoPorId: usuarioId } } } : {}),
      },
    });
    await prisma.auditoria.create({ data: { cotizacionId: cotizacionExistenteId!, usuarioId, accion: 'edito' } });

    // Espejo del trato — ver el mismo bloque en guardarCotizacionPuntual.
    if (pipedriveDealId) {
      await actualizarTratoCotizacion(Number(pipedriveDealId), {
        valor: todos[planRecomendado].valorAnual,
        urlPropuesta: `${process.env.NEXT_PUBLIC_APP_URL || ''}/propuesta/${existente.linkToken}`,
        campos: { vigenteHasta: existente.vigenteHasta },
      }).catch((e) => console.error('Pipedrive: error actualizando el trato tras editar', e));
    }

    if (requiereAprobacion) {
      await enviarCorreoAprobacionPendiente({
        idTrazabilidad: existente.idTrazabilidad,
        clienteNombre,
        margenPct: peorMargen,
        urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL || ''}/cotizaciones/${cotizacionExistenteId}`,
      }).catch((e) => console.error('Error enviando alerta de aprobación', e));
    }
    revalidatePath('/cotizaciones');
    revalidatePath(`/cotizaciones/${cotizacionExistenteId}`);
    // La propuesta pública también: si no, el cliente (y el comercial que la
    // revisa) siguen viendo el precio anterior después de editar. Las demás
    // acciones sobre la propuesta ya lo hacían; esta se había quedado por fuera.
    revalidatePath(`/propuesta/${existente.linkToken}`);
    return { cotizacionId: cotizacionExistenteId! };
  }

  // Corrección — mismo mecanismo que Familia 1: se reutiliza el cliente, se
  // crea una versión nueva, y el registro original queda con linkActivo:false.
  const clienteId = anterior
    ? (await prisma.clienteProspecto.update({
        where: { id: anterior.clienteId },
        data: { nombre: clienteNombre, contacto: clienteContacto, pipedriveDealId },
      })).id
    : (await prisma.clienteProspecto.create({ data: { nombre: clienteNombre, contacto: clienteContacto, pipedriveDealId } })).id;
  const vigenteHasta = new Date();
  vigenteHasta.setDate(vigenteHasta.getDate() + 30);

  const cotizacion = await prisma.cotizacion.create({
    data: {
      idTrazabilidad: generarIdTrazabilidad(),
      familia: 'CARE',
      clienteId,
      creadoPorId: usuarioId,
      pipedriveDealId: dealIdModal ?? null,
      estado: requiereAprobacion ? 'PENDIENTE_APROBACION' : 'BORRADOR',
      requiereAprobacion,
      vigenteHasta,
      snapshotParametros: snapshotJson,
      totalCliente: todos[planRecomendado].valorAnual,
      observaciones,
      versionAnteriorId: anterior?.id,
      care: { create: careData },
      auditorias: { create: { usuarioId, accion: anterior ? 'creo_correccion' : 'creo' } },
    },
  });

  if (anterior) {
    await prisma.cotizacion.update({ where: { id: anterior.id }, data: { linkActivo: false } });
    await prisma.auditoria.create({
      data: { cotizacionId: anterior.id, usuarioId, accion: 'corrigio', detalle: cotizacion.idTrazabilidad },
    });
    revalidatePath(`/cotizaciones/${anterior.id}`);
  }

  if (requiereAprobacion) {
    await enviarCorreoAprobacionPendiente({
      idTrazabilidad: cotizacion.idTrazabilidad,
      clienteNombre,
      margenPct: peorMargen,
      urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL || ''}/cotizaciones/${cotizacion.id}`,
    }).catch((e) => console.error('Error enviando alerta de aprobación', e));
  }

  // Viaje de vuelta a Pipedrive — mismo mecanismo que Familia 1.
  if (pipedriveDealId) {
    await registrarCotizacionCreada(Number(pipedriveDealId), {
      idTrazabilidad: cotizacion.idTrazabilidad,
      clienteNombre,
      urlPropuesta: `${process.env.NEXT_PUBLIC_APP_URL || ''}/propuesta/${cotizacion.linkToken}`,
      familia: 'CARE',
      requiereAprobacion,
      valor: todos[planRecomendado].valorAnual,
      campos: { vigenteHasta },
    }).catch((e) => console.error('Pipedrive: error registrando cotización Care creada', e));
  }

  revalidatePath('/cotizaciones');
  return { cotizacionId: cotizacion.id };
}

// Entrada normal (formulario Care, sesión por cookie de KTV).
export async function crearCotizacionCare(_state: CrearCareState, formData: FormData): Promise<CrearCareState> {
  const session = await verifySession();
  const r = await guardarCotizacionCare(session.userId, formData);
  if (r.error !== undefined) return { error: r.error };
  redirect(`/cotizaciones/${r.cotizacionId}`);
}

// Entrada desde el modal embebido en Pipedrive — ver crearCotizacionPuntualPipedrive.
export async function crearCotizacionCarePipedrive(
  token: string, dealIdParam: string, userIdParam: string, formData: FormData,
): Promise<GuardarPipedriveState> {
  const r = await verificarTokenModal(token, dealIdParam, userIdParam);
  if (!r.ok) return { error: `Sesión de Pipedrive inválida — cierra este modal y vuelve a abrirlo desde el trato. (${r.motivo})` };
  const usuario = await resolverUsuarioPipedrive(r.sesion.userId);
  if (!usuario) return { error: 'Tu usuario de Pipedrive no tiene una cuenta correspondiente en el Sistema Comercial KTV — pide a Gerencia que te cree una con el mismo correo.' };
  return guardarCotizacionCare(usuario.id, formData, String(r.sesion.dealId));
}

// Vista previa SIN GUARDAR — mismo mecanismo que previsualizarPuntual: calcula
// con computarCare, nunca toca prisma. Regla A: margen solo si es Gerencia.
export type PreviewCareState = {
  error?: string; ok?: boolean;
  valorAnualBasic?: number; valorMensualBasic?: number;
  valorAnualEssential?: number; valorMensualEssential?: number;
  valorAnualComplete?: number; valorMensualComplete?: number;
  informeInternacionalAparte?: number;
  requiereAprobacion?: boolean;
  peorMargen?: number;
} | undefined;

// Núcleo compartido — ver calcularPreviewPuntual.
async function calcularPreviewCare(rol: string, formData: FormData): Promise<PreviewCareState> {
  const { parametros } = await getParametrosVigentes();
  const r = computarCare(formData, parametros);
  if (r.error !== undefined) return { error: r.error };
  return {
    ok: true,
    valorAnualBasic: r.todos.BASIC.valorAnual, valorMensualBasic: r.todos.BASIC.valorMensual,
    valorAnualEssential: r.todos.ESSENTIAL.valorAnual, valorMensualEssential: r.todos.ESSENTIAL.valorMensual,
    valorAnualComplete: r.todos.COMPLETE.valorAnual, valorMensualComplete: r.todos.COMPLETE.valorMensual,
    informeInternacionalAparte: r.todos.COMPLETE.internacionalAparte?.precio,
    requiereAprobacion: r.requiereAprobacion,
    ...(rol === 'GERENCIA' ? { peorMargen: r.peorMargen } : {}),
  };
}

export async function previsualizarCare(_state: PreviewCareState, formData: FormData): Promise<PreviewCareState> {
  const session = await verifySession();
  return calcularPreviewCare(session.rol, formData);
}

// Desde el modal de Pipedrive — ver previsualizarPuntualPipedrive.
export async function previsualizarCarePipedrive(
  token: string, dealIdParam: string, userIdParam: string,
  _state: PreviewCareState, formData: FormData,
): Promise<PreviewCareState> {
  const r = await verificarTokenModal(token, dealIdParam, userIdParam);
  if (!r.ok) return { error: `Sesión de Pipedrive inválida — cierra este modal y vuelve a abrirlo desde el trato. (${r.motivo})` };
  const usuario = await resolverUsuarioPipedrive(r.sesion.userId);
  if (!usuario) return { error: 'Tu usuario de Pipedrive no tiene una cuenta correspondiente en el Sistema Comercial KTV.' };
  return calcularPreviewCare(usuario.rol, formData);
}

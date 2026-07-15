import Image from 'next/image';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getCotizacionClienteDTO } from '@/lib/dto';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import AceptarButton from './AceptarButton';

// PÁGINA PÚBLICA — sin login. Solo puede recibir el DTO de cliente (dto.ts),
// que estructuralmente no tiene fee/costo/margen. Regla A vive acá.
// Módulo 2: el [id] de la ruta es el linkToken NO adivinable (nunca el
// idTrazabilidad secuencial). Cada visita de un NO-usuario queda registrada
// como apertura; las vistas del equipo (con sesión) no ensucian el tracking.

// Catálogos públicos existentes — el recorrido comercial completo:
// prospección en frío (landing) → calentamiento (planes) → esta propuesta.
const URL_CATALOGO_FRIO = 'https://landing.ktvworkingdrone.com.co';
const URL_CATALOGO_PLANES = 'https://landing.ktvworkingdrone.com.co/planes.html';

function cop(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return 'COP ' + Math.round(n).toLocaleString('es-CO');
}

const NOMBRES_SERVICIO: Record<string, string> = {
  INSPECCION_SOLA: 'Inspección de fachada y cubierta',
  LAVADO_MAS_INSPECCION: 'Lavado de fachada + Inspección KTV Colombia',
  SOLO_LAVADO: 'Lavado de fachada',
};

const DESC_LAVADO = 'Servicio Integral de Lavado KTV WD — intervención especializada en altura con drones. Incluye lavado externo de fachada, cristales y ventanales con agua a alta presión, y los productos aplicados durante el proceso.';
const DESC_DV = 'Inspección de fachada y cubierta con dron (elaborado con apoyo de IA) — registro fotográfico y de video en alta resolución, identificación de hallazgos (fisuras, humedad, sellos) y recomendaciones de mantenimiento.';
const DESC_INTERNACIONAL = 'Soporte técnico bajo estándar internacional KTV — informe bajo metodología alineada con estándares internacionales reconocidos, elaborado por ingenieros de Inotek (Noruega), para due diligence, auditorías o interventoría técnica.';

// Copy de checklist por paquete Care — mismo contenido aprobado del catálogo
// público (landing/planes.html), adaptado a la propuesta con precio real.
const CARACTERISTICAS_CARE: Record<string, string[]> = {
  INSPECT: ['Inspección anual con informe de estado', 'Gestión preventiva del activo', 'Tarifa preferencial en servicios KTV'],
  ESSENTIAL: ['Inspección anual con Diagnóstico Visual KTV', '1 lavada de fachada al año', 'Prioridad de agenda preferente', 'Precio preferente vs. servicio puntual'],
  COMPLETE: ['Año 1 con Informe Internacional Inotek (Noruega)', 'Año 3 con Diagnóstico Visual KTV', '2 lavadas de fachada al año, los 3 años', 'Prioridad máxima + atención de urgencias', 'Máximo beneficio de precio por volumen'],
};

// Destaque visual por plan — mismo tratamiento que el catálogo público
// (landing/planes.html): Essential "Más popular", Complete "Máximo valor"
// con header sólido. Es fijo por plan (no depende de cuál sea el recomendado
// para este cliente en particular, que se marca aparte con una estrella).
const DESTAQUE_CARE: Record<string, { tag: string; badge?: string; feat?: boolean; pop?: boolean }> = {
  INSPECT: { tag: 'Diagnóstico y gestión' },
  ESSENTIAL: { tag: 'Corporativos y bodegas', badge: 'Más popular', pop: true },
  COMPLETE: { tag: 'Alta exigencia', badge: 'Máximo valor', feat: true },
};

export default async function PropuestaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dto = await getCotizacionClienteDTO(id);
  if (!dto) notFound();

  // Link desactivado: mensaje amable, sin exponer ningún dato de la propuesta.
  if (!dto.linkActivo) {
    return (
      <div className="min-h-screen bg-[#eef2f6] flex items-center justify-center px-4">
        <div className="max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-4xl mb-3">⏸</p>
          <h1 className="text-lg font-extrabold text-[#171E27]">Esta propuesta ya no está disponible</h1>
          <p className="text-sm text-gray-500 mt-2">
            El enlace fue desactivado o la propuesta fue actualizada. Comuníquese con su asesor
            KTV Working Drone para recibir la versión vigente.
          </p>
          <a href={URL_CATALOGO_FRIO} className="inline-block mt-5 bg-[#66C2F8] text-white text-sm font-bold rounded-full px-6 py-2">
            Conocer KTV Working Drone →
          </a>
        </div>
      </div>
    );
  }

  // Tracking de apertura: solo cuentan los visitantes SIN sesión (el cliente);
  // las vistas internas del equipo no se registran.
  const session = await getSession();
  if (!session) {
    const ua = (await headers()).get('user-agent');
    await prisma.apertura.create({
      data: { cotizacion: { connect: { linkToken: id } }, userAgent: ua?.slice(0, 250) ?? null },
    }).catch(() => {});
  }

  const p = dto.puntual;

  return (
    <div className="min-h-screen bg-white">
      {dto.care ? (
        // Hero de Care — panel sólido azul de marca + video al lado (mismo
        // recuadro que el catálogo público, aspect-ratio + object-cover, sin
        // barras negras) para diferenciarse del video de fondo completo de
        // la cotización puntual (Familia 1).
        <section className="relative overflow-hidden bg-[#66C2F8]">
          <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 py-10 md:py-14 grid md:grid-cols-[1.05fr_.95fr] gap-10 items-center">
            <div>
              <Image src="/logo-ktv-white.png" alt="KTV Working Drone" width={200} height={42} className="h-10 md:h-11 w-auto mb-6" />
              <span className="text-xs font-bold tracking-wide bg-white text-[#171E27] rounded-full px-3 py-1.5">{dto.idTrazabilidad}</span>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white mt-4">Propuesta Económica</h1>
              <p className="text-white text-base font-semibold mt-1">Programa KTV Care</p>
              <p className="text-white/90 text-sm md:text-base font-light mt-3 max-w-md">
                Un programa anual a la medida de su edificio: precio preferencial, prioridad de agenda
                e informe técnico de estado incluido. Con tecnología de drones — sin andamios y sin
                riesgo de trabajo en alturas.
              </p>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/20 aspect-[9/12.5] bg-black">
              <video autoPlay muted loop playsInline preload="auto" className="w-full h-full object-cover">
                <source src="https://landing.ktvworkingdrone.com.co/videos/accion-1.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </section>
      ) : (
        <section className="relative min-h-[52vh] md:min-h-[58vh] flex items-end overflow-hidden">
          <div className="absolute inset-0 z-0">
            <video autoPlay muted loop playsInline preload="auto" className="w-full h-full object-cover">
              <source src="https://landing.ktvworkingdrone.com.co/videos/hero.mp4" type="video/mp4" />
            </video>
          </div>
          <div
            className="absolute inset-0 z-[1]"
            style={{ background: 'linear-gradient(160deg,rgba(102,194,248,.68) 0%,rgba(20,20,50,.88) 100%)' }}
          />
          <div className="relative z-[2] max-w-6xl mx-auto w-full px-6 md:px-12 pt-28 pb-10">
            <Image src="/logo-ktv-white.png" alt="KTV Working Drone" width={180} height={38} className="h-8 w-auto mb-5" />
            <span className="text-xs font-bold tracking-wide bg-white/10 border border-[#66C2F8]/40 rounded px-2 py-1 text-white">{dto.idTrazabilidad}</span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white mt-4">Propuesta Económica</h1>
            {p && <p className="text-[#66C2F8] text-base font-semibold mt-2">{NOMBRES_SERVICIO[p.servicio]}</p>}
          </div>
        </section>
      )}

      <div className={`${dto.care ? 'max-w-5xl' : 'max-w-4xl'} mx-auto px-6 md:px-12 py-10 space-y-6`}>
          <div>
            <p className="text-xs text-gray-400">Bogotá, {new Date(dto.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="text-sm text-gray-600 mt-2">Señores</p>
            <p className="text-sm font-bold text-[#171E27]">{dto.clienteNombre}</p>
            {dto.clienteContacto && <p className="text-sm text-gray-500">Atn: {dto.clienteContacto}</p>}
            {p && (
              <p className="text-sm text-gray-600 mt-3">
                <span className="font-bold text-[#66C2F8]">Ref:</span> Propuesta económica — intervención de fachadas con tecnología de drones.
              </p>
            )}
            {dto.care && (
              <p className="text-sm text-gray-600 mt-3">
                <span className="font-bold text-[#66C2F8]">Ref:</span> Propuesta económica — Programa KTV Care de mantenimiento de fachadas con tecnología de drones.
              </p>
            )}
          </div>

          {p && (
            <p className="text-sm text-gray-600 text-justify">
              Agradecemos su invitación a presentar nuestra propuesta económica por servicios
              especializados en gran altura con la utilización de drones de última tecnología. El
              presente documento se ha confeccionado atendiendo de forma exclusiva los requerimientos y
              necesidades expresadas por ustedes para realizar la limpieza y preservación de su
              infraestructura, combinando alta ingeniería aeronáutica con mano de obra técnica calificada.
            </p>
          )}

          {dto.care && (
            <p className="text-sm text-gray-600 text-justify">
              Agradecemos su interés en el Programa KTV Care de mantenimiento preventivo de fachadas.
              A continuación presentamos las opciones disponibles a la medida de su inmueble —
              inspección periódica, lavado programado y precio preferencial frente a un servicio
              puntual — combinando alta ingeniería aeronáutica con mano de obra técnica calificada.
            </p>
          )}

          {p && (
            <>
              {p.incluyeLavado && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-[#66C2F8] text-white px-4 py-2 text-xs font-bold uppercase">{NOMBRES_SERVICIO[p.servicio]}</div>
                  <div className="px-4 py-3 flex justify-between items-center gap-4">
                    <span className="text-sm text-gray-600 text-justify">{DESC_LAVADO}</span>
                    <span className="font-bold text-[#171E27] shrink-0">{cop(p.precioLavadoTotal)}</span>
                  </div>
                  {p.informeBaseNombre && !p.informeBaseCobrado && (
                    <div className="px-4 pb-4 pt-1 text-sm text-gray-700 text-justify border-t border-gray-100">
                      <b className="text-[#171E27]">Incluye {p.informeBaseNombre} sin costo adicional.</b> Registro fotográfico y de video en alta resolución, hallazgos y recomendaciones de mantenimiento. Valor de referencia {cop(p.informeBaseValor)} — ya está contemplado en el precio de arriba, no se factura por separado.
                    </div>
                  )}
                </div>
              )}
              {p.informeBaseNombre && p.informeBaseCobrado && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-[#66C2F8] text-white px-4 py-2 text-xs font-bold uppercase">{p.informeBaseNombre}</div>
                  <div className="px-4 py-3 flex justify-between items-center gap-4">
                    <span className="text-sm text-gray-600 text-justify">{DESC_DV}</span>
                    <span className="font-bold text-[#171E27] shrink-0">{cop(p.informeBaseValor)}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1 items-end text-sm pr-1 pt-2 border-t">
                <div className="flex justify-between w-56"><span className="text-gray-500">Subtotal (sin IVA)</span><span className="font-semibold text-[#171E27]">{cop(dto.totalCliente)}</span></div>
                <div className="flex justify-between w-56"><span className="text-gray-500">IVA (19%)</span><span className="font-semibold text-[#171E27]">{cop(dto.totalCliente * 0.19)}</span></div>
                <div className="flex justify-between w-56"><span className="text-gray-600 font-bold">Total</span><span className="font-extrabold text-[#171E27]">{cop(dto.totalCliente * 1.19)}</span></div>
              </div>
              {p.informeInternacional && (
                <div className="border border-dashed border-gray-300 rounded-xl overflow-hidden">
                  <div className="bg-gray-100 text-[#171E27] px-4 py-2 text-xs font-bold uppercase">Informe Internacional KTV — adicional opcional</div>
                  <div className="px-4 py-3 flex justify-between items-center gap-4">
                    <span className="text-sm text-gray-600 text-justify">{DESC_INTERNACIONAL}</span>
                    <span className="font-bold text-[#171E27] shrink-0">{cop(p.informeInternacional.precioTotal)}</span>
                  </div>
                  <p className="px-4 pb-3 text-xs text-gray-400">
                    Valor independiente, no incluido en el Subtotal ni en el Total de esta propuesta — se cotiza y factura aparte solo si lo solicita.
                  </p>
                </div>
              )}

              <div className="bg-[#F7FBFF] rounded-lg p-4 text-xs text-gray-600 space-y-1">
                <p className="font-bold uppercase tracking-wide text-gray-500 mb-1">Notas</p>
                <p>· Nuestra propuesta incluye los productos a aplicar durante el proceso de lavado.</p>
                <p>· El valor de la oferta es antes del IVA (19%).</p>
                <p>· El inicio de la operación estará sujeto a la agenda disponible de la Aeronáutica Civil.</p>
              </div>
            </>
          )}

          {dto.care && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Su programa a la medida — elija su plan KTV Care</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {dto.care.paquetes.map((paq) => {
                  const d = DESTAQUE_CARE[paq.plan];
                  return (
                  <div key={paq.plan} className={`rounded-xl border-2 overflow-hidden flex flex-col bg-white ${d.feat || d.pop ? 'border-[#66C2F8]' : 'border-gray-200'} ${d.feat ? 'shadow-lg shadow-[#66C2F8]/20 md:-translate-y-1.5' : ''}`}>
                    <div className={`relative px-4 py-3 ${d.feat ? 'bg-[#66C2F8] text-white' : 'bg-gray-50 text-[#171E27]'} ${d.pop ? 'border-t-4 border-t-[#66C2F8]' : ''}`}>
                      {d.badge && (
                        <span className={`absolute top-3 right-3 text-[9px] font-extrabold uppercase tracking-wide rounded-full px-2.5 py-1 ${d.feat ? 'bg-white text-[#66C2F8]' : 'bg-[#66C2F8] text-white'}`}>
                          {d.badge}
                        </span>
                      )}
                      <p className={`text-[10px] font-bold uppercase tracking-wide ${d.feat ? 'text-white/85' : 'text-[#66C2F8]'}`}>{d.tag}</p>
                      <p className="text-base font-extrabold mt-1">{paq.nombre}</p>
                      {paq.recomendado && (
                        <p className={`text-[10px] font-bold uppercase tracking-wide mt-1.5 ${d.feat ? 'text-white' : 'text-[#66C2F8]'}`}>★ Recomendado para su edificio</p>
                      )}
                    </div>
                    <div className="p-4 flex flex-col gap-3 flex-1">
                      <div>
                        <span className="text-xl font-extrabold text-[#171E27]">{cop(paq.valorMensual)}</span> <span className="text-xs text-gray-500">/ mes</span>
                        <p className="text-[11px] text-gray-400">{cop(paq.valorAnual)} / año + IVA</p>
                      </div>
                      <div className="bg-[#EBF8FF] border border-[#66C2F8]/40 rounded-lg px-2.5 py-2 text-[11px] text-gray-700">
                        {paq.plan === 'COMPLETE' ? (
                          <><b className="text-[#171E27]">Año 1 con respaldo internacional Inotek</b> (Noruega), <b className="text-[#171E27]">año 3 con Diagnóstico Visual KTV</b> (con IA) · {paq.nLavadas} lavadas de fachada al año, los 3 años</>
                        ) : (
                          <>Incluye <b className="text-[#171E27]">Diagnóstico Visual KTV</b> (con IA) · valor {cop(dto.care!.informeIncluidoValor)}
                          {paq.nLavadas > 0 ? ` + ${paq.nLavadas} lavada${paq.nLavadas > 1 ? 's' : ''} de fachada` : ''}</>
                        )}
                      </div>
                      <ul className="text-xs text-gray-600 space-y-1.5 flex-1">
                        {CARACTERISTICAS_CARE[paq.plan].map((f) => (
                          <li key={f} className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">✓</span> {f}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  );
                })}
              </div>
              <div className="bg-[#F7FBFF] rounded-lg p-4 mt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Condiciones de pago</p>
                <p className="text-sm text-gray-700 text-justify">
                  Facturación mensual, mes vencido, desde el inicio del programa — aplica por igual sin importar el plan elegido o la duración del contrato. La ejecución del servicio anual (lavado e inspección) se agenda de común acuerdo con el cliente
                  {dto.care.formaPago === 'CONTADO' ? '.' : ' · valor diferido en 12 cuotas al año (no aplica como descuento).'}
                  {' '}Disponible en contratos de 1 o 3 años (el de 3 años congela el valor el primer año y lo ajusta por IPC en los siguientes).
                </p>
              </div>
            </div>
          )}

          {dto.observaciones && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Observaciones</h3>
              <p className="text-sm text-gray-600">{dto.observaciones}</p>
            </div>
          )}

          {p && (p.anticipoPct != null || p.saldoPct != null || p.condicionPagoNota) && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Condiciones de pago</h3>
              <div className="grid grid-cols-2 gap-3">
                {p.anticipoPct != null && (
                  <div className="bg-[#F7FBFF] rounded-lg p-3">
                    <p className="text-[11px] font-bold uppercase text-gray-500">Anticipo</p>
                    <p className="text-xl font-extrabold text-[#171E27]">{p.anticipoPct}%</p>
                  </div>
                )}
                {p.saldoPct != null && (
                  <div className="bg-[#F7FBFF] rounded-lg p-3">
                    <p className="text-[11px] font-bold uppercase text-gray-500">Saldo</p>
                    <p className="text-xl font-extrabold text-[#171E27]">{p.saldoPct}%</p>
                  </div>
                )}
              </div>
              {p.condicionPagoNota && <p className="text-sm text-gray-600 mt-2">{p.condicionPagoNota}</p>}
            </div>
          )}

          {p && (p.permisoAerocivil || p.ejecucionSitio) && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Permisos, tiempos y plazos</h3>
              <div className="grid grid-cols-2 gap-3">
                {p.permisoAerocivil && (
                  <div className="bg-[#F7FBFF] rounded-lg p-3">
                    <p className="text-[11px] font-bold uppercase text-gray-500">Permiso Aeronáutica Civil</p>
                    <p className="text-sm text-gray-700 mt-1">{p.permisoAerocivil}</p>
                  </div>
                )}
                {p.ejecucionSitio && (
                  <div className="bg-[#F7FBFF] rounded-lg p-3">
                    <p className="text-[11px] font-bold uppercase text-gray-500">Ejecución en sitio</p>
                    <p className="text-sm text-gray-700 mt-1">{p.ejecucionSitio}</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                La operación está sujeta a condiciones climáticas seguras (sin lluvias fuertes ni vientos
                extremos). En caso de fuerza mayor, los días se reprograman sin penalización.
              </p>
            </div>
          )}

          {(p?.incluyeLavado || dto.care) && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Requerimientos en sitio (a cargo del cliente)</h3>
              <ul className="text-sm text-gray-600 space-y-1.5">
                <li className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">✓</span> Punto de agua potable (llave con toma de ½, ¾ o 1 pulgada).</li>
                <li className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">✓</span> Red eléctrica: toma tradicional 110V.</li>
                <li className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">✓</span> Espacio de estacionamiento para vehículos operativos y acceso a puntos altos.</li>
                <li className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">✓</span> Permisos internos de la copropiedad y ventanas cerradas antes del servicio.</li>
                <li className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">✓</span> Acceso a baños para el personal técnico.</li>
              </ul>

              <div className="mt-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Equipo tecnológico propuesto en operación</p>
                <ul className="text-sm text-gray-600 space-y-1.5">
                  <li className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">•</span> 1 unidad de lavado especializado con sistema de tratamiento de agua.</li>
                  <li className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">•</span> 1 dron profesional de alta resistencia con equipos de repuesto y tripulación aeronáutica certificada.</li>
                  <li className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">•</span> 1 equipo técnico de acompañamiento en tierra con sistema de pértiga operativa.</li>
                </ul>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3 text-xs text-red-700 text-justify">
                <b>Exclusión por estado de fachada y ventanales.</b> KTV emplea tecnología de alta
                precisión, sin embargo no se hace responsable por filtraciones, humedades o daños
                interiores derivados de ventanas mal cerradas, empaques deteriorados, siliconas
                vencidas, fisuras preexistentes o sellos rotos. El cliente verifica el estado de estos
                elementos antes de la operación.
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">Valores antes de IVA (19%) salvo el Total indicado arriba. {dto.vigenteHasta ? `Propuesta válida hasta ${new Date(dto.vigenteHasta).toLocaleDateString('es-CO')}.` : ''}</p>

          <div className="border-t pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#66C2F8] mb-2">Aceptación de la propuesta</h3>
            <AceptarButton linkToken={dto.linkToken} aceptada={dto.aceptadaPorCliente} />
          </div>

          {p && (
            <div className="grid grid-cols-2 gap-6 pt-8">
              <div className="border-t border-gray-300 pt-2">
                <p className="text-sm font-bold text-[#171E27]">{dto.creadoPorNombre}</p>
                <p className="text-xs text-gray-400">KTV Working Drone Colombia</p>
              </div>
              <div className="border-t border-gray-300 pt-2">
                <p className="text-sm font-bold text-[#171E27]">{dto.clienteNombre}</p>
                <p className="text-xs text-gray-400">{dto.clienteContacto || 'Firma autorizada'}</p>
              </div>
            </div>
          )}

          {/* Calentamiento: a los clientes de servicio puntual se les presenta el
              programa recurrente (catálogo de planes ya publicado) — sin precios aquí. */}
          {p && (
            <div className="bg-[#171E27] rounded-xl p-5 text-white">
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#66C2F8]">¿Y después del servicio?</h3>
              <p className="text-sm text-gray-300 mt-2">
                Con el <b className="text-white">Programa KTV Care</b> su edificio se mantiene con
                lavados planificados, inspección anual incluida y precio preferencial frente al
                servicio puntual.
              </p>
              <a href={URL_CATALOGO_PLANES} target="_blank" rel="noopener" className="inline-block mt-3 bg-[#66C2F8] text-white text-sm font-bold rounded-full px-5 py-2">
                Conocer los planes KTV Care →
              </a>
            </div>
          )}

          {/* Enlace institucional (catálogo de prospección en frío) */}
          <div className="text-center text-xs text-gray-400 border-t pt-5">
            <p>
              KTV Working Drone Colombia S.A.S. · Único operador con Certificado de Explotador UAS
              vigente de Aerocivil en su categoría.
            </p>
            <p className="mt-1">
              KTV Working Drone Colombia S.A.S. — NIT 901.830.814-8 · mercadeo@ktvworkingdrone.com.co · +57 314 235 8441
            </p>
            <a href={URL_CATALOGO_FRIO} target="_blank" rel="noopener" className="text-[#66C2F8] font-semibold hover:underline">
              landing.ktvworkingdrone.com.co
            </a>
            <div className="flex justify-center gap-2.5 mt-4">
              <a href="https://www.tiktok.com/@ktvworkingdronecol" target="_blank" rel="noopener" title="TikTok" className="w-8 h-8 rounded-full bg-gray-100 hover:bg-[#66C2F8] flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z" /></svg>
              </a>
              <a href="https://youtube.com/@ktvworkingdronecol" target="_blank" rel="noopener" title="YouTube" className="w-8 h-8 rounded-full bg-gray-100 hover:bg-[#66C2F8] flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 00.5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 002.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 002.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5v-7l6.25 3.5-6.25 3.5z" /></svg>
              </a>
              <a href="https://www.facebook.com/profile.php?id=61584513467927" target="_blank" rel="noopener" title="Facebook" className="w-8 h-8 rounded-full bg-gray-100 hover:bg-[#66C2F8] flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.27h3.32l-.53 3.5h-2.79V24C19.61 23.1 24 18.1 24 12.07z" /></svg>
              </a>
              <a href="https://www.instagram.com/ktvworkingdronecolombia" target="_blank" rel="noopener" title="Instagram" className="w-8 h-8 rounded-full bg-gray-100 hover:bg-[#66C2F8] flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
  );
}


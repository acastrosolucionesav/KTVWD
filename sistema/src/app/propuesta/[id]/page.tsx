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
const DESC_INTERNACIONAL = 'Soporte técnico bajo estándar internacional KTV — informe certificado para due diligence, auditorías o interventoría técnica.';

// Copy de checklist por paquete Care — mismo contenido aprobado del catálogo
// público (landing/planes.html), adaptado a la propuesta con precio real.
const CARACTERISTICAS_CARE: Record<string, string[]> = {
  INSPECT: ['Inspección anual con informe de estado', 'Gestión preventiva del activo', 'Tarifa preferencial en servicios KTV'],
  ESSENTIAL: ['Inspección anual con Diagnóstico Visual KTV', '1 lavada de fachada al año', 'Prioridad de agenda preferente', 'Precio preferente vs. servicio puntual'],
  COMPLETE: ['Inspección anual con Diagnóstico Visual KTV', '2 lavadas de fachada al año', 'Prioridad máxima + atención de urgencias', 'Máximo beneficio de precio por volumen'],
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
    <div className="min-h-screen bg-[#eef2f6] py-10 px-4">
      <div className={`${dto.care ? 'max-w-4xl' : 'max-w-2xl'} mx-auto bg-white rounded-2xl shadow-lg overflow-hidden border border-[#66C2F8]/20`}>
        <div className="bg-[#171E27] text-white px-8 py-8">
          <Image src="/logo-ktv-white.png" alt="KTV Working Drone" width={160} height={35} className="h-7 w-auto mb-4" />
          <span className="text-xs font-bold tracking-wide bg-white/10 border border-[#66C2F8]/40 rounded px-2 py-1">{dto.idTrazabilidad}</span>
          <h1 className="text-2xl font-extrabold mt-4">Propuesta Económica</h1>
          {p && <p className="text-[#66C2F8] text-sm font-semibold mt-1">{NOMBRES_SERVICIO[p.servicio]}</p>}
        </div>

        <div className="p-8 space-y-6">
          <div>
            <p className="text-sm text-gray-500">Señores: <b className="text-[#171E27]">{dto.clienteNombre}</b>{dto.clienteContacto ? ` · At.: ${dto.clienteContacto}` : ''}</p>
            <p className="text-xs text-gray-400">{new Date(dto.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>

          {p && (
            <p className="text-sm text-gray-600">
              Agradecemos su interés en nuestros servicios especializados de intervención de fachadas en
              gran altura con drones de última tecnología. A continuación presentamos nuestra propuesta
              económica, elaborada según los requerimientos de su inmueble, combinando ingeniería
              aeronáutica con mano de obra técnica calificada.
            </p>
          )}

          {p && (
            <>
              {p.incluyeLavado && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-[#66C2F8] text-white px-4 py-2 text-xs font-bold uppercase">Servicio de lavado de fachada</div>
                  <div className="px-4 py-3 flex justify-between items-start gap-4">
                    <span className="text-sm text-gray-600">{DESC_LAVADO}</span>
                    <span className="font-bold text-[#171E27] shrink-0">{cop(p.precioLavadoTotal)}</span>
                  </div>
                </div>
              )}
              {p.informeBaseNombre && !p.informeBaseCobrado && (
                <div className="bg-[#EBF8FF] border border-[#66C2F8]/50 border-l-4 border-l-[#66C2F8] rounded-xl p-4 text-sm text-gray-700">
                  <b className="text-[#171E27]">{p.informeBaseNombre} — incluido sin costo con su lavado.</b> Registro fotográfico y de video en alta resolución, hallazgos y recomendaciones de mantenimiento. Valor de referencia {cop(p.informeBaseValor)} — <b>sin costo adicional</b>.
                </div>
              )}
              {p.informeBaseNombre && p.informeBaseCobrado && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-[#66C2F8] text-white px-4 py-2 text-xs font-bold uppercase">{p.informeBaseNombre}</div>
                  <div className="px-4 py-3 flex justify-between items-start gap-4">
                    <span className="text-sm text-gray-600">{DESC_DV}</span>
                    <span className="font-bold text-[#171E27] shrink-0">{cop(p.informeBaseValor)}</span>
                  </div>
                </div>
              )}
              {p.informeInternacional && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-[#66C2F8] text-white px-4 py-2 text-xs font-bold uppercase">Informe Internacional KTV (adicional opcional)</div>
                  <div className="px-4 py-3 flex justify-between items-start gap-4">
                    <span className="text-sm text-gray-600">{DESC_INTERNACIONAL}</span>
                    <span className="font-bold text-[#171E27] shrink-0">{cop(p.informeInternacional.precioTotal)}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1 items-end text-sm pr-1 pt-2 border-t">
                <div className="flex justify-between w-56"><span className="text-gray-500">Subtotal (sin IVA)</span><span className="font-semibold text-[#171E27]">{cop(dto.totalCliente)}</span></div>
                <div className="flex justify-between w-56"><span className="text-gray-500">IVA (19%)</span><span className="font-semibold text-[#171E27]">{cop(dto.totalCliente * 0.19)}</span></div>
                <div className="flex justify-between w-56"><span className="text-gray-600 font-bold">Total</span><span className="font-extrabold text-[#171E27]">{cop(dto.totalCliente * 1.19)}</span></div>
              </div>
            </>
          )}

          {dto.care && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Su programa a la medida — elija su plan KTV Care</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {dto.care.paquetes.map((paq) => (
                  <div key={paq.plan} className={`rounded-xl border-2 overflow-hidden flex flex-col ${paq.recomendado ? 'border-[#66C2F8]' : 'border-gray-200'}`}>
                    <div className={`px-4 py-3 text-xs font-bold uppercase ${paq.recomendado ? 'bg-[#66C2F8] text-white' : 'bg-gray-50 text-[#171E27]'}`}>
                      {paq.recomendado && <span className="block text-[10px] tracking-widest mb-1">RECOMENDADO</span>}
                      {paq.nombre}
                    </div>
                    <div className="p-4 flex flex-col gap-3 flex-1">
                      <div>
                        <span className="text-xl font-extrabold text-[#171E27]">{cop(paq.valorMensual)}</span> <span className="text-xs text-gray-500">/ mes</span>
                        <p className="text-[11px] text-gray-400">{cop(paq.valorAnual)} / año + IVA</p>
                      </div>
                      <div className="bg-[#EBF8FF] border border-[#66C2F8]/40 rounded-lg px-2.5 py-2 text-[11px] text-gray-700">
                        Incluye <b className="text-[#171E27]">Diagnóstico Visual KTV</b> (con IA) · valor {cop(dto.care!.informeIncluidoValor)}
                        {paq.nLavadas > 0 ? ` + ${paq.nLavadas} lavada${paq.nLavadas > 1 ? 's' : ''} de fachada` : ''}
                      </div>
                      <ul className="text-xs text-gray-600 space-y-1.5 flex-1">
                        {CARACTERISTICAS_CARE[paq.plan].map((f) => (
                          <li key={f} className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">✓</span> {f}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                Contrato {dto.care.contratoAnios} año(s) · Pago {dto.care.formaPago === 'CONTADO' ? 'de contado' : 'diferido en 12 cuotas (no es descuento)'}.
              </p>
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

          {p?.incluyeLavado && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Requerimientos en sitio (a cargo del cliente)</h3>
              <ul className="text-sm text-gray-600 space-y-1.5">
                <li className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">✓</span> Punto de agua potable (llave con toma de ½, ¾ o 1 pulgada).</li>
                <li className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">✓</span> Red eléctrica: toma tradicional 110V.</li>
                <li className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">✓</span> Espacio de estacionamiento para vehículos operativos y acceso a puntos altos.</li>
                <li className="flex gap-1.5"><span className="text-[#66C2F8] font-bold">✓</span> Permisos internos de la copropiedad y ventanas cerradas antes del servicio.</li>
              </ul>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3 text-xs text-red-700">
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
                <p className="text-sm font-bold text-[#171E27]">KTV Working Drone Colombia</p>
                <p className="text-xs text-gray-400">Firma autorizada</p>
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
          </div>
        </div>
      </div>
    </div>
  );
}

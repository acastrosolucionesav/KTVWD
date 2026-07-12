import { notFound } from 'next/navigation';
import { getCotizacionClienteDTO } from '@/lib/dto';
import { prisma } from '@/lib/prisma';
import AceptarButton from './AceptarButton';

// PÁGINA PÚBLICA — sin login. Solo puede recibir el DTO de cliente (dto.ts),
// que estructuralmente no tiene fee/costo/margen. Regla A vive acá.

function cop(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return 'COP ' + Math.round(n).toLocaleString('es-CO');
}

const NOMBRES_SERVICIO: Record<string, string> = {
  INSPECCION_SOLA: 'Inspección de fachada y cubierta',
  LAVADO_MAS_INSPECCION: 'Lavado de fachada + Inspección KTV Colombia',
  SOLO_LAVADO: 'Lavado de fachada',
};

export default async function PropuestaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dto = await getCotizacionClienteDTO(id);
  if (!dto) notFound();

  await prisma.apertura.create({ data: { cotizacion: { connect: { idTrazabilidad: id } } } }).catch(() => {});

  const p = dto.puntual;

  return (
    <div className="min-h-screen bg-[#eef2f6] py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden border border-[#66C3F8]/20">
        <div className="bg-gradient-to-br from-[#222C38] to-[#0B0F14] text-white px-8 py-8">
          <span className="text-xs font-bold tracking-wide bg-white/10 border border-[#66C3F8]/40 rounded px-2 py-1">{dto.idTrazabilidad}</span>
          <h1 className="text-2xl font-extrabold mt-4">Propuesta Económica</h1>
          {p && <p className="text-[#66C3F8] text-sm font-semibold mt-1">{NOMBRES_SERVICIO[p.servicio]}</p>}
        </div>

        <div className="p-8 space-y-6">
          <div>
            <p className="text-sm text-gray-500">Señores: <b className="text-[#171E27]">{dto.clienteNombre}</b>{dto.clienteContacto ? ` · At.: ${dto.clienteContacto}` : ''}</p>
            <p className="text-xs text-gray-400">{new Date(dto.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>

          {p && (
            <>
              {p.incluyeLavado && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-[#66C3F8] text-white px-4 py-2 text-xs font-bold uppercase">Servicio de lavado de fachada</div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-sm text-gray-600">Servicio Integral de Lavado KTV WD</span>
                    <span className="font-bold text-[#171E27]">{cop(p.precioLavadoTotal)}</span>
                  </div>
                </div>
              )}
              {p.informeBaseNombre && !p.informeBaseCobrado && (
                <div className="bg-[#EBF8FF] border border-[#66C3F8]/50 border-l-4 border-l-[#66C3F8] rounded-xl p-4 text-sm text-gray-700">
                  <b className="text-[#171E27]">{p.informeBaseNombre} — incluido sin costo con su lavado.</b> Registro fotográfico y de video en alta resolución, hallazgos y recomendaciones de mantenimiento. Valor de referencia {cop(p.informeBaseValor)} — <b>sin costo adicional</b>.
                </div>
              )}
              {p.informeBaseNombre && p.informeBaseCobrado && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-[#66C3F8] text-white px-4 py-2 text-xs font-bold uppercase">{p.informeBaseNombre}</div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-sm text-gray-600">Inspección de fachada y cubierta con dron (elaborado con apoyo de IA)</span>
                    <span className="font-bold text-[#171E27]">{cop(p.informeBaseValor)}</span>
                  </div>
                </div>
              )}
              {p.informeInternacional && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-[#66C3F8] text-white px-4 py-2 text-xs font-bold uppercase">Informe Internacional KTV (adicional opcional)</div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-sm text-gray-600">Soporte técnico bajo estándar internacional KTV</span>
                    <span className="font-bold text-[#171E27]">{cop(p.informeInternacional.precioTotal)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {dto.care && (
            <div className="border-2 border-[#66C3F8] rounded-xl overflow-hidden">
              <div className="bg-[#66C3F8] text-white px-4 py-2 text-xs font-bold uppercase">KTV Care {dto.care.plan}</div>
              <div className="px-4 py-3 space-y-3">
                <div>
                  <span className="text-2xl font-extrabold text-[#171E27]">{cop(dto.care.valorMensual)}</span> <span className="text-sm text-gray-500">/ mes</span>
                  <p className="text-xs text-gray-400">{cop(dto.care.valorAnual)} / año + IVA · contrato {dto.care.contratoAnios} año(s)</p>
                </div>
                <div className="bg-[#EBF8FF] border border-[#66C3F8]/40 rounded-lg px-3 py-2 text-xs text-gray-700">
                  Incluye <b className="text-[#171E27]">Diagnóstico Visual KTV</b> (con IA) · valor de referencia {cop(dto.care.informeIncluidoValor)}
                </div>
              </div>
            </div>
          )}

          {dto.observaciones && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Observaciones</h3>
              <p className="text-sm text-gray-600">{dto.observaciones}</p>
            </div>
          )}

          <p className="text-xs text-gray-400">Valores antes de IVA (19%). {dto.vigenteHasta ? `Propuesta válida hasta ${new Date(dto.vigenteHasta).toLocaleDateString('es-CO')}.` : ''}</p>

          <div className="border-t pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#66C3F8] mb-2">Aceptación de la propuesta</h3>
            <AceptarButton idTrazabilidad={dto.idTrazabilidad} aceptada={dto.aceptadaPorCliente} />
          </div>
        </div>
      </div>
    </div>
  );
}

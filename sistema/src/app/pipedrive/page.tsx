import { verificarTokenModal, resolverUsuarioPipedrive } from '@/lib/pipedriveModalAuth';
import { obtenerTrato } from '@/lib/pipedrive';
import { prisma } from '@/lib/prisma';
import PipedriveModalClient from './PipedriveModalClient';

function MensajeModal({ texto, detalle }: { texto: string; detalle?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FBFF] px-6">
      <div className="max-w-md text-center bg-white rounded-2xl shadow p-6 border border-gray-200">
        <p className="text-sm text-gray-600">{texto}</p>
        {detalle && <p className="mt-3 text-xs text-gray-400 border-t border-gray-100 pt-3">{detalle}</p>}
      </div>
    </div>
  );
}

// Modal embebido en el detalle de un trato de Pipedrive (App Extension tipo
// Custom Modal, Developer Hub — ver skill ktv-cotizador). Pipedrive abre esta
// página con ?id=<deal>&token=<jwt>&userId=<user> — nombres exactos, no
// deal_id/user_id. Sin cookie de sesión de KTV: la identidad se valida acá con
// el JWT (ver src/lib/pipedriveModalAuth.ts).
export default async function PipedriveModalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const leer = (k: string) => (Array.isArray(params[k]) ? params[k][0] : params[k]) as string | undefined;
  const id = leer('id');
  const token = leer('token');
  const userId = leer('userId');

  const r = await verificarTokenModal(token, id, userId);
  if (!r.ok) {
    // Se listan los nombres de los parámetros que sí llegaron (no sus valores:
    // el token es sensible) — si Pipedrive los manda con otro nombre, esto lo
    // hace evidente de una vez en vez de dejarlo como un fallo mudo.
    const recibidos = Object.keys(params);
    return (
      <MensajeModal
        texto="No se pudo validar la sesión de Pipedrive. Cierra esta ventana y vuelve a abrirla desde el trato."
        detalle={`${r.motivo} · Parámetros recibidos: ${recibidos.length > 0 ? recibidos.join(', ') : '(ninguno)'}`}
      />
    );
  }
  const sesion = r.sesion;

  const usuario = await resolverUsuarioPipedrive(sesion.userId);
  if (!usuario) {
    return <MensajeModal texto="Tu cuenta de Pipedrive no tiene un usuario correspondiente en el Sistema Comercial KTV. Pide a Gerencia que te cree uno con el mismo correo." />;
  }

  // Solo la cotización VIGENTE de cada familia (nunca una ya reemplazada por
  // una corrección) — mismo criterio que el listado principal.
  const cotizaciones = await prisma.cotizacion.findMany({
    where: { pipedriveDealId: String(sesion.dealId), versionNueva: null },
    include: { cliente: true, puntual: true, care: true, itemsLavado: { orderBy: { orden: 'asc' } } },
  });
  const cPuntual = cotizaciones.find((c) => c.familia === 'PUNTUAL' && c.puntual);
  const cCare = cotizaciones.find((c) => c.familia === 'CARE' && c.care);

  const puntualExistente = cPuntual && cPuntual.puntual
    ? {
        id: cPuntual.id,
        clienteNombre: cPuntual.cliente.nombre,
        clienteContacto: cPuntual.cliente.contacto ?? '',
        pipedriveDealId: cPuntual.cliente.pipedriveDealId ?? '',
        servicio: cPuntual.puntual.servicio,
        itemsLavado: cPuntual.itemsLavado.length > 0
          ? cPuntual.itemsLavado.map((it) => ({
              nombre: it.nombre, concepto: it.concepto, m2Vidrio: it.m2Vidrio, m2Opaca: it.m2Opaca,
              superficie: it.superficie, tipoEdificio: it.tipoEdificio, dificultad: it.dificultad,
            }))
          : cPuntual.puntual.concepto
            ? [{
                nombre: 'Lavado', concepto: cPuntual.puntual.concepto, m2Vidrio: cPuntual.puntual.m2Vidrio ?? 0, m2Opaca: cPuntual.puntual.m2Opaca ?? 0,
                superficie: cPuntual.puntual.superficie ?? 'MIXTA', tipoEdificio: cPuntual.puntual.tipoEdificio ?? 'BAJO', dificultad: cPuntual.puntual.dificultad ?? 'BAJO',
              }]
            : [],
        descuentoPct: cPuntual.puntual.descuentoPct,
        techo: cPuntual.puntual.rangoTecho ?? 0,
        mostrarInformeInternacional: cPuntual.puntual.mostrarInformeInternacional,
        observaciones: cPuntual.observaciones ?? '',
        anticipoPct: cPuntual.puntual.anticipoPct,
        saldoPct: cPuntual.puntual.saldoPct,
        condicionPagoNota: cPuntual.puntual.condicionPagoNota ?? '',
        permisoAerocivil: cPuntual.puntual.permisoAerocivil ?? '',
        diasEjecucion: cPuntual.puntual.diasEjecucion,
        ejecucionSitio: cPuntual.puntual.ejecucionSitio ?? '',
      }
    : undefined;

  const careExistente = cCare && cCare.care
    ? {
        id: cCare.id,
        clienteNombre: cCare.cliente.nombre,
        clienteContacto: cCare.cliente.contacto ?? '',
        pipedriveDealId: cCare.cliente.pipedriveDealId ?? '',
        plan: cCare.care.planRecomendado,
        m2: cCare.care.m2Fachada ?? 0,
        techo: cCare.care.rangoTecho ?? 0,
        superficie: cCare.care.superficie ?? 'MIXTA',
        tipoEdificio: cCare.care.tipoEdificio ?? 'BAJO',
        dificultad: cCare.care.dificultad ?? 'BAJO',
        formaPago: cCare.care.formaPago,
        observaciones: cCare.observaciones ?? '',
        descuentoPct: cCare.care.descuentoManualPct,
      }
    : undefined;

  // Ninguna cotización todavía para este trato: traer nombre/contacto para
  // prellenar el formulario que el comercial elija crear.
  const dealPrefill = !puntualExistente && !careExistente ? await obtenerTrato(sesion.dealId) : null;

  return (
    <PipedriveModalClient
      dealId={sesion.dealId}
      userId={sesion.userId}
      tokenInicial={token!}
      puntualExistente={puntualExistente}
      careExistente={careExistente}
      dealPrefill={dealPrefill ? { clienteNombre: dealPrefill.orgName || dealPrefill.personName || dealPrefill.title, clienteContacto: dealPrefill.personName ?? '' } : undefined}
    />
  );
}

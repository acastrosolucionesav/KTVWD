import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { obtenerTrato } from '@/lib/pipedrive';
import CotizadorForm from './CotizadorForm';

// Acepta ?deal_id=N: es el link que vive en el campo "Cotizador" de cada trato
// de Pipedrive. Al hacer clic desde el trato, el comercial cae aquí y el trato
// queda cargado solo (cliente/contacto prellenados y vinculado), sin buscar
// nada. Si no tiene sesión, se preserva el deal_id a través del login.
export default async function CotizadorPage({ searchParams }: { searchParams: Promise<{ deal_id?: string }> }) {
  const { deal_id } = await searchParams;
  const session = await getSession();
  if (!session?.userId) {
    const destino = deal_id ? `/cotizador?deal_id=${encodeURIComponent(deal_id)}` : '/cotizador';
    redirect(`/login?next=${encodeURIComponent(destino)}`);
  }

  const dealNum = deal_id ? Number(deal_id) : null;
  const dealPrefill = dealNum && !Number.isNaN(dealNum) ? await obtenerTrato(dealNum) : null;

  return (
    <CotizadorForm
      dealPrefill={
        dealPrefill
          ? {
              id: String(dealPrefill.id),
              clienteNombre: dealPrefill.orgName || dealPrefill.personName || dealPrefill.title,
              clienteContacto: dealPrefill.personName ?? '',
            }
          : undefined
      }
    />
  );
}

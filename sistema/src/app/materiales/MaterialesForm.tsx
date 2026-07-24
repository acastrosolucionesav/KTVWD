'use client';

import { useState, useTransition } from 'react';
import PipedriveDealPicker from '@/components/PipedriveDealPicker';
import type { PipedriveDealResumen } from '@/lib/pipedrive';
import { registrarEnvioMaterialPipedrive } from '@/app/actions/pipedrive';

type Material = { key: 'LANDING' | 'PLANES' | 'ALIANZAS'; titulo: string; desc: string; url: string; compartirSolo?: boolean };

const MATERIALES: Material[] = [
  {
    key: 'LANDING' as const,
    titulo: 'Brochure de prospección (en frío)',
    desc: 'Página institucional de presentación — primer contacto con un prospecto nuevo.',
    url: 'https://landing.ktvworkingdrone.com.co',
  },
  {
    key: 'PLANES' as const,
    titulo: 'Catálogo de planes KTV Care (calentamiento)',
    desc: 'Los 3 programas de mantenimiento — para clientes que ya conocen KTV.',
    url: 'https://landing.ktvworkingdrone.com.co/planes.html',
  },
  {
    // No se registra contra un trato de cliente: es para reclutar aliados, no
    // para venderle a un cliente. Solo abrir/copiar para reenviar al candidato.
    key: 'ALIANZAS' as const,
    titulo: 'Página de Alianzas y Subfranquicias',
    desc: 'Para empresas de aseo, referidores o interesados en operar la marca — no es un cliente de servicio.',
    url: 'https://propuestas.ktvworkingdrone.com.co/alianzas',
    compartirSolo: true,
  },
];

export default function MaterialesForm() {
  const [deal, setDeal] = useState<PipedriveDealResumen | null>(null);
  const [pending, startTransition] = useTransition();
  const [estado, setEstado] = useState<Record<string, 'ok' | 'error' | 'copiado' | undefined>>({});

  function registrar(key: 'LANDING' | 'PLANES' | 'ALIANZAS') {
    if (!deal || key === 'ALIANZAS') return;
    startTransition(async () => {
      const r = await registrarEnvioMaterialPipedrive(deal.id, key);
      setEstado((s) => ({ ...s, [key]: r.ok ? 'ok' : 'error' }));
    });
  }

  function copiar(key: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setEstado((s) => ({ ...s, [key + '_copy']: 'copiado' }));
      setTimeout(() => setEstado((s) => ({ ...s, [key + '_copy']: undefined })), 2000);
    });
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-8 my-8 space-y-6 border border-[#66C2F8]/20">
      <div>
        <h1 className="text-lg font-extrabold text-[#171E27]">Enviar material comercial</h1>
        <p className="text-sm text-gray-500 mt-1">
          Comparta el brochure de prospección o el catálogo de planes con un cliente y déjelo
          registrado en su trato de Pipedrive. La página de alianzas se comparte con posibles
          aliados (no se registra contra un trato de cliente).
        </p>
      </div>

      <div className="p-4 bg-amber-50 rounded-xl border-2 border-dashed border-amber-300">
        <label className="block text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">🔗 Paso 1 — Buscar el trato en Pipedrive</label>
        <PipedriveDealPicker onSelect={setDeal} />
        <p className="text-[11px] text-amber-700/70 mt-1">El registro del envío queda en el historial de este trato.</p>
      </div>

      <div className="space-y-4">
        {MATERIALES.map((m) => (
          <div key={m.key} className="border border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-[#171E27] text-sm">{m.titulo}</h3>
            <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              <a href={m.url} target="_blank" rel="noopener"
                className="text-xs font-bold rounded-full px-4 py-2 border border-gray-300 text-gray-700 hover:border-[#66C2F8]">
                Abrir ↗
              </a>
              <button type="button" onClick={() => copiar(m.key, m.url)}
                className="text-xs font-bold rounded-full px-4 py-2 border border-gray-300 text-gray-700 hover:border-[#66C2F8]">
                {estado[m.key + '_copy'] === 'copiado' ? '¡Copiado!' : 'Copiar enlace'}
              </button>
              {!m.compartirSolo && (
                <button type="button" onClick={() => registrar(m.key)} disabled={!deal || pending}
                  className="text-xs font-bold rounded-full px-4 py-2 bg-[#66C2F8] text-white disabled:opacity-40">
                  Registrar envío en Pipedrive
                </button>
              )}
              {estado[m.key] === 'ok' && <span className="text-xs text-emerald-600 font-semibold">✓ Registrado en el trato</span>}
              {estado[m.key] === 'error' && <span className="text-xs text-red-600 font-semibold">No se pudo registrar</span>}
            </div>
            {!m.compartirSolo && !deal && <p className="text-[11px] text-gray-400 mt-2">Busque primero un trato para poder registrar el envío.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

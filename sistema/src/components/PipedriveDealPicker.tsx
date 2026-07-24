'use client';

import { useState, useTransition } from 'react';
import { buscarDealsPipedrive } from '@/app/actions/pipedrive';
import type { PipedriveDealResumen } from '@/lib/pipedrive';

// Vincula la cotización a un trato existente de Pipedrive (búsqueda en vivo,
// nunca un ID a ciegas) — el ID viajará en un input oculto `pipedriveDealId`
// del formulario padre. No crea ni edita nada en Pipedrive hasta que la
// propuesta se marque como enviada (eso lo hace el servidor, no este componente).
export default function PipedriveDealPicker({ onSelect }: { onSelect: (deal: PipedriveDealResumen | null) => void }) {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<PipedriveDealResumen[]>([]);
  const [seleccionado, setSeleccionado] = useState<PipedriveDealResumen | null>(null);
  const [pending, startTransition] = useTransition();

  function buscar(valor: string) {
    setQuery(valor);
    if (valor.trim().length < 2) {
      setResultados([]);
      return;
    }
    startTransition(async () => {
      const r = await buscarDealsPipedrive(valor);
      setResultados(r);
    });
  }

  function elegir(deal: PipedriveDealResumen) {
    setSeleccionado(deal);
    setResultados([]);
    onSelect(deal);
  }

  function quitar() {
    setSeleccionado(null);
    setQuery('');
    onSelect(null);
  }

  if (seleccionado) {
    return (
      <div className="bg-[#EBF8FF] border border-[#66C2F8]/40 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-sm text-[#171E27]">Vinculado a Pipedrive: <b>{seleccionado.title}</b></span>
        <button type="button" onClick={quitar} className="text-xs text-gray-400 hover:text-red-600 shrink-0">Quitar</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => buscar(e.target.value)}
        placeholder="Buscar trato en Pipedrive por nombre del cliente…"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#66C2F8]"
      />
      {pending && <p className="text-[11px] text-gray-400 mt-1">Buscando…</p>}
      {resultados.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-56 overflow-y-auto">
          {resultados.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => elegir(r)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[#EBF8FF]">
                <div className="font-semibold text-[#171E27]">{r.title}</div>
                <div className="text-[11px] text-gray-400">{r.orgName ?? r.personName ?? ''}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

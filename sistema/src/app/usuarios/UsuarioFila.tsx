'use client';

import { useState, useTransition } from 'react';
import { editarUsuario } from '@/app/actions/usuarios';
import EnlaceAccesoBoton from './EnlaceAccesoBoton';
import EstadoUsuarioBoton from './EstadoUsuarioBoton';

const input = 'w-full rounded-lg border border-gray-300 px-2 py-1 outline-none focus:border-[#66C2F8] text-sm';

const NOMBRES_ROL = {
  COMERCIAL: 'Comercial',
  DIRECTOR_COMERCIAL: 'Director comercial',
  GERENCIA: 'Gerencia',
} as const;

type Usuario = { id: string; nombre: string; email: string; rol: keyof typeof NOMBRES_ROL; activo: boolean };

// Corrige nombre/correo de una cuenta ya creada — ej. quedó con el nombre de
// quien la creó en Gerencia en vez del comercial real, o el correo se digitó
// mal. El nombre alimenta la firma de TODAS las propuestas de esa persona
// (pasadas y futuras — se lee en vivo del usuario, no queda congelado), así
// que corregirlo aquí corrige también las cotizaciones ya creadas.
export default function UsuarioFila({ usuario, esMismoUsuario }: { usuario: Usuario; esMismoUsuario: boolean }) {
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombreValor, setNombreValor] = useState(usuario.nombre);
  const [emailValor, setEmailValor] = useState(usuario.email);

  function guardar() {
    setError(null);
    const fd = new FormData();
    fd.set('nombre', nombreValor);
    fd.set('email', emailValor);
    startTransition(async () => {
      const res = await editarUsuario(usuario.id, fd);
      if (res?.error) setError(res.error);
      else setEditando(false);
    });
  }

  function cancelar() {
    setEditando(false);
    setError(null);
    setNombreValor(usuario.nombre);
    setEmailValor(usuario.email);
  }

  if (editando) {
    return (
      <tr className="border-t border-gray-100 align-top">
        <td className="px-4 py-3" colSpan={2}>
          <div className="flex flex-col gap-2 max-w-sm">
            <input className={input} value={nombreValor} onChange={(e) => setNombreValor(e.target.value)} placeholder="Nombre" />
            <input className={input} value={emailValor} onChange={(e) => setEmailValor(e.target.value)} placeholder="Correo" />
            {error && <span className="text-[11px] text-red-500">{error}</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-gray-600">{NOMBRES_ROL[usuario.rol]}</td>
        <td className="px-4 py-3">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${usuario.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
            {usuario.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex gap-3 justify-end">
            <button onClick={cancelar} disabled={pending} className="text-xs font-bold text-gray-500 hover:underline disabled:opacity-60">
              Cancelar
            </button>
            <button onClick={guardar} disabled={pending} className="text-xs font-bold text-[#66C2F8] hover:underline disabled:opacity-60">
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-3 font-semibold text-[#171E27]">{usuario.nombre}</td>
      <td className="px-4 py-3 text-gray-600">{usuario.email}</td>
      <td className="px-4 py-3 text-gray-600">{NOMBRES_ROL[usuario.rol]}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${usuario.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
          {usuario.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-2">
          <button onClick={() => setEditando(true)} className="text-xs font-bold text-gray-600 hover:text-[#66C2F8]">
            Editar nombre/correo
          </button>
          <EnlaceAccesoBoton usuarioId={usuario.id} />
          <EstadoUsuarioBoton usuarioId={usuario.id} activo={usuario.activo} esMismoUsuario={esMismoUsuario} />
        </div>
      </td>
    </tr>
  );
}

import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { getParametrosVigentes } from '@/lib/parametros';
import { prisma } from '@/lib/prisma';
import { actualizarParametros } from '@/app/actions/parametros';
import type { Parametros } from '@/lib/pricing';

// Etiquetas en español y agrupación para que Gerencia edite sin leer código.
const GRUPOS: { titulo: string; items: { clave: keyof Parametros; label: string; nota?: string }[] }[] = [
  {
    titulo: 'Lavado',
    items: [
      { clave: 'TARIFA_LISTA', label: 'Tarifa de lista (COP/m²)' },
      { clave: 'MINIMO_PROYECTO_LAVADO', label: 'Cargo mínimo por proyecto (COP)', nota: 'El precio del lavado nunca baja de aquí' },
      { clave: 'PROD_VIDRIO', label: 'Productividad vidrio (m²/día)' },
      { clave: 'PROD_MIXTA', label: 'Productividad mixta (m²/día)' },
      { clave: 'PROD_DIFICIL', label: 'Productividad difícil (m²/día)' },
    ],
  },
  {
    titulo: 'Costos de operación',
    items: [
      { clave: 'CUADRILLA_DIA', label: 'Cuadrilla por día (COP)' },
      { clave: 'CONSUMIBLES_DIA', label: 'Consumibles por día (COP)', nota: 'Incluye la gasolina — nunca se cobra aparte' },
      { clave: 'DEPRECIACION_DIA', label: 'Depreciación equipos por día (COP)' },
      { clave: 'PCT_ADMIN', label: 'Admin (fracción, ej. 0.10 = 10%)' },
      { clave: 'PCT_IMPREV', label: 'Imprevistos (fracción)' },
    ],
  },
  {
    titulo: 'Inspección',
    items: [
      { clave: 'DV_TIER_1', label: 'Diagnóstico Visual — techo pequeño (COP)' },
      { clave: 'DV_TIER_2', label: 'Diagnóstico Visual — techo mediano (COP)' },
      { clave: 'DV_TIER_3', label: 'Diagnóstico Visual — techo grande (COP)' },
      { clave: 'DV_PRECIO', label: 'Diagnóstico Visual — fuera de rango (COP)' },
      { clave: 'ROOF_TIER_1_MAX', label: 'Límite techo pequeño (m²)' },
      { clave: 'ROOF_TIER_2_MAX', label: 'Límite techo mediano (m²)' },
      { clave: 'ROOF_TIER_3_MAX', label: 'Límite techo grande (m²)' },
      { clave: 'ROOF_FEE_1_EUR', label: 'Fee Noruega techo pequeño (EUR)', nota: 'Lo que Noruega cobra a KTV — confidencial' },
      { clave: 'ROOF_FEE_2_EUR', label: 'Fee Noruega techo mediano (EUR)' },
      { clave: 'ROOF_FEE_3_EUR', label: 'Fee Noruega techo grande (EUR)' },
      { clave: 'INT_PISO_MERCADO', label: 'Piso de mercado Informe Internacional (COP)', nota: 'Estudio jul-2026: $9M+' },
      { clave: 'DRON_4T_EUR', label: 'Dron 4T precio base (EUR)' },
      { clave: 'FACTOR_IMPORT_TRANSPORTE', label: 'Import + transporte dron (fracción del valor)' },
      { clave: 'DRON_4T_VIDA_ANIOS', label: 'Vida útil dron (años)' },
      { clave: 'PROD_INSPECCION_M2_DIA', label: 'Productividad inspección (m² techo/día)', nota: '⚠️ Placeholder — calibrar con Órdenes de Vuelo' },
      { clave: 'COSTO_INFORME_ANALISIS', label: 'Costo de construir el informe (COP)', nota: '⚠️ Pendiente de definir — hoy 0' },
    ],
  },
  {
    titulo: 'Días de ejecución del lavado (⚠️ estimado provisional, sin proyectos ejecutados aún)',
    items: [
      { clave: 'PROD_FACHADA_M2_HORA', label: 'Velocidad fabricante — fachada (m²/hora)', nota: 'Ficha técnica, velocidad de laboratorio' },
      { clave: 'PROD_CRISTALES_M2_HORA', label: 'Velocidad fabricante — cristales (m²/hora)', nota: 'Ficha técnica, velocidad de laboratorio' },
      { clave: 'HORAS_JORNADA', label: 'Horas por jornada' },
      { clave: 'FACTOR_EFICIENCIA_OPERATIVA', label: 'Factor de eficiencia operativa (fracción, 0.45 = 45%)', nota: '⚠️ Calibrar con el primer proyecto real ejecutado' },
      { clave: 'FACTOR_DIFICULTAD_TIEMPO_MEDIO', label: 'Factor tiempo dificultad Media (fracción, 0.90 = 90% de productividad)' },
      { clave: 'FACTOR_DIFICULTAD_TIEMPO_ALTO', label: 'Factor tiempo dificultad Alta (fracción, 0.80 = 80% de productividad)' },
    ],
  },
  {
    titulo: 'KTV Care',
    items: [
      { clave: 'CARE_ESSENTIAL_DESC', label: 'Descuento Essential (fracción, 0.05 = $5.700/m²)' },
      { clave: 'CARE_COMPLETE_DESC', label: 'Descuento Complete (fracción, 0.10 = $5.400/m²)' },
    ],
  },
  {
    titulo: 'Financieros y control',
    items: [
      { clave: 'TRM', label: 'TRM (COP/USD)' },
      { clave: 'EUR_COP', label: 'Euro (COP/EUR)' },
      { clave: 'FEE_NORUEGA', label: 'Fee Noruega sobre facturación (fracción, 0.07 = 7%)', nota: 'Confidencial — Regla A. Art. 8 contrato de franquicia' },
      { clave: 'MARGEN_MINIMO', label: 'Margen mínimo sin aprobación (fracción, 0.35 = 35%)' },
      { clave: 'IVA', label: 'IVA (fracción)' },
    ],
  },
];

export default async function ParametrosPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const session = await verifySession();
  if (session.rol !== 'GERENCIA') redirect('/cotizador');

  const { ok } = await searchParams;
  const { parametros } = await getParametrosVigentes();
  const filas = await prisma.parametro.findMany({ orderBy: { actualizadoAt: 'desc' }, take: 1 });
  const ultimaEdicion = filas[0];

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-lg font-extrabold text-[#171E27]">Parámetros del motor de precios</h1>
      <p className="text-sm text-gray-500 mt-1">
        Solo Gerencia. Los cambios aplican únicamente a cotizaciones <b>futuras</b>: las ya
        creadas conservan sus números congelados (snapshot) y jamás cambian.
      </p>
      {ultimaEdicion?.actualizadoPor && (
        <p className="text-xs text-gray-400 mt-1">
          Última edición: {ultimaEdicion.actualizadoPor} · {ultimaEdicion.actualizadoAt.toLocaleString('es-CO')}
        </p>
      )}
      {ok && (
        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3">
          ✅ Parámetros guardados. Rigen desde la próxima cotización.
        </div>
      )}

      <form action={actualizarParametros} className="mt-6 space-y-6">
        {GRUPOS.map((g) => (
          <fieldset key={g.titulo} className="bg-white rounded-2xl border border-gray-200 p-6">
            <legend className="text-xs font-bold uppercase tracking-wide text-[#171E27] px-2 -mx-2 bg-white">
              <span className="border-l-4 border-[#66C2F8] pl-2">{g.titulo}</span>
            </legend>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mt-2">
              {g.items.map((item) => (
                <label key={item.clave} className="block">
                  <span className="text-xs font-semibold text-gray-600">{item.label}</span>
                  <input
                    name={item.clave}
                    defaultValue={parametros[item.clave]}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#66C2F8]"
                  />
                  {item.nota && <span className="text-[11px] text-gray-400">{item.nota}</span>}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button type="submit" className="bg-[#66C2F8] text-white text-sm font-bold rounded-full px-8 py-3">
          Guardar parámetros
        </button>
      </form>
    </div>
  );
}

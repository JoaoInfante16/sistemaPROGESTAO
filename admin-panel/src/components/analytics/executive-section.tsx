// Executive Section — cards de indicadores visuais + resumo complementar
// + fontes consolidadas. Espelha o widget ExecutiveIndicators do mobile,
// mas em tema light pra relatório compartilhado.
//
// Não renderiza se vier vazio (sem estatísticas no período).

interface Indicator {
  valor: number;
  unidade: string | null;
  tipo: 'percentual' | 'absoluto' | 'monetario';
  sentido: 'positivo' | 'negativo' | 'neutro';
  label: string;
  contexto: string;
  fonte: string;
}

interface ExecutiveData {
  indicadores: Indicator[];
  resumo_complementar: string | null;
  fontes: string[];
}

interface Props {
  data: ExecutiveData;
}

export function ExecutiveSection({ data }: Props) {
  const hasIndicators = data.indicadores && data.indicadores.length > 0;
  const hasResumo = data.resumo_complementar && data.resumo_complementar.trim().length > 0;

  if (!hasIndicators && !hasResumo) return null;

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-6 mb-6">
      <h2 className="text-xs font-bold tracking-[0.2em] text-teal-700 uppercase mb-4">
        Indicadores da Região
      </h2>

      {hasIndicators && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {data.indicadores.map((ind, i) => (
            <IndicatorCard key={i} indicator={ind} />
          ))}
        </div>
      )}

      {hasResumo && (
        <p className="text-sm text-slate-700 leading-relaxed mb-3">
          {data.resumo_complementar}
        </p>
      )}

      {data.fontes && data.fontes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs pt-3 border-t border-teal-100">
          <span className="font-semibold tracking-wider text-slate-500">FONTES:</span>
          {data.fontes.map((f, i) => (
            <span key={i} className="font-mono text-teal-700">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function IndicatorCard({ indicator }: { indicator: Indicator }) {
  const color = sentidoColor(indicator.sentido);
  const arrow = indicator.tipo === 'percentual'
    ? indicator.valor > 0 ? '↑' : indicator.valor < 0 ? '↓' : null
    : null;

  return (
    <div
      className="rounded-lg border bg-white p-3"
      style={{ borderColor: `${color}40` }}
    >
      <div className="flex items-end gap-1 mb-2">
        <span
          className="font-mono text-2xl font-bold leading-none"
          style={{ color }}
        >
          {formatValue(indicator)}
        </span>
        {arrow && (
          <span className="text-sm font-bold pb-0.5" style={{ color }}>
            {arrow}
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight mb-0.5">
        {indicator.label}
      </p>
      {indicator.contexto && (
        <p className="font-mono text-[10px] text-slate-500 truncate">
          {indicator.contexto}
        </p>
      )}
    </div>
  );
}

function sentidoColor(s: Indicator['sentido']): string {
  switch (s) {
    case 'positivo': return '#16a34a'; // green
    case 'negativo': return '#dc2626'; // red
    default: return '#1A8F9A'; // teal SIMEops
  }
}

function formatValue(ind: Indicator): string {
  switch (ind.tipo) {
    case 'percentual': {
      const abs = Math.abs(ind.valor);
      const sign = ind.valor > 0 ? '+' : ind.valor < 0 ? '-' : '';
      const str = abs === Math.round(abs)
        ? abs.toFixed(0)
        : abs.toFixed(1).replace('.', ',');
      return `${sign}${str}${ind.unidade ?? '%'}`;
    }
    case 'monetario': {
      const v = ind.valor;
      if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} Mi`;
      if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)} mil`;
      return `R$ ${v.toFixed(0)}`;
    }
    case 'absoluto':
    default: {
      const v = ind.valor;
      if (v >= 1000) {
        return v.toFixed(0).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
      }
      return v.toFixed(0);
    }
  }
}

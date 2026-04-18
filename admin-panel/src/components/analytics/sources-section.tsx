'use client';

interface SourceEntry {
  name: string;
  count: number;
  urls?: string[];
  type?: 'oficial' | 'midia';
}

interface SourcesSectionProps {
  sources: SourceEntry[];
  sourcesOficial?: SourceEntry[];
  sourcesMedia?: SourceEntry[];
}

// Estilo uniforme com o Flutter FontesAnalisadas: lista numerada [idx] hostname
// + count "Nx" à direita. Sem preview text, sem icons, sem URLs clicáveis —
// limpeza visual solicitada pelo João.
export function SourcesSection({ sources, sourcesOficial, sourcesMedia }: SourcesSectionProps) {
  const oficial = sourcesOficial || sources.filter(s => s.type === 'oficial');
  const midia = sourcesMedia || sources.filter(s => s.type === 'midia' || !s.type);

  if (oficial.length === 0 && midia.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        Nenhuma fonte registrada
      </div>
    );
  }

  return (
    <div>
      {/* Header com contador oficiais · mídias (sobrescreve o <h2> externo se pai usar) */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <span className="font-mono">
          {oficial.length} oficiais · {midia.length} mídias
        </span>
      </div>

      <div className="space-y-1.5">
        {oficial.map((s, i) => (
          <SourceRow key={`of-${i}`} index={i + 1} source={s} isOfficial />
        ))}
        {midia.map((s, i) => (
          <SourceRow
            key={`md-${i}`}
            index={oficial.length + i + 1}
            source={s}
            isOfficial={false}
          />
        ))}
      </div>
    </div>
  );
}

function SourceRow({ index, source, isOfficial }: { index: number; source: SourceEntry; isOfficial: boolean }) {
  const color = isOfficial ? 'text-teal-700' : 'text-slate-600';
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="text-xs text-muted-foreground/60 font-mono w-7">
        [{index}]
      </span>
      <span className={`flex-1 text-sm ${color} truncate`}>{source.name}</span>
      {source.count > 1 && (
        <span className="text-xs text-muted-foreground font-mono">
          {source.count}x
        </span>
      )}
    </div>
  );
}

/** Inline source note for individual charts */
export function SourceNote({ sources }: { sources: SourceEntry[] }) {
  if (!sources || sources.length === 0) return null;

  const oficial = sources.filter(s => s.type === 'oficial');
  const names = sources.slice(0, 3).map(s => s.name);
  const totalRefs = sources.reduce((sum, s) => sum + s.count, 0);
  const suffix = sources.length > 3 ? ` e +${sources.length - 3} fontes` : '';
  const oficialNote = oficial.length > 0 ? ` (incl. ${oficial.length} fonte${oficial.length > 1 ? 's' : ''} oficial${oficial.length > 1 ? 'is' : ''})` : '';

  return (
    <p className="text-xs text-muted-foreground italic mt-2">
      Fonte: {totalRefs} referencias de {names.join(', ')}{suffix}{oficialNote}
    </p>
  );
}

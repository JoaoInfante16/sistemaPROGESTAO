'use client';

import { ExternalLink, Shield, Newspaper } from 'lucide-react';

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

function SourceList({ sources, label, icon, borderColor }: {
  sources: SourceEntry[];
  label: string;
  icon: React.ReactNode;
  borderColor: string;
}) {
  if (sources.length === 0) return null;
  const total = sources.reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="font-medium text-sm">{label}</h4>
        <span className="text-xs text-muted-foreground">
          ({total} {total === 1 ? 'referencia' : 'referencias'})
        </span>
      </div>
      <div className="space-y-3">
        {sources.map((source, i) => (
          <div key={i} className={`rounded-lg border ${borderColor} p-3`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">{source.name}</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {source.count} {source.count === 1 ? 'referencia' : 'referencias'}
              </span>
            </div>
            {source.urls && source.urls.length > 0 && (
              <div className="space-y-1 mt-2">
                {source.urls.slice(0, 3).map((url, j) => (
                  <a
                    key={j}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate"
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{url}</span>
                  </a>
                ))}
                {source.urls.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{source.urls.length - 3} mais
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SourcesSection({ sources, sourcesOficial, sourcesMedia }: SourcesSectionProps) {
  // Se tiver fontes categorizadas, mostra separado
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
    <div className="space-y-6">
      <SourceList
        sources={oficial}
        label="Fontes Oficiais (SSP/Gov)"
        icon={<Shield className="h-4 w-4 text-green-600" />}
        borderColor="border-green-200"
      />
      <SourceList
        sources={midia}
        label="Fontes Jornalisticas"
        icon={<Newspaper className="h-4 w-4 text-blue-600" />}
        borderColor="border-blue-200"
      />
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

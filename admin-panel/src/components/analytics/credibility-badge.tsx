'use client';

import { Shield } from 'lucide-react';

interface CredibilityBadgeProps {
  officialCount: number;
  mediaCount: number;
  credibilityPercent: number;
}

export function CredibilityBadge({ officialCount, mediaCount, credibilityPercent }: CredibilityBadgeProps) {
  const total = officialCount + mediaCount;
  const level = credibilityPercent > 50 ? 'alta' : credibilityPercent > 20 ? 'moderada' : 'jornalistica';

  const config = {
    alta: { label: 'Alta confiabilidade', color: 'text-green-600', iconColor: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10' },
    moderada: { label: 'Confiabilidade moderada', color: 'text-yellow-600', iconColor: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-500/10' },
    jornalistica: { label: 'Baseado em fontes jornalisticas', color: 'text-muted-foreground', iconColor: 'text-gray-400', bg: 'bg-muted' },
  };

  const c = config[level];

  return (
    <div className={`flex items-center gap-4 rounded-xl p-4 ${c.bg}`}>
      <Shield className={`h-8 w-8 ${c.iconColor}`} />
      <div className="flex-1">
        <p className={`font-semibold ${c.color}`}>{c.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Baseado em {officialCount} fonte{officialCount !== 1 ? 's' : ''} oficial{officialCount !== 1 ? 'is' : ''} e {mediaCount} fonte{mediaCount !== 1 ? 's' : ''} jornalistica{mediaCount !== 1 ? 's' : ''}
        </p>
      </div>
      {total > 0 && (
        <div className="text-right">
          <p className="text-2xl font-bold">{credibilityPercent}%</p>
          <p className="text-[10px] text-muted-foreground">oficial</p>
        </div>
      )}
    </div>
  );
}

export function CredibilityChart({ officialCount, mediaCount }: { officialCount: number; mediaCount: number }) {
  const total = officialCount + mediaCount;
  if (total === 0) return null;
  const pct = Math.round((officialCount / total) * 100);

  return (
    <div className="rounded-xl border p-6">
      <h2 className="text-lg font-semibold mb-4">Credibilidade das Fontes</h2>
      <div className="h-4 rounded-full bg-muted overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Oficial: {officialCount} ({pct}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
          <span>Midia: {mediaCount} ({100 - pct}%)</span>
        </div>
      </div>
    </div>
  );
}

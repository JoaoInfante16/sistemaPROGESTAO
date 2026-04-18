'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

// Bar chart semanal pra relatório público — espelha o widget WeeklyTrendBars
// do Flutter. Barras teal (SIMEops) com altura proporcional ao total. Melhor
// que line chart pra dado esparso/discreto ("1 ocorrência por semana" vira
// linha chapada; em barra vira coluna clara).

interface TrendDataPoint {
  period: string;
  label: string;
  total: number;
  breakdown: Record<string, number>;
}

interface Props {
  data: TrendDataPoint[];
  sourceNote?: string;
}

export function CrimeTrendBars({ data, sourceNote }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Sem dados de tendência no período
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: '#1A8F9A', fillOpacity: 0.08 }}
            formatter={(value) => [`${value} ocorrência${value === 1 ? '' : 's'}`, 'Total']}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
          />
          <Bar dataKey="total" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.total > 0 ? '#1A8F9A' : '#e2e8f0'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {sourceNote && (
        <p className="text-xs text-muted-foreground mt-2 italic">{sourceNote}</p>
      )}
    </div>
  );
}

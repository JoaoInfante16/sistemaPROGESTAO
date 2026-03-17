'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const CRIME_COLORS: Record<string, string> = {
  Roubo: '#ef4444',
  Furto: '#f97316',
  Assalto: '#dc2626',
  Homicidio: '#7f1d1d',
  Latrocinio: '#991b1b',
  Trafico: '#7c3aed',
  Outro: '#6b7280',
};

function getColor(tipo: string): string {
  return CRIME_COLORS[tipo] || CRIME_COLORS.Outro;
}

interface CrimeBarChartProps {
  data: Array<{ tipo_crime: string; count: number; percentage: number }>;
  sourceNote?: string;
}

export function CrimeBarChart({ data, sourceNote }: CrimeBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <XAxis type="number" />
          <YAxis
            type="category"
            dataKey="tipo_crime"
            width={100}
            tick={{ fontSize: 13 }}
          />
          <Tooltip
            formatter={(value) => [`${value} ocorrencias`, 'Total']}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={getColor(entry.tipo_crime)} />
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

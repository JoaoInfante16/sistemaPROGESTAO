'use client';

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Cores/labels por categoria. Mapeamento tipo_crime → categoria vive no backend
// (TIPO_CRIME_GRUPO em types.ts — fonte única). Aqui só cuidamos de UI.
const CATEGORY_COLORS: Record<string, string> = {
  patrimonial: '#F97316',
  seguranca: '#EF4444',
  operacional: '#3B82F6',
  fraude: '#8B5CF6',
  institucional: '#64748B',
};

const CATEGORY_LABELS: Record<string, string> = {
  patrimonial: 'Patrimonial',
  seguranca: 'Segurança',
  operacional: 'Operacional',
  fraude: 'Fraude',
  institucional: 'Institucional',
};

interface CrimePieChartProps {
  byCategory: Array<{ category: string; count: number; percentage: number }>;
  sourceNote?: string;
}

export function CrimePieChart({ byCategory, sourceNote }: CrimePieChartProps) {
  if (!byCategory || byCategory.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  const chartData = byCategory.map(d => ({
    name: CATEGORY_LABELS[d.category] || d.category,
    value: d.count,
    color: CATEGORY_COLORS[d.category] || '#64748B',
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            // Percentual dentro do donut (label externo estourava em mobile).
            // Labels dos nomes ficam na Legend abaixo.
            outerRadius="75%"
            innerRadius="45%"
            dataKey="value"
            label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
            fontSize={11}
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${value} ocorrências`, 'Total']}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
          />
          <Legend
            verticalAlign="bottom"
            iconSize={10}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
      {sourceNote && (
        <p className="text-xs text-muted-foreground mt-2 italic">{sourceNote}</p>
      )}
    </div>
  );
}

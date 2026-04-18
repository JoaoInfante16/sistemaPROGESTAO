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
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={50}
            dataKey="value"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={true}
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${value} ocorrencias`, 'Total']}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      {sourceNote && (
        <p className="text-xs text-muted-foreground mt-2 italic">{sourceNote}</p>
      )}
    </div>
  );
}

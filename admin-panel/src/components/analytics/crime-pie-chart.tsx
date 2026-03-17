'use client';

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#7c3aed', '#ec4899', '#6b7280',
];

interface CrimePieChartProps {
  data: Array<{ tipo_crime: string; count: number; percentage: number }>;
  sourceNote?: string;
}

export function CrimePieChart({ data, sourceNote }: CrimePieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  const chartData = data.map(d => ({
    name: d.tipo_crime,
    value: d.count,
    percentage: d.percentage,
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
            dataKey="value"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={true}
          >
            {chartData.map((_entry, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
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

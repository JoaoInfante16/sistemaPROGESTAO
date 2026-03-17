'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface TrendDataPoint {
  period: string;
  label: string;
  total: number;
  breakdown: Record<string, number>;
}

interface CrimeTrendChartProps {
  data: TrendDataPoint[];
  sourceNote?: string;
}

export function CrimeTrendChart({ data, sourceNote }: CrimeTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Sem dados de tendencia
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ left: 0, right: 20, top: 10 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => [`${value} ocorrencias`, 'Total']}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {sourceNote && (
        <p className="text-xs text-muted-foreground mt-2 italic">{sourceNote}</p>
      )}
    </div>
  );
}

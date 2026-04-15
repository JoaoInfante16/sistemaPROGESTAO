'use client';

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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

const TIPO_TO_CATEGORY: Record<string, string> = {
  roubo_furto: 'patrimonial', vandalismo: 'patrimonial', invasao: 'patrimonial',
  homicidio: 'seguranca', latrocinio: 'seguranca', lesao_corporal: 'seguranca',
  trafico: 'operacional', operacao_policial: 'operacional', manifestacao: 'operacional', bloqueio_via: 'operacional',
  estelionato: 'fraude', receptacao: 'fraude',
  crime_ambiental: 'institucional', trabalho_irregular: 'institucional', estatistica: 'institucional', outros: 'institucional',
};

// Fallback colors for unknown categories
const FALLBACK_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#7c3aed', '#ec4899', '#6b7280'];

interface CrimePieChartProps {
  data: Array<{ tipo_crime: string; count: number; percentage: number }>;
  byCategory?: Array<{ category: string; count: number; percentage: number }>;
  sourceNote?: string;
}

export function CrimePieChart({ data, byCategory, sourceNote }: CrimePieChartProps) {
  if ((!data || data.length === 0) && (!byCategory || byCategory.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  // Prefer byCategory if available, otherwise aggregate from tipo_crime
  let chartData: Array<{ name: string; value: number; color: string }>;

  if (byCategory && byCategory.length > 0) {
    chartData = byCategory.map(d => ({
      name: CATEGORY_LABELS[d.category] || d.category,
      value: d.count,
      color: CATEGORY_COLORS[d.category] || '#64748B',
    }));
  } else {
    // Aggregate tipo_crime into categories
    const categoryMap = new Map<string, number>();
    for (const d of data) {
      const cat = TIPO_TO_CATEGORY[d.tipo_crime] || 'institucional';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + d.count);
    }
    chartData = Array.from(categoryMap.entries())
      .map(([cat, count]) => ({
        name: CATEGORY_LABELS[cat] || cat,
        value: count,
        color: CATEGORY_COLORS[cat] || '#64748B',
      }))
      .sort((a, b) => b.value - a.value);
  }

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
              <Cell key={index} fill={entry.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
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

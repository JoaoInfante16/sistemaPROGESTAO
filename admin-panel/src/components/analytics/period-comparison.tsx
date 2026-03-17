'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface ComparisonChange {
  tipo_crime: string;
  period1Count: number;
  period2Count: number;
  changePercent: string;
}

interface PeriodComparisonProps {
  period1: { label: string; total: number };
  period2: { label: string; total: number };
  overallDelta: string;
  changes: ComparisonChange[];
  sourceNote?: string;
}

export function PeriodComparison({
  period1,
  period2,
  overallDelta,
  changes,
  sourceNote,
}: PeriodComparisonProps) {
  const deltaNum = parseInt(overallDelta);
  const isIncrease = deltaNum > 0;
  const isDecrease = deltaNum < 0;

  return (
    <div>
      {/* Overall comparison cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Periodo anterior</p>
          <p className="text-2xl font-bold">{period1.total}</p>
          <p className="text-xs text-muted-foreground">{period1.label}</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Periodo atual</p>
          <p className="text-2xl font-bold">{period2.total}</p>
          <p className="text-xs text-muted-foreground">{period2.label}</p>
        </div>
        <div className={`rounded-lg border p-4 text-center ${
          isIncrease ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800' :
          isDecrease ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' :
          'bg-gray-50 dark:bg-gray-900'
        }`}>
          <p className="text-xs text-muted-foreground mb-1">Variacao</p>
          <div className="flex items-center justify-center gap-1">
            {isIncrease && <ArrowUp className="h-5 w-5 text-red-500" />}
            {isDecrease && <ArrowDown className="h-5 w-5 text-green-500" />}
            {!isIncrease && !isDecrease && <Minus className="h-5 w-5 text-gray-500" />}
            <span className={`text-2xl font-bold ${
              isIncrease ? 'text-red-600' : isDecrease ? 'text-green-600' : ''
            }`}>
              {overallDelta}
            </span>
          </div>
        </div>
      </div>

      {/* Per crime type changes */}
      {changes.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Tipo de Crime</th>
                <th className="text-center p-3 font-medium">Anterior</th>
                <th className="text-center p-3 font-medium">Atual</th>
                <th className="text-center p-3 font-medium">Variacao</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c, i) => {
                const num = parseInt(c.changePercent);
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-3 font-medium">{c.tipo_crime}</td>
                    <td className="text-center p-3">{c.period1Count}</td>
                    <td className="text-center p-3">{c.period2Count}</td>
                    <td className="text-center p-3">
                      <span className={`inline-flex items-center gap-1 font-medium ${
                        num > 0 ? 'text-red-600' : num < 0 ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {num > 0 && <ArrowUp className="h-3 w-3" />}
                        {num < 0 && <ArrowDown className="h-3 w-3" />}
                        {c.changePercent}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sourceNote && (
        <p className="text-xs text-muted-foreground mt-3 italic">{sourceNote}</p>
      )}
    </div>
  );
}

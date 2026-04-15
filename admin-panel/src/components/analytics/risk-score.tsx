'use client';

interface RiskScoreProps {
  score: number;
  level: 'baixo' | 'moderado' | 'alto';
}

const levelConfig = {
  baixo: { label: 'Risco Baixo', color: 'text-green-500', bg: 'bg-green-500/10', ring: 'ring-green-500/30' },
  moderado: { label: 'Risco Moderado', color: 'text-yellow-500', bg: 'bg-yellow-500/10', ring: 'ring-yellow-500/30' },
  alto: { label: 'Risco Alto', color: 'text-red-500', bg: 'bg-red-500/10', ring: 'ring-red-500/30' },
};

export function RiskScore({ score, level }: RiskScoreProps) {
  const config = levelConfig[level] || levelConfig.baixo;

  return (
    <div className="flex items-center gap-6 rounded-xl border p-6">
      <div className={`flex items-center justify-center w-20 h-20 rounded-full ${config.bg} ring-2 ${config.ring}`}>
        <span className={`text-3xl font-bold ${config.color}`}>
          {score.toFixed(1)}
        </span>
      </div>
      <div>
        <p className={`text-xl font-bold ${config.color}`}>{config.label}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Indice calculado com base na gravidade e frequencia das ocorrencias
        </p>
      </div>
    </div>
  );
}

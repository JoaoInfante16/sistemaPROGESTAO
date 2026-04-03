'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/lib/hooks/use-auth';
import { api, type DashboardStats, type RejectedUrlEntry } from '@/lib/api';
import { Newspaper, MapPin, DollarSign, TrendingUp, XCircle, RefreshCw, Activity, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  filter0_regex: { label: 'Regex', color: 'bg-gray-100 text-gray-700' },
  filter1_gpt: { label: 'GPT Snippet', color: 'bg-yellow-100 text-yellow-700' },
  filter2_gpt: { label: 'GPT Analise', color: 'bg-red-100 text-red-700' },
  filter2: { label: 'GPT Analise', color: 'bg-red-100 text-red-700' },
  filter2_location: { label: 'Local errado', color: 'bg-orange-100 text-orange-700' },
  filter2_date: { label: 'Data antiga', color: 'bg-blue-100 text-blue-700' },
  fetch: { label: 'Fetch falhou', color: 'bg-gray-100 text-gray-700' },
};

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rejectedUrls, setRejectedUrls] = useState<RejectedUrlEntry[]>([]);
  const [costEstimate, setCostEstimate] = useState<{
    avgCostPerScan: number;
    totalScansThisMonth: number;
    totalCostThisMonth: number;
    avgCostByProvider: { brightdata: number; brave: number; jina: number; openai: number };
    activeCities: number;
    estimatedScansPerDay: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const token = await getToken();
      const [statsData, rejectedData, ceData] = await Promise.all([
        api.getStats(token),
        api.getRejectedUrls(token).catch(() => [] as RejectedUrlEntry[]),
        api.getCostEstimate(token).catch(() => null),
      ]);
      setStats(statsData);
      setRejectedUrls(rejectedData);
      setCostEstimate(ceData);
    } catch {
      // stats unavailable
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleClearRejected() {
    if (!confirm('Limpar todas as URLs rejeitadas?')) return;
    try {
      const token = await getToken();
      await api.clearRejectedUrls(token);
      setRejectedUrls([]);
      toast.success('URLs rejeitadas limpas');
    } catch {
      toast.error('Erro ao limpar');
    }
  }

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = [
    {
      title: 'Noticias enviadas',
      value: stats?.newsThisMonth ?? '-',
      icon: Newspaper,
    },
    {
      title: 'Cidades ativas',
      value: stats?.activeCities ?? '-',
      icon: MapPin,
    },
    {
      title: 'Custo mensal (USD)',
      value: stats?.costThisMonth != null ? `$${stats.costThisMonth.toFixed(2)}` : '-',
      icon: DollarSign,
    },
    {
      title: 'Taxa de sucesso',
      value: stats?.pipelineSuccessRate != null ? `${stats.pipelineSuccessRate}%` : '-',
      icon: TrendingUp,
    },
    {
      title: 'Scans hoje',
      value: stats?.scansToday ?? '-',
      icon: Activity,
    },
  ];

  // Group rejected URLs by stage for summary
  const rejectedByStage = rejectedUrls.reduce<Record<string, number>>((acc, url) => {
    acc[url.stage] = (acc[url.stage] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {loading ? '...' : card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cost Breakdown */}
      {costEstimate && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Custo real por provider */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Custo real este mes (por provider)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Bright Data</p>
                  <p className="font-mono text-lg font-bold">${costEstimate.avgCostByProvider.brightdata.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Brave</p>
                  <p className="font-mono text-lg font-bold">${costEstimate.avgCostByProvider.brave.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Jina</p>
                  <p className="font-mono text-lg font-bold">${costEstimate.avgCostByProvider.jina.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">OpenAI</p>
                  <p className="font-mono text-lg font-bold">${costEstimate.avgCostByProvider.openai.toFixed(4)}</p>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Total real: <span className="font-mono font-bold">${costEstimate.totalCostThisMonth.toFixed(4)}</span> ({costEstimate.totalScansThisMonth} scans)
              </p>
            </CardContent>
          </Card>

          {/* Expectativa mensal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Expectativa mensal (config atual)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const cities = costEstimate.activeCities || 0;
                const scansPerDay = costEstimate.estimatedScansPerDay || 0;
                const avgCost = costEstimate.avgCostPerScan || 0.01;
                const expectedMonthly = scansPerDay * 30 * avgCost;
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cidades ativas</span>
                      <span className="font-mono font-bold">{cities}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Scans/dia estimados</span>
                      <span className="font-mono font-bold">{scansPerDay}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Custo medio/scan</span>
                      <span className="font-mono font-bold">${avgCost.toFixed(4)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-medium">Expectativa mensal</span>
                      <span className="font-mono text-lg font-bold">${expectedMonthly.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rejected URLs (last 24h) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                URLs Negadas (ultimas 24h)
              </CardTitle>
              <CardDescription>
                URLs encontradas pelo pipeline mas rejeitadas pelos filtros.
                {rejectedUrls.length > 0 && (
                  <span className="ml-2 font-mono text-xs">
                    Total: {rejectedUrls.length}
                    {Object.entries(rejectedByStage).map(([stage, count]) => {
                      const info = STAGE_LABELS[stage] || { label: stage, color: '' };
                      return ` | ${info.label}: ${count}`;
                    }).join('')}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRefreshing(true);
                  loadData();
                }}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              {rejectedUrls.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearRejected}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-4 text-center text-muted-foreground">Carregando...</p>
          ) : rejectedUrls.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">
              Nenhuma URL negada nas ultimas 24h. O pipeline ainda nao rodou ou todas as URLs passaram.
            </p>
          ) : (
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horario</TableHead>
                    <TableHead>Filtro</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rejectedUrls.map((item, idx) => {
                    const stageInfo = STAGE_LABELS[item.stage] || { label: item.stage, color: 'bg-gray-100' };
                    return (
                      <TableRow key={idx}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(item.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'America/Sao_Paulo',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${stageInfo.color}`} variant="outline">
                            {stageInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.monitored_locations?.name || '-'}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                            title={item.title || item.url}
                          >
                            {item.title || item.url}
                          </a>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {item.reason || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

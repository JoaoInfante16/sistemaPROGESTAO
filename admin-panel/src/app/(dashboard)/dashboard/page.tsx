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
import { Newspaper, MapPin, DollarSign, TrendingUp, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  filter0_regex: { label: 'Regex', color: 'bg-gray-100 text-gray-700' },
  filter1_gpt: { label: 'GPT Snippet', color: 'bg-yellow-100 text-yellow-700' },
  filter2_gpt: { label: 'GPT Analise', color: 'bg-red-100 text-red-700' },
};

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rejectedUrls, setRejectedUrls] = useState<RejectedUrlEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const token = await getToken();
      const [statsData, rejectedData] = await Promise.all([
        api.getStats(token),
        api.getRejectedUrls(token).catch(() => [] as RejectedUrlEntry[]),
      ]);
      setStats(statsData);
      setRejectedUrls(rejectedData);
    } catch {
      // stats unavailable
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = [
    {
      title: 'Noticias este mes',
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

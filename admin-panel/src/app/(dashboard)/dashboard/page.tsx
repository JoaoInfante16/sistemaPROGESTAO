'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/hooks/use-auth';
import { api, type DashboardStats } from '@/lib/api';
import { Newspaper, MapPin, DollarSign, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const token = await getToken();
        const data = await api.getStats(token);
        setStats(data);
      } catch {
        // stats unavailable
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [getToken]);

  const cards = [
    {
      title: 'Notícias este mês',
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
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
    </div>
  );
}

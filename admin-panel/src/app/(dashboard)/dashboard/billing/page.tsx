'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/lib/hooks/use-auth';
import { api, type BillingRecord } from '@/lib/api';
import { DollarSign, Receipt, Loader2, Server, Clock, Save } from 'lucide-react';
import { toast } from 'sonner';

const PROVIDER_LABELS: Record<string, string> = {
  brightdata: 'Bright Data',
  jina: 'Jina',
  openai: 'OpenAI',
  brave: 'Brave',
  google: 'Google',
  perplexity: 'Perplexity',
};

// Custos fixos mensais (USD)
const FIXED_COSTS = [
  { name: 'Servidores (Render)', cost: 14.00, note: 'Backend + Admin' },
  { name: 'Monitoramento de erros', cost: 29.00, note: 'Rastreamento em tempo real' },
  { name: 'Banco de dados', cost: 0.00, note: 'Supabase Free' },
  { name: 'Cache/Fila', cost: 0.00, note: 'Upstash Redis Free' },
];

function usd(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace('.', ',');
}

export default function BillingPage() {
  const { getToken } = useAuth();
  const [history, setHistory] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [billingDay, setBillingDay] = useState('1');
  const [savingDay, setSavingDay] = useState(false);

  async function loadBilling() {
    try {
      const token = await getToken();
      const [data, configData] = await Promise.all([
        api.getBillingHistory(token),
        api.getConfig(token).catch(() => ({})),
      ]);
      setHistory(data);
      const configs = Object.values(configData).flat();
      const dayConfig = configs.find((c: { key: string }) => c.key === 'billing_close_day');
      if (dayConfig) setBillingDay((dayConfig as { value: string }).value);
    } catch {
      toast.error('Erro ao carregar historico de billing');
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseMonth() {
    if (!confirm('Fechar o mes anterior? Isso salva o total e nao pode ser desfeito.')) return;
    setClosing(true);
    try {
      const token = await getToken();
      await api.closeBillingMonth(token);
      toast.success('Mes fechado com sucesso');
      await loadBilling();
    } catch {
      toast.error('Erro ao fechar mes');
    } finally {
      setClosing(false);
    }
  }

  async function handleSaveBillingDay() {
    const day = parseInt(billingDay, 10);
    if (isNaN(day) || day < 1 || day > 28) {
      toast.error('Dia deve ser entre 1 e 28');
      return;
    }
    setSavingDay(true);
    try {
      const token = await getToken();
      await api.updateConfig(token, 'billing_close_day', String(day));
      toast.success(`Fechamento alterado para dia ${day}`);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSavingDay(false);
    }
  }

  useEffect(() => {
    loadBilling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalAllTime = history.reduce((sum, r) => sum + Number(r.total_cost_usd), 0);
  const fixedTotal = FIXED_COSTS.reduce((sum, c) => sum + c.cost, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Billing</h1>
        <Button onClick={handleCloseMonth} disabled={closing} variant="outline">
          {closing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Receipt className="h-4 w-4 mr-2" />}
          Fechar mes anterior
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo API acumulado
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">
              {loading ? '...' : `$${usd(totalAllTime)}`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {history.length} mes(es) registrado(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custos fixos/mes
            </CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">
              ${usd(fixedTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Servidores + servicos
            </p>
          </CardContent>
        </Card>

        {history.length > 0 && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ultimo mes fechado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">
                  ${usd(Number(history[0].total_cost_usd))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatMonth(history[0].month)} &middot; {history[0].total_scans} scans
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total mensal medio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">
                  ${usd(totalAllTime / history.length + fixedTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  API + fixos
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Fixed Costs + Billing Config */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Fixed Costs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              Custos fixos mensais
            </CardTitle>
            <CardDescription>Servidores e servicos externos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {FIXED_COSTS.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div>
                    <span>{item.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({item.note})</span>
                  </div>
                  <span className={`font-mono font-medium ${item.cost > 0 ? '' : 'text-muted-foreground'}`}>
                    ${usd(item.cost)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Total fixo</span>
                <span className="font-mono">${usd(fixedTotal)}/mes</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Config */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Configuracao de fechamento
            </CardTitle>
            <CardDescription>Dia do mes para fechar o billing automaticamente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Dia do fechamento:</label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={billingDay}
                  onChange={(e) => setBillingDay(e.target.value)}
                  className="w-20"
                />
                <Button
                  size="sm"
                  onClick={handleSaveBillingDay}
                  disabled={savingDay}
                >
                  {savingDay ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O sistema fecha automaticamente o mes anterior no dia configurado as 00:05 UTC.
                Voce tambem pode fechar manualmente usando o botao no topo.
              </p>
              <p className="text-xs text-muted-foreground">
                Intervalo valido: 1 a 28 (evita problemas com meses curtos).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Historico mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Nenhum mes fechado ainda. O fechamento acontece automaticamente no dia {billingDay} de cada mes,
              ou voce pode fechar manualmente clicando no botao acima.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Custo API</TableHead>
                  <TableHead className="text-right">Custo fixo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Scans</TableHead>
                  <TableHead>Breakdown</TableHead>
                  <TableHead>Fechado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => {
                  const apiCost = Number(record.total_cost_usd);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {formatMonth(record.month)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${usd(apiCost)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ${usd(fixedTotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        ${usd(apiCost + fixedTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.total_scans}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          {Object.entries(record.breakdown || {}).map(([provider, cost]) => (
                            <span
                              key={provider}
                              className="text-xs bg-muted px-2 py-0.5 rounded"
                            >
                              {PROVIDER_LABELS[provider] || provider}: ${usd(Number(cost), 4)}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(record.closed_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const months = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${months[parseInt(m, 10) - 1]} ${year}`;
}

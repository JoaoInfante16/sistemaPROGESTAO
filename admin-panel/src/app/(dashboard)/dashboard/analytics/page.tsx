'use client';

import { useState } from 'react';
import { BarChart3, Link2, Copy, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';
import { api, type CrimeSummary, type CrimeTrend, type CrimeComparison } from '@/lib/api';
import { CrimeBarChart } from '@/components/analytics/crime-bar-chart';
import { CrimeTrendChart } from '@/components/analytics/crime-trend-chart';
import { CrimePieChart } from '@/components/analytics/crime-pie-chart';
import { PeriodComparison } from '@/components/analytics/period-comparison';
import { Button } from '@/components/ui/button';

const PERIOD_PRESETS = [
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
];

const ESTADOS_BR = [
  'Acre', 'Alagoas', 'Amapa', 'Amazonas', 'Bahia', 'Ceara',
  'Distrito Federal', 'Espirito Santo', 'Goias', 'Maranhao',
  'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Para',
  'Paraiba', 'Parana', 'Pernambuco', 'Piaui', 'Rio de Janeiro',
  'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondonia', 'Roraima',
  'Santa Catarina', 'Sao Paulo', 'Sergipe', 'Tocantins',
];

export default function AnalyticsPage() {
  const { getToken } = useAuth();

  // Form state
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [periodDays, setPeriodDays] = useState(60);

  // Data state
  const [summary, setSummary] = useState<CrimeSummary | null>(null);
  const [trend, setTrend] = useState<CrimeTrend | null>(null);
  const [comparison, setComparison] = useState<CrimeComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Report link
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  function getDateRange() {
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - periodDays);
    return {
      dateFrom: dateFrom.toISOString().split('T')[0],
      dateTo: dateTo.toISOString().split('T')[0],
    };
  }

  async function handleLoadDashboard() {
    if (!cidade.trim() || !estado) return;
    setLoading(true);
    setError(null);
    setReportUrl(null);

    try {
      const token = await getToken();
      const { dateFrom, dateTo } = getDateRange();

      const [summaryRes, trendRes] = await Promise.all([
        api.getCrimeSummary(token, { cidade, dateFrom, dateTo }),
        api.getCrimeTrend(token, { cidade, dateFrom, dateTo, groupBy: 'week' }),
      ]);

      setSummary(summaryRes);
      setTrend(trendRes);

      // Comparison: current period vs previous
      const prevTo = new Date(dateFrom);
      prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo);
      prevFrom.setDate(prevFrom.getDate() - periodDays);

      try {
        const compRes = await api.getCrimeComparison(token, {
          cidade,
          period1Start: prevFrom.toISOString().split('T')[0],
          period1End: prevTo.toISOString().split('T')[0],
          period2Start: dateFrom,
          period2End: dateTo,
        });
        setComparison(compRes);
      } catch {
        setComparison(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateLink() {
    if (!cidade.trim() || !estado) return;
    setGeneratingLink(true);

    try {
      const token = await getToken();
      const { dateFrom, dateTo } = getDateRange();

      const { reportId } = await api.generateReport(token, {
        cidade,
        estado,
        dateFrom,
        dateTo,
      });

      const url = `${window.location.origin}/report/${reportId}`;
      setReportUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar link');
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleCopyLink() {
    if (!reportUrl) return;
    await navigator.clipboard.writeText(reportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Analise de Risco
        </h1>
        <p className="text-muted-foreground">
          Gere dashboards de criminalidade e compartilhe via link
        </p>
      </div>

      {/* Filter form */}
      <div className="rounded-xl border p-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
            >
              <option value="">Selecione...</option>
              {ESTADOS_BR.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Cidade</label>
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex: Niteroi"
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Periodo</label>
            <div className="flex gap-2">
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => setPeriodDays(p.days)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    periodDays === p.days
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={handleLoadDashboard}
              disabled={!cidade.trim() || !estado || loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Carregando...
                </>
              ) : (
                'Carregar'
              )}
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 mt-3">{error}</p>
        )}
      </div>

      {/* Dashboard content */}
      {summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total de Ocorrencias" value={String(summary.totalCrimes)} />
            <StatCard label="Tipo Mais Comum" value={summary.byCrimeType[0]?.tipo_crime || 'N/A'} />
            <StatCard
              label="Variacao"
              value={comparison?.overallDelta || 'N/A'}
              highlight={comparison?.overallDelta?.startsWith('+') ? 'red' : 'green'}
            />
            <StatCard
              label="Confianca Media"
              value={summary.avgConfianca > 0 ? `${Math.round(summary.avgConfianca * 100)}%` : 'N/A'}
            />
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Por Tipo de Crime</h2>
              <CrimeBarChart data={summary.byCrimeType} />
            </div>
            <div className="rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Distribuicao</h2>
              <CrimePieChart data={summary.byCrimeType} />
            </div>
          </div>

          {trend && trend.dataPoints.length > 0 && (
            <div className="rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Tendencia Temporal</h2>
              <CrimeTrendChart data={trend.dataPoints} />
            </div>
          )}

          {comparison && (
            <div className="rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Comparacao entre Periodos</h2>
              <PeriodComparison
                period1={comparison.period1}
                period2={comparison.period2}
                overallDelta={comparison.overallDelta}
                changes={comparison.changes}
              />
            </div>
          )}

          {summary.topBairros.length > 0 && (
            <div className="rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Top Bairros</h2>
              <div className="space-y-2">
                {summary.topBairros.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{i + 1}. {b.bairro}</span>
                    <span className="text-muted-foreground">{b.count} ocorrencias</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate shareable link */}
          <div className="rounded-xl border p-6 bg-muted/30">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Compartilhar Relatorio
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Gere um link publico para compartilhar este dashboard. O link expira em 30 dias.
            </p>

            {!reportUrl ? (
              <Button onClick={handleGenerateLink} disabled={generatingLink}>
                {generatingLink ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Gerando...
                  </>
                ) : (
                  'Gerar Link Compartilhavel'
                )}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={reportUrl}
                  className="flex-1 rounded-md border px-3 py-2 text-sm bg-background"
                />
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'red' | 'green';
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${
        highlight === 'red' ? 'text-red-600' : highlight === 'green' ? 'text-green-600' : ''
      }`}>
        {value}
      </p>
    </div>
  );
}

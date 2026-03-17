'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, AlertTriangle, Clock, MapPin, Shield } from 'lucide-react';
import { api, type ReportData } from '@/lib/api';
import { CrimeBarChart } from '@/components/analytics/crime-bar-chart';
import { CrimeTrendChart } from '@/components/analytics/crime-trend-chart';
import { CrimePieChart } from '@/components/analytics/crime-pie-chart';
import { PeriodComparison } from '@/components/analytics/period-comparison';
import { SourcesSection, SourceNote } from '@/components/analytics/sources-section';
import { exportDashboardPDF } from '@/lib/pdf-export';

export default function PublicReportPage() {
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadReport() {
      try {
        const data = await api.getPublicReport(reportId);
        setReport(data);
      } catch {
        setError('Relatorio nao encontrado ou expirado');
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [reportId]);

  async function handleExportPDF() {
    if (!report) return;
    setExporting(true);
    try {
      const rd = report.report_data;
      await exportDashboardPDF('report-content', {
        cidade: rd.cidade,
        estado: rd.estado,
        dateRange: `${formatDate(rd.dateFrom)} a ${formatDate(rd.dateTo)}`,
        generatedAt: new Date(rd.generatedAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
        <h1 className="text-2xl font-bold">Relatorio Indisponivel</h1>
        <p className="text-muted-foreground text-center max-w-md">
          {error || 'Este relatorio nao foi encontrado. Ele pode ter expirado ou o link pode estar incorreto.'}
        </p>
      </div>
    );
  }

  const rd = report.report_data;
  const sources = rd.sources || [];
  const sourcesOficial = rd.sourcesOficial || sources.filter((s: { type?: string }) => s.type === 'oficial');
  const sourcesMedia = rd.sourcesMedia || sources.filter((s: { type?: string }) => s.type === 'midia' || !s.type);
  const sourceNoteText = sources.length > 0
    ? `Fonte: ${sources.reduce((s, src) => s + src.count, 0)} referencias de ${sources.map(s => s.name).slice(0, 3).join(', ')}${sources.length > 3 ? ` e +${sources.length - 3} fontes` : ''}`
    : undefined;

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-10">
      {/* Top bar - not captured in PDF */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <span className="text-lg font-bold text-blue-600">Netrios News</span>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Gerando PDF...' : 'Baixar PDF'}
        </button>
      </div>

      {/* Report content - captured for PDF */}
      <div id="report-content">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Analise de Risco Criminal</h1>
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {rd.cidade} - {rd.estado}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDate(rd.dateFrom)} a {formatDate(rd.dateTo)}
            </span>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            label="Total de Ocorrencias"
            value={String(rd.summary.totalCrimes)}
          />
          <SummaryCard
            label="Tipo Mais Comum"
            value={rd.summary.topCrimeType}
          />
          <SummaryCard
            label="Variacao no Periodo"
            value={rd.summary.comparisonDelta}
            highlight={rd.summary.comparisonDelta.startsWith('+') ? 'red' : 'green'}
          />
          <SummaryCard
            label="Confianca Media"
            value={rd.summary.avgConfianca > 0 ? `${Math.round(rd.summary.avgConfianca * 100)}%` : 'N/A'}
          />
        </div>

        {/* Charts grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Crime by type */}
          <div className="rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Ocorrencias por Tipo de Crime</h2>
            <CrimeBarChart data={rd.byCrimeType} sourceNote={sourceNoteText} />
          </div>

          {/* Crime distribution */}
          <div className="rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Distribuicao Criminal</h2>
            <CrimePieChart data={rd.byCrimeType} sourceNote={sourceNoteText} />
          </div>
        </div>

        {/* Trend chart - full width */}
        {rd.trend && rd.trend.length > 0 && (
          <div className="rounded-xl border p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Tendencia Temporal</h2>
            <CrimeTrendChart data={rd.trend} sourceNote={sourceNoteText} />
          </div>
        )}

        {/* Period comparison */}
        {rd.comparison && (
          <div className="rounded-xl border p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Comparacao entre Periodos</h2>
            <PeriodComparison
              period1={rd.comparison.period1}
              period2={rd.comparison.period2}
              overallDelta={rd.comparison.overallDelta}
              changes={rd.comparison.changes}
              sourceNote={sourceNoteText}
            />
          </div>
        )}

        {/* Top neighborhoods */}
        {rd.topBairros && rd.topBairros.length > 0 && (
          <div className="rounded-xl border p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Bairros com Maior Incidencia</h2>
            <div className="space-y-2">
              {rd.topBairros.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-6 text-muted-foreground">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{b.bairro}</span>
                      <span className="text-sm text-muted-foreground">{b.count} ocorrencias</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{
                          width: `${(b.count / rd.topBairros[0].count) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <SourceNote sources={sources} />
          </div>
        )}

        {/* Sources section */}
        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Fontes dos Dados</h2>
          <SourcesSection sources={sources} sourcesOficial={sourcesOficial} sourcesMedia={sourcesMedia} />
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
          <p>
            Relatorio gerado em{' '}
            {new Date(rd.generatedAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' '}por Netrios News - Monitoramento Criminal Inteligente
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
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
      <p
        className={`text-2xl font-bold ${
          highlight === 'red'
            ? 'text-red-600'
            : highlight === 'green'
            ? 'text-green-600'
            : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

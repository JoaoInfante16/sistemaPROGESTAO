'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, AlertTriangle, Clock, MapPin, Shield } from 'lucide-react';
import { api, type ReportData } from '@/lib/api';
import { CrimePieChart } from '@/components/analytics/crime-pie-chart';
import { CrimeTrendChart } from '@/components/analytics/crime-trend-chart';
import { ReportHeatMap } from '@/components/analytics/report-heat-map';
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
        setError('Relatório não encontrado ou expirado');
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
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
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
        <h1 className="text-2xl font-bold">Relatório Indisponível</h1>
        <p className="text-muted-foreground text-center max-w-md">
          {error || 'Este relatório não foi encontrado. Ele pode ter expirado ou o link pode estar incorreto.'}
        </p>
      </div>
    );
  }

  const rd = report.report_data;
  const sources = rd.sources || [];
  const sourcesOficial = rd.sourcesOficial || sources.filter((s: { type?: string }) => s.type === 'oficial');
  const sourcesMedia = rd.sourcesMedia || sources.filter((s: { type?: string }) => s.type === 'midia' || !s.type);
  const sourceNoteText = sources.length > 0
    ? `Fonte: ${sources.reduce((s, src) => s + src.count, 0)} referências de ${sources.map(s => s.name).slice(0, 3).join(', ')}${sources.length > 3 ? ` e +${sources.length - 3} fontes` : ''}`
    : undefined;

  const byCategory = rd.byCategory || [];
  const heatmapData = rd.heatmapData || [];

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-10">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <span className="text-lg font-bold text-blue-600">SIMEops</span>
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

      {/* Report content */}
      <div id="report-content">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Análise de Risco Criminal</h1>
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

        {/* 1. Resumo - 3 cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <SummaryCard label="Total de Ocorrências" value={String(rd.summary.totalCrimes)} />
          <SummaryCard label="Bairros Afetados" value={String(rd.topBairros?.length || 0)} />
          <SummaryCard label="Tipos de Crime" value={String(rd.byCrimeType?.length || 0)} />
        </div>

        {/* 2. Donut por CATEGORIA */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Distribuição por Categoria</h2>
            <CrimePieChart data={rd.byCrimeType} byCategory={byCategory} sourceNote={sourceNoteText} />
          </div>
        </div>

        {/* 5. Mapa de Calor */}
        {heatmapData.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Mapa de Ocorrências</h2>
            <ReportHeatMap data={heatmapData} cidade={rd.cidade} />
          </div>
        )}

        {/* 6. Bairros ranking */}
        {rd.topBairros && rd.topBairros.length > 0 && (
          <div className="rounded-xl border p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Bairros com Maior Incidência</h2>
            <div className="space-y-2">
              {rd.topBairros.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-6 text-muted-foreground">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{b.bairro}</span>
                      <span className="text-sm text-muted-foreground">{b.count} ocorrências</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${(b.count / rd.topBairros[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <SourceNote sources={sources} />
          </div>
        )}

        {/* 7. Tendencia temporal */}
        {rd.trend && rd.trend.length > 0 && (
          <div className="rounded-xl border p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Tendência Temporal</h2>
            <CrimeTrendChart data={rd.trend} sourceNote={sourceNoteText} />
          </div>
        )}

        {/* 8. Fontes */}
        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Fontes dos Dados</h2>
          <SourcesSection sources={sources} sourcesOficial={sourcesOficial} sourcesMedia={sourcesMedia} />
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
          <p>
            Relatório gerado em{' '}
            {new Date(rd.generatedAt).toLocaleDateString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
            {' '}por SIMEops - Sistema de Monitoramento de Ocorrências Policiais
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

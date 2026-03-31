'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  api,
  type SystemConfig,
} from '@/lib/api';
import {
  Loader2, Save, Calculator, Search, Clock,
  Lock, LockOpen, Info, SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// Ingestion source definitions
// ============================================

// ============================================
// Threshold definitions with tooltips
// ============================================

interface ThresholdConfig {
  key: string;
  label: string;
  description: string;
  tooltip: string;
  min: number;
  max: number;
  step: number;
}

// ============================================
// Scan frequency options (special — updates all cities)
// ============================================

const SCAN_FREQUENCY_OPTIONS = [
  { value: '15', label: 'A cada 15 minutos' },
  { value: '30', label: 'A cada 30 minutos' },
  { value: '60', label: 'A cada 1 hora' },
  { value: '120', label: 'A cada 2 horas' },
  { value: '240', label: 'A cada 4 horas' },
  { value: '360', label: 'A cada 6 horas' },
  { value: '720', label: 'A cada 12 horas' },
  { value: '1440', label: 'A cada 24 horas' },
];

// Grouped thresholds
const AUTO_SCAN_THRESHOLDS: ThresholdConfig[] = [
  {
    key: 'search_max_results',
    label: 'URLs por busca',
    description: 'Quantidade de URLs que o Brave retorna por query.',
    tooltip: 'Mais URLs = mais cobertura mas mais custo de processamento (Jina+GPT). Recomendado: 10-20.',
    min: 1,
    max: 100,
    step: 5,
  },
];

const MANUAL_SEARCH_THRESHOLDS: ThresholdConfig[] = [
  {
    key: 'manual_search_max_results_30d',
    label: 'URLs — periodo 30 dias',
    description: 'Quantidade de URLs por query na busca manual com periodo de 30 dias.',
    tooltip: 'Mais resultados = mais cobertura mas mais custo. Recomendado: 30-50.',
    min: 1,
    max: 100,
    step: 5,
  },
  {
    key: 'manual_search_max_results_60d',
    label: 'URLs — periodo 60 dias',
    description: 'Quantidade de URLs por query na busca manual com periodo de 60 dias.',
    tooltip: 'Periodos maiores tem mais noticias. Recomendado: 50-80.',
    min: 1,
    max: 100,
    step: 5,
  },
  {
    key: 'manual_search_max_results_90d',
    label: 'URLs — periodo 90 dias',
    description: 'Quantidade de URLs por query na busca manual com periodo de 90 dias.',
    tooltip: 'Periodos maiores tem mais noticias. Recomendado: 50-80.',
    min: 1,
    max: 100,
    step: 5,
  },
];

const AI_FILTER_THRESHOLDS: ThresholdConfig[] = [
  {
    key: 'filter2_confidence_min',
    label: 'Confianca minima',
    description: 'Nivel de certeza do AI para aceitar uma noticia como crime real.',
    tooltip: 'Aumentar se aparecem noticias falsas/irrelevantes. Diminuir se noticias reais estao sumindo. Recomendado: 0.6-0.8.',
    min: 0.1,
    max: 1.0,
    step: 0.05,
  },
  {
    key: 'dedup_similarity_threshold',
    label: 'Similaridade de deduplicacao',
    description: 'Quao parecidas duas noticias precisam ser para serem consideradas duplicatas.',
    tooltip: 'Aumentar se aparecem noticias duplicadas. Diminuir se noticias diferentes estao sendo removidas. Recomendado: 0.80-0.90.',
    min: 0.5,
    max: 1.0,
    step: 0.05,
  },
];

export default function SettingsPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);

  // Configs (grouped by category)
  const [configs, setConfigs] = useState<Record<string, SystemConfig[]>>({});
  const [editingConfig, setEditingConfig] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState<Set<string>>(new Set());

  // Cost Calculator
  const [avgCostPerScan, setAvgCostPerScan] = useState(0.01);
  const [activeCitiesBackend, setActiveCitiesBackend] = useState(0);
  const [calcCidades, setCalcCidades] = useState('3');
  const [calcFrequencia, setCalcFrequencia] = useState('60');
  const [calcBuscasDia, setCalcBuscasDia] = useState('0');

  // Scan frequency
  const [scanFrequency, setScanFrequency] = useState('60');
  const [savingFrequency, setSavingFrequency] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const token = await getToken();
      const [cfg, ce, freq] = await Promise.all([
        api.getConfig(token),
        api.getCostEstimate(token),
        api.getScanFrequency(token).catch(() => ({ scan_frequency_minutes: 60 })),
      ]);
      setConfigs(cfg);
      setScanFrequency(String(freq.scan_frequency_minutes));
      if (ce.avgCostPerScan > 0) setAvgCostPerScan(ce.avgCostPerScan);
      if (typeof ce.activeCities === 'number') {
        setActiveCitiesBackend(ce.activeCities);
        setCalcCidades(String(ce.activeCities));
      }
    } catch {
      toast.error('Erro ao carregar configuracoes');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ============================================
  // Helpers: get config value from loaded data
  // ============================================

  const getConfigValue = useCallback(
    (key: string): string => {
      if (editingConfig[key] !== undefined) return editingConfig[key];
      for (const items of Object.values(configs)) {
        const found = items.find((c) => c.key === key);
        if (found) return found.value;
      }
      return '';
    },
    [configs, editingConfig]
  );

  const isConfigEnabled = useCallback(
    (key: string): boolean => getConfigValue(key) === 'true',
    [getConfigValue]
  );

  // ============================================
  // Config handlers
  // ============================================

  const handleConfigChange = (key: string, value: string) => {
    setEditingConfig((prev) => ({ ...prev, [key]: value }));
  };

  const toggleConfig = async (key: string, currentValue: boolean) => {
    const newValue = currentValue ? 'false' : 'true';
    setSavingConfig((prev) => new Set(prev).add(key));
    try {
      const token = await getToken();
      await api.updateConfig(token, key, newValue);
      await loadAll();
      toast.success(`${key} ${newValue === 'true' ? 'ativado' : 'desativado'}`);
    } catch {
      toast.error('Erro ao atualizar configuracao');
    } finally {
      setSavingConfig((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const saveNumericConfig = async (key: string, value: string) => {
    setSavingConfig((prev) => new Set(prev).add(key));
    try {
      const token = await getToken();
      await api.updateConfig(token, key, value);
      setEditingConfig((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await loadAll();
      toast.success('Configuracao atualizada');
    } catch {
      toast.error('Erro ao atualizar configuracao');
    } finally {
      setSavingConfig((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // ============================================
  // Cost calculator (reactive)
  // ============================================

  const costEstimate = useMemo(() => {
    const cidades = parseInt(calcCidades) || 0;
    const freq = parseInt(calcFrequencia) || 60;
    const buscas = parseInt(calcBuscasDia) || 0;
    const urlsPerScan = parseInt(getConfigValue('search_max_results')) || 15;
    const scansPorDia = cidades * (1440 / freq);

    // Custos reais por scan (auto-scan)
    const braveCostPerScan = 0.005;           // 1 query Brave
    const jinaCostPerScan = urlsPerScan * 0.002;    // Jina fetch per URL
    const openaiCostPerScan = 0.0002 + urlsPerScan * (0.0005 + 0.00002); // Filter1 batch + Filter2 + Embedding
    const totalCostPerScan = braveCostPerScan + jinaCostPerScan + openaiCostPerScan;

    const braveMonthly = braveCostPerScan * scansPorDia * 30;
    const jinaMonthly = jinaCostPerScan * scansPorDia * 30;
    const openaiMonthly = openaiCostPerScan * scansPorDia * 30;
    const autoScanMonthly = totalCostPerScan * scansPorDia * 30;

    // Busca manual (usa URLs do periodo 30d como referencia)
    const manualUrls = parseInt(getConfigValue('manual_search_max_results_30d')) || 50;
    const manualCostPerSearch = 0.005 + 0.0002 + manualUrls * (0.002 + 0.0005 + 0.00002);
    const manualMonthly = buscas * 30 * manualCostPerSearch;

    const grandTotal = autoScanMonthly + manualMonthly;

    return {
      scansPorDia,
      totalCostPerScan,
      braveMonthly,
      jinaMonthly,
      openaiMonthly,
      autoScanMonthly,
      manualCostPerSearch,
      manualMonthly,
      grandTotal,
    };
  }, [calcCidades, calcFrequencia, calcBuscasDia, getConfigValue]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Configuracoes</h1>

        {/* ============================================ */}
        {/* Auth Toggle - destaque */}
        {/* ============================================ */}
        <Card className={isConfigEnabled('auth_required') ? 'border-green-200' : 'border-yellow-200'}>
          <CardContent className="flex items-center justify-between pt-6">
            <div className="flex items-center gap-3">
              <div className={`rounded-md p-2 ${isConfigEnabled('auth_required') ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {isConfigEnabled('auth_required') ? <Lock className="h-5 w-5" /> : <LockOpen className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-medium">
                  Autenticacao no App: {isConfigEnabled('auth_required') ? 'Obrigatoria' : 'Desligada'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isConfigEnabled('auth_required')
                    ? 'Usuarios precisam fazer login para usar o app mobile.'
                    : 'App mobile funciona sem login. Qualquer pessoa pode ver as noticias.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {savingConfig.has('auth_required') && <Loader2 className="h-4 w-4 animate-spin" />}
              <Switch
                checked={isConfigEnabled('auth_required')}
                onCheckedChange={() => toggleConfig('auth_required', isConfigEnabled('auth_required'))}
                disabled={savingConfig.has('auth_required')}
              />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="config">
          <TabsList>
            <TabsTrigger value="config">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Configuracoes
            </TabsTrigger>
            <TabsTrigger value="costs">
              <Calculator className="mr-2 h-4 w-4" />
              Configuracao de Custos
            </TabsTrigger>
          </TabsList>

          {/* ============================================ */}
          {/* Config Tab: Ingestion Sources + Thresholds */}
          {/* ============================================ */}
          <TabsContent value="config" className="space-y-6">

            {/* ============================== */}
            {/* GRUPO 1: Auto-Scan */}
            {/* ============================== */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Monitoramento Automatico (Auto-Scan)
                </CardTitle>
                <CardDescription>
                  O sistema busca noticias automaticamente para cada cidade ativa no intervalo configurado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Frequencia */}
                <div className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Label className="font-medium">Frequencia de scan</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[300px]">
                            <p className="text-sm">
                              Frequencias menores encontram noticias mais rapido, mas gastam mais.
                              Aplica para todas as cidades monitoradas.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-sm text-muted-foreground">Intervalo entre buscas automaticas por cidade.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {savingFrequency && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Select
                        value={scanFrequency}
                        onValueChange={async (value) => {
                          setSavingFrequency(true);
                          try {
                            const token = await getToken();
                            const result = await api.updateScanFrequency(token, parseInt(value));
                            setScanFrequency(value);
                            toast.success(`Frequencia: ${SCAN_FREQUENCY_OPTIONS.find(o => o.value === value)?.label}. ${result.updated} cidades atualizadas.`);
                          } catch {
                            toast.error('Erro ao atualizar frequencia');
                          } finally {
                            setSavingFrequency(false);
                          }
                        }}
                        disabled={savingFrequency}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SCAN_FREQUENCY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* URLs por busca */}
                {AUTO_SCAN_THRESHOLDS.map((threshold) => {
                  const currentVal = editingConfig[threshold.key] ?? getConfigValue(threshold.key);
                  const hasChange = editingConfig[threshold.key] !== undefined;
                  const isSaving = savingConfig.has(threshold.key);
                  return (
                    <div key={threshold.key} className="rounded-lg border p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Label className="font-medium">{threshold.label}</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[280px]">
                            <p className="text-sm">{threshold.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{threshold.description}</p>
                      <div className="flex items-center gap-3">
                        <Input type="number" className="w-24" min={threshold.min} max={threshold.max} step={threshold.step} value={currentVal} onChange={(e) => handleConfigChange(threshold.key, e.target.value)} />
                        <span className="text-xs text-muted-foreground">({threshold.min} - {threshold.max})</span>
                        {hasChange && (
                          <Button size="sm" onClick={() => saveNumericConfig(threshold.key, editingConfig[threshold.key])} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Salvar</>}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Estimativa de custo por cidade */}
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">Estimativa de custo por cidade</p>
                  {(() => {
                    const freq = parseInt(scanFrequency) || 60;
                    const urls = parseInt(editingConfig['search_max_results'] ?? getConfigValue('search_max_results')) || 15;
                    const scansPerDay = 1440 / freq;
                    // Custo real por scan: Brave query + Filter1 batch + Jina fetch + Filter2 + Embedding
                    const costPerScan = 0.005 + 0.0002 + (urls * 0.002) + (urls * 0.0005) + (urls * 0.00002);
                    const costPerMonth = scansPerDay * 30 * costPerScan;
                    return (
                      <>
                        <div className="space-y-1 text-xs text-muted-foreground mb-2">
                          <div className="flex justify-between"><span>Brave (1 query)</span><span className="font-mono">$0.0050</span></div>
                          <div className="flex justify-between"><span>Jina ({urls} URLs × $0.002)</span><span className="font-mono">${(urls * 0.002).toFixed(4)}</span></div>
                          <div className="flex justify-between"><span>OpenAI Filter + Embedding ({urls} URLs)</span><span className="font-mono">${(0.0002 + urls * 0.0005 + urls * 0.00002).toFixed(4)}</span></div>
                          <div className="flex justify-between border-t pt-1"><span className="font-medium text-foreground">Custo por scan</span><span className="font-mono font-medium text-foreground">${costPerScan.toFixed(4)}</span></div>
                        </div>
                        <div className="flex items-center justify-between text-sm border-t pt-2">
                          <span className="text-muted-foreground">
                            {scansPerDay.toFixed(0)} scans/dia × 30 dias
                          </span>
                          <span className="font-mono font-bold text-lg">
                            ~${costPerMonth.toFixed(2)}/cidade/mes
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* ============================== */}
            {/* GRUPO 2: Busca Manual */}
            {/* ============================== */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Busca Manual
                </CardTitle>
                <CardDescription>
                  Quantidade de URLs buscadas quando um usuario faz uma busca manual no app. Periodos maiores retornam mais resultados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {MANUAL_SEARCH_THRESHOLDS.map((threshold) => {
                  const currentVal = editingConfig[threshold.key] ?? getConfigValue(threshold.key);
                  const hasChange = editingConfig[threshold.key] !== undefined;
                  const isSaving = savingConfig.has(threshold.key);
                  const urlCount = parseInt(currentVal) || 0;
                  // Brave query + Filter1 batch + Jina + Filter2 + Embedding
                  const estimatedCost = 0.005 + 0.0002 + urlCount * (0.002 + 0.0005 + 0.00002);
                  return (
                    <div key={threshold.key} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Label className="font-medium">{threshold.label}</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[280px]">
                              <p className="text-sm">{threshold.tooltip}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">~${estimatedCost.toFixed(3)}/busca</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Input type="number" className="w-24" min={threshold.min} max={threshold.max} step={threshold.step} value={currentVal} onChange={(e) => handleConfigChange(threshold.key, e.target.value)} />
                        <span className="text-xs text-muted-foreground">URLs ({threshold.min} - {threshold.max})</span>
                        {hasChange && (
                          <Button size="sm" onClick={() => saveNumericConfig(threshold.key, editingConfig[threshold.key])} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Salvar</>}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* ============================== */}
            {/* GRUPO 3: Filtros AI */}
            {/* ============================== */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5" />
                  Filtros de Inteligencia Artificial
                </CardTitle>
                <CardDescription>
                  Ajuste a sensibilidade dos filtros que decidem se uma noticia e relevante e se ja foi processada antes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {AI_FILTER_THRESHOLDS.map((threshold) => {
                  const currentVal = editingConfig[threshold.key] ?? getConfigValue(threshold.key);
                  const hasChange = editingConfig[threshold.key] !== undefined;
                  const isSaving = savingConfig.has(threshold.key);
                  return (
                    <div key={threshold.key} className="rounded-lg border p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Label className="font-medium">{threshold.label}</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[280px]">
                            <p className="text-sm">{threshold.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{threshold.description}</p>
                      <div className="flex items-center gap-3">
                        <Input type="number" className="w-24" min={threshold.min} max={threshold.max} step={threshold.step} value={currentVal} onChange={(e) => handleConfigChange(threshold.key, e.target.value)} />
                        <span className="text-xs text-muted-foreground">({threshold.min} - {threshold.max})</span>
                        {hasChange && (
                          <Button size="sm" onClick={() => saveNumericConfig(threshold.key, editingConfig[threshold.key])} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Salvar</>}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================ */}
          {/* Costs Tab: Calculator */}
          {/* ============================================ */}
          <TabsContent value="costs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Calculadora de Custos
                </CardTitle>
                <CardDescription>
                  Estimativa de custo mensal baseada nas fontes ativas e configuracoes atuais.
                  {avgCostPerScan > 0 && (
                    <span className="ml-1 font-mono text-xs">
                      (custo medio real: ${avgCostPerScan.toFixed(4)}/scan)
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Cidades ativas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={calcCidades}
                      onChange={(e) => setCalcCidades(e.target.value)}
                    />
                    {activeCitiesBackend > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Atualmente: {activeCitiesBackend} cidade{activeCitiesBackend !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Frequencia de scan</Label>
                    <Select value={calcFrequencia} onValueChange={setCalcFrequencia}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">5x por hora (12 min)</SelectItem>
                        <SelectItem value="15">4x por hora (15 min)</SelectItem>
                        <SelectItem value="20">3x por hora (20 min)</SelectItem>
                        <SelectItem value="30">2x por hora (30 min)</SelectItem>
                        <SelectItem value="60">A cada 1 hora</SelectItem>
                        <SelectItem value="120">A cada 2 horas</SelectItem>
                        <SelectItem value="240">A cada 4 horas</SelectItem>
                        <SelectItem value="360">A cada 6 horas</SelectItem>
                        <SelectItem value="720">A cada 12 horas</SelectItem>
                        <SelectItem value="1440">A cada 24 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Buscas manuais/dia</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={calcBuscasDia}
                      onChange={(e) => setCalcBuscasDia(e.target.value)}
                    />
                  </div>
                </div>

                {/* Cost breakdown table */}
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead className="text-right">Custo/scan</TableHead>
                        <TableHead className="text-right">Custo/mes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Brave News (busca)</TableCell>
                        <TableCell className="text-right font-mono">$0.0050</TableCell>
                        <TableCell className="text-right font-mono">${costEstimate.braveMonthly.toFixed(2)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Jina (fetch conteudo)</TableCell>
                        <TableCell className="text-right font-mono">$0.0020/URL</TableCell>
                        <TableCell className="text-right font-mono">${costEstimate.jinaMonthly.toFixed(2)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>OpenAI (filtros + embedding)</TableCell>
                        <TableCell className="text-right font-mono">$0.0005/URL</TableCell>
                        <TableCell className="text-right font-mono">${costEstimate.openaiMonthly.toFixed(2)}</TableCell>
                      </TableRow>
                      {costEstimate.manualMonthly > 0 && (
                        <TableRow>
                          <TableCell>Buscas manuais</TableCell>
                          <TableCell className="text-right font-mono">${costEstimate.manualCostPerSearch.toFixed(4)}/busca</TableCell>
                          <TableCell className="text-right font-mono">${costEstimate.manualMonthly.toFixed(2)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Total */}
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold">
                        Total estimado: ${costEstimate.grandTotal.toFixed(2)} / mes
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {costEstimate.scansPorDia.toFixed(0)} scans/dia × ${costEstimate.totalCostPerScan.toFixed(4)}/scan
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  * Valores estimados. Custo real varia conforme volume de noticias encontradas por scan.
                  Custo de processamento (AI) inclui filtros GPT, embeddings e deduplicacao.
                </p>

              </CardContent>
            </Card>
          </TabsContent>


        </Tabs>
      </div>
    </TooltipProvider>
  );
}

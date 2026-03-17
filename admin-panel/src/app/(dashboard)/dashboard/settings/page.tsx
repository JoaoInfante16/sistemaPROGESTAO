'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useAuth } from '@/lib/hooks/use-auth';
import {
  api,
  type RateLimit,
  type BudgetSummary,
  type DailyBudget,
  type SystemConfig,
  type OperationLog,
} from '@/lib/api';
import { Loader2, Save, AlertTriangle, Calculator, Search, Rss, Newspaper, Shield, Lock, LockOpen, Bug, Bell, Trash2, Database } from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// Ingestion source definitions
// ============================================

interface IngestionSource {
  configKey: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  costPerScan: number; // estimated USD
  extraConfigs?: {
    key: string;
    label: string;
    type: 'number';
    min: number;
    max: number;
  }[];
}

const INGESTION_SOURCES: IngestionSource[] = [
  {
    configKey: 'multi_query_enabled',
    label: 'Multi-Query (variacoes)',
    icon: <Search className="h-5 w-5" />,
    description:
      'Gera multiplas variacoes da busca para cobrir mais tipos de crime. Multiplica queries do Google Custom Search.',
    costPerScan: 0.005,
    extraConfigs: [
      {
        key: 'search_queries_per_scan',
        label: 'Queries por scan',
        type: 'number',
        min: 1,
        max: 5,
      },
    ],
  },
  {
    configKey: 'google_news_rss_enabled',
    label: 'Google News RSS',
    icon: <Rss className="h-5 w-5" />,
    description:
      'Coleta noticias via feed RSS do Google News. Gratuito — sem custo de API.',
    costPerScan: 0,
  },
  {
    configKey: 'section_crawling_enabled',
    label: 'Crawling de Secoes',
    icon: <Newspaper className="h-5 w-5" />,
    description:
      'Acessa a secao "policia" de jornais encontrados (G1, UOL, R7, etc.) e extrai artigos adicionais. Custo: Jina por secao.',
    costPerScan: 0.01,
    extraConfigs: [
      {
        key: 'section_crawling_max_domains',
        label: 'Max dominios por scan',
        type: 'number',
        min: 1,
        max: 10,
      },
    ],
  },
  {
    configKey: 'ssp_scraping_enabled',
    label: 'SSP Estaduais',
    icon: <Shield className="h-5 w-5" />,
    description:
      'Coleta noticias das Secretarias de Seguranca Publica. Disponivel: SP, RJ, MG, BA, RS. Custo: Jina por pagina.',
    costPerScan: 0.004,
  },
];

export default function SettingsPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);

  // Rate Limits
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [editingRL, setEditingRL] = useState<Record<string, Partial<RateLimit>>>({});

  // Budget
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [dailyBudget, setDailyBudget] = useState<DailyBudget[]>([]);

  // Configs (grouped by category)
  const [configs, setConfigs] = useState<Record<string, SystemConfig[]>>({});
  const [editingConfig, setEditingConfig] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState<Set<string>>(new Set());

  // Cost Calculator
  const [avgCostPerScan, setAvgCostPerScan] = useState(0.01);
  const [costByProvider, setCostByProvider] = useState({ google: 0, jina: 0, openai: 0 });
  const [activeCitiesBackend, setActiveCitiesBackend] = useState(0);
  const [calcCidades, setCalcCidades] = useState('3');
  const [calcFrequencia, setCalcFrequencia] = useState('60');
  const [calcBuscasDia, setCalcBuscasDia] = useState('0');

  // Logs
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Dev tools state
  const [seeding, setSeeding] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const isDev = (process.env.NEXT_PUBLIC_API_URL || '').includes('localhost');

  const loadAll = useCallback(async () => {
    try {
      const token = await getToken();
      const [rl, bs, bd, cfg, ce, lg] = await Promise.all([
        api.getRateLimits(token),
        api.getBudgetSummary(token),
        api.getBudgetDaily(token),
        api.getConfig(token),
        api.getCostEstimate(token),
        api.getLogs(token),
      ]);
      setRateLimits(rl);
      setBudget(bs);
      setDailyBudget(bd);
      setConfigs(cfg);
      setLogs(lg);
      if (ce.avgCostPerScan > 0) setAvgCostPerScan(ce.avgCostPerScan);
      if (ce.avgCostByProvider) setCostByProvider(ce.avgCostByProvider);
      // Sempre atualizar activeCities, mesmo se 0 (fix: evita mostrar valor hardcoded incorreto)
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
      // Check if there's a pending edit
      if (editingConfig[key] !== undefined) return editingConfig[key];
      // Find in loaded configs
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
  // Rate Limit handlers
  // ============================================

  const handleRLChange = (id: string, field: keyof RateLimit, value: string) => {
    setEditingRL((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value === '' ? null : parseInt(value),
      },
    }));
  };

  const saveRateLimit = async (id: string) => {
    const updates = editingRL[id];
    if (!updates) return;
    try {
      const token = await getToken();
      await api.updateRateLimit(token, id, updates as {
        max_concurrent?: number;
        min_time_ms?: number;
        daily_quota?: number | null;
        monthly_quota?: number | null;
      });
      setEditingRL((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadAll();
      toast.success('Rate limit atualizado');
    } catch {
      toast.error('Erro ao atualizar rate limit');
    }
  };

  // ============================================
  // Config handlers
  // ============================================

  const handleConfigChange = (key: string, value: string) => {
    setEditingConfig((prev) => ({ ...prev, [key]: value }));
  };

  const saveConfig = async (key: string) => {
    const value = editingConfig[key];
    if (value === undefined) return;
    setSavingConfig((prev) => new Set(prev).add(key));
    try {
      const token = await getToken();
      const result = await api.updateConfig(token, key, value);
      setEditingConfig((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await loadAll();
      if (result.restartRequired) {
        toast.warning(result.message);
      } else {
        toast.success(result.message);
      }
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

  // Toggle a boolean config
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

  // Save a numeric config inline
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
    const scansPorDia = cidades * (1440 / freq);

    const queriesPerScan = parseInt(getConfigValue('search_queries_per_scan') || '2');

    // Per-source cost breakdown
    const sources = INGESTION_SOURCES.map((src) => {
      const enabled = isConfigEnabled(src.configKey);
      let costPerScan = src.costPerScan;

      // Multi-query multiplies google search cost by queries count
      if (src.configKey === 'multi_query_enabled') {
        costPerScan = 0.005 * (enabled ? queriesPerScan : 1);
      }

      const monthlyCost = enabled ? costPerScan * scansPorDia * 30 : 0;

      return {
        label: src.label,
        enabled,
        costPerScan: enabled ? costPerScan : 0,
        monthlyCost,
      };
    });

    // Google Search base cost (always on)
    const googleBaseCost = 0.005 * scansPorDia * 30;

    // Processing cost (AI filters + embeddings) — scales with total URLs found
    const enabledSources = sources.filter((s) => s.enabled).length;
    const processingMultiplier = 1 + enabledSources * 0.3; // more sources = more URLs to process
    const processingCostPerScan = 0.02 * processingMultiplier;
    const processingMonthly = processingCostPerScan * scansPorDia * 30;

    // Manual search cost
    const manualMonthly = buscas * 30 * avgCostPerScan;

    const sourcesTotal = sources.reduce((sum, s) => sum + s.monthlyCost, 0);
    const grandTotal = googleBaseCost + sourcesTotal + processingMonthly + manualMonthly;

    return {
      scansPorDia,
      sources,
      googleBaseCost,
      processingCostPerScan,
      processingMonthly,
      manualMonthly,
      grandTotal,
    };
  }, [calcCidades, calcFrequencia, calcBuscasDia, avgCostPerScan, getConfigValue, isConfigEnabled]);

  // ============================================
  // Non-ingestion configs (filter out ingestion category for System tab)
  // ============================================

  const nonIngestionConfigs = useMemo(() => {
    const result: Record<string, SystemConfig[]> = {};
    for (const [category, items] of Object.entries(configs)) {
      if (category === 'ingestion') continue;
      result[category] = items;
    }
    return result;
  }, [configs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
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

      <Tabs defaultValue="ingestion">
        <TabsList>
          <TabsTrigger value="ingestion">Ingestao</TabsTrigger>
          <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="budget">Orcamento</TabsTrigger>
          <TabsTrigger value="configs">Sistema</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          {isDev && <TabsTrigger value="dev-tools">Dev Tools</TabsTrigger>}
        </TabsList>

        {/* ============================================ */}
        {/* Ingestion Tab */}
        {/* ============================================ */}
        <TabsContent value="ingestion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fontes de Ingestao</CardTitle>
              <CardDescription>
                Controle quais fontes de noticias estao ativas. Cada fonte pode ser ativada ou desativada
                sem necessidade de deploy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Google Search (always on — not toggleable) */}
              <div className="flex items-start justify-between rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-blue-100 p-2 text-blue-700">
                    <Search className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Google Custom Search</p>
                    <p className="text-sm text-muted-foreground">
                      Buscas diretas no Google. Sempre ativo. Custo: ~$0.005/query.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="mt-1">Sempre ativo</Badge>
              </div>

              {/* Toggleable sources */}
              {INGESTION_SOURCES.map((src) => {
                const enabled = isConfigEnabled(src.configKey);
                const isSaving = savingConfig.has(src.configKey);
                return (
                  <div
                    key={src.configKey}
                    className={`rounded-lg border p-4 transition-opacity ${
                      !enabled ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 rounded-md p-2 ${
                            enabled
                              ? 'bg-green-100 text-green-700'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {src.icon}
                        </div>
                        <div>
                          <p className="font-medium">{src.label}</p>
                          <p className="text-sm text-muted-foreground">{src.description}</p>
                          {src.costPerScan > 0 ? (
                            <p className="mt-1 text-xs font-mono text-muted-foreground">
                              Custo: ~${src.costPerScan.toFixed(3)}/scan
                            </p>
                          ) : (
                            <p className="mt-1 text-xs font-mono text-green-600">
                              Gratuito
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        <Switch
                          checked={enabled}
                          onCheckedChange={() => toggleConfig(src.configKey, enabled)}
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    {/* Extra numeric configs (e.g., queries per scan, max domains) */}
                    {enabled && src.extraConfigs && (
                      <div className="mt-4 ml-12 space-y-3">
                        {src.extraConfigs.map((extra) => {
                          const currentVal = editingConfig[extra.key] ?? getConfigValue(extra.key);
                          const hasChange = editingConfig[extra.key] !== undefined;
                          const isSavingExtra = savingConfig.has(extra.key);
                          return (
                            <div key={extra.key} className="flex items-center gap-3">
                              <Label className="text-sm min-w-[140px]">{extra.label}</Label>
                              <Input
                                type="number"
                                className="w-20"
                                min={extra.min}
                                max={extra.max}
                                value={currentVal}
                                onChange={(e) => handleConfigChange(extra.key, e.target.value)}
                              />
                              <span className="text-xs text-muted-foreground">
                                ({extra.min}-{extra.max})
                              </span>
                              {hasChange && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => saveNumericConfig(extra.key, editingConfig[extra.key])}
                                  disabled={isSavingExtra}
                                >
                                  {isSavingExtra ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Save className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* Cost Calculator */}
          {/* ============================================ */}
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
                      <TableHead>Fonte</TableHead>
                      <TableHead className="text-right">Custo/scan</TableHead>
                      <TableHead className="text-right">Custo/mes</TableHead>
                      <TableHead className="text-center w-[60px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Google Search base */}
                    <TableRow>
                      <TableCell>Google Search</TableCell>
                      <TableCell className="text-right font-mono">$0.0050</TableCell>
                      <TableCell className="text-right font-mono">
                        ${costEstimate.googleBaseCost.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">ON</Badge>
                      </TableCell>
                    </TableRow>

                    {/* Toggleable sources */}
                    {costEstimate.sources.map((src) => (
                      <TableRow key={src.label} className={!src.enabled ? 'opacity-50' : ''}>
                        <TableCell>{src.label}</TableCell>
                        <TableCell className="text-right font-mono">
                          ${src.costPerScan.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${src.monthlyCost.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={src.enabled ? 'outline' : 'secondary'}
                            className="text-xs"
                          >
                            {src.enabled ? 'ON' : 'OFF'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Processing */}
                    <TableRow>
                      <TableCell>Processamento (AI)</TableCell>
                      <TableCell className="text-right font-mono">
                        ${costEstimate.processingCostPerScan.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${costEstimate.processingMonthly.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">ON</Badge>
                      </TableCell>
                    </TableRow>

                    {/* Manual searches */}
                    {costEstimate.manualMonthly > 0 && (
                      <TableRow>
                        <TableCell>Buscas manuais</TableCell>
                        <TableCell className="text-right font-mono">
                          ${avgCostPerScan.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${costEstimate.manualMonthly.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">ON</Badge>
                        </TableCell>
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
                      {costEstimate.scansPorDia.toFixed(0)} scans/dia
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                * Valores estimados. Custo real varia conforme volume de noticias encontradas por scan.
                Custo de processamento (AI) inclui filtros GPT, embeddings e deduplicacao.
              </p>

              {/* Real cost by provider (last month) */}
              {(costByProvider.google > 0 || costByProvider.jina > 0 || costByProvider.openai > 0) && (
                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-sm font-medium">Custo real este mes (por provider)</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Google</p>
                      <p className="font-mono text-sm font-bold">${costByProvider.google.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Jina</p>
                      <p className="font-mono text-sm font-bold">${costByProvider.jina.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">OpenAI</p>
                      <p className="font-mono text-sm font-bold">${costByProvider.openai.toFixed(4)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================ */}
        {/* Rate Limits Tab */}
        {/* ============================================ */}
        <TabsContent value="rate-limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Limites de API</CardTitle>
              <CardDescription>
                Controle a velocidade e volume de chamadas para cada provider externo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rateLimits.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">
                  Nenhum rate limit configurado.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>
                        Max Concurrent
                        <p className="text-xs font-normal text-muted-foreground mt-0.5">
                          Requests simultaneos. Mais alto = mais rapido, risco de ban.
                        </p>
                      </TableHead>
                      <TableHead>
                        Min Time (ms)
                        <p className="text-xs font-normal text-muted-foreground mt-0.5">
                          Intervalo entre requests. Mais alto = seguro, mais lento.
                        </p>
                      </TableHead>
                      <TableHead>
                        Quota Diaria
                        <p className="text-xs font-normal text-muted-foreground mt-0.5">
                          Limite/dia. Vazio = sem limite. Google: 100/dia gratis.
                        </p>
                      </TableHead>
                      <TableHead>
                        Quota Mensal
                        <p className="text-xs font-normal text-muted-foreground mt-0.5">
                          Limite/mes. Vazio = sem limite. Controla custo maximo.
                        </p>
                      </TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateLimits.map((rl) => {
                      const edits = editingRL[rl.id];
                      const hasChanges = !!edits;
                      return (
                        <TableRow key={rl.id}>
                          <TableCell>
                            <Badge variant="outline">{rl.provider}</Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24"
                              defaultValue={rl.max_concurrent}
                              onChange={(e) => handleRLChange(rl.id, 'max_concurrent', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24"
                              defaultValue={rl.min_time_ms}
                              onChange={(e) => handleRLChange(rl.id, 'min_time_ms', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24"
                              defaultValue={rl.daily_quota ?? ''}
                              placeholder="-"
                              onChange={(e) => handleRLChange(rl.id, 'daily_quota', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24"
                              defaultValue={rl.monthly_quota ?? ''}
                              placeholder="-"
                              onChange={(e) => handleRLChange(rl.id, 'monthly_quota', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            {hasChanges && (
                              <Button size="sm" onClick={() => saveRateLimit(rl.id)}>
                                <Save className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================ */}
        {/* Budget Tab */}
        {/* ============================================ */}
        <TabsContent value="budget" className="space-y-4">
          {budget && (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Gasto Total (mes)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">${budget.total.toFixed(4)}</p>
                    <div className="mt-2 h-2 rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${
                          budget.budgetUsedPercent > 90
                            ? 'bg-red-500'
                            : budget.budgetUsedPercent > 70
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(budget.budgetUsedPercent, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {budget.budgetUsedPercent}% do orcamento (${budget.budget})
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Scans Automaticos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">${budget.autoScans.toFixed(4)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Buscas Manuais
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">${budget.manualSearches.toFixed(4)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* By Provider */}
              <Card>
                <CardHeader>
                  <CardTitle>Custo por Provider</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(budget.byProvider).length === 0 ? (
                    <p className="text-muted-foreground">Nenhum custo registrado este mes.</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(budget.byProvider).map(([provider, cost]) => (
                        <div key={provider} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{provider}</Badge>
                          </div>
                          <span className="font-mono">${cost.toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Daily Costs */}
              {dailyBudget.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Custos Diarios</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Custo (USD)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyBudget.map((day) => (
                          <TableRow key={day.date}>
                            <TableCell>
                              {new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${day.cost_usd.toFixed(6)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {budget.budgetUsedPercent > 90 && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="flex items-center gap-3 pt-6">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <p className="text-sm text-red-700">
                      Atencao: {budget.budgetUsedPercent}% do orcamento mensal foi consumido.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ============================================ */}
        {/* System Config Tab (non-ingestion configs) */}
        {/* ============================================ */}
        <TabsContent value="configs" className="space-y-4">
          {Object.entries(nonIngestionConfigs).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma configuracao do sistema encontrada.
              </CardContent>
            </Card>
          ) : (
            Object.entries(nonIngestionConfigs).map(([category, items]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize">{category.replace(/_/g, ' ')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map((cfg) => {
                    const isEditing = editingConfig[cfg.key] !== undefined;
                    const isSaving = savingConfig.has(cfg.key);
                    return (
                      <div key={cfg.key} className="flex items-start gap-4">
                        <div className="flex-1">
                          <Label className="text-sm font-medium">{cfg.key}</Label>
                          {cfg.description && (
                            <p className="text-xs text-muted-foreground">{cfg.description}</p>
                          )}
                          <Input
                            className="mt-1"
                            defaultValue={cfg.value}
                            onChange={(e) => handleConfigChange(cfg.key, e.target.value)}
                          />
                        </div>
                        {isEditing && (
                          <Button
                            size="sm"
                            className="mt-6"
                            onClick={() => saveConfig(cfg.key)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ============================================ */}
        {/* Logs Tab */}
        {/* ============================================ */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Operacao</CardTitle>
              <CardDescription>
                Historico de scans do pipeline. Mostra stage, localizacao, noticias encontradas, custo e duracao.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">
                  Nenhum log de operacao encontrado.
                </p>
              ) : (
                <div className="max-h-[600px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Localizacao</TableHead>
                        <TableHead className="text-right">URLs</TableHead>
                        <TableHead className="text-right">Noticias</TableHead>
                        <TableHead className="text-right">Custo (USD)</TableHead>
                        <TableHead className="text-right">Duracao</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {log.stage}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.monitored_locations?.name || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {log.urls_processed}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {log.news_found}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ${log.cost_usd.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right text-sm whitespace-nowrap">
                            {log.duration_ms >= 1000
                              ? `${(log.duration_ms / 1000).toFixed(1)}s`
                              : `${log.duration_ms}ms`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setLogsLoading(true);
                    try {
                      const token = await getToken();
                      const freshLogs = await api.getLogs(token);
                      setLogs(freshLogs);
                      toast.success('Logs atualizados');
                    } catch {
                      toast.error('Erro ao carregar logs');
                    } finally {
                      setLogsLoading(false);
                    }
                  }}
                  disabled={logsLoading}
                >
                  {logsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================ */}
        {/* Dev Tools Tab (so aparece em localhost) */}
        {/* ============================================ */}
        {isDev && (
          <TabsContent value="dev-tools" className="space-y-4">
            <Card className="border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  Ferramentas de Desenvolvimento
                </CardTitle>
                <CardDescription>
                  Funcoes temporarias para testes. Serao removidas antes do deploy em producao.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Seed News */}
                <div className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-md bg-blue-100 p-2 text-blue-700">
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Inserir Noticias Mock</p>
                        <p className="text-sm text-muted-foreground">
                          Insere 15 noticias ficticias de crimes em Sao Paulo com bairros, fontes e datas variadas.
                          Todas comecam com [MOCK] para facil identificacao e remocao.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={async () => {
                        setSeeding(true);
                        try {
                          const token = await getToken();
                          const result = await api.seedNews(token);
                          toast.success(`${result.inserted} noticias mock inseridas!`);
                        } catch (err) {
                          toast.error((err as Error).message);
                        } finally {
                          setSeeding(false);
                        }
                      }}
                      disabled={seeding}
                    >
                      {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                      Seed News
                    </Button>
                  </div>
                </div>

                {/* Trigger Notification */}
                <div className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-md bg-orange-100 p-2 text-orange-700">
                        <Bell className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Enviar Notificacao Push</p>
                        <p className="text-sm text-muted-foreground">
                          Envia uma notificacao push REAL para todos os dispositivos registrados,
                          usando a noticia mais recente do banco. Certifique-se de ter noticias inseridas.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        setNotifying(true);
                        try {
                          const token = await getToken();
                          const result = await api.triggerNotification(token);
                          if (!result.success && result.reason) {
                            toast.error(`Push falhou: ${result.reason}`);
                          } else if (result.success) {
                            toast.success(`Push enviado! ${result.successCount}/${result.devices} dispositivo(s): "${result.notification.title}"`);
                          } else {
                            toast.warning('Push nao enviado. Verifique os logs do servidor.');
                          }
                        } catch (err) {
                          toast.error((err as Error).message);
                        } finally {
                          setNotifying(false);
                        }
                      }}
                      disabled={notifying}
                    >
                      {notifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                      Enviar Push
                    </Button>
                  </div>
                </div>

                {/* Clear Mock */}
                <div className="rounded-lg border border-red-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-md bg-red-100 p-2 text-red-700">
                        <Trash2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Remover Dados Mock</p>
                        <p className="text-sm text-muted-foreground">
                          Remove todas as noticias que comecam com [MOCK] do banco de dados.
                          Noticias reais nao sao afetadas.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        if (!confirm('Remover TODAS as noticias mock do banco?')) return;
                        setClearing(true);
                        try {
                          const token = await getToken();
                          const result = await api.clearMock(token);
                          toast.success(`${result.deleted} noticias mock removidas`);
                        } catch (err) {
                          toast.error((err as Error).message);
                        } finally {
                          setClearing(false);
                        }
                      }}
                      disabled={clearing}
                    >
                      {clearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Limpar Mock
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
}

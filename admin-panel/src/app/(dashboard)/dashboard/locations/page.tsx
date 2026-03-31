'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/hooks/use-auth';
import { api, type StateWithCities } from '@/lib/api';
import {
  ChevronDown,
  ChevronRight,
  Play,
  Loader2,
  MapPin,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { IBGEImportDialog } from './ibge-import-dialog';

export default function LocationsPage() {
  const { getToken } = useAuth();
  const [states, setStates] = useState<StateWithCities[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState<Set<string>>(new Set());


  const loadLocations = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await api.getLocations(token);
      setStates(data);
    } catch {
      toast.error('Erro ao carregar monitoramentos');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const toggleExpand = (stateId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(stateId)) next.delete(stateId);
      else next.add(stateId);
      return next;
    });
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const token = await getToken();
      await api.updateLocation(token, id, { active: !currentActive });
      await loadLocations();
      toast.success(`Monitoramento ${!currentActive ? 'ativado' : 'desativado'}`);
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const triggerScan = async (cityId: string, cityName: string) => {
    setScanning((prev) => new Set(prev).add(cityId));
    try {
      const token = await getToken();
      await api.triggerScan(token, cityId);
      toast.success(`Scan iniciado para ${cityName}`);
    } catch {
      toast.error('Erro ao iniciar scan');
    } finally {
      setScanning((prev) => {
        const next = new Set(prev);
        next.delete(cityId);
        return next;
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deletar "${name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const token = await getToken();
      await api.deleteLocation(token, id);
      await loadLocations();
      toast.success(`"${name}" removido`);
    } catch {
      toast.error('Erro ao deletar');
    }
  };

  const formatLastCheck = (lastCheck: string | null) => {
    if (!lastCheck) return 'Nunca';
    const diff = Date.now() - new Date(lastCheck).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor(diff / (1000 * 60)) % 60;
    if (hours > 24) return `${Math.floor(hours / 24)}d atras`;
    if (hours > 0) return `${hours}h ${mins}m atras`;
    return `${mins}m atras`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Monitoramentos</h1>
        <IBGEImportDialog existingLocations={states} onImportComplete={loadLocations} />
      </div>

      {states.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MapPin className="mx-auto mb-4 h-12 w-12 opacity-30" />
            <p>Nenhum monitoramento configurado.</p>
            <p className="text-sm">Comece adicionando um estado e suas cidades.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {states.map((state) => {
            const activeCities = state.cities.filter((c) => c.active).length;
            const isExpanded = expanded.has(state.id);

            return (
              <Card key={state.id} className={activeCities > 0 ? 'border-green-500/50' : ''}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1"
                      onClick={() => toggleExpand(state.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <CardTitle className="text-base">{state.name}</CardTitle>
                      <Badge className={activeCities > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} variant="outline">
                        {activeCities}/{state.cities.length} ativas
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(state.id, state.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-2 pt-0">
                    {state.cities.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Nenhuma cidade neste estado. Use &quot;Importar IBGE&quot; para adicionar.
                      </p>
                    ) : (
                      state.cities.map((city) => (
                        <div
                          key={city.id}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div className="flex items-center gap-4">
                            <Switch
                              checked={city.active}
                              onCheckedChange={() => toggleActive(city.id, city.active)}
                            />
                            <div>
                              <p className="font-medium">{city.name}</p>
                              <div className="flex gap-2 text-xs text-muted-foreground">
                                <span>
                                  {city.mode === 'keywords'
                                    ? `Keywords: ${city.keywords?.join(', ') || '-'}`
                                    : 'Qualquer ocorrencia'}
                                </span>
                                <span>|</span>
                                <span>{city.scan_frequency_minutes < 60 ? `Cada ${city.scan_frequency_minutes}min` : `Cada ${city.scan_frequency_minutes / 60}h`}</span>
                                <span>|</span>
                                <span>Ultimo: {formatLastCheck(city.last_check)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => triggerScan(city.id, city.name)}
                              disabled={scanning.has(city.id) || !city.active}
                            >
                              {scanning.has(city.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                              <span className="ml-1">Scan</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(city.id, city.name)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

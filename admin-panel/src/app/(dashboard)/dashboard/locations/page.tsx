'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/hooks/use-auth';
import { api, type StateWithCities } from '@/lib/api';
import {
  ChevronDown,
  ChevronRight,
  Plus,
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

  // Add State Dialog
  const [addStateOpen, setAddStateOpen] = useState(false);
  const [newStateName, setNewStateName] = useState('');

  // Add City Dialog
  const [addCityOpen, setAddCityOpen] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [newCityStateId, setNewCityStateId] = useState('');
  const [newCityMode, setNewCityMode] = useState<'any' | 'keywords'>('any');
  const [newCityKeywords, setNewCityKeywords] = useState('');
  const [newCityFrequency, setNewCityFrequency] = useState('60');

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

  const handleAddState = async () => {
    if (!newStateName.trim()) return;
    try {
      const token = await getToken();
      await api.createLocation(token, { type: 'state', name: newStateName.trim() });
      setNewStateName('');
      setAddStateOpen(false);
      await loadLocations();
      toast.success('Estado adicionado');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleAddCity = async () => {
    if (!newCityName.trim() || !newCityStateId) return;
    try {
      const token = await getToken();
      await api.createLocation(token, {
        type: 'city',
        name: newCityName.trim(),
        parent_id: newCityStateId,
        mode: newCityMode,
        keywords: newCityMode === 'keywords' ? newCityKeywords.split(',').map((k) => k.trim()).filter(Boolean) : null,
        scan_frequency_minutes: parseInt(newCityFrequency) || 60,
      });
      setNewCityName('');
      setNewCityKeywords('');
      setAddCityOpen(false);
      await loadLocations();
      toast.success('Cidade adicionada');
    } catch (err) {
      toast.error((err as Error).message);
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
        <div className="flex gap-2">
          {/* Import IBGE */}
          <IBGEImportDialog existingLocations={states} onImportComplete={loadLocations} />

          {/* Add State */}
          <Dialog open={addStateOpen} onOpenChange={setAddStateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Estado
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Estado</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Nome do Estado</Label>
                  <Input
                    placeholder="Ex: Parana"
                    value={newStateName}
                    onChange={(e) => setNewStateName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddState()}
                  />
                </div>
                <Button onClick={handleAddState} className="w-full">Adicionar</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add City */}
          <Dialog open={addCityOpen} onOpenChange={setAddCityOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Cidade
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Cidade</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Estado</Label>
                  <Select value={newCityStateId} onValueChange={setNewCityStateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome da Cidade</Label>
                  <Input
                    placeholder="Ex: Curitiba"
                    value={newCityName}
                    onChange={(e) => setNewCityName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Modo de Monitoramento</Label>
                  <Select value={newCityMode} onValueChange={(v) => setNewCityMode(v as 'any' | 'keywords')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer ocorrencia</SelectItem>
                      <SelectItem value="keywords">Keywords especificas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newCityMode === 'keywords' && (
                  <div>
                    <Label>Keywords (separadas por virgula)</Label>
                    <Input
                      placeholder="roubo, furto, homicidio"
                      value={newCityKeywords}
                      onChange={(e) => setNewCityKeywords(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <Label>Frequencia de Scan</Label>
                  <Select value={newCityFrequency} onValueChange={setNewCityFrequency}>
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
                <Button onClick={handleAddCity} className="w-full">Adicionar Cidade</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
              <Card key={state.id}>
                <CardHeader
                  className="cursor-pointer py-3"
                  onClick={() => toggleExpand(state.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <CardTitle className="text-base">{state.name}</CardTitle>
                    <Badge variant="secondary">
                      {activeCities}/{state.cities.length} cidades ativas
                    </Badge>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-2 pt-0">
                    {state.cities.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Nenhuma cidade neste estado. Clique em &quot;+ Cidade&quot; para adicionar.
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

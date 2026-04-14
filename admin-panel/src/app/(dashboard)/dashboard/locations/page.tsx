'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/hooks/use-auth';
import { api, type StateWithCities, type CityGroup } from '@/lib/api';
import {
  ChevronDown,
  ChevronRight,
  Play,
  Loader2,
  MapPin,
  Trash2,
  Layers,
  Plus,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { IBGEImportDialog } from './ibge-import-dialog';

export default function LocationsPage() {
  const { getToken } = useAuth();
  const [states, setStates] = useState<StateWithCities[]>([]);
  const [groups, setGroups] = useState<CityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState<Set<string>>(new Set());

  // Group dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CityGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedGroupCities, setSelectedGroupCities] = useState<Set<string>>(new Set());
  const [savingGroup, setSavingGroup] = useState(false);


  const loadLocations = useCallback(async () => {
    try {
      const token = await getToken();
      const [data, groupsData] = await Promise.all([
        api.getLocations(token),
        api.getGroups(token).catch(() => [] as CityGroup[]),
      ]);
      setStates(data);
      setGroups(groupsData);
    } catch {
      toast.error('Erro ao carregar monitoramentos');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // All cities flattened (for group dialog)
  const allCities = states.flatMap((s) =>
    s.cities.map((c) => ({ id: c.id, name: c.name, stateName: s.name }))
  );

  function openCreateGroup() {
    setEditingGroup(null);
    setGroupName('');
    setGroupDesc('');
    setSelectedGroupCities(new Set());
    setGroupDialogOpen(true);
  }

  function openEditGroup(group: CityGroup) {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDesc(group.description || '');
    setSelectedGroupCities(new Set(group.cities.map((c) => c.id)));
    setGroupDialogOpen(true);
  }

  async function handleSaveGroup() {
    if (!groupName.trim()) { toast.error('Nome e obrigatorio'); return; }
    if (selectedGroupCities.size === 0) { toast.error('Selecione pelo menos 1 cidade'); return; }
    setSavingGroup(true);
    try {
      const token = await getToken();
      if (editingGroup) {
        await api.updateGroup(token, editingGroup.id, {
          name: groupName.trim(), description: groupDesc.trim() || undefined,
          locationIds: Array.from(selectedGroupCities),
        });
        toast.success('Grupo atualizado');
      } else {
        await api.createGroup(token, {
          name: groupName.trim(), description: groupDesc.trim() || undefined,
          locationIds: Array.from(selectedGroupCities),
        });
        toast.success('Grupo criado');
      }
      setGroupDialogOpen(false);
      await loadLocations();
    } catch { toast.error('Erro ao salvar grupo'); }
    finally { setSavingGroup(false); }
  }

  async function handleDeleteGroup(group: CityGroup) {
    if (!confirm(`Deletar grupo "${group.name}"?`)) return;
    try {
      const token = await getToken();
      await api.deleteGroup(token, group.id);
      toast.success('Grupo deletado');
      await loadLocations();
    } catch { toast.error('Erro ao deletar grupo'); }
  }

  function toggleGroupCity(cityId: string) {
    setSelectedGroupCities((prev) => {
      const next = new Set(prev);
      if (next.has(cityId)) next.delete(cityId); else next.add(cityId);
      return next;
    });
  }

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


      {/* Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Criar Grupo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="gname">Nome do grupo</Label>
              <Input id="gname" placeholder="Ex: Grande Florianopolis" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="gdesc">Descricao (opcional)</Label>
              <Input id="gdesc" placeholder="Ex: Regiao metropolitana" value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} />
            </div>
            <div>
              <Label>Cidades ({selectedGroupCities.size} selecionada{selectedGroupCities.size !== 1 ? 's' : ''})</Label>
              <div className="mt-2 max-h-60 overflow-auto border rounded-md p-2 space-y-1">
                {allCities.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma cidade monitorada.</p>
                ) : (
                  allCities.map((city) => (
                    <label key={city.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                      <Checkbox checked={selectedGroupCities.has(city.id)} onCheckedChange={() => toggleGroupCity(city.id)} />
                      <span className="text-sm">{city.name}</span>
                      <span className="text-xs text-muted-foreground">({city.stateName})</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveGroup} disabled={savingGroup}>
              {savingGroup && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingGroup ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    {/* Groups inside this state */}
                    {groups
                      .filter((g) => g.cities.some((gc) => state.cities.some((sc) => sc.id === gc.id)))
                      .map((group) => {
                        const groupCityIds = new Set(group.cities.map((c) => c.id));
                        const isGroupExpanded = expanded.has(`group-${group.id}`);
                        return (
                          <div key={group.id} className="rounded-md border border-blue-500/30 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Switch
                                  checked={group.active}
                                  onCheckedChange={async () => {
                                    try {
                                      const token = await getToken();
                                      await api.updateGroup(token, group.id, { active: !group.active });
                                      await loadLocations();
                                      toast.success(`Grupo ${!group.active ? 'ativado' : 'desativado'}`);
                                    } catch { toast.error('Erro ao atualizar'); }
                                  }}
                                />
                                <div
                                  className="flex items-center gap-2 cursor-pointer"
                                  onClick={() => toggleExpand(`group-${group.id}`)}
                                >
                                  {isGroupExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  <Layers className="h-4 w-4 text-blue-400" />
                                  <p className="font-medium">{group.name}</p>
                                </div>
                                <Badge variant="outline" className="bg-blue-100 text-blue-700 text-xs">
                                  {group.cities.length} cidade{group.cities.length !== 1 ? 's' : ''}
                                </Badge>
                                {(() => {
                                  const memberCities = state.cities.filter((c) => groupCityIds.has(c.id));
                                  const freq = memberCities[0]?.scan_frequency_minutes ?? 60;
                                  const lastChecks = memberCities.map((c) => c.last_check).filter(Boolean) as string[];
                                  const mostRecent = lastChecks.length > 0 ? lastChecks.sort().reverse()[0] : null;
                                  return (
                                    <span className="text-xs text-muted-foreground">
                                      {freq < 60 ? `Cada ${freq}min` : `Cada ${freq / 60}h`} | Ultimo: {mostRecent ? formatLastCheck(mostRecent) : 'Nunca'}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!group.active || scanning.has(group.id)}
                                  onClick={async () => {
                                    setScanning((prev) => new Set(prev).add(group.id));
                                    try {
                                      const token = await getToken();
                                      for (const city of group.cities) {
                                        await api.triggerScan(token, city.id).catch(() => {});
                                      }
                                      toast.success(`Scan iniciado para ${group.cities.length} cidades`);
                                    } catch { toast.error('Erro ao iniciar scan'); }
                                    finally {
                                      setScanning((prev) => { const next = new Set(prev); next.delete(group.id); return next; });
                                    }
                                  }}
                                >
                                  {scanning.has(group.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                  <span className="ml-1">Scan</span>
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openEditGroup(group)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteGroup(group)} className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {/* Expandable city list inside group */}
                            {isGroupExpanded && (
                              <div className="ml-8 space-y-2 pt-1">
                                {state.cities
                                  .filter((c) => groupCityIds.has(c.id))
                                  .map((city) => (
                                    <div key={city.id} className="flex items-center justify-between rounded-md border p-2.5">
                                      <div className="flex items-center gap-3">
                                        <Switch
                                          checked={city.active}
                                          onCheckedChange={() => toggleActive(city.id, city.active)}
                                        />
                                        <div>
                                          <p className="text-sm font-medium">{city.name}</p>
                                          <div className="flex gap-2 text-xs text-muted-foreground">
                                            <span>{city.mode === 'keywords' ? `Keywords: ${city.keywords?.join(', ') || '-'}` : 'Qualquer ocorrencia'}</span>
                                            <span>|</span>
                                            <span>{city.scan_frequency_minutes < 60 ? `Cada ${city.scan_frequency_minutes}min` : `Cada ${city.scan_frequency_minutes / 60}h`}</span>
                                            <span>|</span>
                                            <span>Ultimo: {formatLastCheck(city.last_check)}</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button variant="outline" size="sm" onClick={() => triggerScan(city.id, city.name)} disabled={scanning.has(city.id) || !city.active}>
                                          {scanning.has(city.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                          <span className="ml-1">Scan</span>
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(city.id, city.name)} className="text-destructive hover:text-destructive">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    {/* Cities NOT in any group */}
                    {(() => {
                      const citiesInGroups = new Set(
                        groups.flatMap((g) => g.cities.map((c) => c.id))
                      );
                      const ungroupedCities = state.cities.filter((c) => !citiesInGroups.has(c.id));
                      if (state.cities.length === 0) return (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          Nenhuma cidade neste estado. Use &quot;Importar IBGE&quot; para adicionar.
                        </p>
                      );
                      return ungroupedCities.map((city) => (
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
                      ));
                    })()}
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

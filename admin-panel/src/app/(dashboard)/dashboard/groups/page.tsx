'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { api, type CityGroup, type StateWithCities } from '@/lib/api';
import { Loader2, Plus, Pencil, Trash2, MapPin, Layers } from 'lucide-react';
import { toast } from 'sonner';

export default function GroupsPage() {
  const { getToken } = useAuth();
  const [groups, setGroups] = useState<CityGroup[]>([]);
  const [locations, setLocations] = useState<StateWithCities[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CityGroup | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const token = await getToken();
      const [groupsData, locData] = await Promise.all([
        api.getGroups(token),
        api.getLocations(token),
      ]);
      setGroups(groupsData);
      setLocations(locData);
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreate() {
    setEditingGroup(null);
    setFormName('');
    setFormDescription('');
    setSelectedCities(new Set());
    setDialogOpen(true);
  }

  function openEdit(group: CityGroup) {
    setEditingGroup(group);
    setFormName(group.name);
    setFormDescription(group.description || '');
    setSelectedCities(new Set(group.cities.map((c) => c.id)));
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error('Nome e obrigatorio');
      return;
    }
    if (selectedCities.size === 0) {
      toast.error('Selecione pelo menos 1 cidade');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      if (editingGroup) {
        await api.updateGroup(token, editingGroup.id, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          locationIds: Array.from(selectedCities),
        });
        toast.success('Grupo atualizado');
      } else {
        await api.createGroup(token, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          locationIds: Array.from(selectedCities),
        });
        toast.success('Grupo criado');
      }
      setDialogOpen(false);
      await loadData();
    } catch {
      toast.error('Erro ao salvar grupo');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(group: CityGroup) {
    if (!confirm(`Deletar grupo "${group.name}"?`)) return;
    try {
      const token = await getToken();
      await api.deleteGroup(token, group.id);
      toast.success('Grupo deletado');
      await loadData();
    } catch {
      toast.error('Erro ao deletar');
    }
  }

  function toggleCity(cityId: string) {
    setSelectedCities((prev) => {
      const next = new Set(prev);
      if (next.has(cityId)) next.delete(cityId);
      else next.add(cityId);
      return next;
    });
  }

  // Flatten all cities for the picker
  const allCities = locations.flatMap((state) =>
    state.cities.map((city) => ({
      id: city.id,
      name: city.name,
      stateName: state.name,
    }))
  );

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
        <h1 className="text-2xl font-bold">Grupos de Cidades</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Criar Grupo
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Layers className="mx-auto mb-4 h-12 w-12 opacity-30" />
            <p>Nenhum grupo criado.</p>
            <p className="text-sm">
              Grupos permitem agrupar varias cidades em um unico card no app.
              Ex: &quot;Grande SP&quot; com Sao Paulo, Guarulhos e Osasco.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Layers className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{group.name}</CardTitle>
                      {group.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {group.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-green-100 text-green-700">
                      {group.cities.length} cidade{group.cities.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(group)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(group)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {group.cities.map((city) => (
                    <Badge key={city.id} variant="secondary" className="text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      {city.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? 'Editar Grupo' : 'Criar Grupo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="group-name">Nome do grupo</Label>
              <Input
                id="group-name"
                placeholder="Ex: Grande Florianopolis"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="group-desc">Descricao (opcional)</Label>
              <Input
                id="group-desc"
                placeholder="Ex: Regiao metropolitana de Florianopolis"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div>
              <Label>Cidades ({selectedCities.size} selecionada{selectedCities.size !== 1 ? 's' : ''})</Label>
              <div className="mt-2 max-h-60 overflow-auto border rounded-md p-2 space-y-1">
                {allCities.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhuma cidade monitorada. Adicione cidades em Monitoramentos primeiro.
                  </p>
                ) : (
                  allCities.map((city) => (
                    <label
                      key={city.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedCities.has(city.id)}
                        onCheckedChange={() => toggleCity(city.id)}
                      />
                      <span className="text-sm">{city.name}</span>
                      <span className="text-xs text-muted-foreground">({city.stateName})</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingGroup ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

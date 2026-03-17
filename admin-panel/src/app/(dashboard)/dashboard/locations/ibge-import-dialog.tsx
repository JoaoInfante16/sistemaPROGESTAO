'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/lib/hooks/use-auth';
import { api, type StateWithCities } from '@/lib/api';
import { Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface IBGEEstado {
  uf: string;
  nome: string;
  cidades: string[];
}

interface IBGEImportDialogProps {
  existingLocations: StateWithCities[];
  onImportComplete: () => void;
}

export function IBGEImportDialog({ existingLocations, onImportComplete }: IBGEImportDialogProps) {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [ibgeData, setIbgeData] = useState<IBGEEstado[]>([]);
  const [loadingIBGE, setLoadingIBGE] = useState(false);

  // Form state
  const [selectedEstado, setSelectedEstado] = useState<string>('');
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [mode, setMode] = useState<'any' | 'keywords'>('any');
  const [frequency, setFrequency] = useState('60');
  const [importing, setImporting] = useState(false);

  // Load IBGE JSON when dialog opens
  useEffect(() => {
    if (open && ibgeData.length === 0) {
      setLoadingIBGE(true);
      fetch('/data/municipios_br.json')
        .then((res) => res.json())
        .then((data: IBGEEstado[]) => setIbgeData(data))
        .catch(() => toast.error('Erro ao carregar dados do IBGE'))
        .finally(() => setLoadingIBGE(false));
    }
  }, [open, ibgeData.length]);

  // Get existing city names for the selected state (to mark as already monitored)
  const existingCityNames = useMemo(() => {
    if (!selectedEstado) return new Set<string>();
    const state = existingLocations.find(
      (s) => s.name.toLowerCase() === selectedEstado.toLowerCase()
    );
    return new Set((state?.cities || []).map((c) => c.name.toLowerCase()));
  }, [selectedEstado, existingLocations]);

  // Get IBGE cities for the selected state
  const ibgeCities = useMemo(() => {
    const estado = ibgeData.find((e) => e.nome === selectedEstado);
    return estado?.cidades || [];
  }, [selectedEstado, ibgeData]);

  // Filter cities by search
  const filteredCities = useMemo(() => {
    if (!searchFilter) return ibgeCities;
    const normalized = searchFilter.toLowerCase();
    return ibgeCities.filter((c) => c.toLowerCase().includes(normalized));
  }, [ibgeCities, searchFilter]);

  // Count of selectable (non-existing) cities
  const selectableCount = filteredCities.filter(
    (c) => !existingCityNames.has(c.toLowerCase())
  ).length;

  const allSelectableSelected = selectableCount > 0 &&
    filteredCities
      .filter((c) => !existingCityNames.has(c.toLowerCase()))
      .every((c) => selectedCities.has(c));

  const toggleCity = (city: string) => {
    setSelectedCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelectableSelected) {
      // Deselect all filtered selectable
      setSelectedCities((prev) => {
        const next = new Set(prev);
        filteredCities
          .filter((c) => !existingCityNames.has(c.toLowerCase()))
          .forEach((c) => next.delete(c));
        return next;
      });
    } else {
      // Select all filtered selectable
      setSelectedCities((prev) => {
        const next = new Set(prev);
        filteredCities
          .filter((c) => !existingCityNames.has(c.toLowerCase()))
          .forEach((c) => next.add(c));
        return next;
      });
    }
  };

  const handleImport = async () => {
    if (selectedCities.size === 0 || !selectedEstado) return;
    setImporting(true);
    try {
      const token = await getToken();
      const result = await api.bulkImportLocations(token, {
        state_name: selectedEstado,
        cities: Array.from(selectedCities),
        mode,
        scan_frequency_minutes: parseInt(frequency) || 60,
      });
      toast.success(
        `Importado: ${result.imported} cidades. ${result.skipped > 0 ? `${result.skipped} ja existiam.` : ''}`
      );
      setOpen(false);
      setSelectedEstado('');
      setSelectedCities(new Set());
      setSearchFilter('');
      onImportComplete();
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao importar');
    } finally {
      setImporting(false);
    }
  };

  const handleEstadoChange = (value: string) => {
    setSelectedEstado(value);
    setSelectedCities(new Set());
    setSearchFilter('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Database className="mr-2 h-4 w-4" />
          Importar IBGE
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Cidades do IBGE</DialogTitle>
        </DialogHeader>

        {loadingIBGE ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Estado select */}
            <div>
              <Label>Estado</Label>
              <Select value={selectedEstado} onValueChange={handleEstadoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  {ibgeData.map((e) => (
                    <SelectItem key={e.uf} value={e.nome}>
                      {e.nome} ({e.uf}) — {e.cidades.length} cidades
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cities section */}
            {selectedEstado && (
              <>
                {/* Search filter */}
                <Input
                  placeholder="Filtrar cidades..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />

                {/* Select all + count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSelectableSelected}
                      onCheckedChange={toggleAll}
                      disabled={selectableCount === 0}
                    />
                    <Label className="text-sm cursor-pointer" onClick={toggleAll}>
                      Selecionar todas
                    </Label>
                  </div>
                  <Badge variant="secondary">
                    {selectedCities.size} de {ibgeCities.length} selecionadas
                  </Badge>
                </div>

                {/* City list */}
                <div className="max-h-64 overflow-y-auto border rounded-md p-2 space-y-1">
                  {filteredCities.map((city) => {
                    const isExisting = existingCityNames.has(city.toLowerCase());
                    const isSelected = selectedCities.has(city);
                    return (
                      <div
                        key={city}
                        className={`flex items-center gap-2 py-1 px-2 rounded text-sm ${
                          isExisting ? 'opacity-50' : 'hover:bg-muted cursor-pointer'
                        }`}
                        onClick={() => !isExisting && toggleCity(city)}
                      >
                        <Checkbox
                          checked={isSelected || isExisting}
                          disabled={isExisting}
                          onCheckedChange={() => !isExisting && toggleCity(city)}
                        />
                        <span className="flex-1">{city}</span>
                        {isExisting && (
                          <Badge variant="outline" className="text-xs">
                            Ja monitorada
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                  {filteredCities.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma cidade encontrada
                    </p>
                  )}
                </div>

                {/* Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Modo</Label>
                    <Select value={mode} onValueChange={(v) => setMode(v as 'any' | 'keywords')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Qualquer ocorrencia</SelectItem>
                        <SelectItem value="keywords">Por palavras-chave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Frequencia</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                        <SelectItem value="360">6 horas</SelectItem>
                        <SelectItem value="720">12 horas</SelectItem>
                        <SelectItem value="1440">24 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Import button */}
                <Button
                  onClick={handleImport}
                  disabled={selectedCities.size === 0 || importing}
                  className="w-full"
                >
                  {importing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="mr-2 h-4 w-4" />
                  )}
                  {importing
                    ? 'Importando...'
                    : `Importar ${selectedCities.size} cidade${selectedCities.size !== 1 ? 's' : ''}`}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/lib/hooks/use-auth';
import { api, type NewsItem } from '@/lib/api';
import { Search, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';

const CRIME_COLORS: Record<string, string> = {
  homicidio: 'bg-red-500',
  latrocinio: 'bg-red-700',
  roubo: 'bg-orange-500',
  furto: 'bg-yellow-500',
  assalto: 'bg-orange-600',
  trafico: 'bg-purple-500',
  outro: 'bg-gray-500',
};

const PAGE_SIZE = 20;

export default function NewsPage() {
  const { getToken } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cidadeFilter, setCidadeFilter] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadNews = useCallback(async (newOffset: number) => {
    setLoading(true);
    try {
      const token = await getToken();
      const result = await api.getNews(token, {
        offset: newOffset,
        limit: PAGE_SIZE,
        cidade: cidadeFilter || undefined,
      });
      setNews(result.news);
      setHasMore(result.hasMore);
      setOffset(newOffset);
      setIsSearching(false);
    } catch {
      // failed to load
    } finally {
      setLoading(false);
    }
  }, [getToken, cidadeFilter]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      loadNews(0);
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      const result = await api.searchNews(token, {
        query: searchQuery,
        cidade: cidadeFilter || undefined,
        limit: PAGE_SIZE,
      });
      setNews(result.news);
      setHasMore(result.hasMore);
      setOffset(0);
      setIsSearching(true);
    } catch {
      // failed to search
    } finally {
      setLoading(false);
    }
  }, [getToken, searchQuery, cidadeFilter, loadNews]);

  useEffect(() => {
    loadNews(0);
  }, [loadNews]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const crimeColor = (tipo: string) => {
    const normalized = tipo.toLowerCase().replace(/í/g, 'i').replace(/á/g, 'a');
    return CRIME_COLORS[normalized] || CRIME_COLORS['outro'];
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Noticias</h1>

      {/* Search & Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por resumo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Input
              placeholder="Filtrar cidade..."
              value={cidadeFilter}
              onChange={(e) => setCidadeFilter(e.target.value)}
              className="w-48"
            />
            <Button onClick={handleSearch}>Buscar</Button>
            {isSearching && (
              <Button variant="outline" onClick={() => { setSearchQuery(''); loadNews(0); }}>
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* News Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isSearching ? `Resultados para "${searchQuery}"` : 'Feed de Noticias'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : news.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              Nenhuma noticia encontrada.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Tipo</TableHead>
                    <TableHead className="w-[160px]">Local</TableHead>
                    <TableHead>Resumo</TableHead>
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead className="w-[80px]">Conf.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {news.map((item) => (
                    <>
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      >
                        <TableCell>
                          <Badge className={`${crimeColor(item.tipo_crime)} text-white`}>
                            {item.tipo_crime}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.cidade}</div>
                          {item.bairro && (
                            <div className="text-xs text-muted-foreground">{item.bairro}</div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="truncate">{item.resumo}</p>
                        </TableCell>
                        <TableCell>{formatDate(item.data_ocorrencia)}</TableCell>
                        <TableCell>
                          <Badge variant={item.confianca >= 0.9 ? 'default' : 'secondary'}>
                            {Math.round(item.confianca * 100)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {expandedId === item.id && (
                        <TableRow key={`${item.id}-expanded`}>
                          <TableCell colSpan={5} className="bg-muted/30">
                            <div className="space-y-2 p-2">
                              <p className="text-sm">{item.resumo}</p>
                              {item.rua && (
                                <p className="text-xs text-muted-foreground">Rua: {item.rua}</p>
                              )}
                              {item.news_sources?.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium mb-1">Fontes:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {item.news_sources.map((src, i) => (
                                      <a
                                        key={i}
                                        href={src.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        {src.source_name || new URL(src.url).hostname}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Criado em: {new Date(item.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando {offset + 1} - {offset + news.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadNews(Math.max(0, offset - PAGE_SIZE))}
                    disabled={offset === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadNews(offset + PAGE_SIZE)}
                    disabled={!hasMore}
                  >
                    Proximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

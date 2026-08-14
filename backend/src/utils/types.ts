// ============================================
// Tipos compartilhados do sistema
// ============================================

// 15 categorias padronizadas de crime (gerenciamento de risco corporativo)
export type TipoCrime =
  | 'roubo_furto' | 'vandalismo' | 'invasao' | 'receptacao'  // patrimonial
  | 'homicidio' | 'latrocinio' | 'lesao_corporal'      // seguranca
  | 'trafico' | 'operacao_policial' | 'manifestacao' | 'bloqueio_via' // operacional
  | 'estelionato'                                       // fraude
  | 'crime_ambiental' | 'trabalho_irregular' | 'estatistica' | 'outros'; // institucional

export type CategoriaGrupo = 'patrimonial' | 'seguranca' | 'operacional' | 'fraude' | 'institucional';
export type Natureza = 'ocorrencia' | 'estatistica';

// Mapa tipo_crime → categoria_grupo (usado pra validacao).
// Nota: receptação (Art. 180 CP) é patrimonial juridicamente E funcionalmente —
// indica cadeia de crime patrimonial ativa (produto roubado sendo vendido).
// Latrocínio mantido em seguranca (tecnicamente patrimonial qualificado, mas
// pro cliente de varejo é risco à vida — pragmático sobre jurídico puro).
export const TIPO_CRIME_GRUPO: Record<TipoCrime, CategoriaGrupo> = {
  roubo_furto: 'patrimonial', vandalismo: 'patrimonial', invasao: 'patrimonial', receptacao: 'patrimonial',
  homicidio: 'seguranca', latrocinio: 'seguranca', lesao_corporal: 'seguranca',
  trafico: 'operacional', operacao_policial: 'operacional', manifestacao: 'operacional', bloqueio_via: 'operacional',
  estelionato: 'fraude',
  crime_ambiental: 'institucional', trabalho_irregular: 'institucional', estatistica: 'institucional', outros: 'institucional',
};

/**
 * Como o tipo aparece **pra quem lê** — cliente, documento, push.
 *
 * Existe porque o relatorio compartilhado imprimia a chave crua do banco:
 * `roubo_furto`, `lesao_corporal`, `trafico`, com underline, num documento
 * desenhado pra chegar no cliente do cliente.
 *
 * ⚠️ **Nao da pra derivar de `ASSUNTOS_CATALOGO`** (taxonomia.ts). La a relacao
 * e N:1 de proposito — `lesao_corporal` aparece como "Violencia domestica" E
 * como "Agressao", porque sao perguntas diferentes ao Google que classificam no
 * mesmo tipo. Derivar dali escolheria uma das duas por ordem de array.
 *
 * ⚠️ `formatTipoCrime` (pushService.ts) tem nome enganoso: devolve o rotulo da
 * CATEGORIA, nao o do tipo. Nao e substituto disto.
 *
 * 🚨 `roubo_furto` se chama **"Roubo"**, por decisao do Joao em 14/08. A chave
 * NAO muda — nada de migration, de prompt do Filter2 ou de linha regravada.
 * O que fica dito: roubo e furto sao crimes distintos (com e sem violencia), e
 * este rotulo chama de roubo os dois. Quem for reparar e um leitor que faca a
 * distincao juridica; foi pesado e aceito.
 */
export const TIPO_CRIME_LABEL: Record<TipoCrime, string> = {
  roubo_furto: 'Roubo', vandalismo: 'Vandalismo', invasao: 'Invasão', receptacao: 'Receptação',
  homicidio: 'Homicídio', latrocinio: 'Latrocínio', lesao_corporal: 'Lesão corporal',
  trafico: 'Tráfico', operacao_policial: 'Operação policial', manifestacao: 'Manifestação',
  bloqueio_via: 'Bloqueio de via',
  estelionato: 'Estelionato',
  crime_ambiental: 'Crime ambiental', trabalho_irregular: 'Trabalho irregular',
  estatistica: 'Estatística', outros: 'Outros',
};

/** O rotulo, tolerante a tipo desconhecido — linha antiga nao pode sumir da tabela. */
export function rotuloTipoCrime(tipo: string | null | undefined): string {
  if (!tipo) return TIPO_CRIME_LABEL.outros;
  return TIPO_CRIME_LABEL[tipo as TipoCrime] ?? tipo.replace(/_/g, ' ');
}

export interface NewsExtraction {
  e_crime: boolean;
  tipo_crime: TipoCrime;
  natureza: Natureza;
  categoria_grupo: CategoriaGrupo;
  cidade: string;
  estado?: string;
  bairro?: string;
  rua?: string;
  data_ocorrencia: string; // YYYY-MM-DD
  /**
   * Hora que o VEICULO publicou, `HH:MM`, como impressa na pagina (migration
   * 030). Sem fuso de proposito — e horario local do portal, e converter so
   * pioraria.
   *
   * Opcional: artigo que nao informa hora nao e rejeitado, e o app **omite** o
   * carimbo em vez de exibir `00:00`. Esse `00:00` era o bug: o carimbo lia
   * `data_ocorrencia`, que e DATE, entao dava meia-noite em 100% dos itens.
   */
  hora_publicacao?: string;
  /**
   * Manchete curta e neutra, escrita pelo Filter2 — nao copiada do veiculo.
   *
   * Opcional de proposito: item sem titulo NAO e rejeitado (seria jogar fora
   * uma ocorrencia paga em SERP + Jina por um campo cosmetico), e as linhas
   * anteriores a migration 029 nao tem nenhum. O app compoe um titulo dos
   * campos estruturados quando vem null.
   */
  titulo?: string;
  resumo: string;
  confianca: number; // 0.0 a 1.0
  embedding?: number[];
}

export interface MonitoredLocation {
  id: string;
  type: 'state' | 'city';
  name: string;
  parent_id: string | null;
  active: boolean;
  mode: 'keywords' | 'any';
  keywords: string[] | null;
  scan_frequency_minutes: number;
  last_check: Date | null;
  created_at: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  is_admin: boolean;
  created_by: string | null;
  active: boolean;
  must_change_password: boolean;
  created_at: Date;
}

export interface UserDevice {
  id: string;
  user_id: string;
  device_token: string;
  platform: 'ios' | 'android';
  last_seen: Date;
  created_at: Date;
}

export interface OperationLog {
  id: string;
  location_id: string;
  stage: string;
  urls_processed: number;
  news_found: number;
  cost_usd: number;
  duration_ms: number;
  created_at: Date;
}

export interface RateLimit {
  id: string;
  provider: 'google' | 'brave' | 'brightdata' | 'jina' | 'openai';
  max_concurrent: number;
  min_time_ms: number;
  daily_quota: number | null;
  monthly_quota: number | null;
  active: boolean;
  updated_at: Date;
}

export interface BudgetEntry {
  id: string;
  source: 'auto_scan' | 'manual_search';
  provider: 'google' | 'brave' | 'brightdata' | 'jina' | 'openai';
  cost_usd: number;
  details: Record<string, unknown>;
  created_at: Date;
}

// Ponto individual de ocorrência pro mapa (radar).
// `precisao` indica o nível de ancoragem do geocode — útil pra aplicar jitter só
// quando cai no centro do bairro ou cidade (evita empilhar pontos em 1 pixel).
export interface CrimePoint {
  id: string;
  lat: number;
  lng: number;
  categoria: CategoriaGrupo;
  tipo_crime: TipoCrime;
  data: string; // YYYY-MM-DD
  bairro: string | null;
  rua: string | null;
  precisao: 'rua' | 'bairro' | 'cidade';

  /// Os dois sinalizadores da busca manual, agora **no ponto**.
  ///
  /// Antes o backend simplesmente nao mandava esses itens: o mapa nascia com o
  /// recorte cravado e as chaves do relatorio ("+ regiao", "+ antigas") mexiam
  /// em todo numero da tela menos nele. Quem decide o que aparece e a tela,
  /// que ja tem as chaves na mao — o endpoint manda tudo, uma vez so.
  ///
  /// Ausentes no caminho do auto-scan (`getMapPointsRaw` le de `news`, onde
  /// nao existe balde): tratar como `false`.
  fora_do_periodo?: boolean;
  cidade_vizinha?: boolean;
}

export interface PipelineResult {
  locationId: string;
  locationName: string;
  urlsFound: number;
  afterFilter0: number;
  afterFilter1: number;
  afterFilter2: number;
  newsSaved: number;
  duplicatesFound: number;
  totalCostUsd: number;
  durationMs: number;
}

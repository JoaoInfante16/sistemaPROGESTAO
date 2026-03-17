// ============================================
// SSP Sources - URLs das Secretarias de Segurança
// ============================================
// Configuração das páginas de notícias das SSPs estaduais.
// Cada estado tem URL da página de notícias e UF para matching.

export interface SSPSource {
  state: string;      // Nome do estado (para matching com location.name)
  uf: string;         // Sigla UF
  newsUrl: string;    // URL da página de notícias
  domain: string;     // Domínio para filtrar links
}

export const SSP_SOURCES: SSPSource[] = [
  {
    state: 'São Paulo',
    uf: 'SP',
    newsUrl: 'https://www.ssp.sp.gov.br/noticias',
    domain: 'ssp.sp.gov.br',
  },
  {
    state: 'Rio de Janeiro',
    uf: 'RJ',
    newsUrl: 'https://www.governo.rj.gov.br/secretaria/seguranca/',
    domain: 'governo.rj.gov.br',
  },
  {
    state: 'Minas Gerais',
    uf: 'MG',
    newsUrl: 'https://www.seguranca.mg.gov.br/noticias',
    domain: 'seguranca.mg.gov.br',
  },
  {
    state: 'Bahia',
    uf: 'BA',
    newsUrl: 'https://www.ssp.ba.gov.br/noticias',
    domain: 'ssp.ba.gov.br',
  },
  {
    state: 'Rio Grande do Sul',
    uf: 'RS',
    newsUrl: 'https://ssp.rs.gov.br/noticias',
    domain: 'ssp.rs.gov.br',
  },
];

/**
 * Encontra a SSP source para uma cidade, baseado no estado pai.
 * @param stateName Nome ou sigla do estado
 */
export function findSSPSource(stateName: string): SSPSource | undefined {
  const normalized = stateName.trim().toLowerCase();
  return SSP_SOURCES.find(
    (s) => s.state.toLowerCase() === normalized || s.uf.toLowerCase() === normalized
  );
}

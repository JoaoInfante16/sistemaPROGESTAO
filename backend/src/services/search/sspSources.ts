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
  // === Sudeste ===
  {
    state: 'São Paulo',
    uf: 'SP',
    newsUrl: 'https://www.ssp.sp.gov.br/noticias',
    domain: 'ssp.sp.gov.br',
  },
  {
    state: 'Rio de Janeiro',
    uf: 'RJ',
    newsUrl: 'https://www.rj.gov.br/seguranca/',
    domain: 'rj.gov.br',
  },
  {
    state: 'Minas Gerais',
    uf: 'MG',
    newsUrl: 'https://www.seguranca.mg.gov.br/noticias',
    domain: 'seguranca.mg.gov.br',
  },
  {
    state: 'Espírito Santo',
    uf: 'ES',
    newsUrl: 'https://sesp.es.gov.br/noticias',
    domain: 'sesp.es.gov.br',
  },
  // === Sul ===
  {
    state: 'Rio Grande do Sul',
    uf: 'RS',
    newsUrl: 'https://ssp.rs.gov.br/noticias',
    domain: 'ssp.rs.gov.br',
  },
  {
    state: 'Paraná',
    uf: 'PR',
    newsUrl: 'https://www.seguranca.pr.gov.br/Seguranca-Publica',
    domain: 'seguranca.pr.gov.br',
  },
  {
    state: 'Santa Catarina',
    uf: 'SC',
    newsUrl: 'https://ssp.sc.gov.br/',
    domain: 'ssp.sc.gov.br',
  },
  // === Nordeste ===
  {
    state: 'Bahia',
    uf: 'BA',
    newsUrl: 'https://www.ssp.ba.gov.br/noticias',
    domain: 'ssp.ba.gov.br',
  },
  {
    state: 'Ceará',
    uf: 'CE',
    newsUrl: 'https://www.sspds.ce.gov.br/',
    domain: 'sspds.ce.gov.br',
  },
  {
    state: 'Pernambuco',
    uf: 'PE',
    newsUrl: 'https://www.sds.pe.gov.br/noticias',
    domain: 'sds.pe.gov.br',
  },
  {
    state: 'Maranhão',
    uf: 'MA',
    newsUrl: 'https://www.ssp.ma.gov.br/',
    domain: 'ssp.ma.gov.br',
  },
  {
    state: 'Alagoas',
    uf: 'AL',
    newsUrl: 'https://seguranca.al.gov.br/',
    domain: 'seguranca.al.gov.br',
  },
  {
    state: 'Sergipe',
    uf: 'SE',
    newsUrl: 'https://www.ssp.se.gov.br/Noticias',
    domain: 'ssp.se.gov.br',
  },
  {
    state: 'Paraíba',
    uf: 'PB',
    newsUrl: 'https://paraiba.pb.gov.br/diretas/secretaria-da-seguranca-e-defesa-social',
    domain: 'paraiba.pb.gov.br',
  },
  {
    state: 'Piauí',
    uf: 'PI',
    newsUrl: 'https://www.ssp.pi.gov.br/',
    domain: 'ssp.pi.gov.br',
  },
  // === Centro-Oeste ===
  {
    state: 'Goiás',
    uf: 'GO',
    newsUrl: 'https://www.seguranca.go.gov.br/noticias-da-ssp',
    domain: 'seguranca.go.gov.br',
  },
  {
    state: 'Mato Grosso',
    uf: 'MT',
    newsUrl: 'https://portal2.sesp.mt.gov.br/',
    domain: 'sesp.mt.gov.br',
  },
  {
    state: 'Mato Grosso do Sul',
    uf: 'MS',
    newsUrl: 'https://www.sejusp.ms.gov.br/',
    domain: 'sejusp.ms.gov.br',
  },
  {
    state: 'Distrito Federal',
    uf: 'DF',
    newsUrl: 'https://www.ssp.df.gov.br/',
    domain: 'ssp.df.gov.br',
  },
  // === Norte ===
  {
    state: 'Amazonas',
    uf: 'AM',
    newsUrl: 'https://www.ssp.am.gov.br/',
    domain: 'ssp.am.gov.br',
  },
  {
    state: 'Pará',
    uf: 'PA',
    newsUrl: 'https://segup.pa.gov.br/',
    domain: 'segup.pa.gov.br',
  },
  {
    state: 'Tocantins',
    uf: 'TO',
    newsUrl: 'https://www.to.gov.br/ssp/',
    domain: 'to.gov.br',
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

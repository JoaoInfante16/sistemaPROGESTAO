// ============================================
// Filtro 0 - Regex Local (gratuito, elimina ~50%)
// ============================================
// Filtragem rápida sem custo de API.
// Bloqueia redes sociais e conteúdo claramente não-crime.

const BLOCKED_DOMAINS = [
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'tiktok.com',
  'linkedin.com',
  'pinterest.com',
  'reddit.com',
  'whatsapp.com',
];

const NON_CRIME_KEYWORDS = [
  'novela',
  'futebol',
  'receita',
  'horóscopo',
  'fofoca',
  'celebridade',
  'cinema',
  'música',
  'jogo',
  'filme',
  'entretenimento',
  'esporte',
  'campeonato',
  'tempo',
  'previsão',
  'bolsa',
  'dólar',
  'cotação',
];

export function filter0Regex(url: string, snippet: string): boolean {
  // Bloquear redes sociais
  if (BLOCKED_DOMAINS.some((domain) => url.includes(domain))) {
    return false;
  }

  // Bloquear palavras claramente não-crime
  const lowerSnippet = snippet.toLowerCase();
  if (NON_CRIME_KEYWORDS.some((kw) => lowerSnippet.includes(kw))) {
    return false;
  }

  return true;
}

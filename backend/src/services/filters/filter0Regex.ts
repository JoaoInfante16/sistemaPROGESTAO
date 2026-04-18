// ============================================
// Filtro 0 - Regex Local (gratuito, elimina ~50%)
// ============================================
// Filtragem rápida sem custo de API.
// Bloqueia redes sociais, páginas de categoria e conteúdo claramente não-crime.

// Bloqueados: redes sociais (reels/stories/posts sem texto util) + YouTube (sem texto).
// Instagram vinha entregando muito reel e pouca noticia. YouTube idem (sem transcript).
const BLOCKED_DOMAINS = [
  'facebook.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'linkedin.com',
  'pinterest.com',
  'reddit.com',
  'whatsapp.com',
  'instagram.com',
  'youtube.com',
  'youtu.be',
  'globoplay.globo.com',
];

// Keywords de entretenimento/não-crime inequívocas. Removidas as ambíguas
// que disparavam falso negativo (match substring no snippet inteiro, sem
// contexto): `tempo` batia em "há muito tempo", `bolsa` em "roubaram a
// bolsa", `receita` em "Receita Federal apreendeu", `dólar` em "US$500 mil
// levados", `futebol`/`campeonato`/`jogo`/`esporte` em "torcedor morto",
// `cinema` em "atirador no cinema", `música` em "show interrompido por
// tiroteio", `filme` em "filmou o assalto". Esses casos passam agora pro
// Filter1 decidir com contexto.
const NON_CRIME_KEYWORDS = [
  'novela',
  'horóscopo',
  'fofoca',
  'celebridade',
  'entretenimento',
  'previsão do tempo',
  'cotação',
];

// Patterns de URL que indicam páginas de listagem/categoria (Jina retorna 0 conteúdo)
const CATEGORY_URL_PATTERNS = [
  /\/category\//i,
  /\/categories\//i,
  /\/editorias?\//i,
  /\/tag\//i,
  /\/tags\//i,
  /\/ultimas-noticias\/?$/i,
  /\/arquivo\/?$/i,
  /\/archives?\/?$/i,
  /\/page\/\d+\/?$/i,
  /\?cat=\d/i,
  /\/index\.php\/category\//i,
  /\/secao\//i,
  /\/editoria\//i,
  /\/assuntos?\//i,
  /\/topico?\//i,
  /\/noticias\/[a-z-]+\/?$/i,   // /noticias/curitiba-regiao/ (seção, sem slug de artigo)
  /\/policia\/?$/i,             // /policia/ (página de seção)
  /\/seguranca\/?$/i,           // /seguranca/ (página de seção)
  /\/cidades\/?$/i,             // /cidades/ (página de seção)
];

export function filter0Regex(url: string, snippet: string): boolean {
  // Bloquear redes sociais (YouTube e Instagram liberados — podem ter reportagens)
  if (BLOCKED_DOMAINS.some((domain) => url.includes(domain))) {
    return false;
  }

  // Bloquear páginas de categoria/listagem (Jina retorna 0 conteúdo pra essas)
  if (CATEGORY_URL_PATTERNS.some((pattern) => pattern.test(url))) {
    return false;
  }

  // Bloquear palavras claramente não-crime
  const lowerSnippet = snippet.toLowerCase();
  if (NON_CRIME_KEYWORDS.some((kw) => lowerSnippet.includes(kw))) {
    return false;
  }

  return true;
}

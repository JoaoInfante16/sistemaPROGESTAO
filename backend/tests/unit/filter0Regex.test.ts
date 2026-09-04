import { filter0Regex } from '../../src/services/filters/filter0Regex';

describe('filter0Regex', () => {
  describe('blocked domains', () => {
    const blockedUrls = [
      'https://facebook.com/noticia-crime',
      'https://www.instagram.com/p/abc123',
      'https://twitter.com/user/status/123',
      'https://x.com/user/status/123',
      'https://youtube.com/watch?v=abc',
      'https://tiktok.com/@user/video/123',
      'https://linkedin.com/posts/abc',
      'https://pinterest.com/pin/123',
      'https://reddit.com/r/brasil/comments/abc',
      'https://whatsapp.com/channel/abc',
    ];

    it.each(blockedUrls)('should block %s', (url) => {
      expect(filter0Regex(url, 'Homicídio na região central')).toBe(false);
    });
  });

  describe('barra entretenimento inequivoco', () => {
    const naoEhCrime = [
      'Novela das 9 estreia novo capítulo',
      'Horóscopo do dia para todos os signos',
      'Fofoca sobre celebridade famosa',
      'Previsão do tempo para amanhã',
      'Cotação do dólar sobe hoje',
    ];

    it.each(naoEhCrime)('barra: "%s"', (snippet) => {
      expect(filter0Regex('https://g1.globo.com/noticia', snippet)).toBe(false);
    });
  });

  describe('🚨 palavra ambigua NAO barra — o Filter1 decide com contexto', () => {
    // Estes casos JA foram barrados, e a lista foi encurtada de proposito: o
    // match e substring no trecho inteiro, sem contexto, entao `receita` batia
    // em "Receita Federal apreendeu" e `futebol` em "torcedor morto". Cada um
    // era uma noticia de crime real jogada fora de graca, antes de qualquer
    // filtro inteligente ver.
    //
    // Estes testes existem para o conserto nao ser desfeito por engano: se
    // alguem devolver essas palavras a lista, eles ficam vermelhos.
    const ambiguos = [
      'Receita Federal apreendeu carga de contrabando',
      'Torcedor morto após briga na saída do jogo de futebol',
      'Atirador abre fogo dentro de cinema no centro',
      'Show interrompido por tiroteio; música parou',
      'Assalto durante campeonato de skate na praça',
      'Câmera filmou o assalto ao mercado',
      'Roubaram a bolsa da vítima em plena avenida',
    ];

    it.each(ambiguos)('deixa passar: "%s"', (snippet) => {
      expect(filter0Regex('https://g1.globo.com/noticia', snippet)).toBe(true);
    });
  });

  describe('valid crime news', () => {
    const crimeSnippets = [
      { url: 'https://g1.globo.com/sp/noticia', snippet: 'Homicídio registrado na zona sul de São Paulo' },
      { url: 'https://uol.com.br/noticias', snippet: 'Polícia prende suspeito de roubo a banco' },
      { url: 'https://folha.uol.com.br', snippet: 'Operação policial apreende drogas no centro' },
      { url: 'https://gazetadopovo.com.br', snippet: 'Assalto à mão armada deixa vítima ferida' },
      { url: 'https://band.uol.com.br', snippet: 'Latrocínio em supermercado choca moradores' },
    ];

    it.each(crimeSnippets)('should pass: $snippet', ({ url, snippet }) => {
      expect(filter0Regex(url, snippet)).toBe(true);
    });
  });

  describe('caixa alta ou baixa nao muda a decisao', () => {
    it('barra igual, escrito de qualquer jeito', () => {
      expect(filter0Regex('https://example.com', 'NOVELA das 9')).toBe(false);
      expect(filter0Regex('https://example.com', 'Fofoca do Dia')).toBe(false);
      expect(filter0Regex('https://example.com', 'HORÓSCOPO do dia')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should pass empty snippet with valid URL', () => {
      expect(filter0Regex('https://g1.globo.com', '')).toBe(true);
    });

    it('should block even with crime-related text if domain is blocked', () => {
      expect(filter0Regex('https://facebook.com/crime-real', 'Homicídio na região')).toBe(false);
    });
  });
});

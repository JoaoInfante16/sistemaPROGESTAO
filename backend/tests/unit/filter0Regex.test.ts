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

  describe('non-crime keywords', () => {
    const nonCrimeSnippets = [
      'Novela das 9 estreia novo capítulo',
      'Resultado do jogo de futebol de ontem',
      'Receita de bolo de chocolate fácil',
      'Horóscopo do dia para todos os signos',
      'Fofoca sobre celebridade famosa',
      'Lançamento de filme no cinema',
      'Campeonato brasileiro rodada 10',
      'Previsão do tempo para amanhã',
      'Cotação do dólar sobe hoje',
    ];

    it.each(nonCrimeSnippets)('should block snippet: "%s"', (snippet) => {
      expect(filter0Regex('https://g1.globo.com/noticia', snippet)).toBe(false);
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

  describe('case insensitivity', () => {
    it('should block non-crime keywords regardless of case', () => {
      expect(filter0Regex('https://example.com', 'FUTEBOL na televisão')).toBe(false);
      expect(filter0Regex('https://example.com', 'Receita de Bolo')).toBe(false);
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

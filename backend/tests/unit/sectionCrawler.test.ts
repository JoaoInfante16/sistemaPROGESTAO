import { extractUniqueDomains, extractArticleLinks, looksLikeArticle } from '../../src/services/search/SectionCrawler';

describe('extractUniqueDomains', () => {
  it('extracts unique domains from URLs', () => {
    const urls = [
      'https://g1.globo.com/sp/policia/article1',
      'https://g1.globo.com/sp/policia/article2',
      'https://r7.com/cidades/article1',
      'https://uol.com.br/article1',
    ];

    const domains = extractUniqueDomains(urls);
    expect(domains).toHaveLength(3);
    expect(domains).toContain('g1.globo.com');
    expect(domains).toContain('r7.com');
    expect(domains).toContain('uol.com.br');
  });

  it('handles invalid URLs gracefully', () => {
    const domains = extractUniqueDomains(['not-a-url', 'https://valid.com/path']);
    expect(domains).toHaveLength(1);
    expect(domains[0]).toBe('valid.com');
  });

  it('returns empty for empty input', () => {
    expect(extractUniqueDomains([])).toEqual([]);
  });
});

describe('looksLikeArticle', () => {
  it('accepts URLs with date patterns', () => {
    expect(looksLikeArticle('https://g1.globo.com/2026/02/10/assalto-em-sp.ghtml')).toBe(true);
    expect(looksLikeArticle('https://news.com/20260210/article-slug-here')).toBe(true);
  });

  it('accepts URLs with long slugs', () => {
    expect(looksLikeArticle('https://g1.globo.com/sp/policia/noticia/assalto-deixa-dois-feridos-na-zona-sul.ghtml')).toBe(true);
  });

  it('accepts URLs with .ghtml, .html extensions', () => {
    expect(looksLikeArticle('https://g1.globo.com/sp/policia/article-name.ghtml')).toBe(true);
    expect(looksLikeArticle('https://news.com/crime/long-article-title.html')).toBe(true);
  });

  it('accepts URLs containing /noticia/ or /noticias/', () => {
    expect(looksLikeArticle('https://g1.globo.com/sp/noticia/something-here')).toBe(true);
    expect(looksLikeArticle('https://ssp.gov.br/noticias/operacao-policial')).toBe(true);
  });

  it('rejects root paths', () => {
    expect(looksLikeArticle('https://g1.globo.com/')).toBe(false);
  });

  it('rejects short paths', () => {
    expect(looksLikeArticle('https://g1.globo.com/sp/')).toBe(false);
  });

  it('rejects RSS/XML files', () => {
    expect(looksLikeArticle('https://g1.globo.com/feed.xml')).toBe(false);
    expect(looksLikeArticle('https://g1.globo.com/rss/feed.rss')).toBe(false);
  });

  it('rejects image files', () => {
    expect(looksLikeArticle('https://g1.globo.com/image.jpg')).toBe(false);
    expect(looksLikeArticle('https://g1.globo.com/photo.png')).toBe(false);
  });

  it('rejects CSS and JS files', () => {
    expect(looksLikeArticle('https://g1.globo.com/styles.css')).toBe(false);
    expect(looksLikeArticle('https://g1.globo.com/app.js')).toBe(false);
  });
});

describe('extractArticleLinks', () => {
  it('extracts matching domain links from content', () => {
    const content = `
      Check this article: https://g1.globo.com/2026/02/10/crime-in-sp.ghtml
      And this one: https://g1.globo.com/sp/noticia/policia-prende-suspeito.ghtml
      But not this: https://other-site.com/article
    `;

    const results = extractArticleLinks(content, 'g1.globo.com');
    expect(results).toHaveLength(2);
    expect(results[0].url).toContain('crime-in-sp');
    expect(results[1].url).toContain('policia-prende-suspeito');
  });

  it('deduplicates URLs', () => {
    const content = `
      https://g1.globo.com/sp/noticia/article-one-here-slug.ghtml
      Same link: https://g1.globo.com/sp/noticia/article-one-here-slug.ghtml
    `;

    const results = extractArticleLinks(content, 'g1.globo.com');
    expect(results).toHaveLength(1);
  });

  it('skips non-article URLs', () => {
    const content = `
      https://g1.globo.com/
      https://g1.globo.com/sp/
      https://g1.globo.com/style.css
    `;

    const results = extractArticleLinks(content, 'g1.globo.com');
    expect(results).toHaveLength(0);
  });

  it('returns empty for content without URLs', () => {
    const results = extractArticleLinks('No links here', 'g1.globo.com');
    expect(results).toEqual([]);
  });
});

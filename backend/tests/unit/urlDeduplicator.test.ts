import { normalizeUrl, deduplicateResults } from '../../src/services/search/urlDeduplicator';

describe('normalizeUrl', () => {
  it('removes protocol and www', () => {
    expect(normalizeUrl('https://www.g1.globo.com/sp/policia')).toBe('g1.globo.com/sp/policia');
    expect(normalizeUrl('http://www.g1.globo.com/sp/policia')).toBe('g1.globo.com/sp/policia');
  });

  it('removes trailing slashes', () => {
    expect(normalizeUrl('https://g1.globo.com/sp/policia/')).toBe('g1.globo.com/sp/policia');
    expect(normalizeUrl('https://g1.globo.com/sp/policia///')).toBe('g1.globo.com/sp/policia');
  });

  it('removes UTM tracking params', () => {
    const url = 'https://news.com/article?utm_source=google&utm_medium=cpc&id=123';
    expect(normalizeUrl(url)).toBe('news.com/article?id=123');
  });

  it('removes fbclid and gclid', () => {
    const url = 'https://news.com/article?fbclid=abc123&gclid=xyz789';
    expect(normalizeUrl(url)).toBe('news.com/article');
  });

  it('removes fragment (#)', () => {
    expect(normalizeUrl('https://news.com/article#comments')).toBe('news.com/article');
  });

  it('lowercases everything', () => {
    expect(normalizeUrl('https://NEWS.COM/Article')).toBe('news.com/article');
  });

  it('handles invalid URLs gracefully', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });

  it('preserves meaningful query params', () => {
    const url = 'https://news.com/search?q=crime&page=2';
    expect(normalizeUrl(url)).toBe('news.com/search?q=crime&page=2');
  });
});

describe('deduplicateResults', () => {
  it('removes duplicate URLs', () => {
    const results = [
      { url: 'https://g1.globo.com/article1', title: 'Title A', snippet: 'Snippet A' },
      { url: 'https://www.g1.globo.com/article1/', title: 'Title B', snippet: 'Snippet B' },
      { url: 'https://g1.globo.com/article2', title: 'Title C', snippet: 'Snippet C' },
    ];

    const unique = deduplicateResults(results);
    expect(unique).toHaveLength(2);
    expect(unique[0].title).toBe('Title A'); // keeps first occurrence
    expect(unique[1].title).toBe('Title C');
  });

  it('removes tracking param duplicates', () => {
    const results = [
      { url: 'https://news.com/article', title: 'A', snippet: 'S' },
      { url: 'https://news.com/article?utm_source=google', title: 'B', snippet: 'S' },
    ];

    const unique = deduplicateResults(results);
    expect(unique).toHaveLength(1);
  });

  it('returns empty for empty input', () => {
    expect(deduplicateResults([])).toEqual([]);
  });

  it('preserves order of first occurrences', () => {
    const results = [
      { url: 'https://a.com/1', title: 'First', snippet: 'S' },
      { url: 'https://b.com/2', title: 'Second', snippet: 'S' },
      { url: 'https://a.com/1', title: 'Third (dup)', snippet: 'S' },
      { url: 'https://c.com/3', title: 'Fourth', snippet: 'S' },
    ];

    const unique = deduplicateResults(results);
    expect(unique).toHaveLength(3);
    expect(unique.map(r => r.title)).toEqual(['First', 'Second', 'Fourth']);
  });
});

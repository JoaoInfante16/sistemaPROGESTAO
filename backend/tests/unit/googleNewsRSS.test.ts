import { parseRSSItems } from '../../src/services/search/GoogleNewsRSSProvider';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>crime São Paulo - Google News</title>
    <item>
      <title>Assalto em São Paulo deixa 2 feridos</title>
      <link>https://g1.globo.com/sp/sao-paulo/noticia/assalto.ghtml</link>
      <description>Dois homens foram baleados durante assalto na zona sul</description>
      <pubDate>Mon, 10 Feb 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title><![CDATA[PM prende suspeito de tráfico em Campinas]]></title>
      <link>https://r7.com/cidades/pm-prende-suspeito</link>
      <description><![CDATA[Operação policial resultou na apreensão de 5kg de cocaína]]></description>
      <pubDate>Mon, 10 Feb 2026 08:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const EMPTY_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test - Google News</title>
  </channel>
</rss>`;

const HTML_ENTITIES_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Crime &amp; Violência: &quot;Situação grave&quot;</title>
      <link>https://news.com/article</link>
      <description>Dados &lt;oficiais&gt; mostram aumento de 30%</description>
    </item>
  </channel>
</rss>`;

describe('parseRSSItems', () => {
  it('extracts items from valid RSS', () => {
    const results = parseRSSItems(SAMPLE_RSS);
    expect(results).toHaveLength(2);
  });

  it('extracts url, title, snippet correctly', () => {
    const results = parseRSSItems(SAMPLE_RSS);

    expect(results[0].url).toBe('https://g1.globo.com/sp/sao-paulo/noticia/assalto.ghtml');
    expect(results[0].title).toBe('Assalto em São Paulo deixa 2 feridos');
    expect(results[0].snippet).toBe('Dois homens foram baleados durante assalto na zona sul');
  });

  it('handles CDATA sections', () => {
    const results = parseRSSItems(SAMPLE_RSS);

    expect(results[1].title).toBe('PM prende suspeito de tráfico em Campinas');
    expect(results[1].snippet).toContain('apreensão de 5kg de cocaína');
  });

  it('returns empty for RSS with no items', () => {
    const results = parseRSSItems(EMPTY_RSS);
    expect(results).toEqual([]);
  });

  it('returns empty for invalid XML', () => {
    const results = parseRSSItems('not xml at all');
    expect(results).toEqual([]);
  });

  it('cleans HTML entities', () => {
    const results = parseRSSItems(HTML_ENTITIES_RSS);

    expect(results[0].title).toBe('Crime & Violência: "Situação grave"');
    expect(results[0].snippet).toBe('Dados <oficiais> mostram aumento de 30%');
  });

  it('uses title as fallback snippet when description is missing', () => {
    const rss = `<rss><channel><item>
      <title>Only title here</title>
      <link>https://example.com/article</link>
    </item></channel></rss>`;

    const results = parseRSSItems(rss);
    expect(results[0].snippet).toBe('Only title here');
  });
});

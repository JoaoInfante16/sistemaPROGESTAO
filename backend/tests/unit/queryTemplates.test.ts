import { QUERY_TEMPLATES, selectTemplates, buildQueries } from '../../src/services/search/queryTemplates';
import { MonitoredLocation } from '../../src/utils/types';

const mockLocation: MonitoredLocation = {
  id: 'loc-1',
  type: 'city',
  name: 'São Paulo',
  parent_id: 'state-sp',
  active: true,
  mode: 'any',
  keywords: null,
  scan_frequency_minutes: 60,
  last_check: null,
  created_at: new Date(),
};

const keywordLocation: MonitoredLocation = {
  ...mockLocation,
  mode: 'keywords',
  keywords: ['sequestro', 'extorsão'],
};

describe('QUERY_TEMPLATES', () => {
  it('has 5 templates', () => {
    expect(QUERY_TEMPLATES).toHaveLength(5);
  });

  it('template 0 (generico) uses default keywords for mode=any', () => {
    const query = QUERY_TEMPLATES[0].build(mockLocation);
    expect(query).toContain('crime polícia ocorrência');
    expect(query).toContain('São Paulo');
    expect(query).toContain('site:.br');
  });

  it('template 0 (generico) uses custom keywords for mode=keywords', () => {
    const query = QUERY_TEMPLATES[0].build(keywordLocation);
    expect(query).toContain('sequestro OR extorsão');
    expect(query).toContain('São Paulo');
  });

  it('template 1 (crimes graves) always uses fixed terms', () => {
    const query = QUERY_TEMPLATES[1].build(mockLocation);
    expect(query).toContain('homicídio OR latrocínio OR tráfico');
    expect(query).toContain('São Paulo');
  });

  it('all templates include city name and site:.br', () => {
    for (const template of QUERY_TEMPLATES) {
      const query = template.build(mockLocation);
      expect(query).toContain('São Paulo');
      expect(query).toContain('site:.br');
    }
  });
});

describe('selectTemplates', () => {
  it('selects correct number of templates', () => {
    expect(selectTemplates(0, 2)).toHaveLength(2);
    expect(selectTemplates(0, 3)).toHaveLength(3);
    expect(selectTemplates(0, 1)).toHaveLength(1);
  });

  it('clamps to 1-5 range', () => {
    expect(selectTemplates(0, 0)).toHaveLength(1);
    expect(selectTemplates(0, 10)).toHaveLength(5);
  });

  it('rotates through templates across scans', () => {
    const scan0 = selectTemplates(0, 2).map(t => t.id);
    const scan1 = selectTemplates(1, 2).map(t => t.id);
    const scan2 = selectTemplates(2, 2).map(t => t.id);

    // Different scans should pick different template sets
    expect(scan0).toEqual([0, 1]);
    expect(scan1).toEqual([2, 3]);
    expect(scan2).toEqual([4, 0]); // wraps around
  });

  it('wraps correctly with queriesPerScan=3', () => {
    const scan0 = selectTemplates(0, 3).map(t => t.id);
    const scan1 = selectTemplates(1, 3).map(t => t.id);

    expect(scan0).toEqual([0, 1, 2]);
    expect(scan1).toEqual([3, 4, 0]); // wraps around
  });
});

describe('buildQueries', () => {
  it('returns single query when multiQuery disabled', () => {
    const queries = buildQueries(mockLocation, {
      multiQueryEnabled: false,
      queriesPerScan: 3,
      scanIndex: 0,
    });

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('crime polícia ocorrência');
  });

  it('returns multiple queries when multiQuery enabled', () => {
    const queries = buildQueries(mockLocation, {
      multiQueryEnabled: true,
      queriesPerScan: 2,
      scanIndex: 0,
    });

    expect(queries).toHaveLength(2);
    expect(queries[0]).not.toBe(queries[1]); // different templates
  });

  it('uses custom keywords in generic template', () => {
    const queries = buildQueries(keywordLocation, {
      multiQueryEnabled: true,
      queriesPerScan: 1,
      scanIndex: 0,
    });

    expect(queries[0]).toContain('sequestro OR extorsão');
  });
});

// ============================================
// Geocodificacao via Nominatim (OpenStreetMap)
// ============================================
// Converte "bairro, cidade, estado" → {lat, lng}
// Cache em memoria pra nao repetir requests.
// Rate limit: 1 req/sec (politica do Nominatim).

import { logger } from '../../middleware/logger';

interface GeoResult {
  lat: number;
  lng: number;
}

// Cache em memoria: "bairro|cidade|estado" → {lat, lng}
const cache = new Map<string, GeoResult | null>();

function cacheKey(bairro: string, cidade: string, estado: string): string {
  return `${bairro.toLowerCase()}|${cidade.toLowerCase()}|${estado.toLowerCase()}`;
}

// Rate limit: 1 request por segundo
let lastRequest = 0;
async function rateLimitWait(): Promise<void> {
  const now = Date.now();
  const diff = now - lastRequest;
  if (diff < 1100) {
    await new Promise(resolve => setTimeout(resolve, 1100 - diff));
  }
  lastRequest = Date.now();
}

/**
 * Geocodifica um bairro usando Nominatim.
 * Retorna {lat, lng} ou null se nao encontrar.
 */
export async function geocodeBairro(
  bairro: string,
  cidade: string,
  estado: string,
): Promise<GeoResult | null> {
  const key = cacheKey(bairro, cidade, estado);

  // Check cache
  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }

  try {
    await rateLimitWait();

    const query = encodeURIComponent(`${bairro}, ${cidade}, ${estado}, Brasil`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SIMEops/1.0 (contact@progestao.com.br)',
      },
    });

    if (!response.ok) {
      logger.warn(`[Geocoding] Nominatim returned ${response.status} for "${bairro}, ${cidade}"`);
      cache.set(key, null);
      return null;
    }

    const data = await response.json() as Array<{ lat: string; lon: string }>;

    if (!data || data.length === 0) {
      // Tentar so com cidade (fallback)
      const cityKey = cacheKey('_city_', cidade, estado);
      if (!cache.has(cityKey)) {
        await rateLimitWait();
        const cityUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${cidade}, ${estado}, Brasil`)}&format=json&limit=1&countrycodes=br`;
        const cityRes = await fetch(cityUrl, {
          headers: { 'User-Agent': 'SIMEops/1.0 (contact@progestao.com.br)' },
        });
        const cityData = await cityRes.json() as Array<{ lat: string; lon: string }>;
        if (cityData && cityData.length > 0) {
          const cityResult = { lat: parseFloat(cityData[0].lat), lng: parseFloat(cityData[0].lon) };
          cache.set(cityKey, cityResult);
        } else {
          cache.set(cityKey, null);
        }
      }
      // Usar coordenada da cidade com pequeno offset aleatorio
      const cityCoord = cache.get(cacheKey('_city_', cidade, estado));
      if (cityCoord) {
        const jittered = {
          lat: cityCoord.lat + (Math.random() - 0.5) * 0.02,
          lng: cityCoord.lng + (Math.random() - 0.5) * 0.02,
        };
        cache.set(key, jittered);
        return jittered;
      }
      cache.set(key, null);
      return null;
    }

    const result: GeoResult = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };

    cache.set(key, result);
    logger.debug(`[Geocoding] ${bairro}, ${cidade} → ${result.lat}, ${result.lng}`);
    return result;
  } catch (error) {
    logger.error(`[Geocoding] Error for "${bairro}, ${cidade}": ${(error as Error).message}`);
    cache.set(key, null);
    return null;
  }
}

/**
 * Geocodifica uma lista de bairros em batch.
 * Retorna array com {bairro, count, lat, lng} (sem os que nao encontrou).
 */
export async function geocodeBairros(
  bairros: Array<{ bairro: string; count: number }>,
  cidade: string,
  estado: string,
): Promise<Array<{ bairro: string; count: number; lat: number; lng: number }>> {
  const results: Array<{ bairro: string; count: number; lat: number; lng: number }> = [];

  for (const b of bairros) {
    const geo = await geocodeBairro(b.bairro, cidade, estado);
    if (geo) {
      results.push({ bairro: b.bairro, count: b.count, lat: geo.lat, lng: geo.lng });
    }
  }

  return results;
}

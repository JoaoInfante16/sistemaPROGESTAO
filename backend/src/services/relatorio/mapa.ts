// ============================================
// O mapa que imprime
// ============================================
// **Por que não é Leaflet.** A página anterior desenhava um mapa interativo e,
// na hora do PDF, rodava html2canvas pra fotografar a `<div>` — porque Leaflet
// não imprime. Um passo que falha calado: se a captura desse errado, o PDF saía
// com um parágrafo de texto no lugar do mapa, e ninguém ficava sabendo.
//
// Aqui o mapa **já nasce impresso**: são os mesmos tiles da CartoCDN que o app
// usa, servidos como `<img>` posicionadas por CSS, com os pinos por cima. Zero
// JavaScript, zero canvas, zero passo que pode falhar — o navegador imprime
// imagem desde 1995.

/** O basemap é o mesmo do app (`crime_radar_map.dart`), no modo claro. */
const TILE = (z: number, x: number, y: number) =>
  `https://${'abcd'[(x + y) % 4]}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`;

const TAM = 256;

export interface Enquadramento {
  z: number;
  /** Pixel global do canto superior esquerdo do enquadramento. */
  ox: number;
  oy: number;
  /** Tamanho da camada **antes** da escala — nela é que tiles e pinos moram. */
  largura: number;
  altura: number;
  /** Fator aplicado na camada inteira. É o que dá zoom contínuo. */
  escala: number;
  tiles: Array<{ url: string; left: number; top: number }>;
}

/** Web Mercator: lat/lng → pixel global no zoom `z`. */
export function paraPixel(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = TAM * Math.pow(2, z);
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

/**
 * Enquadra os pontos na caixa, com **zoom contínuo**.
 *
 * 🚨 A primeira versão só escolhia zoom inteiro, e isso é grave de um jeito
 * pouco óbvio: zoom de mapa é potência de 2, então "não coube por 11 pixels"
 * custa **metade da escala**. Medido em 12/08 com os 15 bairros da Grande
 * Florianópolis: no zoom 11 a mancha media 400×360 e a caixa aceitava 349 de
 * altura — errou por 11px, caiu pro zoom 10, e os pinos passaram a ocupar um
 * terço da largura da folha. O documento virava uma foto de satélite de Santa
 * Catarina com um punhado de marcas no meio.
 *
 * O conserto é renderizar no zoom inteiro **de cima** (dado maior que a caixa)
 * e encolher a camada inteira por `transform: scale()`. Tile continua sendo
 * imagem em zoom inteiro — a única coisa que existe —, mas o enquadramento
 * passa a ser contínuo. Como os tiles vêm em `@2x` e são exibidos a 256, sobra
 * densidade de sobra pra encolher sem borrar.
 */
export function enquadrar(
  pontos: Array<{ lat: number; lng: number }>,
  caixaL: number,
  caixaA: number,
): Enquadramento | null {
  if (pontos.length === 0) return null;

  const lats = pontos.map((p) => p.lat);
  const lngs = pontos.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const centro = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };

  // 10% de folga pra nenhum pino nascer colado na borda.
  const folga = 0.9;

  // O maior zoom inteiro em que a mancha ainda cabe. Teto 16: uma ocorrência
  // sozinha não deve virar foto de quintal. Piso 8: nem mapa do continente.
  let z = 16;
  const spanEm = (zz: number) => {
    const a = paraPixel(minLat, minLng, zz);
    const b = paraPixel(maxLat, maxLng, zz);
    return { w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  };
  for (; z > 8; z--) {
    const { w, h } = spanEm(z);
    if (w <= caixaL * folga && h <= caixaA * folga) break;
  }

  // Um zoom acima: agora a mancha transborda, e a escala traz ela de volta —
  // é aí que os pixels desperdiçados voltam pro documento.
  const zAlto = Math.min(16, z + 1);
  const { w, h } = spanEm(zAlto);

  // Ponto único (ou todos no mesmo lugar): não há mancha pra ajustar, e dividir
  // por zero daria escala infinita. Fica no zoom escolhido, sem encolher.
  const escala = (w < 1 && h < 1)
    ? 1
    : Math.min((caixaL * folga) / Math.max(w, 1), (caixaA * folga) / Math.max(h, 1), 1);

  z = zAlto;

  // A camada é maior que a caixa na razão inversa da escala: depois do
  // `scale(escala)` ela ocupa exatamente a caixa.
  const largura = caixaL / escala;
  const altura = caixaA / escala;

  const c = paraPixel(centro.lat, centro.lng, z);
  const ox = c.x - largura / 2;
  const oy = c.y - altura / 2;

  const tiles: Enquadramento['tiles'] = [];
  const limite = Math.pow(2, z);
  const x0 = Math.floor(ox / TAM), x1 = Math.floor((ox + largura) / TAM);
  const y0 = Math.floor(oy / TAM), y1 = Math.floor((oy + altura) / TAM);
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= limite) continue;
    for (let tx = x0; tx <= x1; tx++) {
      // Wrap horizontal — só importa perto do antimeridiano, mas custa uma linha.
      const wx = ((tx % limite) + limite) % limite;
      tiles.push({ url: TILE(z, wx, ty), left: tx * TAM - ox, top: ty * TAM - oy });
    }
  }

  return { z, ox, oy, largura, altura, escala, tiles };
}

// ============================================
// Tiles embutidos — para o PDF
// ============================================
// A WebView que converte o HTML em PDF pode tirar a foto **antes** das imagens
// da rede chegarem: o mapa sairia branco, calado. É a mesma armadilha do
// html2canvas que a Fase E2 removeu, entrando por outra porta.
//
// A resposta é não ter imagem de rede nenhuma. O cache é por `z/x/y` e vale
// muito: relatórios da mesma cidade pedem exatamente os mesmos tiles.

const cacheDeTiles = new Map<string, string>();

/** Teto do cache: 400 tiles ≈ 20-30 MB. Passou disso, esvazia — é cache de
 *  imagem estática, reconstruir custa uma requisição. */
const TETO_DO_CACHE = 400;

/**
 * Troca as URLs dos tiles por `data:` URIs.
 *
 * Falha de um tile **não derruba o mapa**: aquele quadrado fica vazio e o
 * resto aparece. Mapa com um buraco é melhor que mapa nenhum, e muito melhor
 * que um erro que impede o relatório de sair.
 */
export async function embutirTiles(q: Enquadramento): Promise<Enquadramento> {
  const tiles = await Promise.all(
    q.tiles.map(async (t) => {
      const emCache = cacheDeTiles.get(t.url);
      if (emCache) return { ...t, url: emCache };
      try {
        const resp = await fetch(t.url, {
          headers: { 'User-Agent': 'SIMEops/1.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) return { ...t, url: '' };
        const b64 = Buffer.from(await resp.arrayBuffer()).toString('base64');
        const dataUri = `data:image/png;base64,${b64}`;
        if (cacheDeTiles.size >= TETO_DO_CACHE) cacheDeTiles.clear();
        cacheDeTiles.set(t.url, dataUri);
        return { ...t, url: dataUri };
      } catch {
        return { ...t, url: '' };
      }
    }),
  );
  return { ...q, tiles: tiles.filter((t) => t.url !== '') };
}

/**
 * Executa promises com limite de concorrência.
 * PRESERVA A ORDEM dos resultados (results[i] corresponde a items[i]).
 * Substitui p-limit (que é ESM-only em v5).
 */
export async function asyncPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < items.length; i++) {
    const index = i;
    const promise = fn(items[index]).then((result) => {
      results[index] = result; // Preserva ordem via índice
    });

    const wrapped = promise.then(() => {
      executing.delete(wrapped);
    });
    executing.add(wrapped);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Cosine similarity entre dois vetores.
 * Retorna valor entre -1 e 1 (1 = idênticos, 0 = ortogonais).
 * Usado na deduplicação para comparar embeddings.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error(`Vector length mismatch: ${vecA.length} vs ${vecB.length}`);
  }

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Normaliza texto para comparação: lowercase, remove acentos.
 * Usado para matching de cidade/estado no filtro pós-Filter2.
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Limpa o ruido que o GPT costuma anexar ao nome da cidade, pra permitir
 * comparacao por IGUALDADE em vez de substring.
 *
 * O Filter2 devolve coisas como "Salvador (BA)", "Sao Jose - SC" ou
 * "Municipio de Palhoca" \u2014 foi por isso que o pos-filtro passou a aceitar match
 * parcial. So que `includes` deixa passar cidade que apenas COMECA igual:
 * medido em 02/08/2026, 10 das 34 noticias de "Sao Jose" no banco eram de
 * **Sao Jose do Cedro**, a 600km, porque `"sao jose do cedro".includes("sao
 * jose")` e true e o estado bate. Limpar e comparar exato resolve os dois lados.
 *
 * `estado` opcional cobre o sufixo por extenso ("Sao Jose - Santa Catarina").
 *
 * NAO corta no hifen de proposito: `Embu-Guacu` e `Embu` sao municipios
 * distintos de SP, e cortar ali fundiria um no outro \u2014 trocaria um falso
 * positivo por outro.
 */
export function limparNomeCidade(nome: string, estado?: string): string {
  let s = normalizeText(nome || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')            // "salvador (ba)"
    .replace(/^(municipio|cidade)\s+de\s+/, '')  // "municipio de palhoca"
    .replace(/\s+/g, ' ')
    .trim();

  if (estado) {
    const alvo = normalizeText(estado).trim();
    if (alvo) s = s.replace(new RegExp(`\\s*[-\u2013/,]\\s*${escaparRegex(alvo)}\\s*$`), '');
  }

  // Sufixo de UF de 2 letras depois de separador: "sao jose - sc", "salvador/ba".
  // Nenhum municipio brasileiro termina em " - XX", entao e seguro.
  s = s.replace(/\s*[-\u2013/,]\s*[a-z]{2}\s*$/, '');

  return s.trim();
}

/** Mesma cidade? Igualdade exata depois da limpeza. Ver `limparNomeCidade`. */
export function mesmaCidade(a: string, b: string, estado?: string): boolean {
  const x = limparNomeCidade(a, estado);
  return x.length > 0 && x === limparNomeCidade(b, estado);
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

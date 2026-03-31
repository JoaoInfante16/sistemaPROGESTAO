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

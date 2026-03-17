import { cosineSimilarity } from '../../src/utils/helpers';

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const vec = [0.1, 0.2, 0.3, 0.4];
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 5);
  });

  it('should return -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 5);
  });

  it('should return high similarity for similar vectors', () => {
    const a = [0.1, 0.2, 0.3, 0.4, 0.5];
    const b = [0.11, 0.19, 0.31, 0.39, 0.51];
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.99);
  });

  it('should return low similarity for different vectors', () => {
    const a = [1, 0, 0, 0];
    const b = [0, 0, 0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  it('should handle high-dimensional vectors (1536 like OpenAI)', () => {
    const a = Array.from({ length: 1536 }, (_, i) => Math.sin(i));
    const b = Array.from({ length: 1536 }, (_, i) => Math.sin(i + 0.01));
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0.99);
    expect(sim).toBeLessThanOrEqual(1.0);
  });

  it('should throw for vectors of different lengths', () => {
    expect(() => cosineSimilarity([1, 2, 3], [1, 2])).toThrow('Vector length mismatch');
  });

  it('should return 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it('should be commutative (a,b) === (b,a)', () => {
    const a = [0.3, -0.1, 0.5];
    const b = [0.1, 0.4, -0.2];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});

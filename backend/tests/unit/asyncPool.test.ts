import { asyncPool } from '../../src/utils/helpers';

describe('asyncPool', () => {
  describe('order preservation', () => {
    it('should return results in the same order as input', async () => {
      const items = [100, 50, 200, 10, 150]; // Different delays
      const results = await asyncPool(items, 3, async (ms) => {
        await new Promise((r) => setTimeout(r, ms));
        return `done-${ms}`;
      });

      expect(results).toEqual([
        'done-100',
        'done-50',
        'done-200',
        'done-10',
        'done-150',
      ]);
    });

    it('should preserve order even with concurrency 1', async () => {
      const items = [3, 1, 2];
      const results = await asyncPool(items, 1, async (n) => n * 10);
      expect(results).toEqual([30, 10, 20]);
    });
  });

  describe('concurrency control', () => {
    it('should not exceed max concurrency', async () => {
      let activeCount = 0;
      let maxActive = 0;

      const items = Array.from({ length: 10 }, (_, i) => i);

      await asyncPool(items, 3, async () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await new Promise((r) => setTimeout(r, 50));
        activeCount--;
        return true;
      });

      expect(maxActive).toBeLessThanOrEqual(3);
    });

    it('should process all items with concurrency higher than item count', async () => {
      const items = [1, 2, 3];
      const results = await asyncPool(items, 100, async (n) => n * 2);
      expect(results).toEqual([2, 4, 6]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', async () => {
      const results = await asyncPool([], 5, async (n: number) => n);
      expect(results).toEqual([]);
    });

    it('should handle single item', async () => {
      const results = await asyncPool([42], 5, async (n) => n * 2);
      expect(results).toEqual([84]);
    });

    it('should propagate errors', async () => {
      await expect(
        asyncPool([1, 2, 3], 2, async (n) => {
          if (n === 2) throw new Error('test error');
          return n;
        })
      ).rejects.toThrow('test error');
    });
  });
});

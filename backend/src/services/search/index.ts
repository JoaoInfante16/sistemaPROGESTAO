import { SearchProvider } from './SearchProvider';
import { GoogleSearchProvider } from './GoogleSearchProvider';
import { config } from '../../config';

export function createSearchProvider(): SearchProvider {
  const backend = config.searchBackend;

  switch (backend) {
    case 'google':
      return new GoogleSearchProvider();
    // Futuro: case 'serpapi': return new SerpAPIProvider();
    default:
      throw new Error(`Unknown search backend: ${backend}`);
  }
}

export * from './SearchProvider';
export { GoogleSearchProvider } from './GoogleSearchProvider';

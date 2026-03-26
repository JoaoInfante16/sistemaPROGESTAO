import { SearchProvider } from './SearchProvider';
import { GoogleSearchProvider } from './GoogleSearchProvider';
import { PerplexitySearchProvider } from './PerplexitySearchProvider';
import { BraveNewsProvider } from './BraveNewsProvider';
import { config } from '../../config';

export function createSearchProvider(): SearchProvider {
  const backend = config.searchBackend;

  switch (backend) {
    case 'google':
      return new GoogleSearchProvider();
    case 'perplexity':
      return new PerplexitySearchProvider();
    case 'brave':
      return new BraveNewsProvider();
    default:
      throw new Error(`Unknown search backend: ${backend}`);
  }
}

export * from './SearchProvider';
export { GoogleSearchProvider } from './GoogleSearchProvider';
export { PerplexitySearchProvider } from './PerplexitySearchProvider';
export { BraveNewsProvider } from './BraveNewsProvider';

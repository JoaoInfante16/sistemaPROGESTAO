import { ContentFetcher } from './ContentFetcher';
import { JinaContentFetcher } from './JinaContentFetcher';
import { CachedContentFetcher } from './CachedContentFetcher';
import { config } from '../../config';

export function createContentFetcher(): ContentFetcher {
  const backend = config.contentBackend;

  let fetcher: ContentFetcher;

  switch (backend) {
    case 'jina':
      fetcher = new JinaContentFetcher();
      break;
    // Futuro: case 'firecrawl': fetcher = new FirecrawlFetcher(); break;
    default:
      throw new Error(`Unknown content backend: ${backend}`);
  }

  // Wrap com cache (TTL configurável via CACHE_JINA_CONTENT_TTL)
  return new CachedContentFetcher(fetcher);
}

export * from './ContentFetcher';
export { JinaContentFetcher } from './JinaContentFetcher';
export { CachedContentFetcher } from './CachedContentFetcher';

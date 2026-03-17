import OpenAI from 'openai';
import { EmbeddingProvider, EmbeddingResult } from './EmbeddingProvider';
import { config } from '../../config';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.openaiEmbeddingModel;
  }

  async generate(text: string): Promise<EmbeddingResult> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });

    return {
      embedding: response.data[0].embedding,
      tokensUsed: response.usage.total_tokens,
    };
  }

  async generateBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });

    const tokensPerItem = Math.ceil(response.usage.total_tokens / texts.length);

    return response.data.map((item) => ({
      embedding: item.embedding,
      tokensUsed: tokensPerItem,
    }));
  }
}

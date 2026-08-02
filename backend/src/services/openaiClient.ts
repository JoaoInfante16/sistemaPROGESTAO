// ============================================
// Client OpenAI compartilhado
// ============================================
// Existia um `new OpenAI(...)` em SEIS arquivos (filter1, filter2, dedup,
// embedding, executive, metroRegion), cada um com a config sozinho. Centralizar
// e o que garante que uma opcao nova nao entre em cinco e falte no sexto — foi
// exatamente o caso do timeout abaixo.
//
// TIMEOUT: o default do SDK e **600.000 ms (10 minutos)**. Numa busca manual
// que o app abandona em 10 min, uma unica chamada pendurada consome a janela
// inteira. E com `maxRetries: 2`, o pior caso do default sao 30 minutos.
//
// 60s cobre folgado o caso real: o Filter2 le ate `filter2_max_content_chars`
// (8000 por default) e responde em segundos. Passou de 60s, nao vem.
//
// `maxRetries` fica no default (2): erro de rede em chamada curta e comum e a
// repeticao e barata — o problema nunca foi o retry, e sim o tempo de cada
// tentativa.

import OpenAI from 'openai';
import { config } from '../config';

const OPENAI_TIMEOUT_MS = 60_000;

export const openai = new OpenAI({
  apiKey: config.openaiApiKey,
  timeout: OPENAI_TIMEOUT_MS,
});

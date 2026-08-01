// ============================================
// Nomes de fila POR AMBIENTE
// ============================================
// Staging, producao e dev local compartilham o MESMO Upstash Redis (e o mesmo
// Supabase). Ate 2026-08-01 as filas BullMQ tinham nome fixo — entao o worker
// de PRODUCAO (rodando main desatualizada) competia com o de staging pelos
// mesmos jobs e ganhava a maioria. Resultado: Joao testava a busca manual no
// APK de staging, o job era processado pelo codigo VELHO de producao, e a
// busca voltava 1 resultado enquanto o mesmo codigo em staging achava 18.
// Um `npm run dev` local esquecido causa o mesmo roubo.
//
// Producao fica com o nome puro de proposito: quando `main` for atualizada com
// este codigo, nada muda para o app do cliente. Os outros ambientes ganham
// sufixo e passam a so falar com os proprios workers.

import { config } from '../config';

export function queueName(base: string): string {
  return config.nodeEnv === 'production' ? base : `${base}-${config.nodeEnv}`;
}

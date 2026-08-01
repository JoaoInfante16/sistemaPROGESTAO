// ============================================
// Parser das datas que o SERP devolve no indice de noticias
// ============================================
// O Google mistura formato relativo ("2 semanas atras", "ha 3 horas") com
// absoluto ("6 de jun. de 2026"). Precisamos disso pra saber quando parar de
// paginar com `sbd:1` — sem parse, a unica alternativa e puxar N paginas fixas
// e jogar fora depois (que e o que se fazia ate 2026-08-01).
//
// Imprecisao e aceitavel: isto NAO decide se um artigo entra no resultado — o
// Filter2 faz isso lendo a data da ocorrencia no corpo do texto. Aqui so se
// decide se vale a pena pedir a proxima pagina.

const MESES: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
};

const UNIDADE_MS: Record<string, number> = {
  segundo: 1000,
  minuto: 60_000,
  hora: 3_600_000,
  dia: 86_400_000,
  semana: 604_800_000,
  mes: 2_592_000_000,   // 30 dias
  ano: 31_536_000_000,  // 365 dias
};

/**
 * Converte a string de data do SERP em Date. Retorna null se nao reconhecer.
 * Aceita: "há 3 horas", "2 semanas atrás", "1 mês atrás", "6 de jun. de 2026",
 * "06/06/2026".
 */
export function parseSerpDate(raw: string | undefined, now: Date = new Date()): Date | null {
  if (!raw) return null;

  const s = raw.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acento: "mês" -> "mes"
    .trim();

  // --- Relativo: "ha 3 horas", "2 semanas atras", "1 mes atras"
  const rel = s.match(/(\d+)\s*(segundo|minuto|hora|dia|semana|mes|mese|ano)s?/);
  if (rel) {
    const n = parseInt(rel[1], 10);
    // "meses" cai no grupo "mese" — normaliza
    const unidade = rel[2] === 'mese' ? 'mes' : rel[2];
    const ms = UNIDADE_MS[unidade];
    if (ms && !isNaN(n)) return new Date(now.getTime() - n * ms);
  }

  // "ontem" / "hoje"
  if (s.includes('ontem')) return new Date(now.getTime() - UNIDADE_MS.dia);
  if (s.includes('hoje') || s.includes('agora')) return new Date(now.getTime());

  // --- Absoluto pt-BR: "6 de jun. de 2026" (o ano as vezes some em datas do ano corrente)
  const abs = s.match(/(\d{1,2})\s+de\s+([a-z]{3})[a-z.]*\s*(?:de\s+(\d{4}))?/);
  if (abs) {
    const dia = parseInt(abs[1], 10);
    const mes = MESES[abs[2]];
    const ano = abs[3] ? parseInt(abs[3], 10) : now.getFullYear();
    if (mes !== undefined && !isNaN(dia)) {
      const d = new Date(ano, mes, dia);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // --- Numerico: "06/06/2026" ou "06/06/26"
  const num = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (num) {
    const dia = parseInt(num[1], 10);
    const mes = parseInt(num[2], 10) - 1;
    let ano = parseInt(num[3], 10);
    if (ano < 100) ano += 2000;
    const d = new Date(ano, mes, dia);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/** Converte `dateRestrict` ('d30') no inicio da janela. */
export function inicioDaJanela(dateRestrict: string | undefined, now: Date = new Date()): Date | null {
  if (!dateRestrict) return null;
  const m = dateRestrict.match(/^d(\d+)$/);
  if (!m) return null;
  const dias = parseInt(m[1], 10);
  if (isNaN(dias)) return null;
  return new Date(now.getTime() - dias * UNIDADE_MS.dia);
}

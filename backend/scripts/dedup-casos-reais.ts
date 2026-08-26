// ============================================
// Gabarito de dedup — pares REAIS de producao, rotulados a mao
// ============================================
// Levantado em 2026-08-24 sobre as 59 noticias que entraram depois do conserto
// de 17/08. Serve para que qualquer mudanca no dedup (prompt, limiar, portao)
// seja MEDIDA em vez de adivinhada — e para que a proxima pessoa nao precise
// refazer a revisao um a um, que e a parte cara.
//
// 🚨 REGRA DESTE ARQUIVO: aqui moram **ids e julgamento**, nunca copia de
// titulo ou resumo. O texto vem do banco na hora de rodar. Copia de dado
// apodrece calada — e este arquivo existe justamente para ser a verdade.
//
// A regra de produto que rege os rotulos (decisao do Joao, 24/08, tomada com o
// caso da menina de 4 anos na frente):
//
//   🚨 **E UM CASO SO.** O crime, a operacao que prende, a prisao e o
//   desdobramento da investigacao pertencem a MESMA linha, com as fontes
//   somadas. O feed mostra o CASO, nao cada cobertura dele.
//
// ⚠️ Uma hora antes o Joao tinha dito o oposto ("prisao e fato novo"). A
// reversao foi feita olhando as tres linhas reais da menina de 4 anos, onde a
// MESMA prisao aparece narrada antes e depois de a crianca morrer. Fica
// registrado porque a versao anterior deste arquivo usava a regra antiga.

export type Rotulo = 'IGUAL' | 'DIFERENTE';

export interface CasoDedup {
  /** Prefixo de 8 chars do uuid — o script resolve para a linha inteira. */
  a: string;
  b: string;
  esperado: Rotulo;
  /** Por que. E a unica parte que nao da para redescobrir sozinho. */
  porque: string;
  /**
   * `true` = sabemos que o desenho atual NAO pega este caso, e tudo bem.
   *
   * ⚠️ Fica FORA do criterio de aprovacao de proposito. Bateria que nasce
   * vermelha para sempre ensina todo mundo a ignora-la.
   */
  falhaConhecida?: boolean;
}

export const CASOS: CasoDedup[] = [
  // ────────────────────────────────────────────────────────────
  // IGUAL — o dedup novo TEM que pegar
  // ────────────────────────────────────────────────────────────

  // ── o carro na loja de Palhoca: 3 linhas, 3 tipos, 1 fato ──
  {
    a: '43eef7e6', b: '631e5086', esperado: 'IGUAL',
    porque: 'Mesmo carro, mesma loja, mesmo dia. Caiu em `vandalismo` e `invasao` ' +
            'porque um texto enfatiza o prejuizo e o outro a invasao. cosine 0.9513.',
  },
  {
    a: '631e5086', b: '6c62639f', esperado: 'IGUAL',
    porque: 'Terceira copia do mesmo carro na loja, desta vez em `outros` e com ' +
            '`data_ocorrencia` um dia atras.',
  },

  // ── Operacao Boreal ──
  {
    a: '056a373b', b: '4cd4ec1c', esperado: 'IGUAL',
    porque: 'Os titulos diferem em UMA LETRA (`roubos`/`roubo`) e os tipos sao ' +
            '`operacao_policial` e `roubo_furto`. O caso mais puro de portao ' +
            'fechando por campo que o proprio GPT inventou.',
  },
  {
    a: '056a373b', b: '7c1a48c9', esperado: 'IGUAL',
    porque: 'Os dois resumos dizem "Operacao Boreal" com todas as letras. Difere ' +
            'o numero de presos (seis x cinco) — contagem de veiculo, nao evento ' +
            'diferente. Antes de 24/08 o GPT respondia NO por ler isso como ' +
            'contradicao.',
  },

  // ── a chacina de Rubem Berta: 4 linhas, 1 caso, os TRES modos de falha ──
  // 🚨 O melhor caso de teste que temos. Se o dedup resolver este, resolveu o
  // problema: `b04c143b` caiu em `operacao_policial` contra `homicidio` dos
  // outros (portao de tipo), oito x SETE presos entre veiculos no mesmo dia
  // (contagem lida como contradicao), e `0be148d9` e o desdobramento da
  // investigacao (a regra "e um caso so").
  {
    a: '5d1a9168', b: '9fe1f644', esperado: 'IGUAL',
    porque: 'A mesma Operacao Ad Extremum, nomeada no resumo de `9fe1f644`. ' +
            'Divergem em oito x sete presos — mesma divergencia de contagem do ' +
            'caso Boreal.',
  },
  {
    a: '5d1a9168', b: 'b04c143b', esperado: 'IGUAL',
    porque: 'Pareciam duas operacoes de "oito presos" diferentes; a evidencia diz ' +
            'que nao. Mesmo bairro (Rubem Berta), mesma data, e `b04c143b` nomeia ' +
            'a Operacao Ad Extremum, a mesma de `9fe1f644`. Tipos `homicidio` e ' +
            '`operacao_policial`.',
  },
  {
    a: '5d1a9168', b: '0be148d9', esperado: 'IGUAL',
    porque: '🚨 O caso que define a regra do Joao. `0be148d9` e o desdobramento da ' +
            'investigacao sobre a MESMA chacina (quatro mortos, julho de 2025, ' +
            'Cohab Rubem Berta); `5d1a9168` e a prisao dos suspeitos. Pela regra ' +
            '"e um caso so", fundem.',
  },

  // ── a menina de 4 anos: o caso que fez o Joao reverter a regra ──
  {
    a: '8d3709ca', b: '555bcc01', esperado: 'IGUAL',
    porque: 'A morte da menina e a prisao do tio pela morte. Sao o mesmo caso. ' +
            'Foi olhando estas linhas que a regra virou "e um caso so".',
  },
  {
    a: 'c3f3cfc9', b: '555bcc01', esperado: 'IGUAL',
    porque: 'A MESMA prisao narrada antes e depois de a menina morrer — por isso ' +
            'os tipos sao `lesao_corporal` e `homicidio`. 🚨 Ao fundir, a linha ' +
            'tem que virar `homicidio`: o relatorio conta por tipo, e manter ' +
            '`lesao_corporal` subnotifica um homicidio.',
  },

  // ── outros ──
  {
    a: '8cd74d81', b: '1cd119cc', esperado: 'IGUAL',
    porque: 'Mesmo confronto em Palhoca, no mesmo dia: um texto chama de ' +
            '"confronto com a policia", o outro de "operacao policial". Tipos ' +
            '`trafico` e `operacao_policial`.',
  },
  {
    a: 'b8e29964', b: '0e17b536', esperado: 'IGUAL',
    porque: 'Mesma confusao entre torcidas no mesmo jogo, na Ressacada. Tipos ' +
            '`lesao_corporal` e `invasao`. Ficou abaixo do corte de 0.78 do ' +
            'levantamento automatico — so apareceu na revisao a mao.',
  },

  // ── os dois que a REVISAO A MAO perdeu e a simulacao de 26/08 achou ──
  // 🚨 Estes dois nao vieram de revisao humana: sairam da simulacao completa
  // (`scripts/simular-dedup.ts`) sobre as 70 noticias desde 18/08, e so entao
  // foram conferidos a mao, linha por linha, no banco. Ficam registrados porque
  // sao a prova de que o levantamento manual de 24/08 era incompleto — e porque
  // o segundo mostra um cluster de TRES, nao de dois.
  {
    a: '55336060', b: 'a765e601', esperado: 'IGUAL',
    porque: 'Mesmo homem de 23 anos, mesma data, mesma vitima adolescente, mesma ' +
            'extorsao com ameaca de vazar fotos intimas — `a765e601` nomeia a ' +
            'Operacao Escudo Digital. ⚠️ O titulo de `55336060` diz "em Ubirata", ' +
            'que e de onde a VITIMA e, nao onde o crime foi; os dois estao ' +
            'gravados em Florianopolis. Tipos `outros` e `estelionato` — mais um ' +
            'caso do balde `outros` que o ROADMAP manda revisar.',
  },
  {
    a: '8cd74d81', b: '75f24b0e', esperado: 'IGUAL',
    porque: 'TERCEIRA linha do confronto em Palhoca (as outras duas sao o par ' +
            '`8cd74d81/1cd119cc` acima) — o cluster e de tres, nao de dois. O ' +
            'proprio resumo de `8cd74d81` diz "Barricadas foram montadas em ' +
            'represalia" e o de `75f24b0e` diz "reacao a um confronto policial ' +
            'que deixou um baleado": os textos se citam. Mesmo bairro (Caminho ' +
            'Novo), mesma data. Tipos `trafico` e `bloqueio_via`.',
  },

  // ── IGUAL que o desenho NAO pega, e esta tudo bem ──
  {
    a: 'd1a6ca57', b: '8f5b7a86', esperado: 'IGUAL', falhaConhecida: true,
    porque: 'Mesma denuncia do MP/GAECO a 12 pessoas por trafico. As cidades ' +
            'GRAVADAS diferem — `Palhoca` e `Florianopolis` — porque o Filter2 ' +
            'pendura fato de alcance estadual na cidade que disparou a query. ' +
            '⚠️ O campo NAO esta sujo: o banco so tem municipios reais; o "SC" ' +
            'aparece apenas no texto da manchete. Como `cidade` continua sendo ' +
            'portao da camada 1 (e o unico campo do trio que resiste), este caso ' +
            'e invisivel por design. Ver o modo C no plano.',
  },

  // ────────────────────────────────────────────────────────────
  // DIFERENTE — protegem contra fundir a mais
  // ────────────────────────────────────────────────────────────
  {
    a: 'a74bb14b', b: 'a3f6f0cf', esperado: 'DIFERENTE',
    porque: 'Dois atropelamentos distintos em Florianopolis. Um e pedestre com ' +
            'traumatismo na SC-402; o outro e briga de transito em que o motorista ' +
            'atropela o motociclista. cosine 0.804 e o GPT ja acerta — este caso ' +
            'existe para PROTEGER contra o afrouxamento.',
  },
  {
    a: 'd1cac65a', b: '094ac376', esperado: 'DIFERENTE',
    porque: 'Os dois bloqueiam a BR-101 em Palhoca e sao `bloqueio_via`, mas um e ' +
            'caminhao tombado e o outro incendio em veiculo, com cinco dias de ' +
            'distancia. Mesmo lugar e mesmo tipo nao fazem mesmo fato.',
  },
  {
    a: 'd1a6ca57', b: '8cd74d81', esperado: 'DIFERENTE',
    porque: 'Ambos sao trafico em Palhoca e o cosine da 0.801, mas um e a denuncia ' +
            'de 12 pessoas pela Operacao Caminho Sem Volta e o outro e um confronto ' +
            'com um ferido.',
  },
];

/** Os que valem como criterio de aprovacao (exclui as falhas conhecidas). */
export const CASOS_COBRADOS = CASOS.filter((c) => !c.falhaConhecida);

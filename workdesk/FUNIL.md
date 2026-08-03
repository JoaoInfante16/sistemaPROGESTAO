# O Funil — de onde saem os números da busca manual

> 📌 **Documento vivo** — descreve como o pipeline funciona hoje e é editado
> in-place quando ele muda. Não é arquivado com a fase.
>
> Escrito em 2026-08-03, depois das reformas da Fase 8 e do frontend da Fase 9.
> Nasceu de uma pergunta concreta do João: *"só 11 em Goiânia em 30 dias? cadê
> aquele monte que tava vindo antes?"* — e a resposta exigiu abrir o pipeline
> inteiro.
>
> **Leia junto:** [API_CONTRATO.md](./API_CONTRATO.md) (shapes das rotas) e
> [ARQUITETURA.md](./ARQUITETURA.md) (como o sistema é montado).

---

## 1. A pergunta que este documento responde

Uma busca diz "77 resultados" e a seguinte diz "11". Nenhuma das duas está
errada — mas sem enxergar o funil parece que o sistema quebrou. Este documento
mostra **onde cada item morre** e **qual alavanca mexe em quê**.

---

## 2. Os sete estágios

O que o app mostra como cinco blocos são sete estágios no servidor. Os
estágios **4 e 5 são ~85% do tempo** e os únicos com contador `feitos/total`.

| # | estágio | o que faz | custo | contador? |
|---|---|---|---|---|
| 1 | `searching` | Bright Data SERP: várias queries × páginas | 💰 SERP | não |
| 2 | `filter0` | regex local: bloqueia domínio e keyword | grátis | não |
| 3 | `filter1` | GPT em lote decide YES/NO só pelo título | 💰 GPT | não |
| 4 | `fetching` | Jina baixa o texto de cada artigo | 💰 Jina | **sim** |
| 5 | `analyzing` | Filter2 (GPT full) + pós-filtro + embedding | 💰 GPT | **sim** + achados |
| 6 | `dedup` | agrupa matérias do mesmo evento (intra-batch) | quase grátis | não |
| 7 | `saving` | grava e devolve | grátis | não |

⚠️ **Não existe dedup contra o banco na busca manual.** Os dois dedups dela
(`deduplicateResults` de URL e `runIntraBatchDedupLayered`) olham **só o próprio
lote**. Buscar uma cidade que o auto-scan já monitora **não** perde resultado por
já estar no banco — o dedup contra `news` é do auto-scan, para não repetir
notícia no feed.

---

## 3. Números reais (medidos em 02 e 03/08, buscas de verdade)

| cidade | período | 2. URLs | 3. p/ GPT | 4. artigos | 5. conteúdos | 6. consolidando | entregue |
|---|---|---|---|---|---|---|---|
| Campo Grande | 60d | 321 | 269 | 253 | 241 | 151 | **77** |
| Salvador | 30d | 202 | 176 | 161 | 159 | 125 | **54** |
| São Paulo | 90d | 185 | 175 | 141 | 139 | 92 | **60** |
| **Goiânia** | 30d | **106** | 101 | 82 | 74 | **27** | **11** |
| Vitória | 30d | 85 | 71 | 50 | 48 | 5 | **5** |

**A leitura que importa:** a diferença entre Goiânia e Salvador (mesmo período)
nasce em **dois lugares distintos**, e confundir os dois leva a mexer na alavanca
errada:

1. **Coleta** — Goiânia rendeu 106 URLs contra 202 de Salvador. Metade. É o teto
   do índice do Google por cidade: menos matéria indexada para as queries atuais.
2. **Extração** — dos conteúdos lidos, Salvador manteve 79% (159 → 125) e Goiânia
   só 36% (74 → 27). Aqui **não sabemos o motivo** — ver a seção 6.

E o número final não é o total útil:

```
Goiânia:  19 gravados = 11 principal + 8 região metropolitana + (2 estatísticas)
                             ↑ o número no topo do app
```

Os 8 da região (6 Aparecida de Goiânia, 1 Pontalina, 1 Caldas Novas) estão na
seção **REGIÃO METROPOLITANA**, recolhida no fim da lista. Contando tudo, a busca
entregou 19 e não 11.

---

## 4. Por que um item morre, estágio por estágio

### Estágio 2 — Filter0 (regex, grátis)

Bloqueia por **domínio** (redes sociais, YouTube, globoplay — reel e vídeo não
têm texto para o Jina) e por **keyword inequívoca** de não-crime.

📌 Keywords ambíguas foram **removidas de propósito**: `tempo` batia em "há muito
tempo", `bolsa` em "roubaram a bolsa", `receita` em "Receita Federal apreendeu",
`jogo`/`futebol` em "torcedor morto". Esses casos passam para o Filter1 decidir
com contexto.

### Estágio 3 — Filter1 (GPT em lote, só título)

Decide YES/NO pelo título. Barato e serve para não pagar Jina + Filter2 em
artigo obviamente irrelevante.

### Estágio 4 — Fetching (Jina)

Perde por falha de download, página vazia ou timeout. **~7,4s por artigo**, 10 em
paralelo — é o estágio mais lento do pipeline.

### Estágio 5 — Filter2 (GPT full) + pós-filtro

Duas etapas diferentes, e a distinção é o que mais confunde:

**5a. O Filter2 descarta quando:**

| motivo | quando acontece |
|---|---|
| `e_crime=false` | GPT julgou que não é segurança pública |
| `confianca < 0.7` | **corte de confiança** — matéria vaga cai aqui |
| `tipo_crime_invalido` | tipo fora das 15 categorias e sem alias |
| `cidade_vazia` / `resumo_vazio` | não conseguiu extrair |
| `data_invalida` / `data_futura` | fora de `YYYY-MM-DD` ou no futuro |
| `json_invalido` / `gpt_error` | falha técnica |

Ele lê só os **primeiros 4.000 caracteres** (`filter2MaxContentChars`) — portal
com muito boilerplate no topo pode empurrar a notícia para fora da janela.

**5b. O pós-filtro decide o destino de quem passou:**

```
data < período pedido?
├── e < horizonte (180d)  → DESCARTA        (stage: filter2_date)
└── e ≥ horizonte         → fora_do_periodo  → seção MAIS OCORRÊNCIAS

cidade/estado bate?
├── sim                    → principal        → lista normal
├── não, mas é da região   → cidade_vizinha   → seção REGIÃO METROPOLITANA
└── não                    → DESCARTA        (stage: filter2_location)
```

📌 **O estado é validado SEMPRE**, inclusive para vizinha — sem isso Camaçari/SP
entraria como vizinha de Salvador/BA. E a cidade casa por **igualdade**, nunca
por substring: `includes` já colocou 10 notícias de São José do Cedro no feed de
São José.

📌 Rejeição por local que a regra antiga (substring) teria aceitado é marcada com
`[parcial]` no motivo — dá para medir se o aperto derrubou notícia boa, sem
instrumentar nada novo.

### Estágio 6 — Dedup intra-batch

Agrupa matérias do **mesmo evento** num item só — é o que produz "coberto por 3
veículos". Um cluster só herda `fora_do_periodo`/`cidade_vizinha` se **todos** os
membros forem; basta um item principal para o cluster inteiro ser principal.

Em Goiânia: 27 extrações → 19 clusters.

---

## 5. Qual alavanca mexe em quê

| quero... | mexo em | onde |
|---|---|---|
| **mais volume** | `search_subjects` — mais assuntos, não mais páginas | painel admin |
| mais alcance temporal | `periodo_dias` (slider 1–180 no app) | app |
| aceitar matéria mais vaga | `filter2_confidence_min` (hoje 0,7) | painel admin |
| ler mais do artigo | `filter2_max_content_chars` (hoje 4000) | painel admin |
| busca mais rápida | concorrência do Jina — **dois limitadores em série** | ver ROADMAP Fase 10 |

⚠️ **Pedir mais página do mesmo assunto não traz nada.** O índice do Google tem
teto de ~60-70 itens **por query** e não é regulável (`num` deprecado, `qdr`/`cdr`
ignorados). São Paulo/90 dias tinha 36 páginas de direito e a SERP secou sozinha
na 23. **Mais assuntos é a única alavanca real de alcance.**

⚠️ **Nunca fazer retry por contagem baixa.** Retry só sobre sinal explícito
(corpo de 0 bytes, `x-brd-err-code`).

---

## 6. A lacuna: não sabemos por que os 47 de Goiânia morreram

O worker da busca manual **coletava** os motivos em `rejectedUrls[]` e os
**descartava** no fim — só o auto-scan persistia, em `pipeline_rejected_urls`.
Por isso a única forma de descobrir onde uma busca perdeu era rodar
`scripts/diagnostico-funil.ts`, que **re-executa o pipeline pagando Jina + GPT
de novo**.

**Corrigido em 03/08** (aguardando a migration): o worker agora grava os motivos
com o `search_id` da busca. Depois de aplicada a
[migration 026](./SQL/migrations/026_rejected_urls_search_id.sql), o funil de
qualquer busca sai com uma query e custo zero:

```sql
SELECT stage, reason, count(*)
  FROM pipeline_rejected_urls
 WHERE search_id = '<id da busca>'
 GROUP BY stage, reason
 ORDER BY count(*) DESC;
```

Até lá, o insert falha e cai no `catch` — a busca não quebra, só não registra.

**A pergunta que isso vai responder:** dos 47 artigos de Goiânia que sumiram
entre "74 conteúdos" e "27 extrações", quantos foram `confianca<0.7`, quantos
`filter2_location` (e quantos desses com `[parcial]`), e quantos `e_crime=false`.
Cada resposta aponta para uma alavanca diferente — e hoje escolheríamos no chute.

---

## 7. Como ler o funil de uma busca que já rodou

Sem custo nenhum, o `progress.history` do `search_cache` guarda os `details` de
cada estágio:

```sql
SELECT params->>'cidades', params->>'periodo_dias', total_results,
       jsonb_pretty(progress->'history')
  FROM search_cache
 ORDER BY created_at DESC
 LIMIT 3;
```

E a composição do que foi entregue (principal vs extras) está em
`search_results.results`, no JSON de cada item: `cidade_vizinha` e
`fora_do_periodo` só aparecem quando são `true`.

# DEV_LOG — SIMEops (Fase 2)

> Diário de bordo: o que foi feito, decisões tomadas, problemas encontrados.
> Append-only, cronológico (mais recente no topo).
>
> Histórico da Fase 1 (6 sub-fases até produção) arquivado em [Fase 1/](./Fase%201/).
>
> Rotação: quando passar de ~1500 linhas, mover conteúdo antigo pra `_archive/DEV_LOG_YYYY-MM.md`.

---

## 2026-04-16

### Início da Fase 2 — Refino do workflow de colaboração

**Contexto:** Primeira sessão com Claude Opus 4.7 (migração do Opus 4.6 após atualização). João aproveitou a troca de modelo pra **refinar o workflow de vibe coding** antes de seguir pros bugs pendentes.

**O que mudou no jeito de trabalhar:**
- Relação firmada como **sócio, não funcionário** — Claude deve questionar, discordar, trazer opinião técnica, não só executar.
- **Pró-atividade obrigatória** — reportar achados inesperados na hora, sem esperar pedido.
- **Zero agentes de code review/auditoria** — investigação manual com Grep+Read, findings discutidos antes de mexer.
- **Falar de si mesmo** — se prompt for ruim ou task não casar com forças do modelo, avisar antes de executar. Autorizado consultar doc da Anthropic sobre o próprio modelo (Opus 4.7).
- **Fim de sessão disciplinado** — Claude revisa ROADMAP + ARQUITETURA + confirma DEV_LOG antes de fechar.

**Reorganização do workdesk:**
- Tudo que era Fase 1-6 (sub-fases até produção) movido pra dentro de `workdesk/Fase 1/` — vira histórico.
- `workdesk/` raiz agora tem 3 arquivos ativos: `DEV_LOG.md` (este), `ROADMAP.md`, `ARQUITETURA.md`.
- Novo `workdesk/WORKFLOW.md` criado como constituição da colaboração.
- SQL mantido como estava.

**Novos artefatos criados:**
- [workdesk/WORKFLOW.md](./WORKFLOW.md) — constituição da Fase 2 em diante.
- [CLAUDE.md](../CLAUDE.md) na raiz do projeto — regras operacionais lidas automaticamente toda sessão.
- [workdesk/DEV_LOG.md](./DEV_LOG.md) e [workdesk/ROADMAP.md](./ROADMAP.md) — nova cadência iniciada.

**Memórias pessoais do Claude atualizadas:**
- `feedback_partner_relationship.md` — sócio, pró-atividade, sem code review agent.
- `feedback_self_awareness.md` — avisar prompts ruins, pesquisar doc Anthropic se útil.

**Decisão descartada:** consolidar todas as Fases 1-6 num único DEV_LOG histórico. ROI baixo, tempo alto. Mantido como arquivo separado.

**Nenhuma mudança de código neste turno** — só organização de workdesk e acordos de colaboração.

---

### Bug: mistura de cidades homônimas no dashboard — FIX aplicado

**Sintoma relatado:** no dashboard, notícias de uma cidade apareciam no card de outra (user viu grupos "Grande Florianópolis" misturando com "São Paulo").

**Investigação** (leitura manual do pipeline, sem agentes): bug tinha DUAS causas encadeadas.

**Causa #1 — Short-circuit no post-filter** ([pipelineCore.ts:212-229](../backend/src/jobs/pipeline/pipelineCore.ts#L212-L229)):
```ts
// ANTES (bug):
const aceitar = cidadeExata || (cidadeParcial && estadoBate);
// Se cidade bate exato, || curto-circuita e NÃO checa estado.
// Cidades homônimas em estados diferentes (São José/SC, São José/SP, Santo Antônio, Planalto...) vazavam.
```

**Causa #2 — Tabela `news` sem coluna estado.** O Filter2 extraía estado mas `insertNews` descartava. Mesmo com Fix #1, feed e dedup camada 1 continuavam colapsando cidades homônimas.

**Fix aplicado:**

1. **Fix 1 — Post-filter sempre exige estado** ([pipelineCore.ts](../backend/src/jobs/pipeline/pipelineCore.ts)):
   ```ts
   const aceitar = (cidadeExata || cidadeParcial) && estadoBate;
   ```

2. **Fix 2 — Estrutural (estado vira first-class):**
   - [Migration 019](SQL/migrations/019_news_add_estado.sql) — `ALTER news ADD COLUMN estado TEXT` + index `(cidade, estado) WHERE active`.
   - [queries.ts](../backend/src/database/queries.ts): `InsertNewsParams`, `insertNews`, `findGeoTemporalCandidates`, `NewsFeedItem`, `NewsFeedParams`, `SearchNewsParams`, `getNewsFeed`, `getUserNewsFeed`, `searchNews` — todos aceitam/gravam/filtram `estado`.
   - [scanPipeline.ts](../backend/src/jobs/pipeline/scanPipeline.ts): passa `news.estado || parentState?.name` no `insertNews`.
   - [deduplication/index.ts](../backend/src/services/deduplication/index.ts): passa `newsData.estado` pro `findGeoTemporalCandidates` (dedup camada 1 agora inclui estado).
   - [newsRoutes.ts](../backend/src/routes/newsRoutes.ts): aceita `?estado=...` em GET /news, GET /news/feed e POST /search.

**Typecheck:** `npx tsc --noEmit` passou limpo.

**Flutter NÃO foi mexido (decisão consciente):**
- Backend passou a aceitar `estado` como query opcional → backwards-compatible.
- Fix 1 sozinho **estanca o fluxo novo** de mistura: notícias de SP só entram se monitoradas como SP.
- Fix 2 grava estado e permite distinguir no DB, protegendo contra o edge case de cidades homônimas em monitorings diferentes.
- Flutter passar `estado` na query seria a cereja do bolo (filtra no lado do feed também), mas requer decidir de onde vem o estado no UI (card → location → parent_state). Fica no ROADMAP.

**Pendente pelo João:**
- Rodar [migration 019](SQL/migrations/019_news_add_estado.sql) no Supabase antes do próximo scan.
- Rodar a migration de limpeza (notícias já gravadas com cidade errada) que ele mencionou ter preparada.

**Finding secundário (não mexido):** `MIGRATIONS_LOG.md` estava inconsistente — listava 005 como `city_groups` mas o arquivo real é 018. Corrigi o log.

---

### Dedup: 3 findings fechados no mesmo combo

Continuando a investigação após o fix de cidades, auditei o pipeline de dedup (intra-batch + 3 camadas DB). Apresentei 5 findings ao João, ele aprovou fix em todos.

**Causa raiz comum:** o dedup tinha pontos onde a lógica empobrecia a agregação de fontes e podia mesclar eventos diferentes. Impactava relatórios (ranking de bairros, mapa de calor, estatísticas).

**Fix #1 — Perda de sources em cluster intra-batch que vira duplicata DB**

[deduplication/index.ts](../backend/src/services/deduplication/index.ts): `deduplicateNews` agora aceita `extraSourceUrls: string[] = []`. Quando marca como duplicata (layer 3), insere a URL principal + todos os extras do cluster intra-batch como sources da notícia existente.

Antes: 3 veículos (G1, R7, UOL) consolidados no scan viravam 1 source (G1) quando crime já existia no DB.
Depois: todos os 3 viram sources agregadas.

Chamada em [scanPipeline.ts](../backend/src/jobs/pipeline/scanPipeline.ts): passa `news.extraSourceUrls` no `deduplicateNews`.

**Fix #2 — Prompt GPT da camada 3 reescrito**

[deduplication/index.ts:confirmDuplicateWithGPT](../backend/src/services/deduplication/index.ts): o prompt antigo pedia pro GPT confirmar critérios que a camada 1 JÁ tinha garantido (cidade+tipo+data). Viés claro pra "YES".

Prompt novo explicita que cidade+estado+tipo+data **não basta** — GPT precisa distinguir por detalhes: local exato (bairro/rua/estabelecimento), vítimas/suspeitos, valores, modus operandi, horário. Em dúvida, respira e responde **NO**: "a false NO just keeps two cards; a false YES loses an event permanently."

**Fix #3 — Bairro na camada 1 com tolerância a NULL**

[queries.ts:findGeoTemporalCandidates](../backend/src/database/queries.ts): aceita `bairro?: string | null`. Lógica:
- Se bairro foi passado → query adiciona `.or('bairro.eq.X,bairro.is.null')` → traz candidatos com mesmo bairro OU sem bairro (tolerante).
- Se bairro for NULL na nova notícia → não filtra por bairro (comportamento antigo).

Evita: eventos com bairros diferentes explícitos virarem candidatos um do outro → menos falsos positivos → relatórios de bairro mais precisos (ranking, mapa de calor, estatística).

Policy escolhida: **tolerante** (João aprovou) — prioriza não perder duplicata real em caso de bairro ausente.

**Fix #4 (menor) — Threshold intra-batch agora configurável**

[pipelineCore.ts:runIntraBatchDedup](../backend/src/jobs/pipeline/pipelineCore.ts): recebe `similarityThreshold` como parâmetro (default 0.85). Chamadas em [scanPipeline.ts](../backend/src/jobs/pipeline/scanPipeline.ts) e [manualSearchWorker.ts](../backend/src/jobs/workers/manualSearchWorker.ts) passam `pipelineConfig.dedupSimilarityThreshold` (mesma config `dedup_similarity_threshold` usada na camada 2 do dedup DB).

Manual search worker agora também carrega essa config.

**Fix #5 (menor) — Limit camada 1 aumentado 50 → 200**

[queries.ts:findGeoTemporalCandidates](../backend/src/database/queries.ts): em cidade grande (SP, RJ) com muito volume diário, o teto de 50 candidatos podia cortar matches válidos → duplicatas escapavam. Aumentado pra 200.

**Typecheck:** `npx tsc --noEmit` passou limpo.

**Arquivos alterados nesta rodada:**
- `backend/src/services/deduplication/index.ts`
- `backend/src/database/queries.ts`
- `backend/src/jobs/pipeline/pipelineCore.ts`
- `backend/src/jobs/pipeline/scanPipeline.ts`
- `backend/src/jobs/workers/manualSearchWorker.ts`

**Nenhuma migration SQL nesta rodada** (todos os fixes são code-only).

**Pendente pelo João:**
- Deploy do backend após rodar migration 019 (do combo anterior).
- Validar em produção: (1) cards com múltiplas fontes agregadas; (2) menos merges errados (conferir ranking de bairros); (3) relatórios com distribuição realista por bairro.

---

### Revisão do funil de filtros — 3 fixes aplicados

João pediu mapa completo do funil (Filter0 → Filter1 → Fetch → Filter2 → Post-filter → Intra-batch → Dedup DB). Ao revisar Filter0 e Filter1 (únicos que eu ainda não tinha lido), trouxe 4 findings. João aprovou 3 pra corrigir agora (o 4º, keywords broad no Filter0, fica pra discussão futura).

**Fix A — Filter0 bloqueia Instagram e YouTube**

[filter0Regex.ts](../backend/src/services/filters/filter0Regex.ts): `BLOCKED_DOMAINS` ganhou `instagram.com`, `youtube.com`, `youtu.be`. Comentário antigo ("YouTube e Instagram liberados — podem ter reportagens") estava desalinhado com a prática — João reportou que Instagram entregava muito reel e pouca notícia, YouTube não tem texto pra Jina extrair. Agora está consistente com a query Google da busca manual (que já excluía via `-site:instagram.com -site:youtube.com`).

**Fix B — Filter1 não faz mais fallback "all true" em erro de OpenAI**

[filter1GPTBatch.ts](../backend/src/services/filters/filter1GPTBatch.ts): o fallback antigo em caso de exceção no try/catch retornava `results: all true` — o que jogava **todas as URLs** pro Jina fetch e Filter2, gastando Jina + GPT-4o-mini sem filtro real. Potencial explosão de budget se OpenAI tivesse outage.

Novo comportamento:
- Parse JSON inválido ou length mismatch: ainda faz padding seguro (é lixo do GPT, não downtime).
- **Exceção de API após retry**: `throw` em vez de fallback. BullMQ faz retry com backoff. Sentry já capturava (alerta por email via Sentry UI).

[cronScheduler.ts](../backend/src/jobs/scheduler/cronScheduler.ts): BullMQ retry ajustado de `attempts: 3, delay: 2000ms` (total ~14s) pra `attempts: 5, delay: 60000ms` exponencial (1min → 2min → 4min → 8min → 16min = ~31min de tolerância pra OpenAI voltar). Aplicado no cron automático e no `enqueueScan` manual.

**Fix C — Filter2 maxContentChars dobrado**

[configManager/index.ts](../backend/src/services/configManager/index.ts) + [schema.sql](../backend/src/database/schema.sql): default `filter2_max_content_chars` de `4000` → `8000`. Matérias investigativas longas tinham o desfecho cortado antes do GPT analisar (data/cidade podem aparecer no fim).

Custo marginal: ~$0.0003/notícia vs $0.00015 antes (gpt-4o-mini). Em 30 notícias/scan, ~$0.005 a mais.

**Typecheck:** `npx tsc --noEmit` passou limpo.

**Arquivos alterados:**
- `backend/src/services/filters/filter0Regex.ts`
- `backend/src/services/filters/filter1GPTBatch.ts`
- `backend/src/jobs/scheduler/cronScheduler.ts`
- `backend/src/services/configManager/index.ts`
- `backend/src/database/schema.sql`

**Pendente pelo João:**
- **Config em PROD**: `filter2_max_content_chars` já está no DB como 4000. Atualizar via admin panel pra 8000 (a mudança no código só afeta instâncias novas sem config salva). *Adicionado na UI em 2026-04-16 — ver ajuste abaixo.*
- **Sentry**: configurar alerta de email no Sentry UI pra tag `provider:openai` + `stage:filter1`. Assim outage de OpenAI vira notificação direta.
- Finding aberto não corrigido: **F0-1 keywords broad** (`"jogo"`, `"tempo"`, `"música"`, `"esporte"` bloqueando falsos positivos). Ver ROADMAP.

---

### Ajuste pós-fix: expor `filter2_max_content_chars` no admin panel

Descobri (João me alertou) que a config `filter2_max_content_chars` não tinha UI editável no admin panel — só `filter2_confidence_min` e `dedup_similarity_threshold` estavam expostos. Então a mudança de default no código (4000→8000) não surtia efeito em prod, porque a prod tem valor salvo no DB e não há forma de editar.

Adicionado em [admin-panel/.../settings/page.tsx](../admin-panel/src/app/(dashboard)/dashboard/settings/page.tsx), grupo `AI_FILTER_THRESHOLDS`:

```ts
{
  key: 'filter2_max_content_chars',
  label: 'Tamanho máximo do conteúdo analisado',
  description: 'Quantos caracteres da matéria o AI lê para extrair dados...',
  min: 2000, max: 16000, step: 500,
}
```

Range escolhido: <2000 corta quase tudo, >16000 raro em matérias. Default recomendado 6000-10000 no tooltip.

**Typecheck admin panel:** limpo.

**Próximo passo pelo João:** ao abrir a página de Settings, vai ter um slider novo pra configurar o tamanho. Ajustar pra 8000 em prod.

---

### Script de regressão: teste lado-a-lado do prompt de dedup

Criado [backend/scripts/test-dedup-prompt.ts](../backend/scripts/test-dedup-prompt.ts) pra isolar a validação do prompt novo do dedup camada 3 (Fix #2 do combo anterior).

Auto-contido — não importa nada de `src/`. Hardcoda os dois prompts (antigo e novo) e 4 pares de resumos pré-fabricados:

- Par 1: mesmo evento, veículos diferentes (esperado YES)
- Par 2: crimes diferentes mesmo tipo/cidade (esperado NO)
- Par 3: mesmo evento, escritas muito diferentes (esperado YES)
- Par 4: crimes diferentes no mesmo bairro (esperado NO)

**Uso:**
```bash
cd backend
npx tsx scripts/test-dedup-prompt.ts
```

Roda em ~15-30s, custo ~$0.002. Saída: tabela com comparativo + seção de regressões e ganhos.

**Leitura de sucesso:** novo prompt acerta todos os 4 sem regressão. Se regressão aparecer, recalibrar o prompt antes de confiar nele em prod.

**Fora de escopo:** mudança de post-filter por natureza (ocorrência/estatística) — discutido e descartado nesta rodada, pode voltar futuramente se necessário.

**Typecheck:** passou limpo.

---

### Prompt novo do dedup REVERTIDO — velho vence 9/10 vs 7/10

Rodei o script `test-dedup-prompt.ts` com 10 pares balanceados (3 YES claro, 3 NO claro, 2 borderline NO, 2 borderline YES). Resultado:

- **Prompt velho (original):** 9/10 ✓
- **Prompt novo (meu de Fix #2 do combo de dedup):** 7/10 ✗
- **Regressões do novo:** Par 02 e Par 03 — YES claros onde o novo disse NO (mesmo evento, veículos diferentes e escritas diferentes). Isso quebra o **core value** do sistema (agregar veículos num card único).
- **Ambos erraram Par 10** (borderline YES, idade 35 vs ~30).

**Admissão honesta:** o Finding #2 original era **especulação minha** mais que bug comprovado. Minha hipótese era que o GPT cairia em viés pra YES porque os critérios do prompt antigo sempre batiam (cidade+tipo+data já pré-filtrados). Na prática, o gpt-4o-mini é inteligente o suficiente pra focar nos outros critérios (vítimas, detalhes-chave) mesmo quando os primeiros batem. Os pares borderline NO (Par 07 e 08) foram resolvidos corretamente pelo prompt velho.

**Ação:** revertido em [dedup/index.ts:confirmDuplicateWithGPT](../backend/src/services/deduplication/index.ts) pro prompt original. Comentário na função documenta a tentativa e por que foi descartada.

**Outros 4 fixes do combo de dedup permanecem** (preserva sources, bairro camada 1, threshold configurável, limit 200) — todos validados por lógica, não por especulação.

**Lição aprendida:** não confiar em finding teórico sem evidência de produção ou teste. Script de regressão `scripts/test-dedup-prompt.ts` fica como referência pra próximas mexidas de prompt.

---

### ARQUITETURA.md atualizado — graph detalhado do funil

A seção "## PIPELINE CORE" de [ARQUITETURA.md](./ARQUITETURA.md#pipeline-core-pipelinecorets) foi reescrita com:

- Mapa detalhado do funil stage por stage (URL dedup → Filter0 → Filter1 → Fetch → Filter2 → Post-filter → Embedding → Intra-batch → Dedup DB)
- Pontos de rejeição explicitados (setas laterais `[X->]` marcam saídas do funil)
- Valores atuais da sessão (limit 200, threshold configurável, bairro tolerante, maxContentChars 8000, retry BullMQ 31min)
- STAGE 7 separado pra dedup DB das 3 camadas (só auto-scan)
- Seção final documentando a tentativa+reversão do prompt

Mantive formato ASCII consistente com o resto do arquivo.

**Inconsistências observadas no ARQUITETURA.md (não corrigidas nesta rodada):**
- Header menciona "Fase 3 — Sessao 012" — desatualizado (estamos Fase 2 nova).
- Menciona "Brave News" como principal — na prática é BrightData via `config.searchBackend`.

Anoto como pendência: revisão completa do ARQUITETURA.md depois que a Camada 5 estiver mapeada também, pra fazer uma varredura única.

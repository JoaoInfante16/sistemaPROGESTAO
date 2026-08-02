# AUDITORIA GERAL — SIMEops

> Checkup completo de backend, admin panel e Flutter.
> Data: **2026-07-30**. Última sessão de código: 2026-04-18 (~3,5 meses de intervalo).
> Método: investigação manual (Grep + Read), sem agentes de auditoria — conforme [WORKFLOW.md](WORKFLOW.md) §2.3.
> Nada foi alterado no código. Este documento é diagnóstico + proposta.

---

## Sumário executivo

O sistema está **estruturalmente saudável**: `npx tsc --noEmit` passa limpo, os guards de autenticação do backend estão corretos em todas as rotas admin, e a arquitetura de pipeline compartilhado (`pipelineCore`) se sustentou bem.

O problema relatado pelo cliente — **"busca manual fica carregando e não busca dados"** — é real, reproduzível por análise e tem **causa raiz identificada**. Não é um bug único: é uma combinação de um gargalo de performance com um limite de timeout no app que ficaram em rota de colisão.

Além disso foram encontrados **3 bugs de dados/estado** que podem travar um usuário permanentemente, e um conjunto de dívidas de manutenção (dependências, configs mortas, documentação defasada).

| Severidade | Qtd | Resumo |
|---|---|---|
| 🔴 Crítico | 4 | Busca manual estoura timeout; usuário travado por busca fantasma; perda de dados entre usuários |
| 🟡 Médio | 7 | Sem timeouts externos, contenção auto-scan × manual, configs mortas, admin sem check de admin |
| 🟢 Baixo | 6 | Dependências desatualizadas, nomes legado, docs defasadas |

---

# PARTE 1 — O BUG DO CLIENTE

## Diagnóstico: a busca não trava, ela é lenta demais para o app esperar

O worker **não** está quebrado. Ele processa a busca até o fim. O que acontece é que o **app desiste antes do backend terminar**, e o usuário vê um spinner que nunca vira resultado.

### A colisão de dois números

```
  Flutter desiste em:     10 minutos  (_maxPolls = 200 × 3s)
  Busca real leva:      10–25 minutos  (dependendo de nº de cidades)
                        ^^^^^^^^^^^^^
                        colisão garantida em busca multi-cidade
```

[manual_search_screen.dart:49](../mobile-app/lib/features/search/screens/manual_search_screen.dart#L49)
```dart
static const _maxPolls = 200; // ~10 min at 3s intervals
```

Quando estoura, o app mostra *"Busca demorou demais. Verifique o histórico."* — mas antes disso o usuário passou 10 minutos olhando a barra de progresso parada num estágio. Da perspectiva dele: **"fica carregando e não busca dados"**.

---

## Causa raiz #1 — Filter2 roda em série (o maior ofensor)

Este é **o** gargalo. Em [pipelineCore.ts:183](../backend/src/jobs/pipeline/pipelineCore.ts#L183), o estágio 5 é um `for` sequencial com **duas chamadas OpenAI aguardadas por artigo**:

```ts
for (const fetched of contents) {
  const { extraction } = await rateLimiter.schedule('openai', () => filter2GPTWithReason(...));
  // ...
  const embeddingResult = await rateLimiter.schedule('openai', () => embeddingProvider.generate(...));
}
```

O rate limiter está configurado para permitir **5 chamadas OpenAI simultâneas**, mas o loop nunca emite mais de uma por vez. **A capacidade existe e não é usada** — o pipeline roda a 20% da vazão disponível.

Custo em tempo real:

| Artigos que chegam ao Filter2 | Tempo do estágio 5 (série) | Se paralelizado (5×) |
|---|---|---|
| 30 | ~3 min | ~35 s |
| 60 | ~6 min | ~1,2 min |
| 150 | ~15 min | ~3 min |
| 250 | ~25 min | ~5 min |

*(base: gpt-4o-mini com ~8000 chars de entrada ≈ 4–6 s por chamada, + embedding ≈ 0,5 s)*

**Sozinho, este item já explica o bug.** É também a correção de melhor custo-benefício: trocar o `for` por `asyncPool` (helper que já existe em [helpers.ts:6](../backend/src/utils/helpers.ts#L6) e já é usado no estágio de fetch) corta o tempo total em ~5×, sem mudar custo em dólar e sem tocar em nenhuma regra de negócio.

---

## Causa raiz #2 — A busca aceita até 10 cidades

[validation.ts:116](../backend/src/middleware/validation.ts#L116)
```ts
cidades: z.array(z.string().min(2).max(100)).min(1).max(10),
```

Cada cidade dispara **duas** buscas em paralelo ([manualSearchWorker.ts:255](../backend/src/jobs/workers/manualSearchWorker.ts#L255)):
- Web Top100 → até 50 URLs (período 30d)
- News paginado → até 30 URLs

Ou seja **até 80 URLs por cidade**, e com 10 cidades **até 800 URLs** entrando no funil. Depois de Filter0 e Filter1 sobram tipicamente 25–35% — entre 200 e 280 artigos para o Filter2 sequencial. Isso é a faixa de **20–25 minutos** da tabela acima.

O app não avisa o usuário que escolher 8 cidades transforma uma busca de 3 minutos numa de 25.

---

## Causa raiz #3 — Nenhuma chamada externa tem timeout

Varredura em todos os providers: **zero `AbortSignal`, zero `timeout`** em `fetch`.

| Serviço | Timeout configurado | Comportamento real |
|---|---|---|
| Jina Reader | nenhum | pendura indefinidamente |
| Bright Data (SERP e Unlocker) | nenhum | pendura indefinidamente |
| OpenAI (SDK) | não configurado | usa default de **600 s × 2 retries** = até 30 min numa chamada |

O único timeout do sistema inteiro é o poll do snapshot Bright Data (180 s). Uma única URL lenta no Jina, ou uma chamada OpenAI que enrosca, segura o pipeline inteiro sem limite.

Agravante no Bright Data Web Top100 ([BrightDataSERPProvider.ts:48](../backend/src/services/search/BrightDataSERPProvider.ts#L48)): há retry de 1×, e cada tentativa pode gastar 180 s de polling. **Até 6 minutos por cidade só no estágio 1**, antes de qualquer filtro.

---

## Causa raiz #4 — Auto-scan e busca manual disputam o mesmo processo

Ambos os workers sobem no **mesmo processo Node** ([server.ts:79-80](../backend/src/server.ts#L79-L80)) e compartilham o **mesmo rate limiter Bottleneck** (instância única de módulo, `max_concurrent: 5` para OpenAI).

```
  server.ts
    ├── scanWorker         concurrency: 3   ─┐
    └── manualSearchWorker concurrency: 2   ─┴─→ MESMO Bottleneck('openai') max 5
```

Consequência: com 3 scans automáticos rodando, eles ocupam a fila do OpenAI e a busca manual — que já é sequencial — fica **atrás deles na fila**.

E o pior detalhe: a janela do auto-scan é **seg–sex, 6h–18h** ([configManager](../backend/src/services/configManager/index.ts)), que é **exatamente o horário comercial em que o cliente usa o app**. O bug é pior justamente quando mais importa.

---

## Bugs de estado que travam o usuário

### 🔴 A. Busca fantasma bloqueia o usuário para sempre

[manualSearchRoutes.ts:40-45](../backend/src/routes/manualSearchRoutes.ts#L40-L45)
```ts
const history = await db.getUserSearchHistory(userId);
const running = history.find((s) => s.status === 'processing');
if (running) {
  res.status(409).json({ error: 'Já existe uma busca em andamento. Cancele antes de iniciar outra.' });
  return;
}
```

Não há **nenhum critério de idade** nessa checagem. Se uma busca ficar presa em `processing` — deploy no Render no meio do job, restart do processo, OOM, worker morto — o `catch` que marcaria `failed` nunca roda, e a linha fica `processing` **para sempre**.

A partir daí, **toda** nova busca daquele usuário recebe 409. Ele está permanentemente travado e a única saída é apagar a busca manualmente no histórico (long-press → deletar) — algo que o cliente não tem como adivinhar.

**Correção proposta:** tratar como obsoleta qualquer busca em `processing` há mais de ~20 min (marcar `failed` e seguir), em vez de bloquear.

### 🔴 B. Linha órfã quando o enfileiramento falha

Mesma rota, ordem das operações:
```ts
const searchId = await db.createSearchCache({...});   // grava status='processing'
await manualSearchQueue.add('manual-search', {...});  // se falhar aqui…
```

Se o Redis estiver indisponível, a linha `processing` já foi criada e **nunca** será processada nem marcada como falha. O usuário recebe 500 e, a partir daí, cai no bug (A): travado por 409 permanente.

**Correção proposta:** `try/catch` no `queue.add` que marca a busca como `failed` antes de retornar o erro.

### 🔴 C. Um usuário apaga a busca de outro

[queries.ts:987-993](../backend/src/database/queries.ts#L987-L993)
```ts
if (error && error.message.includes('duplicate key')) {
  await supabase
    .from('search_cache')
    .delete()
    .eq('params_hash', paramsHash);   // ← sem filtro de user_id
```

O `params_hash` é só o JSON dos parâmetros — não inclui o usuário. Se dois clientes buscarem *"SC / Florianópolis / 30 dias"*, o segundo **apaga a busca e os resultados do primeiro** (cascade em `search_results`). O primeiro usuário vê a busca sumir do histórico sem explicação.

**Correção proposta:** adicionar `.eq('user_id', p.user_id)` ao delete.

### 🟡 D. Usuários anônimos compartilham um balde só

Quando `search_permission = 'all'`, [auth.ts](../backend/src/middleware/auth.ts) deixa passar sem token e a rota cai em `userId = 'anonymous'`. Todos os anônimos então **compartilham histórico e o bloqueio de 409** — a busca de um trava a de todos, e um vê os resultados do outro. Hoje o default é `'authorized'`, então está latente; vira problema no dia em que a config mudar.

---

## Plano de correção sugerido (ordem de impacto)

| # | Correção | Arquivo | Esforço | Efeito |
|---|---|---|---|---|
| 1 | Paralelizar Filter2 com `asyncPool` | `pipelineCore.ts` | ~30 min | **−80% no tempo total** |
| 2 | Ignorar buscas `processing` obsoletas (>20 min) | `manualSearchRoutes.ts` | ~20 min | Destrava usuário preso |
| 3 | `try/catch` no `queue.add` → marca `failed` | `manualSearchRoutes.ts` | ~10 min | Elimina linha órfã |
| 4 | `.eq('user_id')` no delete por hash | `queries.ts` | ~5 min | Para a perda de dados |
| 5 | Timeout em Jina / Bright Data / OpenAI | providers | ~40 min | Falha rápido em vez de pendurar |
| 6 | Subir `_maxPolls` + backoff no polling | `manual_search_screen.dart` | ~20 min | Rede de segurança |
| 7 | Baixar limite de cidades (10 → 5) ou avisar na UI | `validation.ts` | ~15 min | Contém o pior caso |

Os itens 1–4 são cirúrgicos, não mudam regra de negócio e resolvem o problema do cliente. **Recomendo fazer os quatro juntos num único commit** e validar em staging antes de tocar nos demais.

---

# PARTE 2 — CHECKUP GERAL

## O que está bem

- **`npx tsc --noEmit` passa limpo** no backend.
- **Guards de autenticação corretos**: todas as rotas de `locationRoutes`, `userRoutes`, `settingsRoutes` e `groupRoutes` que mudam estado têm `requireAuth + requireAdmin`. Não há rota admin exposta.
- **Categorias com fonte única real**: `TIPO_CRIME_GRUPO` vive no backend; o Flutter só carrega cores/labels em [category_colors.dart](../mobile-app/lib/core/utils/category_colors.dart). A consolidação da sessão de abril se sustentou — não encontrei duplicação remanescente.
- **Graceful shutdown implementado** com timeout de 30 s nos workers.
- **Rastreio de custo por estágio** (`db.trackCost`) cobre todos os provedores pagos.
- **Janela de operação do auto-scan** funciona e força timezone de Brasília corretamente — imune ao host em UTC do Render.

## Configs do admin que não fazem nada

Existem em `schema.sql` e/ou nos defaults do `configManager`, mas **nenhum código as lê**:

| Config | Situação |
|---|---|
| `worker_concurrency` | Ignorada — hardcoded `3` em `scanWorker.ts` |
| `worker_max_per_minute` | Ignorada — hardcoded `10` em `scanWorker.ts` |
| `scan_cron_schedule` | Ignorada — o scheduler lê a env `SCAN_CRON_SCHEDULE`, não o DB |
| `scan_lock_ttl_minutes` | Ignorada — hardcoded `30 * 60 * 1000` |
| `budget_warning_threshold` | Só existe no schema; nada consome |

As três primeiras aparecem na lista `restartRequired` de [settingsRoutes.ts:317](../backend/src/routes/settingsRoutes.ts#L317), o que sugere que **um dia funcionaram**. Hoje a mensagem *"Requer restart do servidor para ter efeito"* é enganosa: mesmo com restart, nada muda.

Nenhuma delas está exposta na UI do admin hoje, então o risco prático é baixo — mas é uma armadilha para você ou para uma instância futura minha.

## Configs importantes que faltam na UI do admin

Estas **são** lidas pelo código, mas não têm controle no painel:

- **`content_fetch_concurrency`** (default 5) — alavanca direta de vazão do Jina, relevante para o bug de lentidão
- **`monthly_budget_usd`** — o teto que rejeita buscas quando estourado; só editável direto no DB
- **`push_enabled`** — desligar push exige ir ao Supabase
- **`search_permission`** — controla se busca manual exige login

## Admin panel não verifica se o usuário é admin

[middleware.ts](../admin-panel/src/middleware.ts) só checa se **existe sessão**. Não há verificação de `is_admin` em lugar nenhum do frontend — nem no middleware, nem no layout do dashboard, nem no `use-auth`.

Como o app mobile e o admin usam o **mesmo projeto Supabase**, um usuário comum do app consegue logar na URL do admin com as credenciais dele e carregar a casca do dashboard. **Não há vazamento de dados** — o backend rejeita com 403 em todas as rotas admin — mas ele vê o menu completo e uma tela de erros, o que é ruim de confiança e desnecessariamente revelador da estrutura interna.

**Correção:** checar `is_admin` no middleware e redirecionar para login com mensagem clara.

## Dívida menor

- **`asyncPool`** ([helpers.ts:6](../backend/src/utils/helpers.ts#L6)): se a função passada lançar, o `Promise.race` derruba o pool inteiro e deixa promises órfãs. Hoje está seguro porque o único uso captura erros internamente — mas é uma armadilha para o próximo uso (inclusive para a correção #1 acima, que precisa capturar erro por item).
- **Nomes legado**: `pubspec.yaml` ainda declara `name: netrios_news`; `backend/package.json` ainda é `netrios-news-backend` com `author: Netrios Team`. Renomear o pacote Flutter quebra imports em massa — avaliar se vale.
- **`ARQUITETURA.md` estava defasado** em pontos concretos (corrigido nesta sessão): dizia Brave como provider principal quando é Bright Data; CRON de hora em hora quando é a cada 5 min; `filter2_max_content_chars` 4000 quando é 8000. Faltavam por completo os serviços `executive`, `geocoding` e `billingScheduler`.

## Dependências desatualizadas

**Backend** — nada quebrado, mas atrasado:

| Pacote | Atual | Situação |
|---|---|---|
| `openai` | ^4.24.1 | **duas majors atrás** (v6). A v4 é de dez/2023 |
| `express` | ^4.18.2 | v5 estável disponível |
| `@typescript-eslint/*` | ^6.17 | v8 disponível |
| `eslint` | ^8.56 | v9 disponível (admin já está na 9) |

O upgrade do `openai` é o único com ganho concreto: as versões novas têm melhor tratamento de timeout e retry — exatamente a lacuna da causa raiz #3.

**Flutter** — vários majors atrás:

| Pacote | Atual | Disponível |
|---|---|---|
| `fl_chart` | ^0.70.2 | 1.x |
| `share_plus` | ^10.1.4 | 12.x |
| `flutter_map` | ^7.0.2 | 8.x |
| `sentry_flutter` | ^8.13.0 | 9.x |

**Admin panel** está atualizado (Next 16.1.6, React 19.2.3, Sentry 10). Sem ação necessária.

⚠️ Nenhum desses upgrades deve ser feito junto com a correção do bug do cliente. São commits separados, com build de APK em device físico para validar.

---

# PARTE 3 — MELHORIAS PROPOSTAS

Separadas do que é correção de bug. Ordenadas por relação valor/esforço.

## Alto valor, baixo esforço

**1. Progresso real em vez de 7 caixinhas**
Hoje o app mostra "estágio 3 de 7". O estágio 5 sozinho pode ser 80% do tempo total, então a barra fica travada num ponto e parece congelada. Como o backend já sabe quantos artigos está processando, dá para reportar `"Analisando 34 de 112 artigos"` e mover a barra de forma proporcional. **Muda completamente a percepção de travamento** — e é a melhoria mais barata do relatório.

**2. Estimativa de tempo antes de iniciar**
Com o número de cidades e o período selecionados dá para estimar a duração. Mostrar *"Esta busca deve levar ~4 minutos"* antes do usuário apertar o botão elimina a ansiedade e desestimula naturalmente a seleção de 10 cidades.

**3. Retomada automática pelo push**
O push de "busca concluída" já existe e já carrega o `search_id`. Hoje ele não abre a busca. Fazer o toque na notificação abrir direto o resultado converte a espera longa em algo tolerável: o usuário fecha o app e volta quando chega o aviso.

**4. Expor `content_fetch_concurrency` e `monthly_budget_usd` no admin**
Duas alavancas operacionais importantes que hoje exigem ir ao Supabase.

## Valor médio

**5. Separar auto-scan e busca manual em processos distintos**
Resolve a contenção da causa raiz #4 de forma estrutural. No Render significa um segundo serviço (+$7/mês) — ou, sem custo, dar prioridade à fila manual sobre a de scan.

**6. Cache de busca por cidade+período**
Duas buscas iguais na mesma semana repagam Bright Data, Jina e OpenAI do zero. Um cache de 24–48 h por `params_hash` (a coluna **já existe**) tornaria a segunda busca instantânea e de graça. Cuidado: precisa resolver o bug (C) antes, senão o cache vira vetor de vazamento entre usuários.

**7. Página de saúde do pipeline no admin**
Buscas presas, taxa de rejeição por estágio, custo por busca, latência por provedor. Você hoje descobre problema pelo relato do cliente — isso inverte a ordem.

**8. Dedup contra o banco na busca manual**
O auto-scan tem 3 camadas de dedup contra o DB; a busca manual só faz dedup dentro do próprio lote. Uma notícia já conhecida reaparece como novidade.

## Valor alto, esforço alto

**9. Migrar Filter2 para a Batch API da OpenAI**
50% de desconto no maior item de custo variável. Só faz sentido para o auto-scan (a Batch API é assíncrona, com janela de até 24 h) — nunca para busca manual.

**10. Retenção configurável de dados**
Já está no ROADMAP. Ganha urgência conforme o banco cresce.

---

# PARTE 4 — IDEIAS DE FEATURES

Você perguntou o que mais eu penso. Estas são minhas, para discutir — **não estão no ROADMAP** e nenhuma foi acordada.

### As que eu defenderia

**Alerta por área de interesse (geofence)**
O sistema já extrai bairro e rua e já tem geocode com precisão. Deixar o usuário desenhar/escolher uma região — o entorno de uma unidade, um raio de N km — e receber push **só** do que cai ali. Hoje o push é por cidade inteira, o que gera ruído para quem só se importa com o próprio quarteirão. **É o pulo de "jornal de crimes" para "monitoramento operacional"** — e é o que mais aproxima o produto do nome *ops*.

**Relatório recorrente automático**
Um relatório semanal ou mensal gerado sozinho e entregue pronto (push + link público, que já existe). Transforma um app de consulta ativa num serviço que entrega valor sem o cliente lembrar de abrir. Alto valor percebido, e reaproveita quase tudo que já está construído.

**Digest diário em vez de push por ocorrência**
Um resumo às 8h — *"ontem: 4 ocorrências, 2 patrimoniais no Centro"* — em vez de N pushes ao longo do dia. Para cidade movimentada o push atual vira spam, e spam de push termina em notificação desativada. Deveria ser uma preferência do usuário.

### As que eu levantaria, mas com ressalva

**Comparação entre cidades**
O cliente PROGESTÃO provavelmente monitora várias unidades. Um comparativo lado a lado é natural — mas cuidado com a armadilha que você já rejeitou em abril (e com razão): volume de **notícia** não é volume de **crime**. Cidade com imprensa local forte parece mais violenta. Só faria sentido com a limitação declarada na tela.

**Exportar para CSV/Excel**
Barato de fazer, e cliente corporativo costuma querer os dados na planilha dele. Ressalva: o PDF que você acabou de polir existe justamente para controlar a apresentação — CSV abre mão disso.

### As que eu registro, mas não recomendaria agora

- **Web app para o cliente** — duplica superfície de manutenção; o relatório público já cobre 80% do caso de uso
- **Multi-tenant / white-label** — só depois que houver um segundo cliente real pedindo
- **Alertas por WhatsApp** — API oficial é cara e burocrática; push já resolve

---

## Perguntas em aberto para você

1. Fecho os 4 fixes críticos num commit só, ou prefere revisar um a um?
2. O cliente está travado **agora** por uma busca fantasma? Se sim, dá para destravar na hora apagando a linha `processing` no Supabase, sem esperar deploy.
3. O limite de 10 cidades é intencional, ou foi um número solto na validação?
4. Auto-scan e busca manual em processos separados vale +$7/mês, ou prefere a rota de prioridade de fila?

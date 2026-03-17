# Manual de Configurações do Painel Admin

Este documento descreve todas as configurações gerenciáveis pelo painel admin do Netrios News.

---

## Visão Geral

Todas as configurações são armazenadas na tabela `system_config` do banco de dados e podem ser alteradas via API:

- **GET** `/settings/config` - Lista todas as configs agrupadas por categoria
- **PATCH** `/settings/config/:key` - Atualiza uma config específica

O backend lê essas configs com **cache de 5 minutos** (via `ConfigManager`). Alterações levam no máximo 5 minutos para ter efeito, exceto as marcadas como "requer restart".

---

## Categorias de Configuração

### Pipeline

Controla o comportamento do pipeline de processamento de notícias.

| Config | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| `search_max_results` | number | `10` | Número máximo de resultados retornados pelo Google Search por query. Valores maiores encontram mais notícias mas custam mais. |
| `content_fetch_concurrency` | number | `5` | Quantidade de fetches de conteúdo (Jina) executados em paralelo por pipeline run. Valores maiores = mais rápido, mas pode sobrecarregar a API. |
| `filter2_confidence_min` | number | `0.7` | Confiança mínima da extração GPT para aceitar uma notícia (0.0 a 1.0). Valores mais altos = menos falsos positivos, mas pode perder notícias legítimas. |
| `filter2_max_content_chars` | number | `4000` | Máximo de caracteres enviados ao GPT no Filter 2. Valores maiores dão mais contexto mas custam mais tokens. |
| `dedup_similarity_threshold` | number | `0.85` | Threshold de similaridade coseno para a camada 2 da deduplicação. Valores mais altos = mais rígido (aceita menos como duplicata). Valores mais baixos = mais agressivo (considera mais como duplicata). |

**Recomendações de ajuste:**

- Se muitas notícias irrelevantes passam: **aumentar** `filter2_confidence_min` (ex: 0.8)
- Se notícias legítimas estão sendo rejeitadas: **diminuir** `filter2_confidence_min` (ex: 0.6)
- Se notícias duplicadas estão passando: **diminuir** `dedup_similarity_threshold` (ex: 0.80)
- Se notícias diferentes estão sendo agrupadas indevidamente: **aumentar** `dedup_similarity_threshold` (ex: 0.90)
- Se o pipeline está lento: **aumentar** `content_fetch_concurrency` (ex: 10)
- Se a API do Jina retorna erros 429: **diminuir** `content_fetch_concurrency` (ex: 3)

---

### Budget

Controla limites de gastos e alertas.

| Config | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| `monthly_budget_usd` | number | `100` | Limite mensal de gastos em USD. O dashboard mostra a porcentagem usada. |
| `budget_warning_threshold` | number | `0.9` | Threshold de alerta (0.0 a 1.0). Quando o gasto atinge esta porcentagem do budget, um alerta é gerado. `0.9` = alerta aos 90%. |

**Endpoints de monitoramento:**

- **GET** `/settings/budget/summary` - Mostra gasto total do mês, por provider (Google, Jina, OpenAI), e % do budget usado
- **GET** `/settings/budget/daily` - Mostra gasto por dia do mês atual (para gráficos)

**Exemplo de resposta do summary:**
```json
{
  "month": "2026-02",
  "total": 15.4321,
  "autoScans": 14.2100,
  "manualSearches": 1.2221,
  "byProvider": {
    "google": 5.0000,
    "jina": 4.0000,
    "openai": 6.4321
  },
  "budget": 100,
  "budgetUsedPercent": 15.4
}
```

---

### Scheduler

Controla a frequência e concorrência dos scans automáticos.

| Config | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| `scan_cron_schedule` | string | `0 * * * *` | Expressão CRON que define quando o scheduler verifica localizações para scan. Default: a cada hora. **Requer restart.** |
| `worker_concurrency` | number | `3` | Máximo de scans rodando em paralelo no worker BullMQ. **Requer restart.** |
| `worker_max_per_minute` | number | `10` | Limite de jobs processados por minuto. **Requer restart.** |
| `scan_lock_ttl_minutes` | number | `30` | Tempo (minutos) do lock Redis por localização. Evita scans duplicados da mesma cidade. |

**Expressões CRON comuns:**

| Expressão | Significado |
|-----------|-------------|
| `0 * * * *` | A cada hora (minuto 0) |
| `*/30 * * * *` | A cada 30 minutos |
| `0 */2 * * *` | A cada 2 horas |
| `0 6-22 * * *` | A cada hora, das 6h às 22h |
| `0 8,12,18 * * *` | Às 8h, 12h e 18h |

**Nota:** A frequência individual por cidade é configurada em `/locations` (campo `scan_frequency_minutes`). O CRON schedule define quando o scheduler VERIFICA, a frequência por cidade define se aquela cidade precisa de um novo scan.

---

### Notifications

Controla push notifications via Firebase Cloud Messaging.

| Config | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| `push_enabled` | boolean | `true` | Habilita/desabilita envio de push notifications. Útil para desativar temporariamente sem remover a configuração do Firebase. |

**Como funciona o push:**

1. Notícia nova é inserida no banco via pipeline
2. Trigger Postgres dispara evento `NOTIFY new_news`
3. `newsEventListener` recebe o evento
4. Se `push_enabled` = true e Firebase está configurado:
   - Busca todos devices com `last_seen` nos últimos 30 dias
   - Envia push em batches de 500 tokens
   - Remove automaticamente tokens inválidos

**Formato da notificação:**
- **Título:** `{tipo_crime} em {cidade} - {bairro}`
- **Corpo:** Primeiros 100 caracteres do resumo

---

## Rate Limits

Configurados separadamente na tabela `api_rate_limits` (não faz parte do `system_config`).

**Endpoints:**
- **GET** `/settings/rate-limits` - Lista rate limits por provider
- **PATCH** `/settings/rate-limits/:id` - Atualiza rate limit

| Provider | Default Concurrent | Default Min Time | Default Daily Quota |
|----------|-------------------|-------------------|---------------------|
| Google | 1 | 100ms | 100 (free tier) |
| Jina | 10 | 50ms | - (ilimitado) |
| OpenAI | 5 | 200ms | - (ilimitado) |

**Campos configuráveis:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `max_concurrent` | number (1-50) | Máximo de chamadas simultâneas ao provider |
| `min_time_ms` | number (10-10000) | Intervalo mínimo entre chamadas (ms) |
| `daily_quota` | number ou null | Limite diário de chamadas (null = ilimitado) |
| `monthly_quota` | number ou null | Limite mensal de chamadas (null = ilimitado) |

**Refresh automático:** O backend recarrega configs de rate limit a cada 5 minutos. Alterações terão efeito em até 5 minutos sem necessidade de restart.

---

## Localizações Monitoradas

Cada localização (estado/cidade) tem suas próprias configurações.

**Endpoints:**
- **GET** `/locations` - Lista hierarquia (estados com cidades)
- **POST** `/locations` - Criar nova localização
- **PATCH** `/locations/:id` - Atualizar localização
- **POST** `/locations/:id/scan` - Disparar scan manual

**Campos por localização:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `active` | boolean | Se a cidade está sendo monitorada ativamente |
| `mode` | 'keywords' ou 'any' | Modo de busca: por palavras-chave específicas ou qualquer crime |
| `keywords` | string[] ou null | Palavras-chave (só usado quando mode = 'keywords') |
| `scan_frequency_minutes` | number (5-1440) | De quantos em quantos minutos fazer scan nesta cidade |

**Exemplo:** Uma cidade com `scan_frequency_minutes = 120` será escaneada a cada 2 horas (quando o scheduler CRON roda e detecta que já se passaram 120 min desde o último scan). Use `12` para 5x/hora, `20` para 3x/hora, `60` para 1x/hora.

---

## Resumo de Endpoints Admin

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/health` | Nenhum | Health check |
| GET | `/news` | Token | Feed de notícias |
| POST | `/search` | Token | Busca manual |
| POST | `/devices` | Token | Registrar device push |
| GET | `/locations` | Admin | Listar localizações |
| POST | `/locations` | Admin | Criar localização |
| PATCH | `/locations/:id` | Admin | Atualizar localização |
| POST | `/locations/:id/scan` | Admin | Scan manual |
| GET | `/users` | Admin | Listar usuários |
| POST | `/users` | Admin | Criar usuário |
| PATCH | `/users/:id` | Admin | Ativar/desativar |
| GET | `/settings/rate-limits` | Admin | Listar rate limits |
| PATCH | `/settings/rate-limits/:id` | Admin | Atualizar rate limit |
| GET | `/settings/budget/summary` | Admin | Resumo orçamento |
| GET | `/settings/budget/daily` | Admin | Custos diários |
| GET | `/settings/config` | Admin | Listar configs |
| PATCH | `/settings/config/:key` | Admin | Atualizar config |
| GET | `/stats` | Admin | Dashboard stats |
| GET | `/logs/recent` | Admin | Logs recentes |

**Autenticação:**
- **Token**: Header `Authorization: Bearer <supabase_jwt_token>`
- **Admin**: Token + campo `is_admin = true` na tabela `user_profiles`

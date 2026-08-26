-- =========================================================
-- SCHEMA extraido do banco VIVO — nao editar a mao
-- Origem: projeto uywvrkiujzcmfmoxbwna
-- Gerado: 2026-08-26T21:45:12.139Z
-- Por: backend/scripts/exportar-schema.ts
--
-- Cada DDL abaixo saiu de um emissor do proprio Postgres
-- (pg_get_constraintdef / indexdef / viewdef / functiondef / triggerdef),
-- os mesmos que o pg_dump usa. Regerar em vez de editar.
-- =========================================================

SET search_path = public, extensions;

-- ---------- 1. EXTENSIONS ----------
-- (pulada, o Supabase ja instala) pg_stat_statements
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
-- (pulada, o Supabase ja instala) plpgsql
-- (pulada, o Supabase ja instala) supabase_vault
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- ---------- 2. TABELAS ----------
CREATE TABLE IF NOT EXISTS public."api_rate_limits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "max_concurrent" integer DEFAULT 5 NOT NULL,
  "min_time_ms" integer DEFAULT 100 NOT NULL,
  "daily_quota" integer,
  "monthly_quota" integer,
  "active" boolean DEFAULT true,
  "updated_at" timestamp without time zone DEFAULT now(),
  "updated_by" uuid
);

CREATE TABLE IF NOT EXISTS public."billing_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "month" character varying(7) NOT NULL,
  "total_cost_usd" numeric(10,4) DEFAULT 0 NOT NULL,
  "total_scans" integer DEFAULT 0 NOT NULL,
  "breakdown" jsonb DEFAULT '{}'::jsonb,
  "closed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."budget_tracking" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL,
  "provider" text NOT NULL,
  "cost_usd" numeric(10,6) NOT NULL,
  "details" jsonb,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."city_group_members" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid,
  "location_id" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."city_groups" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."executive_cache" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cidade" text NOT NULL,
  "estado" text NOT NULL,
  "range_days" integer NOT NULL,
  "data" jsonb NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "search_id" uuid
);

CREATE TABLE IF NOT EXISTS public."monitored_locations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "type" text,
  "name" text NOT NULL,
  "parent_id" uuid,
  "active" boolean DEFAULT true,
  "mode" text DEFAULT 'any'::text,
  "keywords" text[],
  "last_check" timestamp without time zone,
  "created_at" timestamp without time zone DEFAULT now(),
  "scan_frequency_minutes" integer DEFAULT 60
);

CREATE TABLE IF NOT EXISTS public."news" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tipo_crime" text NOT NULL,
  "cidade" text NOT NULL,
  "bairro" text,
  "rua" text,
  "data_ocorrencia" date NOT NULL,
  "resumo" text NOT NULL,
  "embedding" vector(1536),
  "confianca" numeric(3,2),
  "active" boolean DEFAULT true,
  "created_at" timestamp without time zone DEFAULT now(),
  "natureza" text DEFAULT 'ocorrencia'::text,
  "categoria_grupo" text,
  "estado" text,
  "titulo" text,
  "hora_publicacao" time without time zone,
  "corpo" text
);

CREATE TABLE IF NOT EXISTS public."news_sources" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "news_id" uuid,
  "url" text NOT NULL,
  "source_name" text,
  "fetched_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."operation_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid,
  "stage" text,
  "urls_processed" integer,
  "news_found" integer,
  "cost_usd" numeric(10,6),
  "duration_ms" integer,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."pipeline_rejected_urls" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "url" text NOT NULL,
  "title" text,
  "stage" text NOT NULL,
  "reason" text,
  "location_id" uuid,
  "created_at" timestamp without time zone DEFAULT now(),
  "search_id" uuid
);

CREATE TABLE IF NOT EXISTS public."reports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "search_id" uuid,
  "cidade" text NOT NULL,
  "estado" text NOT NULL,
  "date_from" date NOT NULL,
  "date_to" date NOT NULL,
  "report_data" jsonb NOT NULL,
  "sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "expires_at" timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public."search_cache" (
  "search_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "params" jsonb NOT NULL,
  "params_hash" text,
  "status" text DEFAULT 'processing'::text,
  "total_results" integer,
  "created_at" timestamp without time zone DEFAULT now(),
  "expires_at" timestamp without time zone DEFAULT (now() + '24:00:00'::interval),
  "progress" jsonb
);

CREATE TABLE IF NOT EXISTS public."search_results" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "search_id" uuid,
  "offset_num" integer,
  "results" jsonb
);

CREATE TABLE IF NOT EXISTS public."system_config" (
  "key" text NOT NULL,
  "value" text NOT NULL,
  "description" text,
  "category" text DEFAULT 'general'::text NOT NULL,
  "value_type" text DEFAULT 'string'::text NOT NULL,
  "updated_at" timestamp without time zone DEFAULT now(),
  "updated_by" uuid
);

CREATE TABLE IF NOT EXISTS public."user_devices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "device_token" text NOT NULL,
  "platform" text,
  "last_seen" timestamp without time zone DEFAULT now(),
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."user_news_read" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "news_id" uuid,
  "read_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."user_notification_prefs" (
  "user_id" uuid NOT NULL,
  "cidades" text[],
  "categorias" text[],
  "estatisticas" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."user_profiles" (
  "id" uuid NOT NULL,
  "email" text NOT NULL,
  "is_admin" boolean DEFAULT false,
  "created_by" uuid,
  "active" boolean DEFAULT true,
  "created_at" timestamp without time zone DEFAULT now(),
  "must_change_password" boolean DEFAULT false,
  "password_reset_requested" boolean DEFAULT false
);

-- ---------- 3. CONSTRAINTS (PK -> UNIQUE -> CHECK -> FK) ----------
ALTER TABLE public."api_rate_limits" ADD CONSTRAINT "api_rate_limits_pkey" PRIMARY KEY (id);
ALTER TABLE public."billing_history" ADD CONSTRAINT "billing_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."budget_tracking" ADD CONSTRAINT "budget_tracking_pkey" PRIMARY KEY (id);
ALTER TABLE public."city_group_members" ADD CONSTRAINT "city_group_members_pkey" PRIMARY KEY (id);
ALTER TABLE public."city_groups" ADD CONSTRAINT "city_groups_pkey" PRIMARY KEY (id);
ALTER TABLE public."executive_cache" ADD CONSTRAINT "executive_cache_pkey" PRIMARY KEY (id);
ALTER TABLE public."monitored_locations" ADD CONSTRAINT "monitored_locations_pkey" PRIMARY KEY (id);
ALTER TABLE public."news" ADD CONSTRAINT "news_pkey" PRIMARY KEY (id);
ALTER TABLE public."news_sources" ADD CONSTRAINT "news_sources_pkey" PRIMARY KEY (id);
ALTER TABLE public."operation_logs" ADD CONSTRAINT "operation_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."pipeline_rejected_urls" ADD CONSTRAINT "pipeline_rejected_urls_pkey" PRIMARY KEY (id);
ALTER TABLE public."reports" ADD CONSTRAINT "reports_pkey" PRIMARY KEY (id);
ALTER TABLE public."search_cache" ADD CONSTRAINT "search_cache_pkey" PRIMARY KEY (search_id);
ALTER TABLE public."search_results" ADD CONSTRAINT "search_results_pkey" PRIMARY KEY (id);
ALTER TABLE public."system_config" ADD CONSTRAINT "system_config_pkey" PRIMARY KEY (key);
ALTER TABLE public."user_devices" ADD CONSTRAINT "user_devices_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_news_read" ADD CONSTRAINT "user_news_read_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_notification_prefs" ADD CONSTRAINT "user_notification_prefs_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."user_profiles" ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."api_rate_limits" ADD CONSTRAINT "api_rate_limits_provider_unique" UNIQUE (provider);
ALTER TABLE public."billing_history" ADD CONSTRAINT "billing_history_month_key" UNIQUE (month);
ALTER TABLE public."city_group_members" ADD CONSTRAINT "city_group_members_group_id_location_id_key" UNIQUE (group_id, location_id);
ALTER TABLE public."monitored_locations" ADD CONSTRAINT "unique_location" UNIQUE (type, name, parent_id);
ALTER TABLE public."news_sources" ADD CONSTRAINT "news_sources_url_key" UNIQUE (url);
ALTER TABLE public."search_cache" ADD CONSTRAINT "search_cache_params_hash_key" UNIQUE (params_hash);
ALTER TABLE public."user_devices" ADD CONSTRAINT "user_devices_device_token_key" UNIQUE (device_token);
ALTER TABLE public."user_news_read" ADD CONSTRAINT "user_news_read_user_id_news_id_key" UNIQUE (user_id, news_id);
ALTER TABLE public."api_rate_limits" ADD CONSTRAINT "api_rate_limits_provider_check" CHECK ((provider = ANY (ARRAY['google'::text, 'perplexity'::text, 'brave'::text, 'brightdata'::text, 'jina'::text, 'openai'::text])));
ALTER TABLE public."budget_tracking" ADD CONSTRAINT "budget_tracking_provider_check" CHECK ((provider = ANY (ARRAY['google'::text, 'perplexity'::text, 'brave'::text, 'brightdata'::text, 'jina'::text, 'openai'::text])));
ALTER TABLE public."budget_tracking" ADD CONSTRAINT "budget_tracking_source_check" CHECK ((source = ANY (ARRAY['auto_scan'::text, 'manual_search'::text])));
ALTER TABLE public."monitored_locations" ADD CONSTRAINT "monitored_locations_mode_check" CHECK ((mode = ANY (ARRAY['keywords'::text, 'any'::text])));
ALTER TABLE public."monitored_locations" ADD CONSTRAINT "monitored_locations_type_check" CHECK ((type = ANY (ARRAY['state'::text, 'city'::text])));
ALTER TABLE public."news" ADD CONSTRAINT "news_categoria_grupo_check" CHECK ((categoria_grupo = ANY (ARRAY['patrimonial'::text, 'seguranca'::text, 'operacional'::text, 'fraude'::text, 'institucional'::text])));
ALTER TABLE public."news" ADD CONSTRAINT "news_natureza_check" CHECK ((natureza = ANY (ARRAY['ocorrencia'::text, 'estatistica'::text])));
ALTER TABLE public."search_cache" ADD CONSTRAINT "search_cache_status_check" CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])));
ALTER TABLE public."system_config" ADD CONSTRAINT "system_config_value_type_check" CHECK ((value_type = ANY (ARRAY['string'::text, 'number'::text, 'boolean'::text])));
ALTER TABLE public."user_devices" ADD CONSTRAINT "user_devices_platform_check" CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text])));
ALTER TABLE public."api_rate_limits" ADD CONSTRAINT "api_rate_limits_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public."city_group_members" ADD CONSTRAINT "city_group_members_group_id_fkey" FOREIGN KEY (group_id) REFERENCES city_groups(id) ON DELETE CASCADE;
ALTER TABLE public."city_group_members" ADD CONSTRAINT "city_group_members_location_id_fkey" FOREIGN KEY (location_id) REFERENCES monitored_locations(id) ON DELETE CASCADE;
ALTER TABLE public."monitored_locations" ADD CONSTRAINT "monitored_locations_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES monitored_locations(id) ON DELETE CASCADE;
ALTER TABLE public."news_sources" ADD CONSTRAINT "news_sources_news_id_fkey" FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE;
ALTER TABLE public."operation_logs" ADD CONSTRAINT "operation_logs_location_id_fkey" FOREIGN KEY (location_id) REFERENCES monitored_locations(id) ON DELETE CASCADE;
ALTER TABLE public."pipeline_rejected_urls" ADD CONSTRAINT "pipeline_rejected_urls_location_id_fkey" FOREIGN KEY (location_id) REFERENCES monitored_locations(id) ON DELETE CASCADE;
ALTER TABLE public."reports" ADD CONSTRAINT "reports_search_id_fkey" FOREIGN KEY (search_id) REFERENCES search_cache(search_id) ON DELETE SET NULL;
ALTER TABLE public."search_cache" ADD CONSTRAINT "search_cache_user_id_fkey" FOREIGN KEY (user_id) REFERENCES user_profiles(id);
ALTER TABLE public."search_results" ADD CONSTRAINT "search_results_search_id_fkey" FOREIGN KEY (search_id) REFERENCES search_cache(search_id) ON DELETE CASCADE;
ALTER TABLE public."system_config" ADD CONSTRAINT "system_config_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public."user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."user_news_read" ADD CONSTRAINT "user_news_read_news_id_fkey" FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE;
ALTER TABLE public."user_news_read" ADD CONSTRAINT "user_news_read_user_id_fkey" FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."user_notification_prefs" ADD CONSTRAINT "user_notification_prefs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public."user_profiles" ADD CONSTRAINT "user_profiles_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."user_profiles" ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id);

-- ---------- 4. INDICES (os de constraint saem no passo 3) ----------
CREATE INDEX idx_billing_history_month ON public.billing_history USING btree (month DESC);
CREATE INDEX idx_budget_created ON public.budget_tracking USING btree (created_at DESC);
CREATE INDEX idx_budget_tracking_provider ON public.budget_tracking USING btree (provider, created_at DESC);
CREATE INDEX idx_city_group_members_group ON public.city_group_members USING btree (group_id);
CREATE INDEX idx_city_group_members_location ON public.city_group_members USING btree (location_id);
CREATE INDEX executive_cache_expires ON public.executive_cache USING btree (expires_at);
CREATE INDEX executive_cache_lookup ON public.executive_cache USING btree (cidade, estado, range_days);
CREATE INDEX executive_cache_search_lookup ON public.executive_cache USING btree (search_id) WHERE (search_id IS NOT NULL);
CREATE UNIQUE INDEX executive_cache_unique_dashboard ON public.executive_cache USING btree (cidade, estado, range_days) WHERE (search_id IS NULL);
CREATE UNIQUE INDEX executive_cache_unique_search ON public.executive_cache USING btree (search_id) WHERE (search_id IS NOT NULL);
CREATE INDEX idx_news_analytics ON public.news USING btree (cidade, tipo_crime) WHERE (active = true);
CREATE INDEX idx_news_cidade ON public.news USING btree (cidade);
CREATE INDEX idx_news_cidade_data_tipo ON public.news USING btree (cidade, data_ocorrencia, tipo_crime) WHERE (active = true);
CREATE INDEX idx_news_cidade_estado ON public.news USING btree (cidade, estado) WHERE (active = true);
CREATE INDEX idx_news_cidade_tipo ON public.news USING btree (cidade, tipo_crime) WHERE (active = true);
CREATE INDEX idx_news_created ON public.news USING btree (created_at DESC);
CREATE INDEX idx_news_data ON public.news USING btree (data_ocorrencia DESC);
CREATE INDEX news_embedding_idx ON public.news USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_logs_created ON public.operation_logs USING btree (created_at DESC);
CREATE INDEX idx_operation_logs_location ON public.operation_logs USING btree (location_id, created_at DESC);
CREATE INDEX idx_rejected_created ON public.pipeline_rejected_urls USING btree (created_at DESC);
CREATE INDEX idx_rejected_search ON public.pipeline_rejected_urls USING btree (search_id) WHERE (search_id IS NOT NULL);
CREATE INDEX idx_rejected_stage ON public.pipeline_rejected_urls USING btree (stage);
CREATE INDEX idx_reports_expires ON public.reports USING btree (expires_at);
CREATE INDEX idx_user_news_read ON public.user_news_read USING btree (user_id, news_id);

-- ---------- 5. VIEWS ----------
CREATE OR REPLACE VIEW public."budget_summary" AS
 SELECT date_trunc('month'::text, created_at) AS month,
    source,
    provider,
    sum(cost_usd) AS total_cost_usd,
    count(*) AS total_requests
   FROM budget_tracking
  GROUP BY (date_trunc('month'::text, created_at)), source, provider;


-- ---------- 6. FUNCOES (as de extensao ficam de fora) ----------
CREATE OR REPLACE FUNCTION public.notify_new_news()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM pg_notify(
    'new_news',
    json_build_object(
      'id', NEW.id,
      'tipo_crime', NEW.tipo_crime,
      'cidade', NEW.cidade,
      'bairro', NEW.bairro,
      'resumo', NEW.resumo
    )::text
  );
  RETURN NEW;
END;
$function$
;


-- ---------- 7. TRIGGERS ----------
CREATE TRIGGER news_inserted_trigger AFTER INSERT ON public.news FOR EACH ROW EXECUTE FUNCTION notify_new_news();

-- ---------- 8. RLS (retrato da origem; a 035 fecha o resto) ----------
ALTER TABLE public."api_rate_limits" ENABLE ROW LEVEL SECURITY;
-- billing_history: RLS DESLIGADA na origem (a 035 fecha)
ALTER TABLE public."budget_tracking" ENABLE ROW LEVEL SECURITY;
-- city_group_members: RLS DESLIGADA na origem (a 035 fecha)
-- city_groups: RLS DESLIGADA na origem (a 035 fecha)
ALTER TABLE public."executive_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."monitored_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."news" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."news_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."operation_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pipeline_rejected_urls" ENABLE ROW LEVEL SECURITY;
-- reports: RLS DESLIGADA na origem (a 035 fecha)
ALTER TABLE public."search_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."search_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."system_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_news_read" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_notification_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_profiles" ENABLE ROW LEVEL SECURITY;

-- ---------- 9. POLICIES ----------
CREATE POLICY "Authenticated users can read rejected urls" ON public."pipeline_rejected_urls"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Service role can delete rejected urls" ON public."pipeline_rejected_urls"
  AS PERMISSIVE
  FOR DELETE
  TO service_role
  USING (true);
CREATE POLICY "Service role can insert rejected urls" ON public."pipeline_rejected_urls"
  AS PERMISSIVE
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ---------- 10. GRANTS (paridade com a origem) ----------
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."api_rate_limits" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."api_rate_limits" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."api_rate_limits" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."billing_history" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."billing_history" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."billing_history" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."budget_summary" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."budget_summary" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."budget_summary" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."budget_tracking" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."budget_tracking" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."budget_tracking" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."city_group_members" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."city_group_members" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."city_group_members" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."city_groups" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."city_groups" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."city_groups" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."executive_cache" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."executive_cache" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."executive_cache" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."monitored_locations" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."monitored_locations" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."monitored_locations" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."news" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."news" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."news" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."news_sources" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."news_sources" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."news_sources" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."operation_logs" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."operation_logs" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."operation_logs" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."pipeline_rejected_urls" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."pipeline_rejected_urls" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."pipeline_rejected_urls" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."reports" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."reports" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."reports" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."search_cache" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."search_cache" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."search_cache" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."search_results" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."search_results" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."search_results" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."system_config" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."system_config" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."system_config" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."user_devices" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."user_devices" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."user_devices" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."user_news_read" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."user_news_read" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."user_news_read" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."user_notification_prefs" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."user_notification_prefs" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."user_notification_prefs" TO "service_role";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."user_profiles" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."user_profiles" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."user_profiles" TO "service_role";

-- ---------- fim ----------
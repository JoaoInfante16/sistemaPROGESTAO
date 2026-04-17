-- Fase 2: DROP coluna resumo_agregado em news
-- Motivo: feature nunca foi implementada. Coluna existia desde Fase 1 mas nenhum
-- INSERT/UPDATE a populava. Flutter usava fallback `resumoAgregado ?? resumo` que
-- sempre caia no `resumo`. Removido pra limpar dead code.
--
-- ORDEM DE APLICACAO:
-- 1) Deploy do backend novo (sem SELECT de resumo_agregado) em producao
-- 2) SO DEPOIS rodar esta migration
-- Se rodar antes, o codigo velho em prod quebra (coluna desaparece mas SELECT ainda pede).

-- UP
ALTER TABLE news DROP COLUMN IF EXISTS resumo_agregado;

-- DOWN (caso precise reverter — vai voltar vazia, dados antigos perdidos)
-- ALTER TABLE news ADD COLUMN resumo_agregado TEXT;

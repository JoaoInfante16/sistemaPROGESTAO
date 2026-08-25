-- 034_news_corpo.sql
--
-- Adiciona `corpo` em `news`: o texto que a FOLHA mostra quando a pessoa toca
-- no card. Ate aqui ela nao tinha nenhum.
--
-- POR QUE: o card imprime o `resumo` INTEIRO — decisao do Joao em 09/08, e boa:
-- se o paragrafo cabe todo, nao precisa de sanfona, e o toque passa a ter um
-- significado so. O efeito colateral e que a folha aberta no toque mostrava o
-- MESMO texto, caractere por caractere. Tocar num card nao entregava nenhuma
-- palavra a mais; so a ficha (rua, tipo, fontes). O proprio cabecalho de
-- `news_detail_sheet.dart` ja registrava que a folha quase morreu por isso.
--
-- O teto de 190 do `resumo` existe por causa do CARD, e nao pode subir: passar
-- disso quebra o ritmo vertical da lista. Entao o corpo e um campo separado.
--
-- CUSTO ~ZERO, e este e o argumento central: a Jina ja busca o artigo inteiro e
-- o Filter2 ja le ate `filter2_max_content_chars` (6000) para extrair
-- cidade/data/tipo. O conteudo esta em maos e era descartado. Escrever ~900
-- caracteres a mais sai no MESMO request: algo como 200 tokens de saida, ~US$
-- 0,0001 por materia. Nenhuma chamada nova, nenhum fetch novo.
--
-- ⚠️ Ficou ainda mais necessario depois do dedup de 24/08: agora varios relatos
-- do mesmo caso sao FUNDIDOS num texto so, e a uniao de tres veiculos nao cabe
-- em 190 caracteres. Sem o corpo, consolidar significa escolher o que jogar
-- fora.
--
-- NULLABLE de proposito, pelos mesmos dois motivos da 029 (`titulo`):
--   1. linha existente fica sem corpo e NAO e reprocessada — a folha cai no
--      `resumo`, que e o comportamento de hoje;
--   2. item novo cujo GPT nao devolveu o corpo NAO e rejeitado. Descartar uma
--      ocorrencia ja paga em SERP + Jina por causa de um campo de leitura seria
--      o pior negocio possivel.
--
-- Aditiva e reversivel: nao toca linha existente, nao muda constraint, nao
-- quebra o app publicado (que ignora coluna que nao conhece).
-- Reverter: ALTER TABLE news DROP COLUMN corpo;

ALTER TABLE news ADD COLUMN IF NOT EXISTS corpo TEXT;

COMMENT ON COLUMN news.corpo IS
  'Texto de leitura (max ~900 char) escrito pelo Filter2 no mesmo request do resumo, mostrado apenas na folha de detalhe. NULL nas linhas anteriores a 25/08/2026 — a folha cai no resumo.';

-- 029_news_titulo.sql
--
-- Adiciona `titulo` em `news`: manchete curta e neutra escrita pelo Filter2.
--
-- POR QUE: ate aqui a "manchete" do app era o tipo de crime em caixa alta
-- ("HOMICIDIO · Kobrasol") com o resumo embaixo. O redesign (fio de agencia)
-- tem a manchete como peca central da leitura, e o `resumo` nao serve: foi
-- escrito como paragrafo de 1-2 frases, e a primeira frase costuma passar de
-- 150 caracteres — cinco linhas em corpo de manchete, o que mata o ritmo
-- vertical que faz a lista ser escaneavel.
--
-- O Filter2 ja le o artigo inteiro pra extrair cidade/data/tipo, entao a
-- manchete sai no MESMO request: custo marginal ~0 (algumas dezenas de tokens
-- de saida por item), nenhuma chamada nova.
--
-- DECISAO DE PRODUTO: o campo e ESCRITO pelo GPT, nao copiado do veiculo.
-- Imprensa policial brasileira titula no sensacional ("VEJA O VIDEO",
-- "EXECUTADO A SANGUE FRIO") e o produto e ferramenta de trabalho sobria pra
-- quem lida com isso o dia inteiro. Copiar o titulo da fonte importaria o tom
-- que o app existe pra nao ter.
--
-- NULLABLE de proposito, em duas frentes:
--   1. as linhas ja existentes ficam sem titulo e NAO sao reprocessadas
--      (reprocessar custaria Jina + GPT de novo por item, pra um campo
--      cosmetico) — o app compoe "Homicidio no Kobrasol" dos campos
--      estruturados quando vem null;
--   2. item novo cujo GPT nao devolveu headline NAO e rejeitado. Jogar fora
--      uma ocorrencia ja paga em SERP + Jina por causa de um titulo seria o
--      pior negocio possivel.
--
-- Aditiva e reversivel: nao toca nenhuma linha existente, nao muda constraint,
-- nao quebra o app publicado (que ignora colunas que nao conhece).
-- Reverter: ALTER TABLE news DROP COLUMN titulo;

ALTER TABLE news ADD COLUMN IF NOT EXISTS titulo TEXT;

COMMENT ON COLUMN news.titulo IS
  'Manchete curta (max 90 char) escrita pelo Filter2 em tom neutro, nao copiada do veiculo. NULL nas linhas anteriores a 06/08/2026 — o cliente compoe do tipo_crime + bairro.';

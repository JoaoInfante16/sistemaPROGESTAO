-- 030_news_hora_publicacao.sql
--
-- Adiciona `hora_publicacao` em `news`: a hora que o veiculo publicou a
-- materia, como ela aparece impressa na propria pagina.
--
-- POR QUE: o app mostra um carimbo de hora na slug de cada materia
-- ("SEGURANCA  Sao Jose - Frei Damiao   07:40"). Esse carimbo lia
-- `data_ocorrencia`, que e uma coluna **DATE** — sem hora. Toda materia do app,
-- sempre, exibia `00:00`. Nao era um caso raro: era 100% dos itens, um campo
-- ocupando espaco na linha mais disputada do card pra dizer nada.
--
-- Detectado pelo Joao olhando o aparelho, no dia 09/08:
--   "e muito melhor saber que hora que foi o acontecimento do que que hora foi
--    a varredura, esse 00:00 ai e inutil"
--
-- POR QUE HORA DE PUBLICACAO, E NAO DO FATO: a hora do fato quase nunca esta
-- no texto de forma extraivel ("por volta das 3h da madrugada" e aproximacao,
-- as vezes de outro dia). A hora de publicacao esta impressa em praticamente
-- todo portal brasileiro e e exata. E e tambem o que um carimbo de fio
-- significa: quando a materia entrou no fio, nao quando o fato aconteceu.
--
-- POR QUE NAO USAR `created_at`: esse e o momento em que NOS coletamos, ou
-- seja a hora da varredura — exatamente o que o Joao apontou como inutil. Uma
-- materia publicada as 07:40 e varrida as 23:10 carimbaria 23:10.
--
-- TIPO `TIME`, sem fuso, DE PROPOSITO. O valor e a hora local que o veiculo
-- imprimiu na pagina ("Publicado em 04/08/2026 as 14:32"). Nao sabemos o offset
-- com que ele foi escrito, e converter um horario que ja esta no fuso do leitor
-- brasileiro so pode piorar. **Exibir cru, nunca converter.**
--
-- NULLABLE em duas frentes:
--   1. as linhas existentes ficam sem hora e NAO sao reprocessadas — reler o
--      artigo custaria Jina + GPT de novo por item;
--   2. artigo que nao imprime hora (acontece) nao rejeita a ocorrencia.
--   O app **omite o carimbo** quando vem null, em vez de inventar 00:00: campo
--   que mente e pior que campo ausente.
--
-- `data_ocorrencia` NAO e tocada: ela e DATE, indexada, e usada em todo filtro
-- e ordenacao do sistema. Mudar o tipo dela seria reescrever a tabela.
--
-- Aditiva e reversivel. Reverter: ALTER TABLE news DROP COLUMN hora_publicacao;

ALTER TABLE news ADD COLUMN IF NOT EXISTS hora_publicacao TIME;

COMMENT ON COLUMN news.hora_publicacao IS
  'Hora local impressa pelo veiculo na materia (ex: 14:32). SEM fuso de proposito — exibir cru, nunca converter. NULL quando o artigo nao informa ou para linhas anteriores a 09/08/2026.';

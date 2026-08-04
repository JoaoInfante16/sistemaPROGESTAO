# Contrato da API — as decisoes de contrato

> 📌 **Documento vivo** — atualizado sempre que uma *decisao* de contrato muda.
> Nao e arquivado com a fase. Ver [README](./README.md).
>
> Ultima revisao: **2026-08-04**.
>
> Staging: `https://simeops-backend.onrender.com`
> Producao: `https://sistemaprogestao-7fzs.onrender.com`
> ⚠️ Producao ainda roda codigo de junho (`main`). Ver [ROADMAP](./ROADMAP.md).

---

## O que esta aqui e o que nao esta

**A lista de rotas esta em [`backend/src/routes/`](../backend/src/routes/) e os
shapes de request em [`validation.ts`](../backend/src/middleware/validation.ts).**
Copiar isso pra ca so cria uma segunda verdade que envelhece — foi o que
aconteceu com a tabela "o que o app ainda ignora", que sobreviveu meses depois da
Fase 9 ter implementado tudo.

Melhor ainda: os comentarios do `validation.ts` **ja explicam o porque** de cada
limite, colados na linha que o aplica. Leia la.

Aqui ficam so as decisoes de contrato: as que, se alguem desfizer sem saber,
quebram o app na mao do cliente.

---

## A regra que nao pode ser quebrada

**`body['results']` e a lista que o app renderiza — e continua sendo APENAS o
balde principal.** Tudo que a Fase 8 acrescentou vai pendurado em `extras`, ao
lado:

```jsonc
{
  "results": [ /* SO o principal, no shape de sempre */ ],
  "extras": {
    "regiao":          [ /* cidades vizinhas */ ],
    "fora_do_periodo": [ /* mais antigas que a janela pedida */ ]
  }
}
```

Se um dia os extras forem misturados em `results`, **o APK que esta na mao do
cliente passa a exibi-los na lista e a conta-los nas estatisticas, sem ninguem
perceber.** O usuario veria "47 ocorrencias em Salvador" quando 12 sao de
Camacari e 9 sao de tres meses atras. Foi por isso que o contrato ficou assim, e
e por isso que ele nao muda.

**Cada item aparece em exatamente um dos tres baldes.** Quem e vizinha *e* velha
conta como vizinha — mas os dois sinalizadores (`cidade_vizinha`,
`fora_do_periodo`) viajam dentro do item, entao da pra reconstruir a verdade
completa sem depender do balde.

---

## `natureza: "estatistica"` nao e ocorrencia

Sao indicadores — *"homicidios cairam 12% no semestre"*. O backend ja os separa
nos agregados, mas **a lista precisa trata-los diferente ou eles inflam a
contagem**: uma materia de balanco anual viraria "1 ocorrencia" no card.

---

## O relatorio e o mapa filtram os extras — de proposito

`POST /analytics/report`, `GET /analytics/executive` e `POST /analytics/map-points`
seguem o recorte que o usuario pediu, sem regiao e sem fora-do-periodo.

**No mapa isso e critico:** o geocode roda contra a cidade **da requisicao**,
entao um bairro de Camacari viraria pino dentro de Salvador. Nao e cosmetico — e
informacao falsa num mapa de criminalidade.

Desde 04/08 o relatorio **declara o proprio recorte** em datas concretas e traz a
regiao como toggle explicito, justamente pra que o usuario nao leia o total como
se fosse tudo do periodo que ele pediu.

---

## O 409 e acionavel

Busca ja rodando devolve `409` **com `searchId`, `params` e `progress`** — da pra
oferecer *"Salvador em andamento (42%) — ver progresso / cancelar"* em vez de um
erro seco.

E se a busca anterior morreu (sem avanco de progresso ha 20 min), o backend a
marca como `failed` sozinho e **deixa a nova passar**. Sem isso, uma busca
travada bloquearia o usuario pra sempre.

---

## Progresso: por que os estagios 4 e 5 tem contador

Os sete estagios do `progress` acompanham o funil
(ver [ARQUITETURA](./ARQUITETURA.md)). Sao **4 (Jina) e 5 (Filter2)** que levam a
maior parte do tempo — e sao exatamente os que ganharam `feitos`/`total` e
`achados`, porque eram neles que a tela *parecia travada*.

A escrita e estrangulada em ~1 a cada 2s (o polling e de 3s; mais que isso nao
apareceria), mas **o ultimo item de cada estagio sempre escreve**, senao a barra
nunca fecharia em 100%.

**`atualizado_em` existe para o app desistir por ESTAGNACAO, nao por relogio.**
O `_maxPolls = 200` antigo desistia em 10 min mesmo com a busca andando — e era
esse o bug que o cliente reportava. Ja trocado no app (04/08). Nao voltar a
cravar numero magico de timeout: buscas longas sao legitimas.

---

## Assuntos: termos livres, de proposito

`assuntos: string[]` (ate 20) substituiu o `tipo_crime` (uma string, uma query).
Cada assunto vira uma query `<assunto> <cidade>` — **e um teto novo de ~60-70
itens no indice do Google**, que e a unica alavanca real de alcance.

Sao termos **livres**: a taxonomia
([`taxonomia.ts`](../backend/src/utils/taxonomia.ts), servida por
`GET /settings/taxonomia`) e so uma sugestao boa, e o usuario pode digitar
`greve` ou `queda de energia`.

**Ausente = a lista do painel (`search_subjects`)** — que e o comportamento
antigo. Foi assim de proposito: o APK que o cliente tem hoje nao manda `assuntos`
e continua funcionando igual.

⚠️ Os assuntos escolhidos **entram como contexto nos prompts do Filter1 e do
Filter2**. Sem isso o Filter1 mata `greve`/`bloqueio` pacifico antes do Jina, em
silencio, por "nao ser seguranca publica". Quem mexer nos prompts precisa
preservar essa regra.

---

## Uma cidade por busca

`cidades` aceita exatamente **1**. A regiao metropolitana ja vem junto, das
**mesmas** queries, marcada como `cidade_vizinha` — entao `1 cidade + regiao`
custa o mesmo que `1 cidade` custava. Permitir N seria pagar N vezes por algo que
ja esta incluso.

⚠️ **O APK que o cliente tem hoje deixa escolher ate 10.** Enquanto ele nao
atualizar, escolher 2+ da **400**. Backend e app precisam subir juntos — ou
aceitar essa janela conscientemente (foi o que o Joao escolheu em 04/08).

---

## Push de conclusao

Ja manda `search_id` e `type: manual_search_completed | _failed`, e o app ja abre
o resultado direto (9.7, 02/08).

---

## Onde procurar o resto

| pergunta | onde |
|---|---|
| que rotas existem | [`backend/src/routes/`](../backend/src/routes/) |
| o que cada rota aceita, e **por que** aquele limite | [`validation.ts`](../backend/src/middleware/validation.ts) |
| como o item de resultado e montado | [`manualSearchWorker.ts`](../backend/src/jobs/workers/manualSearchWorker.ts) |
| como o app le tudo isso | [`news_item.dart`](../mobile-app/lib/core/models/news_item.dart) |
| onde cada item do funil morre | [FUNIL.md](./FUNIL.md) |

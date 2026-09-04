# SIMEops — Briefing de implementação

Evolução do app atual (monitor de notícias) para sistema multiplataforma com dois
módulos de ingestão e três perfis de acesso.

Referência visual: `prototipo.html` (protótipo navegável, tudo funcional exceto dados).
O protótipo é a fonte de verdade para layout, hierarquia e microcópia.

---

## ⚠️ Leia isto antes do resto — o que foi medido e não bate

> **Este briefing foi escrito sem acesso ao código nem às bases reais.** Em
> 30/08/2026 as três planilhas da SIC foram analisadas (3.396 registros) e o
> código foi conferido. O que segue abaixo continua valendo como **direção de
> produto, layout, hierarquia e microcópia** — que é o que ele faz bem.
>
> **Onde ele afirma número ou fórmula, a verdade agora é**
> [FORMULARIOS_SIC.md](./FORMULARIOS_SIC.md) e [MUDANCAS.md](./MUDANCAS.md).

| onde | o briefing diz | o que foi medido |
|---|---|---|
| §1 | "dois módulos de ingestão" | são **três** frentes de formulário — consultor, **mediador** e **apoio social** — mais as notícias. O mediador e o apoio social não aparecem no briefing |
| §2 | três perfis | quatro públicos, cada um num lugar |
| §2 | "cliente final: nenhum acesso ao app, recebe o relatório exportado" | 🚨 **falso desde 03/09.** O cliente final **entra num site ao vivo**, a qualquer hora, e **registra ocorrências da loja** — que alimentam o mesmo banco e são cruzadas com as do consultor |
| §12 | relatório do cliente como documento a exportar | 🚨 **não é documento, é site.** Nada de PDF nem de exportação: link com acesso permanente |
| §5 | "28 perguntas em 7 blocos" | **39 perguntas**. O `BLOCKS` do protótipo pula duas condicionais e fica deslocado em **+2** a partir do bloco 5 |
| §5, §8, §9 | fórmulas por número de pergunta (`Q21`, `Q15`…) | **o número não identifica pergunta** — duas perguntas diferentes aparecem como "16" conforme o caminho. Toda fórmula que cite Q≥12 está errada. Usar nome fixo |
| §8 | "valor prevenido = soma de Q21 nas tentativas" | é a pergunta 23 — e **53 dos 304 registros com valor estão marcados "Consumado"**, onde não houve prevenção |
| §8 | "eficácia da resposta" via grau de sucesso | **683 de 851 respostas são "5"** (80%). Sem variação, não mede nada |
| §9 | funil de risco em barras empilhadas | **as etapas não se contêm**: 735 avaliaram sucesso e só 476 formalizaram; 314 têm ocorrência com "risco = Não". Empilhar seria mentira gráfica |
| §9 | "preenchimento suspeito" por tempo abaixo da média | a mediana real é **3 min** e o consultor mais produtivo tem 2,7 min — marcaria os melhores. O sinal que funciona é **envio em lote** (76 janelas, 29% da base) |
| §10 | tokens de cor | a paleta reprova no branco: verde de ação **1,70:1**, ouro 2,87, `--mute` 3,66. A escala validada já existe no `estilo.ts` do relatório |
| §12 | "definir se o relatório sai como PDF, link ou ambos" | **decidido por medição em 14/08**: PDF no aparelho não termina em 90s no A57. É link + impressão nativa |
| §12 | "coordenadas das unidades bloqueiam o selo" | falta também coordenada **do artigo** — `news` não tem lat/lng, e o geocode roda depois da entrega |

🚨 **E o maior desvio de todos, de 03/09:** o briefing descreve um **app de
notícias que ganhou formulários**. A SIC pediu o contrário — **a notícia vira
matéria-prima de indicador**, dentro do dashboard e do relatório, e o feed de
leitura sai do centro do produto. Toda a proposta de navegação abaixo (as abas, a
hierarquia, o que fica na barra) precisa ser relida com isso em mente.

**O que o briefing acertou e ninguém tinha medido:** a pergunta-portão antes do
bloco de ocorrências. O apoio social já faz exatamente isso
(`Observação` × `Multidimensional`).

---

## 1. Contexto

**Quem usa:** a SIC, consultoria de gestão de risco que atende supermercados
(Atacadão, Carrefour Bairro/Express/Hiper, Sam's Club).

**O que muda:** hoje o app só monitora notícias. Passa a ter também os formulários
de campo que os consultores aplicam nas visitas, e a gerar relatórios que combinam
as duas fontes.

**A tese do produto:** a imprensa mostra o que virou notícia; o formulário mostra o
que ninguém publicou. O valor está no cruzamento.

---

## 2. Perfis e permissões

| Perfil | Acesso |
|---|---|
| **Consultor** | App completo: Hoje, Notícias, Campo (registros + relatórios), Config |
| **Liderança** | Mesmo app, com Hoje substituído pelo Painel. Não preenche formulário |
| **Cliente final** | Nenhum acesso ao app. Recebe apenas o relatório exportado (PDF ou link) |

Regra: a barra de navegação é **idêntica** para consultor e liderança —
três itens, mesmos rótulos. Só o conteúdo da primeira aba difere.

---

## 3. Navegação

```
Hoje  ·  Notícias  ·  Campo
```

Configurações **não** ocupa espaço na barra. Fica na engrenagem do canto
superior direito, presente no Hoje e no Painel.

### Hoje (consultor)
Ordem fixa das seções:
1. Estado de sincronização (ver §7)
2. Briefing em uma frase, com números em negrito
3. Visitas de hoje
4. Pendências (rascunho parado, relatório aguardando revisão)
5. Notícias novas da região do consultor + botão "Ver todas as notícias"

### Hoje (liderança) — o Painel
Quatro sub-abas: **Atenção · Operação · Risco · Cruzamento**.
Abre em Atenção, não em Operação — o gestor precisa ver o que exige decisão hoje.

> **Ajuste pendente:** quatro sub-abas cortam na borda em telas estreitas.
> Avaliar reduzir para três ou tornar a faixa claramente rolável.

### Notícias
Duas sub-abas: **Monitorando** (cidades acompanhadas) e **Consultas**
(buscas pontuais + histórico). Antes eram duas abas separadas na barra inferior;
foram unificadas porque leem a mesma base.

### Campo
Duas sub-abas: **Registros** (formulários) e **Relatórios** (montagem e exportação).

---

## 4. Feed de notícias — hierarquia em dois níveis

Esta é a mudança mais importante do módulo de notícias. O feed antigo tratava
todas as notícias como iguais; com 26 novas por dia isso é ilegível.

### Resumo do dia
Uma frase no topo, gerada a partir dos dados do dia:

> 3 ocorrências de furto em varejo na Grande Florianópolis, sendo 2 a menos de
> 2 km de unidades da sua carteira. O restante é contexto da região.

### Perto de você
Notícia é **relevante** quando:
- ocorre a menos de 2 km de uma unidade da carteira do consultor, **ou**
- é categoria Segurança/Patrimonial **e** menciona varejo, supermercado,
  atacadista, furto, roubo ou receptação

Renderiza como card completo: selo de proximidade com distância e nome da
unidade, categoria, manchete, resumo, fonte. Borda esquerda vermelha.

### Contexto da região
Todo o resto. Uma linha: quadradinho de cor da categoria, manchete em uma linha,
horário. Toque expande resumo e fonte inline. Sete visíveis, resto atrás de
"Ver mais N do dia".

**Dependência:** exige latitude/longitude de cada unidade da carteira para
calcular a distância. Sem isso, o critério cai só para categoria + palavra-chave
e o selo de proximidade não aparece.

---

## 5. Formulário de campo

Espelha o "Report Diário — Consultor" da SIC (Microsoft Forms).
**28 perguntas em 7 blocos. As perguntas e opções não podem ser alteradas.**

| Bloco | Perguntas |
|---|---|
| 1. Identificação do Consultor | Q1 |
| 2. Atendimento | Q2–Q4 |
| 3. Dados Atendimento | Q5–Q7 |
| 4. Análise territorial e estrutural | Q8–Q11 |
| 5. Partes interessadas | Q12–Q13 |
| 6. Avaliação de Processos Internos | Q14 |
| 7. Ocorrências e Ações | Q15–Q28 |

O enunciado completo de cada pergunta e todas as opções estão no array `BLOCKS`
do protótipo — copiar de lá, é literal do Forms.

### Melhorias na camada de apresentação
Não alteram as perguntas, só como aparecem:

- **Blocos navegáveis:** sete tracinhos sob a barra de progresso, clicáveis.
  Concluídos em teal, atual em verde, pendentes em cinza.
- **Exibição condicional:** Q23 ("Se não, por quê?") só aparece quando Q22 = "Não".
  Mesma lógica para Q21, que só faz sentido em tentativa.
- **Rascunho automático** a cada resposta, com timestamp visível.

### Instrumentação a coletar
Não existe no Forms e é necessária para os indicadores de qualidade do Painel:
- timestamp de abertura e de envio de cada formulário
- tempo total de preenchimento
- contagem de campos deixados em branco e de uso da opção "Outra"

---

## 6. Retomada de rascunho

Barra fina persistente logo acima da navegação, visível em qualquer tela enquanto
existir rascunho aberto:

```
● Rascunho aberto · salvo no aparelho
  Carrefour Bairro Centro · bloco 4 de 7          RETOMAR
```

Some ao enviar. O botão flutuante de novo formulário sobe para não colidir.

---

## 7. Offline — requisito não negociável

O consultor preenche dentro do supermercado, onde o sinal é ruim. Se ele não
enxergar que o trabalho está salvo, abandona o app e volta pro Forms.

- Formulários gravam em storage local a cada resposta, não só no envio
- Fila de envio com retry automático
- Estado visível em três lugares: topo do Hoje, topo de Campo → Registros, e
  sob a barra de progresso do formulário
- A palavra "salvo" precisa aparecer literalmente. Exemplos do protótipo:
  "Sem conexão · 3 registros aguardando envio — Salvos no aparelho",
  "Salvo no aparelho às 09:41 · envio pendente"

---

## 8. Relatório do cliente

Documento exportável (PDF ou link protegido por senha). **Tema claro sempre**,
independente do tema do app.

### Hierarquia — a ordem é o produto

1. **Veredito** — caixa com borda vermelha de 3px, faixa "ATENÇÃO ELEVADA",
   índice de exposição em número gigante, comparação com a média da bandeira
2. **O que fazer agora** — ações numeradas com etiqueta de prioridade
   (URGENTE · 3º MÊS / URGENTE / ESTE MÊS / CONCLUÍDA). Cada uma cita as
   perguntas que a fundamentam
3. **Os três números que justificam o contrato**, um por seção:
   valor prevenido, dias de antecipação sobre a imprensa, taxa de subnotificação
4. **Evidência** — categorias, volume no tempo, janela de risco, setor × prejuízo,
   origem da ameaça, eficácia da resposta, posição na bandeira
5. **Metodologia e fontes**, ao final, em corpo pequeno

Regra: o que exige ação vem antes do que apenas informa.

### Indicadores e como se calculam

| Indicador | Origem |
|---|---|
| Índice de exposição | Composto: volume de imprensa no raio + taxa de Q8 afirmativa + gravidade da tipificação |
| Valor prevenido | Soma de Q21 nos casos de tentativa (Q20) |
| Antecipação | Data do primeiro Q8="Sim" no bairro − data da primeira notícia do mesmo bairro |
| Subnotificação | Ocorrências documentadas (Q15) vs. Q22 = "Sim" |
| Janela de risco | Q6 (turno) cruzado com Q17 (tipificação) |
| Setor × prejuízo | Q18 (frequência) contra Q21 (valor) |
| Origem da ameaça | Q16 |
| Eficácia da resposta | Q26 cruzado com Q20 e Q28 |
| Posição na bandeira | Índice desta unidade vs. demais da mesma bandeira/UF |

**Não incluir no relatório do cliente:** "quem detectou primeiro" (Q15 agregado).
Mostrar que o time da loja detecta apenas 14% soa como acusação ao gerente que
está lendo. O indicador rende no Painel da liderança, como argumento de proposta
de treinamento.

---

## 9. Painel da liderança

### Atenção (primeira aba)
Alertas gerados por regra, cada um com o consultor e a unidade envolvidos:
- **Ponto cego** — imprensa em alta e Q8 = "Não" nos últimos registros
- **Sem articulação** — risco alto com Q12 = "Não" recorrente
- **Preenchimento suspeito** — vários envios em lote fora do horário da visita,
  ou tempo de preenchimento muito abaixo da média
- **Risco de churn** — relatórios não abertos pelo cliente + índice em queda
- **Reincidência** — mesma tipificação repetindo na mesma unidade

### Operação
KPIs, funil de risco (visitas → risco identificado → ocorrência → formalizada →
resolvida), produção por consultor com valor prevenido, qualidade de
preenchimento, projeção.

### Risco
Agregação das perguntas: Q7, Q8, Q9, Q11, Q12, Q14, Q17, Q18, Q22 e o
"quem detecta primeiro" (Q15).

### Cruzamento
Imprensa × campo por unidade, classificado em **Convergente**, **Ponto cego**,
**Subnotificação** e **Estável**. Mais antecipação média por cidade.

---

## 10. Design system

### Tokens

```
claro                          escuro
--bg      #FFFFFF              #0A0F16
--surf    #F4F6F7              #121821
--ink     #0A0F16              #FFFFFF
--body    #4A5560              #8A96A3
--mute    #7C8792              #6B7885
--hair    #E2E7EB              #1A222C
--track   #D8DEE3              #1A222C
--rule    #0A0F16              #FFFFFF
--teal    #3D7A87              #4E9A93
--green   #A3D65C              #A3D65C
--red     #C9525E              #E0655C
--gold    #B8942F              #C9A227
--purple  #9B7BD8              #8B7BD8
--leaf    #5C8C4A              #5CA35C
```

**Claro é o padrão.** O tema fica em Config → Aparência e vale para o app inteiro.

### Tipografia
- **Archivo** — títulos (700), corpo de texto (400/500)
- **IBM Plex Mono** — rótulos, números, metadados, tudo em caixa alta com
  letter-spacing largo

O corpo de texto em 400 ficou fino demais na primeira versão. Usar 500 em
parágrafos de destaque e garantir contraste com `--body`, não `--mute`.

### Regras
- Sem border-radius em nada, exceto avatares e dots de legenda
- Sem sombra, exceto no botão flutuante
- Régua de header: 2px, cor `--rule`
- **Verde é só ação** — botões, aba ativa, toggles ligados. Nunca decoração
- **Vermelho é só urgência.** Ouro é atenção. Verde-folha é resultado positivo
- Cor de categoria é constante em todo o sistema:
  Segurança vermelho, Patrimonial ouro, Operacional teal, Institucional
  verde-folha, Fraude roxo

---

## 11. Ordem sugerida de implementação

1. Tema claro + tokens aplicados ao app existente
2. Nova navegação de três abas + tela Hoje
3. Feed de notícias em dois níveis (sem o selo de proximidade, se as coordenadas
   ainda não existirem)
4. Formulário de 28 perguntas com rascunho local e fila offline
5. Barra de retomada e botão flutuante
6. Painel da liderança
7. Relatório do cliente e exportação

Os itens 1 a 5 são o que faz o consultor adotar o app. O 6 e o 7 são o que
justifica o contrato com a SIC.

---

## 12. Pontos em aberto

- Coordenadas das unidades da carteira (bloqueia o selo de proximidade)
- Valor do contrato por unidade, caso se queira exibir ROI no relatório
- As quatro sub-abas do Painel cortam em telas estreitas
- Campo hoje é idêntico para os dois perfis; a liderança não deveria ver
  "Novo formulário"
- Definir se o relatório do cliente sai como PDF, link protegido, ou ambos
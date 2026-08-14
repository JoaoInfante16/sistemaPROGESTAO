// ============================================
// O relatório em papel — o render
// ============================================
// **Um documento, um renderizador.** Este arquivo é o único lugar do sistema
// que desenha o relatório compartilhado. Ele produz um HTML A4 que abre em
// qualquer navegador e que vira PDF pelo botão de imprimir — quem renderiza o
// PDF é o mesmo motor que desenhou a página, então o que se vê é o que sai.
//
// **Por que HTML e não um PDF gerado no servidor.** Chromium headless no Render
// Starter (512MB, 0.5 CPU) mora na mesma caixa que roda o CRON 24/7: um OOM ali
// não derruba o relatório, derruba o monitoramento, que é o produto. Fica
// anotado no ROADMAP pra quando o backend tiver caixa própria.
//
// **Por que HTML e não um arquivo `.html` mandado por anexo.** Porque anexo
// `.html` é o pior dos mundos: o Google Drive mostra o **código-fonte** em vez
// da página, filtro de e-mail corporativo trata como vetor de phishing, e no
// Android depende de ter app registrado pra `text/html`. O link abre em tudo; o
// PDF viaja em tudo. O arquivo intermediário não serve pra nenhum dos dois.

import { CATEGORIA_CORES, CATEGORIA_LABELS, CATEGORIA_ORDEM } from '../../utils/taxonomia';
import { CategoriaGrupo, rotuloTipoCrime } from '../../utils/types';
import { RelatorioRenderizavel } from './tipos';
import { ESTILO } from './estilo';
import { FONTES_EMBUTIDAS } from './fontes';
import { enquadrar, paraPixel, embutirTiles } from './mapa';

// ──────────────────────────────────────────────────────────
// Utilidades de texto
// ──────────────────────────────────────────────────────────

/** Escapa TUDO que entra no HTML. Nome de bairro e título de matéria vêm de
 *  texto extraído da imprensa pelo GPT — não é conteúdo confiável. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
  'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const dd = (n: number) => String(n).padStart(2, '0');

/** `2026-07-01` → `1º de julho de 2026`. Data por extenso é o que separa um
 *  documento de uma tela: ninguém lê `01/07` em voz alta numa reunião. */
function porExtenso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d === 1 ? '1º' : d} de ${MESES[m - 1]} de ${y}`;
}

/** Duas datas do mesmo mês não repetem o mês: `1º a 31 de julho de 2026`. */
function periodoPorExtenso(de: string, ate: string): string {
  const [y1, m1, d1] = de.split('-').map(Number);
  const [y2, m2] = ate.split('-').map(Number);
  if (y1 === y2 && m1 === m2) {
    return `${d1 === 1 ? '1º' : d1} a ${porExtenso(ate)}`;
  }
  return `${porExtenso(de)} a ${porExtenso(ate)}`;
}

function geradoEm(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  // Fuso de Brasília — o relatório é lido no Brasil, não em UTC.
  const br = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return `${dd(br.getUTCDate())}/${dd(br.getUTCMonth() + 1)}/${br.getUTCFullYear()} ` +
    `às ${dd(br.getUTCHours())}:${dd(br.getUTCMinutes())}`;
}

/** `[A, B, C]` → `A, B e C`. */
function listar(itens: string[]): string {
  if (itens.length === 0) return '';
  if (itens.length === 1) return itens[0];
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

const plural = (n: number, um: string, muitos: string) => (n === 1 ? um : muitos);

/** Milhar com ponto — `1245` → `1.245`. */
const num = (n: number) => n.toLocaleString('pt-BR');

// ──────────────────────────────────────────────────────────
// Volume no tempo — espelho exato de `volume_no_tempo.dart`
// ──────────────────────────────────────────────────────────

/** 🚨 Tem que continuar batendo com `baldeDaJanela` do app. Se as duas regras
 *  divergirem, a mesma consulta desenha um gráfico na tela e outro no papel. */
function baldeDaJanela(dias: number): 'day' | 'week' | 'month' {
  if (dias <= 14) return 'day';
  if (dias <= 90) return 'week';
  return 'month';
}

interface Balde { label: string; total: number; }

function agruparNoTempo(
  serie: Array<{ date: string; count: number }>,
  dias: number,
): { balde: 'day' | 'week' | 'month'; baldes: Balde[] } {
  const contas = new Map<number, number>();
  let min = Infinity, max = -Infinity;
  for (const e of serie) {
    const t = Date.parse(`${e.date}T00:00:00Z`);
    if (isNaN(t)) continue;
    contas.set(t, (contas.get(t) ?? 0) + (e.count || 0));
    if (t < min) min = t;
    if (t > max) max = t;
  }
  if (!isFinite(min)) return { balde: 'day', baldes: [] };

  const DIA = 86400000;
  // O balde sai do MAIOR entre a janela pedida e o que os dados cobrem — com a
  // tolerância de período ligada, uma consulta de 30 dias traz item de 180 dias
  // atrás, e escolher só pela janela pedida daria 26 barras numa tela que pediu 5.
  const span = Math.round((max - min) / DIA);
  const balde = baldeDaJanela(Math.max(dias, span));

  const somaEntre = (a: number, b: number) => {
    let t = 0;
    contas.forEach((c, d) => { if (d >= a && d <= b) t += c; });
    return t;
  };

  const out: Balde[] = [];
  if (balde === 'day') {
    for (let d = min; d <= max; d += DIA) {
      const x = new Date(d);
      out.push({ label: `${dd(x.getUTCDate())}/${dd(x.getUTCMonth() + 1)}`, total: somaEntre(d, d) });
    }
  } else if (balde === 'week') {
    // Começa na segunda-feira da semana do primeiro dia.
    const p = new Date(min);
    const diaSemana = p.getUTCDay() || 7;
    let ini = min - (diaSemana - 1) * DIA;
    while (ini <= max) {
      const x = new Date(ini);
      out.push({
        label: `${dd(x.getUTCDate())}/${dd(x.getUTCMonth() + 1)}`,
        total: somaEntre(ini, ini + 6 * DIA),
      });
      ini += 7 * DIA;
    }
  } else {
    const a = new Date(min), b = new Date(max);
    let ano = a.getUTCFullYear(), mes = a.getUTCMonth();
    while (ano < b.getUTCFullYear() || (ano === b.getUTCFullYear() && mes <= b.getUTCMonth())) {
      const ini = Date.UTC(ano, mes, 1);
      const fim = Date.UTC(ano, mes + 1, 0);
      out.push({ label: MESES_CURTOS[mes], total: somaEntre(ini, fim) });
      if (++mes > 11) { mes = 0; ano++; }
    }
  }
  return { balde, baldes: out };
}

// ──────────────────────────────────────────────────────────
// Peças de desenho
// ──────────────────────────────────────────────────────────

const cor = (cat: string) =>
  CATEGORIA_CORES[cat as CategoriaGrupo] ?? CATEGORIA_CORES.institucional;
const rotuloCat = (cat: string) =>
  CATEGORIA_LABELS[cat as CategoriaGrupo] ?? 'Institucional';

function cabecaDeSecao(rotulo: string, titulo: string, conta?: string): string {
  return `<div class="cabeca">
      <h2>${esc(titulo)}</h2>
      <span class="dateline">${esc(rotulo)}</span>
      ${conta ? `<span class="slug conta">${esc(conta)}</span>` : ''}
    </div>`;
}

/**
 * A rosca por categoria — SVG escrito à mão, sem biblioteca de gráfico.
 *
 * São arcos de um círculo com `stroke-dasharray`: cada fatia é um traço do
 * tamanho da sua fração, deslocado pelo acumulado. É a técnica mais antiga do
 * SVG e a única que imprime sem depender de nada.
 */
function rosca(byCategory: Array<{ categoria: string; count: number }>, total: number): string {
  const R = 62, C = 2 * Math.PI * R;
  let acc = 0;
  const arcos = byCategory.map((c) => {
    const frac = total > 0 ? c.count / total : 0;
    const len = frac * C;
    const arco = `<circle cx="80" cy="80" r="${R}" fill="none"
      stroke="${cor(c.categoria)}" stroke-width="26"
      stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}"
      stroke-dashoffset="${(-acc).toFixed(2)}" />`;
    acc += len;
    return arco;
  }).join('');

  return `<svg viewBox="0 0 160 160" width="100%" style="max-width:62mm" role="img"
    aria-label="Distribuição por categoria">
    <g transform="rotate(-90 80 80)">
      <circle cx="80" cy="80" r="${R}" fill="none" stroke="#DBE2E9" stroke-width="26" />
      ${arcos}
    </g>
    <text x="80" y="78" text-anchor="middle" font-family="Archivo, sans-serif"
      font-size="30" font-weight="700" letter-spacing="-1.4" fill="#060D18">${num(total)}</text>
    <text x="80" y="93" text-anchor="middle" font-family="'JetBrains Mono', monospace"
      font-size="7.5" letter-spacing="1.1" fill="#64798C">OCORRÊNCIAS</text>
  </svg>`;
}

function barrasNoTempo(baldes: Balde[]): string {
  const max = Math.max(1, ...baldes.map((b) => b.total));
  // Rótulo de 8.5px mono pede ~30px; a coluna na folha tem ~11mm. Só passa a
  // pular rótulo em série muito longa — ancorado na ÚLTIMA barra, que é a que
  // interessa (mesma regra do app).
  const passo = Math.max(1, Math.ceil(baldes.length / 14));

  const colunas = baldes.map((b) => {
    const alt = b.total > 0 ? Math.max(4, (b.total / max) * 100) : 0;
    return `<div class="col">
      <span class="val">${b.total > 0 ? b.total : ''}</span>
      <div class="haste${b.total > 0 ? '' : ' zero'}" style="height:${alt.toFixed(1)}%"></div>
    </div>`;
  }).join('');

  const eixo = baldes.map((b, i) =>
    `<div class="col">${(baldes.length - 1 - i) % passo === 0 ? esc(b.label) : ''}</div>`
  ).join('');

  return `<div class="barras">${colunas}</div><div class="eixo">${eixo}</div>`;
}

async function mapaImpresso(
  r: RelatorioRenderizavel,
  paraPdf: boolean,
): Promise<string> {
  const pontos = r.mapPoints.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pontos.length === 0) return '';

  // ⚠️ `L` e `A` **não são o tamanho na folha** — o mapa é fluido e ocupa a
  // largura que tiver. Eles são a **proporção do quadro** (e a referência que
  // `enquadrar` usa pra escolher o zoom que cabe). O comentário aqui dizia
  // "168mm × 105mm na folha", e era justamente essa crença que cortava o mapa:
  // a folha tem 150mm de conteúdo, não 168mm.
  const L = 635, A = 397;
  let q = enquadrar(pontos, L, A);
  if (!q) return '';

  // Tudo que sai daqui pra baixo vira % do quadro. Ver `.mapa` no estilo.
  const pctL = (v: number) => `${((v / L) * 100).toFixed(3)}%`;
  const pctA = (v: number) => `${((v / A) * 100).toFixed(3)}%`;

  // 🚨 No caminho do PDF os tiles viram `data:` URI. Quem converte é a WebView
  // do aparelho, e ela pode fotografar a página **antes** de as imagens da rede
  // chegarem — o mapa sairia branco, sem erro nenhum. É a armadilha do
  // html2canvas de novo, por outra porta. Aqui não há o que esperar.
  if (paraPdf) q = await embutirTiles(q);

  // O tile é posicionado em % da CAMADA (não do quadro): ele vive lá dentro,
  // no sistema de coordenadas que o `scale` depois encolhe.
  const pctCamL = (v: number) => `${((v / q.largura) * 100).toFixed(4)}%`;
  const pctCamA = (v: number) => `${((v / q.altura) * 100).toFixed(4)}%`;
  const tiles = q.tiles.map((t) =>
    `<img src="${t.url}" alt="" loading="eager"
      style="left:${pctCamL(t.left)};top:${pctCamA(t.top)};` +
      `width:${pctCamL(256)};height:${pctCamA(256)}">`
  ).join('');

  // 🚨 O pino NÃO entra na camada escalada. Se entrasse, encolheria junto com os
  // tiles: com escala 0.55 um pino de 7px viraria 3,8px, e a marca de dado é a
  // única coisa do mapa que precisa de tamanho constante. Ele fica solto por
  // cima, com a coordenada já multiplicada pela escala.
  //
  // ⚠️ A **posição** vai em %, e o **tamanho** continua em px — de propósito, e
  // é a mesma regra de cima levada ao fim: onde o pino está é relativo ao mapa,
  // o quanto ele mede não é. Num telefone o mapa encolhe e o pino segue com 7px,
  // que é o mínimo pra dois vizinhos continuarem legíveis como dois.
  const pinos = pontos.map((p) => {
    const px = paraPixel(p.lat, p.lng, q.z);
    const x = (px.x - q.ox) * q.escala, y = (px.y - q.oy) * q.escala;
    if (x < -6 || y < -6 || x > L + 6 || y > A + 6) return '';
    // Ponto sem bairro é geocodado no centro da cidade — ele entra no mapa, mas
    // apagado, pra não fingir precisão que a matéria não deu.
    const vago = p.precisao === 'cidade' ? ' cidade' : '';
    return `<span class="pino${vago}" style="left:${pctL(x)};top:${pctA(y)};` +
      `background:${cor(p.categoria)}"></span>`;
  }).join('');

  const precisos = pontos.filter((p) => p.precisao !== 'cidade').length;

  // A chave. Sem ela o mapa é uma nuvem de cores que o leitor não tem como
  // decifrar — e este documento é lido por quem não estava na sala. Só entram
  // as categorias que de fato aparecem no mapa: legenda com item que não está
  // desenhado faz procurar o que não existe.
  const presentes = CATEGORIA_ORDEM.filter((c) => pontos.some((p) => p.categoria === c));
  const chave = presentes.map((c) =>
    `<span><i style="background:${cor(c)}"></i>${esc(rotuloCat(c))}</span>`
  ).join('');

  return `<section class="secao">
    ${cabecaDeSecao('Onde', 'Mapa de ocorrências', `${num(pontos.length)} localizadas`)}
    <div class="mapa">
      <div class="camada" style="width:${pctL(q.largura)};height:${pctA(q.altura)};
        transform:scale(${q.escala.toFixed(4)})">${tiles}</div>
      ${pinos}
    </div>
    <div class="chave">${chave}</div>
    <p class="creditos">© OPENSTREETMAP · © CARTO — ${num(precisos)} de ${num(pontos.length)}
      ${plural(precisos, 'ocorrência situada', 'ocorrências situadas')} em rua ou bairro;
      ${plural(pontos.length - precisos, 'a outra marca', 'as outras marcam')} o centro do
      município, em ponto menor e mais claro.</p>
  </section>`;
}

// ──────────────────────────────────────────────────────────
// A capa — quem, onde, quando, e com que recorte
// ──────────────────────────────────────────────────────────

/**
 * A capa declara o filtro — e **só o filtro que existia na tela de origem**.
 *
 * Cada linha é condicional de propósito. O relatório do monitoramento não tem
 * `+antigas`, `+região` nem seletor de categoria: imprimir *"Fora da contagem"*
 * ali seria afirmar uma exclusão que ninguém fez, num documento cujo trabalho é
 * ser citado sem quem cita precisar do contexto de volta.
 */
function linhasDoRecorte(r: RelatorioRenderizavel): string {
  const linhas: Array<[string, string]> = [];

  const rec = r.recorte;

  // A origem vem antes do período porque ela muda o significado do período:
  // "30 dias de varredura contínua" e "30 dias de uma consulta pontual" são
  // coberturas diferentes do mesmo intervalo.
  if (rec?.origem) {
    linhas.push([
      'Origem',
      rec.origem === 'monitoramento'
        ? 'Monitoramento contínuo'
        : 'Consulta sob demanda',
    ]);
  }

  linhas.push(['Período', periodoPorExtenso(r.dateFrom, r.dateTo)]);

  if (rec) {
    if (rec.categorias) {
      linhas.push([
        'Categorias',
        rec.categorias.length === 0
          ? 'Todas as categorias'
          : listar(rec.categorias.map(rotuloCat)),
      ]);
    }

    if (rec.regiao !== undefined) {
      linhas.push([
        'Municípios vizinhos',
        rec.regiao
          ? `Incluídos${rec.municipiosVizinhos?.length ? ` — ${listar(rec.municipiosVizinhos)}` : ''}`
          : 'Fora da contagem',
      ]);
    }

    // O "+ antigas" precisa dizer até ONDE alcança: um relatório de 30 dias com
    // a chave ligada pode conter matéria de cinco meses atrás, e isso não pode
    // ficar implícito num documento que vai ser citado.
    if (rec.antigas !== undefined) {
      linhas.push([
        'Matérias anteriores',
        rec.antigas
          ? `Incluídas${rec.horizonteDias ? ` — até ${rec.horizonteDias} dias antes do período` : ''}`
          : 'Fora da contagem',
      ]);
    }
  }

  linhas.push(['Gerado em', geradoEm(r.geradoEm)]);

  return linhas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
}

/** A frase de abertura — montada dos próprios dados, como na tela do app. */
function abertura(r: RelatorioRenderizavel): string {
  const cidades = listar(r.cidades);
  const topo = r.byCategory[0];

  const partes: string[] = [];
  partes.push(
    `${plural(r.total, 'Uma ocorrência foi publicada', `${num(r.total)} ocorrências foram publicadas`)} ` +
    `pela imprensa sobre ${esc(cidades)} no período.`
  );
  if (topo && r.total > 0) {
    const pct = Math.round((topo.count / r.total) * 100);
    partes.push(
      `${rotuloCat(topo.categoria)} responde por ${pct}% do volume` +
      `${r.byCrimeType[0] ? `, com ${esc(r.byCrimeType[0].tipo_crime)} à frente` : ''}.`
    );
  }
  if (r.totalRegiao > 0) {
    partes.push(
      `${num(r.totalRegiao)} ${plural(r.totalRegiao, 'é de município vizinho', 'são de municípios vizinhos')}.`
    );
  }

  return `<div class="abertura">
    <div class="hero">${num(r.total)}<small>OCORRÊNCIAS</small></div>
    <div>
      <p class="lead">${partes.join(' ')}</p>
      <!-- A ressalva na voz do APP, não na de um documento que se explica.
           Ela dizia "Este documento mede o que a imprensa publicou, não o que a
           polícia registrou. Ocorrência sem repercussão na mídia não aparece
           aqui, e uma mesma ocorrência coberta por vários veículos é contada
           uma vez só." — mesma informação, registro errado: o app AFIRMA e o
           documento EXPLICAVA. A primeira frase agora é literalmente a que a
           tela já usa (relatorio_de_risco.dart), e as outras duas seguem no
           mesmo compasso curto. -->
      <p class="nota">É o que a imprensa <strong>noticiou</strong> — não o total registrado
      pelas polícias. Ocorrência sem repercussão não entra, e a mesma ocorrência em vários
      veículos conta uma vez.</p>
    </div>
  </div>`;
}

// ──────────────────────────────────────────────────────────
// Seções
// ──────────────────────────────────────────────────────────

function secaoCategorias(r: RelatorioRenderizavel): string {
  if (r.byCategory.length === 0) return '';
  const ordenadas = [...r.byCategory].sort(
    (a, b) => CATEGORIA_ORDEM.indexOf(a.categoria as CategoriaGrupo) -
              CATEGORIA_ORDEM.indexOf(b.categoria as CategoriaGrupo)
  );

  // Todo gráfico tem gêmeo em tabela: rosca é boa pra ver proporção e péssima
  // pra citar número — e este documento existe pra ser citado por alguém que
  // não estava na sala.
  const linhas = ordenadas.map((c) => `<tr>
      <td><span class="marca" style="background:${cor(c.categoria)}"></span>${esc(rotuloCat(c.categoria))}</td>
      <td class="n">${num(c.count)}</td>
      <td class="n">${r.total > 0 ? Math.round((c.count / r.total) * 100) : 0}%</td>
    </tr>`).join('');

  // ⚠️ Aqui saía `esc(t.tipo_crime)` — a chave crua do banco. O documento que
  // vai pro cliente imprimia `roubo_furto`, `lesao_corporal`, `trafico`.
  const tipos = r.byCrimeType.slice(0, 8).map((t) => `<tr>
      <td>${esc(rotuloTipoCrime(t.tipo_crime))}</td><td class="n">${num(t.count)}</td>
    </tr>`).join('');

  return `<section class="secao">
    ${cabecaDeSecao('O quê', 'Distribuição por categoria')}
    <div class="bloco duas">
      ${rosca(ordenadas, r.total)}
      <table><thead><tr><th>Categoria</th><th class="n">Nº</th><th class="n">%</th></tr></thead>
        <tbody>${linhas}</tbody></table>
    </div>
    ${tipos ? `<div class="bloco" style="margin-top:9mm">
      <h3>Tipos mais frequentes</h3>
      <table><tbody>${tipos}</tbody></table>
    </div>` : ''}
  </section>`;
}

function secaoTempo(r: RelatorioRenderizavel): string {
  const dias = r.recorte?.dias
    ?? Math.max(1, Math.round((Date.parse(r.dateTo) - Date.parse(r.dateFrom)) / 86400000));
  const { balde, baldes } = agruparNoTempo(r.serie, dias);
  // Uma barra só não é uma série temporal — é o total outra vez, com eixo.
  if (baldes.length < 2) return '';

  const rotulo = { day: 'um dia por barra', week: 'uma semana por barra', month: 'um mês por barra' }[balde];

  return `<section class="secao">
    ${cabecaDeSecao('Quando', 'Volume no tempo', rotulo)}
    <div class="bloco">${barrasNoTempo(baldes)}</div>
  </section>`;
}

function secaoBairros(r: RelatorioRenderizavel): string {
  if (r.topBairros.length === 0) return '';
  const top = r.topBairros.slice(0, 12);
  const maior = top[0].count || 1;

  const linhas = top.map((b, i) => `<div class="rank">
      <span class="pos">${dd(i + 1)}</span>
      <div>
        <div class="nome">${esc(b.bairro)}</div>
        <div class="trilho"><div class="cheio" style="width:${((b.count / maior) * 100).toFixed(1)}%"></div></div>
      </div>
      <span class="qtd">${num(b.count)}</span>
    </div>`).join('');

  // A ressalva é do app e vale mais no papel: o ranking só enxerga quem citou
  // bairro. Sem ela, o leitor lê a lista como se fosse o mapa completo.
  const ressalva = r.semBairro > 0
    ? `<p class="nota" style="margin-top:8px">${num(r.semBairro)} de ${num(r.total)}
       ${plural(r.semBairro, 'matéria não cita', 'matérias não citam')} o bairro e
       ${plural(r.semBairro, 'fica', 'ficam')} fora deste ranking.</p>`
    : '';

  return `<section class="secao">
    ${cabecaDeSecao('Concentração', 'Bairros com maior incidência',
      // "11 de 11" é ruído: a contagem só informa quando a lista foi cortada.
      top.length < r.topBairros.length ? `${top.length} de ${num(r.topBairros.length)}` : undefined)}
    <div class="bloco">${linhas}${ressalva}</div>
  </section>`;
}

function secaoIndicadores(r: RelatorioRenderizavel): string {
  const ex = r.executive;
  const temAlgo = ex.indicadores.length > 0 || (ex.resumo_complementar || '').trim().length > 0;
  if (!temAlgo) return '';

  const cards = ex.indicadores.map((i) => {
    const sinal = i.valor > 0 && i.tipo === 'percentual' ? '+' : '';
    const valor = i.tipo === 'monetario'
      ? `R$ ${num(Math.abs(i.valor))}`
      : `${sinal}${num(i.valor)}${i.unidade ?? ''}`;
    return `<div class="ind">
      <div class="n ${esc(i.sentido)}">${esc(valor)}</div>
      <div class="rot">${esc(i.label)}</div>
      <div class="slug ctx">${esc([i.contexto, i.fonte].filter(Boolean).join(' · '))}</div>
    </div>`;
  }).join('');

  return `<section class="secao">
    ${cabecaDeSecao('Contexto', 'Indicadores da região',
      r.totalEstatisticas > 0 ? `${num(r.totalEstatisticas)} balanços` : undefined)}
    ${cards ? `<div class="bloco indicadores">${cards}</div>` : ''}
    ${ex.resumo_complementar
      ? `<p class="lead" style="margin-top:9px">${esc(ex.resumo_complementar)}</p>` : ''}
    <p class="nota">Números divulgados por órgãos oficiais e pela imprensa no período.
      São <strong>balanços</strong>, não ocorrências — não entram na contagem acima.</p>
  </section>`;
}

function secaoFontes(r: RelatorioRenderizavel): string {
  const total = [...r.sourcesOficial, ...r.sourcesMedia];
  if (total.length === 0) return '';

  const coluna = (titulo: string, itens: typeof total) => itens.length === 0 ? '' : `<div>
      <h3>${esc(titulo)} <span class="slug">(${itens.length})</span></h3>
      ${itens.map((s) => `<div class="fonte"><span>${esc(s.name)}</span>
        <span class="q">${num(s.count)}</span></div>`).join('')}
    </div>`;

  return `<section class="secao">
    ${cabecaDeSecao('De onde', 'Fontes analisadas', `${total.length} veículos`)}
    <div class="bloco fontes">
      ${coluna('Oficiais', r.sourcesOficial)}
      ${coluna('Imprensa', r.sourcesMedia)}
    </div>
  </section>`;
}

// ──────────────────────────────────────────────────────────
// O documento
// ──────────────────────────────────────────────────────────

/**
 * A página de erro do link.
 *
 * Vive aqui, e não numa string solta na rota, porque **ela também chega no
 * cliente** — é o que ele vê quando o link veio truncado pelo WhatsApp. Um
 * `{"error":"not found"}` cru nessa hora não é um erro técnico, é um cartão de
 * visita ruim.
 */
export function paginaDeErro(titulo: string, explicacao: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SIMEops — ${esc(titulo)}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>${ESTILO}</style>
</head>
<body>
<main class="folha" style="margin-top:24mm">
  <header class="masthead">
    <div class="wordmark">SIME<span>ops</span></div>
    <div class="slug">PROGESTÃO TECNOLOGIA</div>
  </header>
  <div class="capa">
    <div class="dateline">Relatório de risco</div>
    <h1>${esc(titulo)}</h1>
    <p class="lead" style="margin-top:10px">${esc(explicacao)}</p>
  </div>
</main>
</body>
</html>`;
}

/**
 * O documento.
 *
 * Com [paraPdf], é o **mesmo** documento com uma diferença de fundo: nada nele
 * depende da rede. Quem converte no aparelho é a WebView, e ela não espera —
 * imagem que não chegou a tempo simplesmente não aparece, calada. Por isso os
 * tiles do mapa viram `data:` URI e a barra de ações nem é emitida (em vez de
 * ficar escondida por `@media print`, que é apostar que a WebView aplica print
 * styles).
 *
 * Um renderizador, um parâmetro. Duas funções seria o começo de dois documentos.
 */
export async function renderizarRelatorio(
  r: RelatorioRenderizavel,
  opcoes: { paraPdf?: boolean } = {},
): Promise<string> {
  const paraPdf = opcoes.paraPdf ?? false;
  const cidades = listar(r.cidades);
  const titulo = `SIMEops — Análise de Risco · ${cidades}/${r.estado}`;
  const mapa = await mapaImpresso(r, paraPdf);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="Análise de risco criminal — ${esc(cidades)}/${esc(r.estado)}, ${esc(periodoPorExtenso(r.dateFrom, r.dateTo))}.">
${paraPdf
  // Impressao: a fonte vem DENTRO do arquivo. A WebView do Android converte em
  // `onPageFinished`, que nao espera a rede — buscar fonte no Google aqui e
  // sortear a tipografia do documento que vai pro cliente.
  ? `<style>${FONTES_EMBUTIDAS}</style>`
  // Navegador: o <link> continua, porque ali a pagina repinta quando a fonte
  // chega e o cache do Google e melhor que 88 KB em toda visita.
  : `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">`}
<style>${ESTILO}</style>
</head>
<body>

${paraPdf ? '' : `<div class="acoes">
  <span class="quem">SIMEops · Relatório de risco</span>
  <button type="button" onclick="window.print()">Baixar PDF</button>
</div>`}

<main class="folha">

  <header class="masthead">
    <div class="wordmark">SIME<span>ops</span></div>
    <div style="text-align:right">
      <div class="slug">PROGESTÃO TECNOLOGIA</div>
      <div class="slug">Monitoramento de ocorrências na imprensa</div>
    </div>
  </header>

  <div class="capa">
    <div class="dateline">Análise de risco</div>
    <h1>${esc(cidades)}</h1>
    <div class="onde">${esc(r.estado)} · ${esc(periodoPorExtenso(r.dateFrom, r.dateTo))}</div>

    <dl class="recorte">${linhasDoRecorte(r)}</dl>
  </div>

  ${abertura(r)}
  ${secaoCategorias(r)}
  ${secaoTempo(r)}
  ${mapa}
  ${secaoBairros(r)}
  ${secaoIndicadores(r)}
  ${secaoFontes(r)}

  <footer class="rodape">
    <div class="slug">SIMEops · PROGESTÃO TECNOLOGIA</div>
    <div class="slug">Gerado em ${esc(geradoEm(r.geradoEm))}</div>
  </footer>

</main>
</body>
</html>`;
}

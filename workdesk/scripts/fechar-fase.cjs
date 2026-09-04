#!/usr/bin/env node
/**
 * FECHAR FASE — a parte mecanica do encerramento.
 *
 * POR QUE ESTE SCRIPT EXISTE:
 * Fechar fase e um ritual de sete passos que acontece a cada poucas semanas.
 * Justamente por ser raro, e onde se erra por desatencao: numero da fase,
 * intervalo de datas, um arquivo que nao foi movido, e — o pior — as ideias do
 * 🟡 DEPOIS e do 🔵 IDEIAS indo para o arquivo morto junto com o resto.
 *
 * O QUE ELE FAZ (mecanico, verificavel):
 *   1. descobre o numero da fase e o intervalo de datas lendo os documentos
 *   2. cria `Fases/Fase NN — <inicio> a <fim>/`
 *   3. MOVE DEV_LOG.md e ROADMAP.md para la
 *   4. COPIA a ARQUITETURA (retrato do fim da fase; a viva fica na raiz)
 *   5. cria DEV_LOG e ROADMAP novos na raiz, **carregando 🟡 DEPOIS e 🔵 IDEIAS**
 *
 * O QUE ELE NAO FAZ, e nao deve:
 *   - escrever o README da fase (exige ler a fase inteira e resumir)
 *   - decidir o que do DEV_LOG virou arquitetura
 *   - decidir o titulo da fase
 *   - commitar
 * Isso e trabalho da skill `fechar-fase`, que chama este script no meio.
 *
 * 🚨 RECUSA rodar com a arvore suja. Ele move e reescreve arquivo; sem commit
 * anterior nao ha para onde voltar se o resultado nao agradar.
 *
 * USO:  node workdesk/scripts/fechar-fase.cjs --titulo "niveis de acesso"
 *       node workdesk/scripts/fechar-fase.cjs --titulo "..." --dry-run
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
const WORKDESK = path.join(RAIZ, 'workdesk');
const FASES = path.join(WORKDESK, 'Fases');

const DEV_LOG = path.join(WORKDESK, 'DEV_LOG.md');
const ROADMAP = path.join(WORKDESK, 'ROADMAP.md');
const ARQUITETURA = path.join(WORKDESK, 'ARQUITETURA.md');

function morrer(msg) {
  console.error('\n[fechar-fase] ' + msg + '\n');
  process.exit(1);
}

function arg(nome) {
  const i = process.argv.indexOf('--' + nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const DRY = process.argv.includes('--dry-run');

// ── 0. A arvore tem que estar limpa ──────────────────────────────────────────
function exigirArvoreLimpa() {
  let saida;
  try {
    saida = execFileSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf8' });
  } catch {
    morrer('nao consegui rodar `git status`. Rode de dentro do repositorio.');
  }
  if (saida.trim()) {
    morrer(
      'a arvore tem mudancas nao commitadas. Este script MOVE e REESCREVE arquivo —\n' +
      'sem commit anterior nao ha para onde voltar. Commite antes:\n\n' +
      saida.trim().split('\n').map((l) => '  ' + l).join('\n'),
    );
  }
}

// ── 1. Numero da fase e datas ────────────────────────────────────────────────
/** `# DEV_LOG — SIMEops (Fase 12: niveis de acesso)` -> 12 */
function numeroDaFase(texto, arquivo) {
  const m = texto.match(/Fase\s+(\d+)/i);
  if (!m) morrer(`nao achei "Fase N" no titulo de ${arquivo}. Titulo mudou de formato?`);
  return parseInt(m[1], 10);
}

/** Datas das entradas `## YYYY-MM-DD` do DEV_LOG. */
function intervaloDeDatas(devLog) {
  const datas = [...devLog.matchAll(/^##\s+(\d{4}-\d{2}-\d{2})/gm)].map((m) => m[1]).sort();
  if (!datas.length) {
    morrer('nao achei nenhuma entrada `## YYYY-MM-DD` no DEV_LOG. Fase sem historico?');
  }
  return { inicio: datas[0], fim: datas[datas.length - 1] };
}

/** O preambulo do documento: tudo antes do primeiro titulo de secao. */
function preambulo(texto, regexPrimeiraSecao) {
  const m = texto.match(regexPrimeiraSecao);
  return m ? texto.slice(0, m.index).trimEnd() : texto.trimEnd();
}

/** Recorta do 🟡 DEPOIS ate o fim — o que NAO morre com a fase. */
function oQueSobrevive(roadmap) {
  const m = roadmap.match(/^#+\s*🟡/m);
  return m ? roadmap.slice(m.index).trimEnd() : '';
}

// ── 2. Executar ──────────────────────────────────────────────────────────────
function main() {
  const titulo = arg('titulo');
  if (!titulo) {
    morrer(
      'falta --titulo. E o nome curto da fase, o mesmo que vai no README e no indice.\n' +
      'Ex: --titulo "niveis de acesso"',
    );
  }

  if (!DRY) exigirArvoreLimpa();

  for (const [p, nome] of [[DEV_LOG, 'DEV_LOG.md'], [ROADMAP, 'ROADMAP.md'], [ARQUITETURA, 'ARQUITETURA.md']]) {
    if (!fs.existsSync(p)) morrer(`nao achei workdesk/${nome}.`);
  }

  const devLog = fs.readFileSync(DEV_LOG, 'utf8');
  const roadmap = fs.readFileSync(ROADMAP, 'utf8');

  const n = numeroDaFase(devLog, 'DEV_LOG.md');
  const nRoadmap = numeroDaFase(roadmap, 'ROADMAP.md');
  if (n !== nRoadmap) {
    morrer(
      `DEV_LOG diz Fase ${n} e ROADMAP diz Fase ${nRoadmap}. Os dois sao as duas metades\n` +
      'do mesmo periodo — se divergiram, alguem editou um sem o outro. Conferir antes.',
    );
  }

  const { inicio, fim } = intervaloDeDatas(devLog);
  const periodo = inicio === fim ? inicio : `${inicio} a ${fim}`;
  const nn = String(n).padStart(2, '0');

  // O nome entra na pasta desde a Fase 12 (pedido do Joao em 04/09): achar "a
  // fase do planejamento da reuniao" era impossivel numa lista de datas. O
  // NUMERO continua na frente, entao a ordem alfabetica segue sendo a
  // cronologica. As pastas de 01 a 11 ficam como estao — sao arquivo morto, tem
  // link apontando para elas, e documento arquivado nao se reescreve.
  const tituloLimpo = titulo.replace(/[\\/:*?"<>|]/g, '').trim();
  const nomeDaPasta = `Fase ${nn} — ${tituloLimpo} — ${periodo}`;
  const pasta = path.join(FASES, nomeDaPasta);

  if (fs.existsSync(pasta)) morrer(`a pasta ja existe: ${path.relative(RAIZ, pasta)}`);

  const proxima = n + 1;
  const sobrevive = oQueSobrevive(roadmap);

  const novoDevLog =
    preambulo(devLog, /^##\s/m).replace(new RegExp(`Fase ${n}[^)\\n]*`), `Fase ${proxima}`) +
    '\n\n---\n\n## 🚦 ONDE PARAMOS\n\n' +
    '> Única seção deste arquivo que se **sobrescreve** em vez de acumular.\n' +
    '> Teto: ~25 linhas. Passou disso, virou arquitetura ou virou roadmap.\n\n' +
    `A Fase ${nn} — ${tituloLimpo} — fechou. Ver [a pasta dela](${encodeURI('./Fases/' + nomeDaPasta + '/')}).\n` +
    'A Fase ' + proxima + ' ainda não começou — o primeiro trabalho define o assunto.\n';

  const novoRoadmap =
    preambulo(roadmap, /^#+\s*🔴/m).replace(new RegExp(`Fase ${n}[^)\\n]*`), `Fase ${proxima}`) +
    '\n\n---\n\n# 🔴 AGORA\n\n' +
    '_Vazio. O que entrar aqui define o assunto da Fase ' + proxima + ' — e uma fase é **um**\n' +
    'trabalho: se começarem a caber vários assuntos, o corte já devia ter acontecido._\n\n' +
    (sobrevive ? '---\n\n' + sobrevive + '\n' : '');

  const plano = [
    `Fase ${nn} — "${tituloLimpo}"`,
    `periodo: ${periodo}`,
    `pasta:   workdesk/Fases/${nomeDaPasta}/`,
    '',
    '  mover   DEV_LOG.md   -> pasta da fase',
    '  mover   ROADMAP.md   -> pasta da fase',
    '  copiar  ARQUITETURA.md -> pasta da fase (retrato; a viva fica na raiz)',
    `  criar   DEV_LOG.md e ROADMAP.md novos (Fase ${proxima})`,
    sobrevive
      ? `  carregar 🟡 DEPOIS e 🔵 IDEIAS para o ROADMAP novo (${sobrevive.split('\n').length} linhas)`
      : '  ⚠️ nao achei 🟡 DEPOIS no ROADMAP — nada sera carregado. Conferir.',
  ].join('\n');

  if (DRY) {
    console.log('\n[dry-run] nada foi escrito.\n\n' + plano + '\n');
    return;
  }

  fs.mkdirSync(pasta, { recursive: true });
  fs.renameSync(DEV_LOG, path.join(pasta, 'DEV_LOG.md'));
  fs.renameSync(ROADMAP, path.join(pasta, 'ROADMAP.md'));
  fs.copyFileSync(ARQUITETURA, path.join(pasta, 'ARQUITETURA.md'));
  fs.writeFileSync(DEV_LOG, novoDevLog, 'utf8');
  fs.writeFileSync(ROADMAP, novoRoadmap, 'utf8');

  console.log('\n' + plano + '\n\nFEITO — a parte mecanica. Falta o que so se faz lendo:');
  console.log('  1. o README.md da pasta da fase (o que resolveu, o que vale para');
  console.log('     sempre, os erros cometidos)');
  console.log('  2. a linha nova em workdesk/Fases/README.md');
  console.log('  3. conferir se algo do DEV_LOG devia ter virado ARQUITETURA');
  console.log('  4. commitar\n');
}

main();

#!/usr/bin/env node
/**
 * Hook SessionStart — injeta o onboarding da workdesk em toda sessao nova.
 *
 * POR QUE ESTE HOOK EXISTE:
 * O CLAUDE.md ja manda comecar pela ARQUITETURA, mas texto so vale se for lido.
 * O estado do sistema ja viveu num bloco no topo do DEV_LOG que ninguem
 * atualizava: chegou a 376 linhas e dava tres respostas diferentes para "a
 * migration 025 rodou?". Um hook o harness executa — nao depende de lembrar.
 *
 * Injeta so o BLOCO DE ONBOARDING, nao o arquivo inteiro: a ARQUITETURA cresce
 * junto com o app, e injetar 500+ linhas em toda sessao nao escala.
 *
 * ⚠️ A PRIMEIRA VERSAO DESTE HOOK QUEBROU EM MENOS DE 24H. Ela delimitava o
 * bloco entre DOIS titulos fixos, e o titulo do fim ("## Regra deste documento")
 * sumiu na primeira reescrita do documento. Agora o fim e "o proximo titulo de
 * nivel 2, qualquer que seja" — so o marcador de INICIO segue acoplado ao texto.
 * Licao: mecanismo que depende de documento deve depender do MINIMO possivel
 * dele, e gritar quando esse minimo sumir.
 */
const fs = require('fs');
const path = require('path');

const MARCADOR = '## 🚪 COMECE POR AQUI';

const raiz = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
const alvo = path.join(raiz, 'workdesk', 'ARQUITETURA.md');

function emitir(texto) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: texto,
    },
  }));
}

/**
 * Roda o verificador da workdesk e devolve um aviso — ou string vazia se estiver
 * tudo certo. Silencio quando limpo e o ponto: aviso que aparece sempre vira
 * ruido que se ignora, e ai nao e mais aviso.
 *
 * Nunca lanca: se o verificador sumir ou quebrar, o onboarding segue.
 */
function avisoDeApodrecimento() {
  try {
    const script = path.join(raiz, 'workdesk', 'scripts', 'verificar-workdesk.cjs');
    if (!fs.existsSync(script)) return '';
    const { execFileSync } = require('child_process');
    let saida;
    try {
      saida = execFileSync(process.execPath, [script, '--json'], {
        encoding: 'utf8', timeout: 10000, cwd: raiz,
      });
    } catch (e) {
      // exit 1 = achou problema; a saida vem no stdout mesmo assim.
      saida = e.stdout;
    }
    if (!saida) return '';
    const { problemas = [], ausentes = [] } = JSON.parse(saida);
    if (!problemas.length && !ausentes.length) return '';

    const linhas = problemas.slice(0, 12).map(
      (p) => `- \`${p.alvo}\` em **${p.doc}** — ${p.tipo === 'link' ? 'link quebrado' : 'nao existe mais no codigo'}`
    );
    if (problemas.length > 12) linhas.push(`- …e mais ${problemas.length - 12}`);
    for (const d of ausentes) linhas.push(`- **${d}** nao foi encontrado`);

    return '\n\n---\n\n🚨 **A workdesk apodreceu em ' + (problemas.length + ausentes.length) +
      ' ponto(s).** O verificador achou isto agora:\n\n' + linhas.join('\n') +
      '\n\nCada item e: ou o documento ficou para tras do codigo (corrija o documento), ' +
      'ou e um identificador externo legitimo (adicione a `EXTERNOS` em ' +
      '`workdesk/scripts/verificar-workdesk.cjs`, **com motivo**). Detalhe completo: ' +
      '`node workdesk/scripts/verificar-workdesk.cjs`.';
  } catch {
    return '';
  }
}

try {
  const doc = fs.readFileSync(alvo, 'utf8');
  const inicio = doc.indexOf(MARCADOR);

  if (inicio === -1) {
    emitir(
      `⚠️ O hook de onboarding nao achou "${MARCADOR}" em workdesk/ARQUITETURA.md. ` +
      'O documento foi reestruturado — leia-o INTEIRO antes de mexer em codigo, e ' +
      'conserte o marcador em .claude/hooks/workdesk-onboarding.cjs.'
    );
    process.exit(0);
  }

  // Fim = proximo titulo de nivel 2 depois do bloco. Nao depende de QUAL titulo.
  const depois = doc.indexOf('\n## ', inicio + MARCADOR.length);
  // O trimEnd deixa o '---' que fecha a secao no documento; tira, senao sai duplicado.
  const bloco = (depois === -1 ? doc.slice(inicio) : doc.slice(inicio, depois))
    .trimEnd()
    .replace(/\n-{3,}$/, '')
    .trimEnd();

  emitir(
    '# Onboarding da workdesk (injetado automaticamente)\n\n' + bloco +
    '\n\n---\n\n🚨 **Leia `workdesk/ARQUITETURA.md` INTEIRO antes de tocar em ' +
    'codigo.** O trecho acima e so a porta de entrada; o resto do arquivo tem as ' +
    'armadilhas que ja custaram tempo e dinheiro. As regras de trabalho estao no ' +
    'CLAUDE.md, que ja foi carregado.' +
    avisoDeApodrecimento()
  );
} catch (erro) {
  emitir('⚠️ O hook de onboarding nao conseguiu ler workdesk/ARQUITETURA.md: ' + erro.message);
}
process.exit(0);

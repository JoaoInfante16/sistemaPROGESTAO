#!/usr/bin/env node
/**
 * Hook SessionStart — injeta o onboarding da workdesk em toda sessao nova.
 *
 * POR QUE ESTE HOOK EXISTE (27/08/2026):
 * O CLAUDE.md ja manda comecar pela ARQUITETURA, mas texto so vale se for lido.
 * Ate 27/08 o estado do sistema vivia num bloco no topo do DEV_LOG que ninguem
 * atualizava: chegou a 376 linhas, listava como pendente um bug corrigido 18
 * dias antes, e dava tres respostas diferentes para "a migration 025 rodou?".
 * Um hook o harness executa — nao depende do Claude lembrar de abrir o arquivo.
 *
 * Injeta so o BLOCO DE ONBOARDING, nao o arquivo inteiro: a ARQUITETURA vai
 * crescer junto com o app, e injetar 500+ linhas em toda sessao nao escala.
 * O bloco diz onde esta o resto e manda ler.
 */
const fs = require('fs');
const path = require('path');

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

try {
  const doc = fs.readFileSync(alvo, 'utf8');
  const inicio = doc.indexOf('## 🚪 COMECE POR AQUI');
  const fim = doc.indexOf('## Regra deste documento');

  // Sem os marcadores, o documento foi reestruturado: avisa em vez de calar.
  if (inicio === -1 || fim === -1 || fim <= inicio) {
    emitir(
      '⚠️ O hook de onboarding da workdesk nao achou o bloco "COMECE POR AQUI" em ' +
      'workdesk/ARQUITETURA.md. O documento pode ter sido reestruturado — leia-o ' +
      'inteiro antes de mexer em codigo, e conserte .claude/hooks/workdesk-onboarding.cjs.'
    );
    process.exit(0);
  }

  emitir(
    '# Onboarding da workdesk (injetado automaticamente)\n\n' +
    doc.slice(inicio, fim).trimEnd() +
    '\n\n---\n\n🚨 **Leia `workdesk/ARQUITETURA.md` INTEIRO antes de tocar em codigo.** ' +
    'O trecho acima e so a porta de entrada; o resto do arquivo tem as armadilhas ' +
    'que ja custaram tempo e dinheiro. As regras de trabalho estao no CLAUDE.md.'
  );
} catch (erro) {
  // Hook nunca derruba a sessao: reporta e sai limpo.
  emitir('⚠️ O hook de onboarding nao conseguiu ler workdesk/ARQUITETURA.md: ' + erro.message);
}
process.exit(0);

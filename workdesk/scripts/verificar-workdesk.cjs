#!/usr/bin/env node
/**
 * VERIFICADOR DA WORKDESK — a defesa mecanica contra o apodrecimento.
 *
 * POR QUE ESTE SCRIPT EXISTE:
 * Nenhum documento se mantem atualizado por disciplina. So em 2026 apodreceram
 * a ARQUITETURA (quatro afirmacoes falsas dentro de uma caixa escrita "LEIA
 * ANTES DE MEXER"), o bloco ESTADO DO MUNDO (376 linhas, tres respostas para a
 * mesma pergunta) e o MIGRATIONS_LOG. Os tres tinham regra escrita mandando
 * atualizar. Regra escrita nao e defesa; verificacao e.
 *
 * O QUE ELE CHECA, nos documentos PERSISTENTES (os que nao rotacionam por fase):
 *   1. IDENTIFICADORES — todo `nome_em_crase` com cara de codigo tem que
 *      existir no codigo. Se sumiu, o documento cita um fantasma.
 *   2. LINKS — todo link relativo tem que apontar para arquivo que existe.
 *
 * O QUE ELE NAO CHECA, e nenhum script consegue: se o que esta escrito e
 * VERDADE. Um identificador pode existir e a frase sobre ele estar errada.
 * Isto pega apodrecimento ESTRUTURAL, nao semantico.
 *
 * USO:  node workdesk/scripts/verificar-workdesk.cjs
 *       node workdesk/scripts/verificar-workdesk.cjs --json
 *
 * Sai com codigo 1 se achar problema, 0 se estiver limpo.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
const WORKDESK = path.join(RAIZ, 'workdesk');

/**
 * Documentos que descrevem o presente e devem acompanhar o codigo.
 * Caminho relativo a RAIZ; o CLAUDE.md entra porque e o documento mais lido de
 * todos — em 28/08 ele ainda apontava para o WORKFLOW.md, deletado na vespera,
 * e nenhuma verificacao pegou porque ele estava fora desta lista.
 */
const PERSISTENTES = [
  'CLAUDE.md',
  'workdesk/ARQUITETURA.md',
  'workdesk/API_CONTRATO.md',
  'workdesk/FUNIL.md',
  'workdesk/DESIGN_CONTRATO.md',
  'workdesk/Protótipo/FORMULARIOS_SIC.md',
  'workdesk/Protótipo/MUDANCAS.md',
  'workdesk/Protótipo/REUNIAO_SIC.md',
  'workdesk/Protótipo/PERGUNTAS_X_RELATORIO.md',
  'workdesk/Fases/README.md',
];

/** Onde procurar por identificadores. */
const FONTES = [
  'backend/src',
  'backend/scripts',
  'mobile-app/lib',
  'mobile-app/android',
  'admin-panel',
  'workdesk/scripts',
  '.claude',
];
const EXT_CODIGO = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.dart', '.kt', '.kts',
  '.gradle', '.xml', '.sql', '.json', '.yaml', '.yml',
]);
const IGNORAR_DIR = new Set([
  'node_modules', 'build', '.dart_tool', '.next', 'dist', '.git', 'ios', 'web',
]);

/**
 * Identificadores que NAO estao no codigo de proposito e nao sao apodrecimento.
 * Cada um precisa de motivo — allowlist sem motivo vira tapete pra sujeira.
 */
const EXTERNOS = {
  PGRST205: 'codigo de erro do PostgREST, servico externo',
  '42P01': 'codigo de erro do Postgres, servico externo',
  'x-brd-err-code': 'header da Bright Data',
  'Retry-After': 'header HTTP padrao',
  brd_json: 'parametro de URL da Bright Data',
  results_cnt: 'campo de resposta da Bright Data',
  'tbm=nws': 'parametro de URL do Google',
  'sbd:1': 'parametro de URL do Google',
  BiometricPrompt: 'classe do Android SDK',
  FragmentActivity: 'classe do Flutter/Android SDK',
  FlutterActivity: 'classe do Flutter SDK',
  NOT_FRAGMENT_ACTIVITY: 'codigo de erro do plugin local_auth',
  processReleaseGoogleServices: 'task do Gradle, gerada em build',
  applicationIdSuffix: 'propriedade do Android Gradle Plugin',
  uptime_seconds: 'campo de /health, montado dinamicamente',
  'budget_tracking.details': 'caminho dentro de coluna JSONB',
  'budget_tracking.details.commit': 'caminho dentro de coluna JSONB',
  SessionStart: 'evento de hook do Claude Code',
  PreToolUse: 'evento de hook do Claude Code',
  PostToolUse: 'evento de hook do Claude Code',
  TRUNCATE: 'palavra reservada do SQL',
  'c:/Projetos/dev-panel/': 'projeto separado, fora deste repositorio',
  'BACKEND_PENDENTE.md': 'documento extinto em 04/08; citado no indice das fases como historico',

  // ── Protótipo/FORMULARIOS_SIC.md e Protótipo/MUDANCAS.md ──────────────
  // Valores literais das bases da SIC. Sao DADO do cliente, nao identificador
  // nosso — nunca vao existir no codigo, e a grafia torta e justamente o que o
  // documento esta registrando.
  'Diadems.': 'valor digitado por consultor na base da SIC; exemplo de grafia suja',
  'Protótipo/Relatório/': 'pasta de capturas do Power BI da SIC; nao versionada (dado de cliente)',
  DIADEMA: 'grafia da loja na base da SIC (31/08); exemplo de de-para de unidade',
  DIADEMS: 'grafia da loja na base da SIC (31/08); exemplo de de-para de unidade',
  'Estacionamento.': 'valor digitado na base da SIC; exemplo de grafia divergente',
  'Mendicância.': 'valor digitado na base da SIC; exemplo de grafia divergente',
  'Mendicância/Perturbação': 'valor digitado na base da SIC; exemplo de grafia divergente',
  'Cor/raça': 'nome de coluna do Microsoft Forms da SIC',
  BLOCKS: 'array dentro de Protótipo/prototipo.html, que nao e codigo do app',

  // Pastas do material que a SIC mandou. Ficam fora das FONTES de proposito:
  // contem dado pessoal real e nao deve ser varrido por script nenhum.
  'formularios/consultor/': 'pasta de material da SIC, fora das FONTES',
  'formularios/Mediador/': 'pasta de material da SIC, fora das FONTES',
  'formularios/Apoio/': 'pasta de material da SIC, fora das FONTES',

  // 🚦 NOMES PROPOSTOS DAS PERGUNTAS — exencao TEMPORARIA, criada em 30/08.
  // Ainda nao existem no codigo porque o formulario ainda nao foi implementado.
  // **Quando a tabela do formulario existir, apagar daqui**: e justamente
  // nesse dia que a verificacao passa a valer, e manter a exencao esconderia o
  // renome que este documento existe para tornar seguro (ver MUDANCAS.md).
  ...Object.fromEntries([
    'uf_unidade', 'data_registro', 'mov_atipica', 'risco_entorno', 'risco_externo',
    'falha_estrutural', 'falha_tipo', 'falha_descricao', 'contato_forcas',
    'acao_conjunta', 'acao_conjunta_explicacao', 'processo_vulneravel',
    'processo_qual', 'processo_motivo', 'colaborador_negligente',
    'escala_risco_processos', 'quem_identificou', 'classificacao_ameaca',
    'tentativa_consumacao', 'valor_prevenido', 'nao_formalizada_motivo',
    'quem_conduziu', 'tipo_resposta', 'forcas_externas', 'grau_sucesso',
  ].map((s) => [s, 'nome proposto de pergunta (30/08); APAGAR daqui quando a tabela existir'])),
};

const CURTOS_OK = new Set(['news', 'city', 'state', 'main', 'geo']);

function listarArquivos(dir, acc = []) {
  let entradas;
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entradas) {
    if (e.name.startsWith('.') && e.name !== '.env') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORAR_DIR.has(e.name)) continue;
      listarArquivos(p, acc);
    } else {
      acc.push(p);
    }
  }
  return acc;
}

function indexarCodigo() {
  const partes = [];
  const nomes = new Set();
  const registrar = (p) => {
    nomes.add(path.basename(p));
    nomes.add(path.relative(RAIZ, p).replace(/\\/g, '/'));
  };
  for (const rel of FONTES) {
    const base = path.join(RAIZ, rel);
    for (const arquivo of listarArquivos(base)) {
      registrar(arquivo);
      // Registrar tambem cada DIRETORIO do caminho: o documento cita pastas
      // (`backend/src/routes/`) tanto quanto arquivos.
      let dir = path.dirname(arquivo);
      while (dir.startsWith(RAIZ) && dir !== RAIZ) {
        registrar(dir);
        dir = path.dirname(dir);
      }
      if (EXT_CODIGO.has(path.extname(arquivo))) {
        try {
          partes.push(fs.readFileSync(arquivo, 'utf8'));
        } catch {
          /* binario ou ilegivel, ignora */
        }
      }
    }
  }
  // O proprio workdesk conta como fonte de NOMES (SQL/, migrations, scripts).
  for (const arquivo of listarArquivos(WORKDESK)) registrar(arquivo);
  return { conteudo: partes.join('\n'), nomes: [...nomes] };
}

/** Parece identificador de codigo? Descarta prosa escrita em crase. */
function pareceIdentificador(s) {
  if (EXTERNOS[s]) return false;
  if (/\s/.test(s)) return false;
  if (s.length < 4) return false;
  if (s.length < 6 && !CURTOS_OK.has(s)) return false;
  if (/^https?:\/\//.test(s)) return false; // URL nao e identificador
  if (/[<>*]/.test(s)) return false; // template: content:<urlHash>, PROD_*
  // cara de codigo: snake_case, caminho, extensao, camelCase ou CONSTANTE
  return /[_./]/.test(s) || /[a-z][A-Z]/.test(s) || /^[A-Z][A-Z0-9_]{5,}$/.test(s);
}

/**
 * As formas em que um identificador aparece num documento raramente sao o
 * literal do codigo: `X=valor` (exemplo de uso), `X[]` (indica lista),
 * `a.b.c` (caminho dentro de objeto). Reduz a raiz e tenta cada nivel.
 */
function candidatos(id) {
  const lista = [id];
  const semSufixo = id.replace(/\[\]$/, '').replace(/\/+$/, '');
  if (semSufixo !== id) lista.push(semSufixo);
  const antesDoIgual = semSufixo.split('=')[0];
  if (antesDoIgual !== semSufixo) lista.push(antesDoIgual);
  // Documento citado sem extensao: `ARQUITETURA` -> ARQUITETURA.md
  if (/^[A-Z][A-Z0-9_]+$/.test(antesDoIgual)) lista.push(antesDoIgual + '.md');
  // a.b.c -> tambem tenta 'a.b' e 'a', mas so se nao tiver cara de arquivo
  if (!/\.[a-z]{2,4}$/.test(antesDoIgual) && antesDoIgual.includes('.')) {
    const partes = antesDoIgual.split('.');
    for (let i = partes.length - 1; i >= 1; i--) lista.push(partes.slice(0, i).join('.'));
  }
  return [...new Set(lista)];
}

function existeNoCodigo(id, idx) {
  for (const c of candidatos(id)) {
    if (!c) continue;
    if (EXTERNOS[c]) return true; // `results_cnt=1` reduz a `results_cnt`
    if (idx.conteudo.includes(c)) return true;
    const base = path.basename(c);
    if (idx.nomes.some((n) => n === c || n.endsWith('/' + c) || n === base)) return true;
    // Caminho relativo a raiz do projeto: pega ate arquivo git-ignored no disco.
    if (c.includes('/') && fs.existsSync(path.join(RAIZ, c))) return true;
  }
  return false;
}

function verificarIdentificadores(doc, texto, idx) {
  const achados = [];
  const vistos = new Set();
  for (const m of texto.matchAll(/`([^`\n]+)`/g)) {
    const id = m[1].trim();
    if (vistos.has(id) || !pareceIdentificador(id)) continue;
    vistos.add(id);
    if (!existeNoCodigo(id, idx)) {
      achados.push({ doc, tipo: 'identificador', alvo: id });
    }
  }
  return achados;
}

function verificarLinks(doc, texto) {
  const achados = [];
  const base = path.dirname(path.join(RAIZ, doc));
  // Pega link relativo (./x, ../x) e tambem o sem prefixo (workdesk/x), que e
  // como o CLAUDE.md aponta para tudo.
  for (const m of texto.matchAll(/\]\(((?:\.\.?\/|[A-Za-z0-9_])[^)\s]*)\)/g)) {
    const bruto = m[1];
    if (/^[a-z]+:/i.test(bruto) || bruto.startsWith('#')) continue; // URL ou ancora
    const alvo = decodeURIComponent(bruto).split('#')[0];
    if (!alvo) continue;
    if (!fs.existsSync(path.resolve(base, alvo))) {
      achados.push({ doc, tipo: 'link', alvo: bruto });
    }
  }
  return achados;
}

function main() {
  const json = process.argv.includes('--json');
  const idx = indexarCodigo();
  const problemas = [];
  const ausentes = [];

  for (const doc of PERSISTENTES) {
    const caminho = path.join(RAIZ, doc);
    if (!fs.existsSync(caminho)) {
      ausentes.push(doc);
      continue;
    }
    const texto = fs.readFileSync(caminho, 'utf8');
    problemas.push(...verificarIdentificadores(doc, texto, idx));
    problemas.push(...verificarLinks(doc, texto));
  }

  if (json) {
    console.log(JSON.stringify({ problemas, ausentes }));
    process.exit(problemas.length || ausentes.length ? 1 : 0);
  }

  console.log('\nVerificador da workdesk — ' + PERSISTENTES.length + ' documentos persistentes\n');
  for (const d of ausentes) console.log('  [!] documento nao encontrado: ' + d);

  if (!problemas.length && !ausentes.length) {
    console.log('  OK — nenhum identificador fantasma, nenhum link quebrado.\n');
    process.exit(0);
  }

  const porDoc = {};
  for (const p of problemas) (porDoc[p.doc] = porDoc[p.doc] || []).push(p);
  for (const doc of Object.keys(porDoc)) {
    console.log('  ' + doc);
    for (const p of porDoc[doc]) {
      const rotulo = p.tipo === 'link' ? 'link quebrado       ' : 'nao existe no codigo';
      console.log('     ' + rotulo + '  ' + p.alvo);
    }
    console.log('');
  }
  console.log('  ' + problemas.length + ' problema(s). Cada um e: ou o documento apodreceu, ou');
  console.log('  o identificador e externo e merece entrada em EXTERNOS, com motivo.\n');
  process.exit(1);
}

main();

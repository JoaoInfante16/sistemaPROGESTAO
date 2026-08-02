// ============================================
// Regressao da lista de assuntos — sem rede, sem banco
// ============================================
// `parseAssuntos` le um campo de texto livre que o cliente edita no painel.
// Formato errado nao pode virar query gigante nem lista vazia: os dois casos
// gastam dinheiro pra devolver nada.
//
// Uso: npx tsx scripts/test-assuntos.ts

import { parseAssuntos, ASSUNTOS_PADRAO } from '../src/services/search/queryTemplates';

let ok = 0;
let falhou = 0;

function checar(nome: string, entrada: string, esperado: string[]): void {
  const obtido = parseAssuntos(entrada);
  const igual = obtido.length === esperado.length && obtido.every((v, i) => v === esperado[i]);
  if (igual) {
    ok++;
    console.log(`  ✅ ${nome}`);
  } else {
    falhou++;
    console.log(`  ❌ ${nome}`);
    console.log(`       esperado: ${JSON.stringify(esperado)}`);
    console.log(`       obtido:   ${JSON.stringify(obtido)}`);
  }
}

console.log('parseAssuntos\n');

checar('uma linha por assunto',
  'polícia\nhomicídio morte tiros\nroubo furto assalto',
  ['polícia', 'homicídio morte tiros', 'roubo furto assalto']);

checar('virgula tambem separa (o usuario digita como quiser)',
  'polícia, homicídio, roubo',
  ['polícia', 'homicídio', 'roubo']);

checar('mistura de virgula e quebra de linha',
  'polícia, homicídio\nroubo furto',
  ['polícia', 'homicídio', 'roubo furto']);

checar('espaco em volta e aparado',
  '  polícia  \n\n   homicídio   ',
  ['polícia', 'homicídio']);

checar('linha vazia nao vira query (custaria uma SERP so com o nome da cidade)',
  'polícia\n\n\nhomicídio\n',
  ['polícia', 'homicídio']);

checar('repetido sai — pagar duas vezes pela mesma SERP',
  'polícia\nPolícia\nhomicídio',
  ['polícia', 'homicídio']);

checar('campo vazio devolve lista vazia (quem decide o fallback e getAssuntos)',
  '', []);

checar('so separadores devolve lista vazia',
  '\n, \n ,', []);

checar('assunto com varias palavras continua UM assunto',
  'tráfico drogas apreensão armas',
  ['tráfico drogas apreensão armas']);

// O default de fabrica tem que sobreviver ao proprio parser — se alguem editar
// ASSUNTOS_PADRAO e quebrar isso, o sistema fica sem assunto nenhum.
console.log('\nASSUNTOS_PADRAO\n');
checar('o fallback de fabrica passa pelo parser sem perder nada',
  ASSUNTOS_PADRAO.join('\n'), ASSUNTOS_PADRAO);

console.log(`\n${ok}/${ok + falhou} corretos`);
process.exit(falhou > 0 ? 1 : 0);

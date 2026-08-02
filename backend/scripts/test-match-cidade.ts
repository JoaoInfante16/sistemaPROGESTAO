// ============================================
// Teste do casamento de cidade do pos-filtro (Fase 11, achado #1)
// ============================================
// Nao chama rede nem banco. Uso: npx tsx scripts/test-match-cidade.ts
//
// O caso que originou isto: `"sao jose do cedro".includes("sao jose")` e true,
// entao 10 noticias de Sao Jose do Cedro (600km) entraram no feed de Sao Jose.

import { mesmaCidade, limparNomeCidade } from '../src/utils/helpers';

interface Caso {
  extraido: string;   // o que o Filter2 devolveu
  esperado: string;   // a cidade monitorada / pedida
  estado?: string;
  bate: boolean;      // deve casar?
  porque: string;
}

const casos: Caso[] = [
  // --- O BUG. Estes tres sao a razao de existir esta mudanca.
  { extraido: 'São José do Cedro', esperado: 'São José', estado: 'Santa Catarina', bate: false, porque: 'BUG ORIGINAL: 600km de distancia, mesmo estado' },
  { extraido: 'São José', esperado: 'São José dos Campos', estado: 'São Paulo', bate: false, porque: 'o inverso: esperado contem o extraido' },
  { extraido: 'São José dos Pinhais', esperado: 'São José', estado: 'Paraná', bate: false, porque: 'outro prefixo comum' },

  // --- Ruido do GPT que a regra parcial existia pra tolerar. Tem que continuar passando.
  { extraido: 'Salvador (BA)', esperado: 'Salvador', estado: 'Bahia', bate: true, porque: 'UF entre parenteses' },
  { extraido: 'São José - SC', esperado: 'São José', estado: 'Santa Catarina', bate: true, porque: 'UF depois de hifen' },
  { extraido: 'São José/SC', esperado: 'São José', estado: 'Santa Catarina', bate: true, porque: 'UF depois de barra' },
  { extraido: 'Salvador, BA', esperado: 'Salvador', estado: 'Bahia', bate: true, porque: 'UF depois de virgula' },
  { extraido: 'São José - Santa Catarina', esperado: 'São José', estado: 'Santa Catarina', bate: true, porque: 'estado por extenso' },
  { extraido: 'Município de Palhoça', esperado: 'Palhoça', estado: 'Santa Catarina', bate: true, porque: 'prefixo "Municipio de"' },
  { extraido: 'Cidade de Florianópolis', esperado: 'Florianópolis', estado: 'Santa Catarina', bate: true, porque: 'prefixo "Cidade de"' },
  { extraido: 'FLORIANOPOLIS', esperado: 'Florianópolis', estado: 'Santa Catarina', bate: true, porque: 'caixa alta e sem acento' },
  { extraido: 'porto alegre', esperado: 'Porto Alegre', estado: 'Rio Grande do Sul', bate: true, porque: 'caixa baixa' },

  // --- Hifen no meio do nome NAO pode ser cortado.
  { extraido: 'Embu-Guaçu', esperado: 'Embu-Guaçu', estado: 'São Paulo', bate: true, porque: 'hifen faz parte do nome' },
  { extraido: 'Embu-Guaçu', esperado: 'Embu', estado: 'São Paulo', bate: false, porque: 'Embu e Embu-Guacu sao municipios distintos' },
  { extraido: 'Biritiba-Mirim', esperado: 'Biritiba-Mirim', estado: 'São Paulo', bate: true, porque: 'idem' },

  // --- Nomes compostos legitimos, iguais dos dois lados.
  { extraido: 'São José do Rio Preto', esperado: 'São José do Rio Preto', estado: 'São Paulo', bate: true, porque: 'composto identico' },
  { extraido: "Santa Bárbara d'Oeste", esperado: "Santa Bárbara d'Oeste", estado: 'São Paulo', bate: true, porque: 'apostrofo' },

  // --- Vizinhas de verdade (entram como cidade_vizinha, nao como principal).
  { extraido: 'Camaçari', esperado: 'Salvador', estado: 'Bahia', bate: false, porque: 'vizinha, nao a principal' },
  { extraido: 'São José', esperado: 'Florianópolis', estado: 'Santa Catarina', bate: false, porque: 'vizinha, nao a principal' },

  // --- Degenerados.
  { extraido: '', esperado: 'Salvador', estado: 'Bahia', bate: false, porque: 'vazio nunca casa' },
  { extraido: '(BA)', esperado: 'Salvador', estado: 'Bahia', bate: false, porque: 'so ruido, sobra vazio' },
];

let falhas = 0;
console.log('\n=== mesmaCidade ===\n');
for (const c of casos) {
  const obtido = mesmaCidade(c.extraido, c.esperado, c.estado);
  const ok = obtido === c.bate;
  if (!ok) falhas++;
  const sinal = ok ? '✅' : '❌';
  const seta = c.bate ? '==' : '!=';
  console.log(
    `${sinal} "${c.extraido}" ${seta} "${c.esperado}"  →  ${obtido}` +
    (ok ? '' : `  ESPERADO ${c.bate}`) +
    `\n     ${c.porque}` +
    (ok ? '' : `\n     limpo: "${limparNomeCidade(c.extraido, c.estado)}" vs "${limparNomeCidade(c.esperado, c.estado)}"`)
  );
}

console.log(`\n${casos.length - falhas}/${casos.length} passaram`);
process.exit(falhas === 0 ? 0 : 1);

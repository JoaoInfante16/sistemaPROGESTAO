/**
 * Gera o arquivo municipios_br.json com todos os estados e municipios do Brasil.
 * Fonte: API IBGE (https://servicodados.ibge.gov.br)
 *
 * Uso: npx tsx scripts/generate_municipios.ts
 */

interface IBGEEstado {
  id: number;
  sigla: string;
  nome: string;
}

interface IBGEMunicipio {
  id: number;
  nome: string;
}

interface EstadoOutput {
  uf: string;
  nome: string;
  cidades: string[];
}

async function main() {
  console.log('Buscando estados da API IBGE...');

  const estadosRes = await fetch(
    'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome'
  );
  if (!estadosRes.ok) throw new Error(`Erro ao buscar estados: ${estadosRes.status}`);
  const estados: IBGEEstado[] = await estadosRes.json();

  console.log(`${estados.length} estados encontrados. Buscando municipios...`);

  const result: EstadoOutput[] = [];

  for (const estado of estados) {
    const muniRes = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado.id}/municipios?orderBy=nome`
    );
    if (!muniRes.ok) throw new Error(`Erro ao buscar municipios de ${estado.sigla}: ${muniRes.status}`);
    const municipios: IBGEMunicipio[] = await muniRes.json();

    result.push({
      uf: estado.sigla,
      nome: estado.nome,
      cidades: municipios.map(m => m.nome),
    });

    console.log(`  ${estado.sigla}: ${municipios.length} municipios`);
  }

  const totalCidades = result.reduce((sum, e) => sum + e.cidades.length, 0);
  console.log(`\nTotal: ${result.length} estados, ${totalCidades} municipios`);

  const { writeFileSync } = await import('fs');
  const { resolve } = await import('path');

  const json = JSON.stringify(result);

  // Output para Flutter (mobile app)
  const mobilePath = resolve(__dirname, '..', 'mobile-app', 'assets', 'data', 'municipios_br.json');
  writeFileSync(mobilePath, json);
  console.log(`Arquivo salvo: ${mobilePath}`);

  // Output para Admin Panel (public asset)
  const adminPath = resolve(__dirname, '..', 'admin-panel', 'public', 'data', 'municipios_br.json');
  writeFileSync(adminPath, json);
  console.log(`Arquivo salvo: ${adminPath}`);

  const { statSync } = await import('fs');
  const size = statSync(mobilePath).size;
  console.log(`Tamanho: ${(size / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});

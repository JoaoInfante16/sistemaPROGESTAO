// ============================================
// Dev Routes - TEMPORARIO (remover antes do deploy)
// ============================================
// POST /dev/seed-news          - Insere noticias mock
// POST /dev/trigger-notification - Envia push de teste
// POST /dev/clear-mock         - Remove dados mock

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { db } from '../database/queries';
import { supabase } from '../config/database';
import { sendPushNotification } from '../services/notifications/pushService';
import { logger } from '../middleware/logger';

const router = Router();

// Bloqueia em producao
router.use('/dev', (_req: Request, res: Response, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  next();
});

// ============================================
// Mock News Data
// ============================================

interface MockNews {
  tipo_crime: string;
  cidade: string;
  bairro: string;
  resumo: string;
  confianca: number;
  sources: string[];
}

const MOCK_NEWS: MockNews[] = [
  {
    tipo_crime: 'Homicidio',
    cidade: 'Sao Paulo',
    bairro: 'Capao Redondo',
    resumo: '[MOCK] Homem de 34 anos foi encontrado morto com marcas de disparos de arma de fogo no bairro Capao Redondo, zona sul de Sao Paulo. A Policia Civil investiga a motivacao do crime e busca imagens de cameras de seguranca da regiao.',
    confianca: 0.92,
    sources: ['https://g1.globo.com/sp/sao-paulo/noticia/2026/02/homem-morto-capao-redondo.ghtml'],
  },
  {
    tipo_crime: 'Roubo',
    cidade: 'Sao Paulo',
    bairro: 'Centro',
    resumo: '[MOCK] Quadrilha e presa apos assaltar agencia bancaria no centro de Sao Paulo. Tres suspeitos foram detidos com armas e explosivos. A acao foi flagrada por cameras e a policia chegou em minutos ao local.',
    confianca: 0.88,
    sources: ['https://noticias.uol.com.br/cotidiano/2026/02/quadrilha-presa-centro-sp.htm'],
  },
  {
    tipo_crime: 'Trafico',
    cidade: 'Sao Paulo',
    bairro: 'Jardim Angela',
    resumo: '[MOCK] Operacao policial no Jardim Angela apreende 50kg de cocaina e prende 4 traficantes. O material estava escondido em uma residencia no fundo de um terreno baldio. A denuncia partiu de moradores da regiao.',
    confianca: 0.95,
    sources: ['https://g1.globo.com/sp/sao-paulo/noticia/2026/02/operacao-jardim-angela-cocaina.ghtml', 'https://r7.com/sp/policia/operacao-apreende-cocaina-jardim-angela'],
  },
  {
    tipo_crime: 'Latrocinio',
    cidade: 'Sao Paulo',
    bairro: 'Morumbi',
    resumo: '[MOCK] Motorista de aplicativo e vitima de latrocinio na regiao da Ponte Estaiada, bairro Morumbi. O suspeito solicitou uma corrida e anunciou o assalto durante o trajeto. A vitima nao resistiu aos ferimentos.',
    confianca: 0.90,
    sources: ['https://noticias.uol.com.br/cotidiano/2026/02/motorista-app-latrocinio-morumbi.htm'],
  },
  {
    tipo_crime: 'Trafico',
    cidade: 'Sao Paulo',
    bairro: 'Liberdade',
    resumo: '[MOCK] PM apreende adolescente com 30 porcoes de maconha no bairro da Liberdade. O jovem de 16 anos confessou participacao no trafico local e indicou o fornecedor, que foi preso horas depois em outro endereco.',
    confianca: 0.82,
    sources: ['https://g1.globo.com/sp/sao-paulo/noticia/2026/02/apreensao-maconha-liberdade.ghtml'],
  },
  {
    tipo_crime: 'Furto',
    cidade: 'Sao Paulo',
    bairro: 'Pinheiros',
    resumo: '[MOCK] Bando furta equipamentos eletronicos de loja na Rua dos Pinheiros durante a madrugada. Prejuizo estimado em R$ 150 mil. Cameras de seguranca registraram a acao de quatro individuos encapuzados.',
    confianca: 0.85,
    sources: ['https://www.band.uol.com.br/noticias/furto-loja-pinheiros-sp'],
  },
  {
    tipo_crime: 'Operacao Policial',
    cidade: 'Sao Paulo',
    bairro: 'Heliopolis',
    resumo: '[MOCK] Policia Civil realiza operacao contra organizacao criminosa em Heliopolis e cumpre 12 mandados de prisao. A quadrilha era responsavel por roubos a residencias na zona sul. Armas e veiculos foram apreendidos.',
    confianca: 0.93,
    sources: ['https://g1.globo.com/sp/sao-paulo/noticia/2026/02/operacao-heliopolis-mandados.ghtml', 'https://noticias.uol.com.br/cotidiano/2026/02/operacao-heliopolis.htm'],
  },
  {
    tipo_crime: 'Roubo',
    cidade: 'Sao Paulo',
    bairro: 'Mooca',
    resumo: '[MOCK] Dois homens armados roubam padaria na Mooca e levam R$ 8 mil do caixa. Funcionarios foram rendidos por cerca de 10 minutos. Ninguem ficou ferido. Policia analisa imagens de cameras do estabelecimento.',
    confianca: 0.80,
    sources: ['https://r7.com/sp/policia/roubo-padaria-mooca-sp'],
  },
  {
    tipo_crime: 'Homicidio',
    cidade: 'Sao Paulo',
    bairro: 'Cidade Tiradentes',
    resumo: '[MOCK] Jovem de 22 anos e assassinado a tiros em via publica no bairro Cidade Tiradentes, zona leste. Testemunhas relatam que o crime foi cometido por ocupantes de um veiculo prata que fugiu em seguida.',
    confianca: 0.87,
    sources: ['https://g1.globo.com/sp/sao-paulo/noticia/2026/02/jovem-morto-cidade-tiradentes.ghtml'],
  },
  {
    tipo_crime: 'Apreensao',
    cidade: 'Sao Paulo',
    bairro: 'Paraisopolis',
    resumo: '[MOCK] Policia apreende arsenal com 15 armas de fogo e municoes em operacao na comunidade de Paraisopolis. Dois suspeitos foram presos em flagrante. As armas seriam usadas por faccao criminosa atuante na regiao.',
    confianca: 0.91,
    sources: ['https://noticias.uol.com.br/cotidiano/2026/02/arsenal-apreendido-paraisopolis.htm', 'https://g1.globo.com/sp/sao-paulo/noticia/2026/02/armas-paraisopolis.ghtml'],
  },
  {
    tipo_crime: 'Furto',
    cidade: 'Sao Paulo',
    bairro: 'Consolacao',
    resumo: '[MOCK] Homem e preso em flagrante furtando cabos de cobre de poste na Rua da Consolacao. O furto causou queda de energia em quarteiroes vizinhos. Segundo a policia, o suspeito tinha passagens anteriores pelo mesmo crime.',
    confianca: 0.78,
    sources: ['https://www.band.uol.com.br/noticias/furto-cabos-consolacao-sp'],
  },
  {
    tipo_crime: 'Roubo',
    cidade: 'Sao Paulo',
    bairro: 'Tatuape',
    resumo: '[MOCK] Assaltantes rendem clientes de restaurante no Tatuape e levam celulares e carteiras. A acao durou menos de 3 minutos. PM foi acionada mas os suspeitos ja haviam fugido em motocicleta.',
    confianca: 0.83,
    sources: ['https://r7.com/sp/policia/assalto-restaurante-tatuape'],
  },
  {
    tipo_crime: 'Operacao Policial',
    cidade: 'Sao Paulo',
    bairro: 'Brasilandia',
    resumo: '[MOCK] ROTA apreende drogas e armas em operacao na Brasilandia apos denuncia anonima. Tres traficantes foram presos e 2kg de crack foram encontrados em um imovel abandonado.',
    confianca: 0.89,
    sources: ['https://g1.globo.com/sp/sao-paulo/noticia/2026/02/rota-brasilandia-drogas.ghtml'],
  },
  {
    tipo_crime: 'Homicidio',
    cidade: 'Sao Paulo',
    bairro: 'Santo Amaro',
    resumo: '[MOCK] Comerciante de 45 anos e morto a facadas durante tentativa de roubo em Santo Amaro. O suspeito foi identificado por cameras e preso horas depois em um bar proximo ao local do crime.',
    confianca: 0.86,
    sources: ['https://noticias.uol.com.br/cotidiano/2026/02/comerciante-morto-santo-amaro.htm'],
  },
  {
    tipo_crime: 'Trafico',
    cidade: 'Sao Paulo',
    bairro: 'Itaquera',
    resumo: '[MOCK] Denarc fecha laboratorio de refino de cocaina em Itaquera. No local foram encontrados 120kg de pasta base, produtos quimicos e R$ 200 mil em dinheiro. Dois quimicos responsaveis pelo refino foram presos.',
    confianca: 0.94,
    sources: ['https://g1.globo.com/sp/sao-paulo/noticia/2026/02/laboratorio-cocaina-itaquera.ghtml', 'https://r7.com/sp/policia/laboratorio-drogas-itaquera'],
  },
];

// ============================================
// POST /dev/seed-news
// ============================================

router.post(
  '/dev/seed-news',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      let inserted = 0;
      const zeroEmbedding = new Array(1536).fill(0);

      for (const mock of MOCK_NEWS) {
        // Data aleatoria nos ultimos 7 dias
        const daysAgo = Math.floor(Math.random() * 7);
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        const dataOcorrencia = date.toISOString().split('T')[0];

        try {
          const newsId = await db.insertNews({
            tipo_crime: mock.tipo_crime,
            cidade: mock.cidade,
            bairro: mock.bairro,
            data_ocorrencia: dataOcorrencia,
            resumo: mock.resumo,
            embedding: zeroEmbedding,
            confianca: mock.confianca,
          });

          // Inserir sources
          for (const url of mock.sources) {
            try {
              await db.insertNewsSource(newsId, url);
            } catch {
              // URL duplicada — ok
            }
          }

          inserted++;
        } catch (err) {
          logger.warn(`[DevSeed] Failed to insert mock: ${(err as Error).message}`);
        }
      }

      res.json({ success: true, inserted, total: MOCK_NEWS.length });
    } catch (error) {
      logger.error('[DevSeed] Error:', error);
      res.status(500).json({ error: 'Failed to seed mock data' });
    }
  }
);

// ============================================
// POST /dev/trigger-notification
// ============================================

router.post(
  '/dev/trigger-notification',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      // Buscar noticia mais recente
      const { data, error } = await supabase
        .from('news')
        .select('id, tipo_crime, cidade, bairro, resumo')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        res.status(400).json({ error: 'Nenhuma noticia encontrada. Rode seed-news primeiro.' });
        return;
      }

      // force: true ignora push_enabled para testes via dev tools
      const pushResult = await sendPushNotification(
        {
          id: data.id as string,
          tipo_crime: data.tipo_crime as string,
          cidade: data.cidade as string,
          bairro: (data.bairro as string) || null,
          resumo: data.resumo as string,
        },
        { force: true }
      );

      const title = `${data.tipo_crime} em ${data.cidade}${data.bairro ? ` - ${data.bairro}` : ''}`;
      res.json({
        success: pushResult.sent,
        devices: pushResult.deviceCount,
        successCount: pushResult.successCount,
        reason: pushResult.reason || undefined,
        notification: {
          title,
          body: (data.resumo as string).substring(0, 100) + '...',
        },
      });
    } catch (error) {
      logger.error('[DevNotify] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// ============================================
// POST /dev/clear-mock
// ============================================

router.post(
  '/dev/clear-mock',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      // Contar antes de deletar
      const { count } = await supabase
        .from('news')
        .select('id', { count: 'exact', head: true })
        .like('resumo', '[MOCK]%');

      // Deletar (cascade deleta news_sources automaticamente)
      const { error } = await supabase
        .from('news')
        .delete()
        .like('resumo', '[MOCK]%');

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({ success: true, deleted: count || 0 });
    } catch (error) {
      logger.error('[DevClear] Error:', error);
      res.status(500).json({ error: 'Failed to clear mock data' });
    }
  }
);

export default router;

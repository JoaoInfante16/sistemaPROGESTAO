export const metadata = {
  title: 'Política de Privacidade — SIMEops',
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'sans-serif', color: '#1a1a1a', lineHeight: 1.7, backgroundColor: '#ffffff' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Política de Privacidade</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>SIMEops — Última atualização: 27 de abril de 2026</p>

      <p>
        A <strong>Progestão Tecnologia</strong> desenvolveu o aplicativo <strong>SIMEops</strong> como um serviço de
        monitoramento de ocorrências policiais para uso profissional. Esta página informa sobre nossa política de coleta,
        uso e proteção de dados pessoais.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>1. Dados coletados</h2>
      <p>O aplicativo coleta os seguintes dados:</p>
      <ul>
        <li><strong>E-mail e senha:</strong> utilizados exclusivamente para autenticação no sistema.</li>
        <li><strong>Token de dispositivo (FCM):</strong> gerado pelo Firebase para envio de notificações push. Não identifica o usuário pessoalmente.</li>
        <li><strong>Preferências de notificação:</strong> categorias de alerta ativadas/desativadas pelo usuário.</li>
        <li><strong>Dados de uso e erros:</strong> coletados anonimamente via Sentry para monitoramento de estabilidade do app.</li>
      </ul>
      <p>O SIMEops <strong>não coleta</strong> localização geográfica do dispositivo, contatos, fotos ou qualquer outro dado sensível.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>2. Uso dos dados</h2>
      <p>Os dados coletados são utilizados para:</p>
      <ul>
        <li>Autenticar o acesso ao sistema;</li>
        <li>Enviar notificações push sobre ocorrências nas cidades monitoradas;</li>
        <li>Monitorar a estabilidade técnica do aplicativo e corrigir falhas.</li>
      </ul>
      <p>Nenhum dado é vendido, compartilhado ou utilizado para fins publicitários.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>3. Serviços de terceiros</h2>
      <p>O aplicativo utiliza os seguintes serviços externos, cada qual com sua própria política de privacidade:</p>
      <ul>
        <li><strong>Supabase</strong> — banco de dados e autenticação</li>
        <li><strong>Firebase (Google)</strong> — notificações push</li>
        <li><strong>Sentry</strong> — monitoramento de erros (dados anônimos)</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>4. Retenção de dados</h2>
      <p>
        Os dados de conta são mantidos enquanto o usuário estiver ativo no sistema. Ao encerrar o acesso,
        os dados podem ser removidos mediante solicitação ao administrador.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>5. Segurança</h2>
      <p>
        As senhas são armazenadas com hash seguro via Supabase Auth. A comunicação entre o aplicativo
        e o servidor é feita exclusivamente via HTTPS.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>6. Público-alvo</h2>
      <p>
        O SIMEops é destinado exclusivamente a profissionais adultos. O aplicativo não é direcionado
        a menores de 18 anos e não coleta dados de crianças.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>7. Contato</h2>
      <p>
        Dúvidas sobre esta política ou solicitações relacionadas aos seus dados podem ser enviadas para:<br />
        <strong>contato@progestao.com.br</strong>
      </p>

      <p style={{ marginTop: 48, color: '#888', fontSize: 14 }}>
        Progestão Tecnologia — SIMEops v1.0
      </p>
    </div>
    </div>
  );
}

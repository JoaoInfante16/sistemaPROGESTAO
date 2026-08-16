export const metadata = {
  title: 'Excluir Conta — SIMEops',
};

export default function DeleteAccountPage() {
  const email = 'aplicacao.progestao@gmail.com';
  const subject = encodeURIComponent('Solicitação de exclusão de conta SIMEops');
  const body = encodeURIComponent(
    'Olá,\n\nSolicito a exclusão da minha conta e de todos os dados associados no aplicativo SIMEops.\n\nMeu e-mail cadastrado: [SEU EMAIL AQUI]\n\nAtenciosamente.'
  );
  const mailtoLink = `mailto:${email}?subject=${subject}&body=${body}`;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '64px 24px', fontFamily: 'sans-serif', color: '#1a1a1a', lineHeight: 1.7 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Excluir minha conta</h1>
        <p style={{ color: '#666', marginBottom: 32 }}>SIMEops — Progestão Tecnologia</p>

        <p>
          Para solicitar a exclusão da sua conta e de todos os dados associados, clique no botão abaixo.
          Isso abrirá seu aplicativo de e-mail com a mensagem pronta para envio.
        </p>

        <p>Processamos todas as solicitações em até <strong>7 dias úteis</strong>.</p>

        <div style={{ margin: '40px 0' }}>
          <a
            href={mailtoLink}
            style={{
              display: 'inline-block',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '14px 28px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 16,
              textDecoration: 'none',
            }}
          >
            Solicitar exclusão de conta
          </a>
        </div>

        <p style={{ fontSize: 14, color: '#555' }}>
          Ou envie manualmente um e-mail para{' '}
          <strong>aplicacao.progestao@gmail.com</strong> com o assunto{' '}
          <em>"Solicitação de exclusão de conta SIMEops"</em> informando o e-mail
          cadastrado na sua conta.
        </p>

        <p style={{ fontSize: 14, color: '#555', marginTop: 24 }}>
          Após a exclusão, seus dados de acesso, preferências e histórico serão removidos permanentemente
          dos nossos servidores.
        </p>

        <p style={{ marginTop: 48, fontSize: 13, color: '#aaa' }}>
          <a href="/privacy" style={{ color: '#2563eb' }}>← Voltar para a Política de Privacidade</a>
        </p>
      </div>
    </div>
  );
}

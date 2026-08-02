'use client';

// ============================================
// Porteiro do painel: sessão válida não basta, tem que ser admin
// ============================================
// O `middleware.ts` só checa se existe sessão do Supabase — e a MESMA base de
// usuários serve o app do cliente. Então qualquer usuário comum conseguia abrir
// a URL do painel e ver a casca do dashboard (menu, cards vazios, tela de
// configurações). Os dados nunca vazaram: toda rota admin do backend passa por
// `requireAdmin` e responde 403. Mas parecer acessível já é problema de
// confiança.
//
// A checagem vai pelo backend (`GET /auth/me`, que lê `user_profiles` com a
// service key) e não pelo Supabase do browser, de propósito: a chave anon é
// pública (está no bundle e no APK) e o banco vai ser fechado pra ela — ver a
// migration 025. Guard que dependesse dela quebraria no dia em que a RLS ligar.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { api } from '@/lib/api';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, getToken, signOut } = useAuth();
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    let cancelado = false;

    (async () => {
      try {
        const perfil = await api.getMe(await getToken());
        if (cancelado) return;

        if (perfil.is_admin) {
          setAutorizado(true);
          return;
        }

        // Usuário do app tentando entrar no painel: desloga, senão ele fica
        // preso num vai-e-vem entre /login e /dashboard (a sessão é válida, e
        // o middleware manda quem tem sessão pro dashboard).
        await signOut();
        router.replace('/login?erro=nao-admin');
      } catch {
        // Backend fora ou token expirado: não deixa entrar, mas também não
        // desloga — pode ser instabilidade, e derrubar a sessão do admin numa
        // falha de rede seria pior que pedir pra tentar de novo.
        if (!cancelado) router.replace('/login?erro=verificacao');
      }
    })();

    return () => { cancelado = true; };
  }, [user, loading, getToken, signOut, router]);

  if (loading || !autorizado) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Verificando acesso...
      </div>
    );
  }

  return <>{children}</>;
}

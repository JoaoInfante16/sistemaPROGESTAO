abstract class Env {
  // 🚨 O default destas duas e PRODUCAO, e continua sendo de proposito.
  //
  // Ate 26/08 os tres ambientes usavam o mesmo Supabase e nenhum env/*.json
  // definia estas chaves — todo build, inclusive o de staging, autenticava no
  // banco do cliente. Desde a separacao, `env/dev.json` e `env/staging.json`
  // sobrescrevem as duas (via --dart-define-from-file) e apontam pro projeto de
  // staging; `env/prod.json` NAO define nenhuma das duas e cai aqui.
  //
  // Manter producao como default e a escolha segura: se um build de producao
  // esquecer o arquivo de env, ele ainda fala com o banco certo. O inverso
  // (default de staging) faria o APK do cliente autenticar num banco de teste,
  // e o erro so apareceria na mao de quem paga.
  //
  // ⚠️ O APK que ja esta na Play Store tem o valor abaixo COMPILADO dentro. Por
  // isso producao nao pode trocar de projeto Supabase sem release novo: binario
  // instalado nao se conserta remotamente.
  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://uywvrkiujzcmfmoxbwna.supabase.co',
  );

  static const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5d3Zya2l1anpjbWZtb3hid25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1Mjk1MzcsImV4cCI6MjA4NjEwNTUzN30.YJWzQcYbiIRm_rw-dHnZMVFOEpUDen7pACG_teFOPIE',
  );

  // Build com: --dart-define=API_URL=https://sua-api.onrender.com
  // Emulador Android: http://10.0.2.2:3000 (proxy pro localhost do host)
  // Device fisico na LAN: http://192.168.x.x:3000
  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://192.168.1.5:3000',
  );

  // Sentry DSN — só preenchida em prod (via env/prod.json).
  // Dev e staging ficam vazias; Sentry nem inicializa (zero overhead, zero quota).
  static const sentryDsn = String.fromEnvironment('SENTRY_DSN', defaultValue: '');

  // Ambiente pra rotular eventos no Sentry ('development' | 'staging' | 'production').
  static const environment = String.fromEnvironment('ENVIRONMENT', defaultValue: 'development');
}

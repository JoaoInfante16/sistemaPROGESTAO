import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'firebase_options.dart';
import 'core/config/env.dart';
import 'core/theme/simeops_colors.dart';
import 'core/services/auth_service.dart';
import 'core/services/api_service.dart';
import 'core/services/local_db_service.dart';
import 'core/services/push_service.dart';
import 'core/models/city_overview.dart';
import 'features/dashboard/screens/city_detail_screen.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/screens/change_password_screen.dart';
import 'features/feed/screens/main_screen.dart';
import 'features/search/screens/manual_search_screen.dart';

/// Navigator key global pra push service navegar sem BuildContext
final navigatorKey = GlobalKey<NavigatorState>();

/// Handler de push em background (top-level, fora de qualquer classe)
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  // Notificação já é exibida automaticamente pelo FCM no Android
  // quando app está em background/fechado e o payload tem "notification"
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    // Already initialized (hot restart or auto-init via google-services.json)
  }

  FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
  );

  // Sentry só inicializa se DSN foi injetada via --dart-define (prod).
  // Staging/dev: DSN vazia → runApp direto, zero overhead, zero quota consumida.
  if (Env.sentryDsn.isNotEmpty) {
    await SentryFlutter.init(
      (options) {
        options.dsn = Env.sentryDsn;
        options.environment = Env.environment;
        options.tracesSampleRate = 0.2;
      },
      appRunner: () => runApp(const SIMEopsApp()),
    );
  } else {
    runApp(const SIMEopsApp());
  }
}

class SIMEopsApp extends StatelessWidget {
  const SIMEopsApp({super.key});

  static ThemeData _buildTheme(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final base = isDark
        ? ThemeData.dark(useMaterial3: true)
        : ThemeData.light(useMaterial3: true);

    return base.copyWith(
      scaffoldBackgroundColor: isDark ? SIMEopsColors.navy : null,
      colorScheme: ColorScheme.fromSeed(
        seedColor: SIMEopsColors.teal,
        brightness: brightness,
        primary: SIMEopsColors.teal,
        secondary: SIMEopsColors.green,
        surface: isDark ? SIMEopsColors.navyMid : null,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: isDark ? SIMEopsColors.navyMid : null,
        centerTitle: true,
        titleTextStyle: GoogleFonts.rajdhani(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: 2,
          color: isDark ? SIMEopsColors.white : null,
        ),
      ),
      cardTheme: CardThemeData(
        color: isDark ? SIMEopsColors.navyLight : null,
        elevation: 0,
        shape: const RoundedRectangleBorder(),
      ),
      // ⚠️ Aqui existiu o `navigationBarTheme` — 24 linhas para domar o
      // `NavigationBar` do Material: apagar a cápsula do ativo, forçar o
      // rótulo a aparecer sempre, repintar ícone e texto. O comentário dizia
      // que o ativo se marcava "pela tinta e pelo filete de topo, igual às
      // abas de cidade" — só que o filete nunca existiu: o tema tinha
      // conseguido apagar a peça errada, não desenhar a certa.
      //
      // A barra virou peça do app (`main_screen.dart`), com a mesma anatomia
      // dos cadernos. Tema que configura widget que não se usa mais é
      // configuração que ninguém vai saber que pode apagar.
      // Archivo no lugar de Exo 2: grotesca sólida, aguenta manchete de 23-30px
      // com entrelinha apertada. Exo é geométrica techy — o lugar-comum de que
      // o redesign foge. Ver core/theme/simeops_type.dart.
      textTheme: GoogleFonts.archivoTextTheme(base.textTheme),
      // ─────────────────────────────────────────────────────────────────
      // Este bloco é o que fazia o app parecer **pálido**, e por isso está
      // comentado com detalhe: cada tela do redesign herdava daqui um botão
      // teal de canto 12, um campo com fundo e borda arredondada, e a Exo 2
      // que já devia ter morrido. Dava pra reescrever cinco telas em fio de
      // agência e mesmo assim o elemento mais chamativo de cada uma continuar
      // sendo um botão Material. **Tema é a camada onde a cor acontece.**
      // ─────────────────────────────────────────────────────────────────
      //
      // Hierarquia de botões (uma regra só, sem overrides locais):
      //   primária    = FilledButton VERDE, canto zero
      //   secundária  = OutlinedButton borda discreta, texto muted
      //   terciária   = TextButton em mono teal
      //
      // O verde é a decisão que mais muda a tela. Ele é a única cor saturada
      // do sistema e passa a marcar **a ação**, uma por tela. Em teal o botão
      // brigava com o teal do texto de link e com o teal do progresso, e três
      // coisas na mesma cor querem dizer que nenhuma é especial.
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: SIMEopsColors.green,
          // Tinta escura sobre o verde: 8.9:1. Branco sobre verde daria 2.6:1,
          // que é reprovado e é o erro clássico de botão colorido.
          foregroundColor: const Color(0xFF08150A),
          disabledBackgroundColor: SIMEopsColors.navyLight,
          disabledForegroundColor: SIMEopsColors.faint,
          minimumSize: const Size.fromHeight(54),
          // Mono com tracking largo em botão: fala a mesma língua do metadado
          // e separa "comando" de "leitura". Rajdhani fica só na marca.
          textStyle: GoogleFonts.jetBrainsMono(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            letterSpacing: 2.86,
          ),
          shape: const RoundedRectangleBorder(),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: SIMEopsColors.muted,
          side: const BorderSide(color: SIMEopsColors.ruleStrong),
          minimumSize: const Size.fromHeight(50),
          textStyle: GoogleFonts.jetBrainsMono(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            letterSpacing: 2.4,
          ),
          shape: const RoundedRectangleBorder(),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: SIMEopsColors.tealLight,
          textStyle: GoogleFonts.jetBrainsMono(
            fontSize: 11,
            letterSpacing: 1.5,
          ),
          shape: const RoundedRectangleBorder(),
        ),
      ),
      // Campo é uma LINHA, não uma caixa. Fundo preenchido + borda em volta
      // desenha um retângulo por campo; num formulário de cinco campos são
      // cinco caixas competindo com o conteúdo.
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        contentPadding: const EdgeInsets.only(top: 12, bottom: 9),
        border: const UnderlineInputBorder(
          borderSide: BorderSide(color: SIMEopsColors.ruleStrong),
        ),
        enabledBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: SIMEopsColors.ruleStrong),
        ),
        focusedBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: SIMEopsColors.tealLight),
        ),
        hintStyle: GoogleFonts.archivo(
          fontSize: 17,
          color: SIMEopsColors.faint,
        ),
        labelStyle: GoogleFonts.jetBrainsMono(
          fontSize: 9.5,
          letterSpacing: 1.9,
          color: SIMEopsColors.muted,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        Provider(create: (_) => ApiService()),
        Provider(create: (_) => LocalDbService()),
      ],
      child: MaterialApp(
        navigatorKey: navigatorKey,
        title: 'SIMEops',
        debugShowCheckedModeBanner: false,
        themeMode: ThemeMode.dark,
        theme: _buildTheme(Brightness.light),
        darkTheme: _buildTheme(Brightness.dark),
        home: const AuthGate(),
        onGenerateRoute: (settings) {
          if (settings.name == '/city') {
            final cidade = settings.arguments as String;
            return MaterialPageRoute(
              builder: (_) => _CityRouteWrapper(cidade: cidade),
            );
          }
          // Deep link do push de busca manual: abre o resultado direto
          // (a tela já sabe retomar/carregar pelo resumeSearchId).
          if (settings.name == '/search') {
            final searchId = settings.arguments as String;
            return MaterialPageRoute(
              builder: (_) => ManualSearchScreen(resumeSearchId: searchId),
            );
          }
          return null;
        },
      ),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _pushInitialized = false;
  bool _configLoaded = false;
  bool _authRequired = true;
  bool _checkingProfile = false;
  bool _mustChangePassword = false;

  @override
  void initState() {
    super.initState();
    _loadAuthConfig();
    _setupAuthRefresh();
    Future.delayed(const Duration(seconds: 4), () {
      if (mounted && !_configLoaded) {
        setState(() => _configLoaded = true);
      }
    });
  }

  void _setupAuthRefresh() {
    final auth = context.read<AuthService>();
    final api = context.read<ApiService>();

    // Atualizar token no ApiService quando Supabase faz auto-refresh
    Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      final newToken = data.session?.accessToken ?? '';
      if (newToken.isNotEmpty) {
        api.setToken(newToken);
        debugPrint('[AuthGate] Token refreshed');
      }
    });

    // Callback pra forçar logout quando API retorna 401
    api.onAuthExpired = () {
      debugPrint('[AuthGate] Auth expired — signing out');
      auth.signOut();
    };
  }

  Future<void> _loadAuthConfig() async {
    try {
      final api = context.read<ApiService>();
      final config = await api.getAuthConfig();
      if (mounted && !_configLoaded) {
        setState(() {
          _authRequired = config['authRequired'] as bool? ?? true;
          _configLoaded = true;
        });
      }
    } catch (_) {
      if (mounted && !_configLoaded) {
        setState(() => _configLoaded = true);
      }
    }
  }

  Future<void> _checkMustChangePassword() async {
    if (_checkingProfile) return;
    _checkingProfile = true;
    try {
      final api = context.read<ApiService>();
      final profile = await api.getMyProfile();
      if (mounted) {
        final must = profile['must_change_password'] as bool? ?? false;
        if (must != _mustChangePassword) {
          setState(() => _mustChangePassword = must);
        }
      }
    } catch (_) {
      // Se falhar, nao bloqueia — deixa entrar
    } finally {
      _checkingProfile = false;
    }
  }

  void _initPush() {
    if (_pushInitialized) return;
    _pushInitialized = true;
    final api = context.read<ApiService>();
    PushService(api).init();
  }

  Future<void> _onPasswordChanged() async {
    setState(() => _mustChangePassword = false);
  }

  @override
  Widget build(BuildContext context) {
    if (!_configLoaded) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final auth = context.watch<AuthService>();

    // Se auth nao e obrigatorio, ir direto para MainScreen
    if (!_authRequired) {
      if (auth.isAuthenticated) {
        context.read<ApiService>().setToken(auth.accessToken);
        _initPush();
      }
      return const MainScreen();
    }

    if (auth.isAuthenticated) {
      context.read<ApiService>().setToken(auth.accessToken);
      _initPush();

      // Checar se precisa trocar senha (async, nao bloqueia)
      _checkMustChangePassword();

      if (_mustChangePassword) {
        return ChangePasswordScreen(
          onComplete: _onPasswordChanged,
        );
      }

      return const MainScreen();
    }

    _pushInitialized = false;
    _mustChangePassword = false;
    _checkingProfile = false;
    return const LoginScreen();
  }
}

/// Wrapper para navegar pra CityDetailScreen a partir de push notification.
/// Cria um CityOverview minimo com o nome da cidade.
class _CityRouteWrapper extends StatelessWidget {
  final String cidade;
  const _CityRouteWrapper({required this.cidade});

  @override
  Widget build(BuildContext context) {
    return CityDetailScreen(
      city: CityOverview(
        id: '',
        name: cidade,
        type: 'city',
        totalCrimes30d: 0,
        totalCrimes: 0,
        trendPercent: 0,
        topCrimePercent: 0,
        unreadCount: 0,
      ),
    );
  }
}

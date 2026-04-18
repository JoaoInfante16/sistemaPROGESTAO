import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'firebase_options.dart';
import 'core/config/env.dart';
import 'core/services/auth_service.dart';
import 'core/services/api_service.dart';
import 'core/services/local_db_service.dart';
import 'core/services/push_service.dart';
import 'core/models/city_overview.dart';
import 'features/dashboard/screens/city_detail_screen.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/screens/change_password_screen.dart';
import 'features/feed/screens/main_screen.dart';

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

// Cores do design SIMEops
class SIMEopsColors {
  static const navy = Color(0xFF060D18);
  static const navyMid = Color(0xFF0A1828);
  static const navyLight = Color(0xFF112233);
  static const teal = Color(0xFF1A8F9A);
  static const tealLight = Color(0xFF22B5C4);
  static const green = Color(0xFF7AB648);
  static const greenLight = Color(0xFF92D050);
  static const white = Color(0xFFF0F4F8);
  static const muted = Color(0xFF8FA9C0);
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
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(
            color: isDark
                ? SIMEopsColors.teal.withValues(alpha: 0.15)
                : Colors.grey.withValues(alpha: 0.2),
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: isDark ? SIMEopsColors.navyMid : null,
        indicatorColor: SIMEopsColors.teal.withValues(alpha: 0.2),
      ),
      textTheme: GoogleFonts.exo2TextTheme(base.textTheme),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: SIMEopsColors.green,
          foregroundColor: Colors.white,
          textStyle: GoogleFonts.rajdhani(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: 2,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark
            ? SIMEopsColors.navyLight.withValues(alpha: 0.7)
            : null,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: SIMEopsColors.teal.withValues(alpha: 0.2),
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: SIMEopsColors.teal.withValues(alpha: 0.2),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: SIMEopsColors.teal),
        ),
        labelStyle: TextStyle(
          color: isDark ? SIMEopsColors.muted : null,
          letterSpacing: 1,
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

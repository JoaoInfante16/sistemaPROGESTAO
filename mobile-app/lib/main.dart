import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'firebase_options.dart';
import 'core/config/env.dart';
import 'core/services/auth_service.dart';
import 'core/services/api_service.dart';
import 'core/services/local_db_service.dart';
import 'core/services/push_service.dart';
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

  runApp(const SIMEopsApp());
}

class SIMEopsApp extends StatelessWidget {
  const SIMEopsApp({super.key});

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
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF1A237E),
            brightness: Brightness.light,
          ),
          useMaterial3: true,
        ),
        darkTheme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF1A237E),
            brightness: Brightness.dark,
          ),
          useMaterial3: true,
        ),
        home: const AuthGate(),
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
    Future.delayed(const Duration(seconds: 4), () {
      if (mounted && !_configLoaded) {
        setState(() => _configLoaded = true);
      }
    });
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

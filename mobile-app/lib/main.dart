import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'firebase_options.dart';
import 'core/config/env.dart';
import 'core/services/auth_service.dart';
import 'core/services/api_service.dart';
import 'core/services/local_db_service.dart';
import 'core/services/push_service.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/feed/screens/main_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    // Already initialized (hot restart or auto-init via google-services.json)
  }

  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
  );

  runApp(const NetriosApp());
}

class NetriosApp extends StatelessWidget {
  const NetriosApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        Provider(create: (_) => ApiService()),
        Provider(create: (_) => LocalDbService()),
      ],
      child: MaterialApp(
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

  @override
  void initState() {
    super.initState();
    _loadAuthConfig();
    // Safety: se tudo falhar, desbloqueia em 4 segundos
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

  void _initPush() {
    if (_pushInitialized) return;
    _pushInitialized = true;
    final api = context.read<ApiService>();
    PushService(api).init();
  }

  @override
  Widget build(BuildContext context) {
    if (!_configLoaded) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final auth = context.watch<AuthService>();

    // Se auth não é obrigatório, ir direto para MainScreen
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
      return const MainScreen();
    }

    _pushInitialized = false;
    return const LoginScreen();
  }
}

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/widgets/grid_background.dart';
import '../../../main.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _loading = false;
  bool _obscurePassword = true;
  String? _error;
  bool _deviceAuthAvailable = false;
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _checkDeviceAuth();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _animCtrl.forward();
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkDeviceAuth() async {
    final auth = context.read<AuthService>();
    final hasEnabled = await auth.hasDeviceAuthEnabled();
    final isAvailable = await auth.isDeviceAuthAvailable();
    if (mounted) {
      setState(() => _deviceAuthAvailable = hasEnabled && isAvailable);
    }
  }

  Future<void> _handleDeviceAuth() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final auth = context.read<AuthService>();
      final success = await auth.authenticateWithDevice();
      if (!success) {
        setState(() => _error = 'Autenticacao cancelada.');
        return;
      }
      await auth.signInWithDeviceAuth();
    } catch (e) {
      setState(
          () => _error = 'Falha na autenticacao. Tente com email e senha.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleForgotPassword() async {
    final emailController =
        TextEditingController(text: _emailCtrl.text.trim());
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SIMEopsColors.navyMid,
        icon: Icon(Icons.lock_reset, size: 40, color: SIMEopsColors.tealLight),
        title: Text('Esqueceu a senha?',
            style: GoogleFonts.rajdhani(fontWeight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
                'Digite seu email e vamos notificar o administrador para redefinir sua senha.'),
            const SizedBox(height: 16),
            TextField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Email',
                hintText: 'Digite seu email',
                prefixIcon: Icon(Icons.email_outlined),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Solicitar'),
          ),
        ],
      ),
    );

    if (result == true &&
        emailController.text.trim().isNotEmpty &&
        mounted) {
      try {
        final api = context.read<ApiService>();
        await api.requestPasswordReset(emailController.text.trim());
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content:
                    Text('Solicitacao enviada! O administrador sera notificado.')),
          );
        }
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content:
                    Text('Solicitacao enviada! O administrador sera notificado.')),
          );
        }
      }
    }
    emailController.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await context.read<AuthService>().signIn(
            _emailCtrl.text.trim(),
            _passwordCtrl.text,
          );
    } catch (e) {
      setState(() => _error = 'Email ou senha incorretos');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      body: GridBackground(
        child: SafeArea(
          child: Center(
          child: FadeTransition(
            opacity: _fadeAnim,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Container(
                constraints: const BoxConstraints(maxWidth: 400),
                decoration: BoxDecoration(
                  color: SIMEopsColors.navyMid.withValues(alpha: 0.92),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: SIMEopsColors.teal.withValues(alpha: 0.15),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.5),
                      blurRadius: 64,
                      offset: const Offset(0, 24),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(32, 48, 32, 32),
                  child: Form(
                    key: _formKey,
                    child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Logo
                            Image.asset(
                              'assets/images/logo.png',
                              width: 64,
                              height: 64,
                            ),
                            const SizedBox(height: 18),

                            // SIME + OPS
                            RichText(
                              text: TextSpan(
                                style: GoogleFonts.rajdhani(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 3,
                                  color: SIMEopsColors.white,
                                ),
                                children: const [
                                  TextSpan(text: 'SIME'),
                                  TextSpan(
                                    text: 'OPS',
                                    style: TextStyle(
                                        color: SIMEopsColors.greenLight),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 4),

                            // PROGESTAO TECNOLOGIA
                            Text(
                              'PROGESTAO TECNOLOGIA',
                              style: GoogleFonts.rajdhani(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                letterSpacing: 3.5,
                                color: SIMEopsColors.tealLight
                                    .withValues(alpha: 0.8),
                              ),
                            ),
                            const SizedBox(height: 7),

                            // Descricao
                            Text(
                              'Sistema de Monitoramento de\nOcorrências Policiais',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.exo2(
                                fontSize: 11,
                                color:
                                    SIMEopsColors.muted.withValues(alpha: 0.7),
                                height: 1.5,
                              ),
                            ),
                            const SizedBox(height: 22),

                            // Divider
                            Row(
                              children: [
                                Expanded(
                                  child: Container(
                                    height: 1,
                                    color: SIMEopsColors.teal
                                        .withValues(alpha: 0.15),
                                  ),
                                ),
                                Padding(
                                  padding:
                                      const EdgeInsets.symmetric(horizontal: 8),
                                  child: Text(
                                    '\u25CB \u25CB \u25CB',
                                    style: TextStyle(
                                      fontSize: 6,
                                      color: SIMEopsColors.muted
                                          .withValues(alpha: 0.35),
                                      letterSpacing: 2,
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: Container(
                                    height: 1,
                                    color: SIMEopsColors.teal
                                        .withValues(alpha: 0.15),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 22),

                            // Device auth button
                            if (_deviceAuthAvailable) ...[
                              SizedBox(
                                width: double.infinity,
                                height: 48,
                                child: OutlinedButton.icon(
                                  onPressed: _loading ? null : _handleDeviceAuth,
                                  style: OutlinedButton.styleFrom(
                                    side: BorderSide(
                                        color: SIMEopsColors.teal
                                            .withValues(alpha: 0.3)),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  icon: Icon(Icons.fingerprint,
                                      size: 24, color: SIMEopsColors.tealLight),
                                  label: Text(
                                    'ENTRAR COM DESBLOQUEIO',
                                    style: GoogleFonts.rajdhani(
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 1.5,
                                      color: SIMEopsColors.tealLight,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Expanded(
                                      child: Container(
                                          height: 1,
                                          color: SIMEopsColors.teal
                                              .withValues(alpha: 0.1))),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 12),
                                    child: Text(
                                      'ou entre com senha',
                                      style: GoogleFonts.exo2(
                                        fontSize: 11,
                                        color: SIMEopsColors.muted
                                            .withValues(alpha: 0.5),
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                      child: Container(
                                          height: 1,
                                          color: SIMEopsColors.teal
                                              .withValues(alpha: 0.1))),
                                ],
                              ),
                              const SizedBox(height: 16),
                            ],

                            // Error
                            if (_error != null) ...[
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.red.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                      color:
                                          Colors.red.withValues(alpha: 0.3)),
                                ),
                                child: Text(
                                  _error!,
                                  style: const TextStyle(
                                      color: Colors.redAccent, fontSize: 13),
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            // E-MAIL label
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                'E-MAIL',
                                style: GoogleFonts.rajdhani(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 2,
                                  color: SIMEopsColors.muted,
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextFormField(
                              controller: _emailCtrl,
                              keyboardType: TextInputType.emailAddress,
                              style:
                                  const TextStyle(color: SIMEopsColors.white),
                              decoration: const InputDecoration(
                                hintText: 'seu@email.com',
                                prefixIcon: Icon(Icons.email_outlined,
                                    color: SIMEopsColors.muted, size: 20),
                              ),
                              validator: (v) {
                                if (v == null || v.isEmpty) {
                                  return 'Informe o email';
                                }
                                if (!v.contains('@')) return 'Email invalido';
                                return null;
                              },
                            ),
                            const SizedBox(height: 14),

                            // SENHA label
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                'SENHA',
                                style: GoogleFonts.rajdhani(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 2,
                                  color: SIMEopsColors.muted,
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextFormField(
                              controller: _passwordCtrl,
                              obscureText: _obscurePassword,
                              style:
                                  const TextStyle(color: SIMEopsColors.white),
                              decoration: InputDecoration(
                                hintText: '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022',
                                prefixIcon: const Icon(Icons.lock_outlined,
                                    color: SIMEopsColors.muted, size: 20),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility_off
                                        : Icons.visibility,
                                    color: SIMEopsColors.muted,
                                    size: 20,
                                  ),
                                  onPressed: () => setState(() =>
                                      _obscurePassword = !_obscurePassword),
                                ),
                              ),
                              validator: (v) {
                                if (v == null || v.isEmpty) {
                                  return 'Informe a senha';
                                }
                                return null;
                              },
                              onFieldSubmitted: (_) => _handleLogin(),
                            ),
                            const SizedBox(height: 24),

                            // ENTRAR button
                            SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [
                                      SIMEopsColors.green,
                                      SIMEopsColors.greenLight,
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: ElevatedButton(
                                  onPressed: _loading ? null : _handleLogin,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.transparent,
                                    shadowColor: Colors.transparent,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  child: _loading
                                      ? const SizedBox(
                                          height: 20,
                                          width: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : Text(
                                          'ENTRAR',
                                          style: GoogleFonts.rajdhani(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                            letterSpacing: 3,
                                            color: Colors.white,
                                          ),
                                        ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),

                            // Esqueci minha senha
                            TextButton(
                              onPressed: _loading ? null : _handleForgotPassword,
                              child: Text(
                                'Esqueci minha senha',
                                style: GoogleFonts.exo2(
                                  fontSize: 13,
                                  color: SIMEopsColors.muted
                                      .withValues(alpha: 0.7),
                                ),
                              ),
                            ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        ),
      ),
    );
  }
}

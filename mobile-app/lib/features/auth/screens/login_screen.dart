import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _deviceAuthAvailable = false;

  @override
  void initState() {
    super.initState();
    _checkDeviceAuth();
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
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
      setState(() => _error = 'Falha na autenticacao. Tente com email e senha.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleForgotPassword() async {
    final emailController = TextEditingController(text: _emailCtrl.text.trim());
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.lock_reset, size: 40),
        title: const Text('Esqueceu a senha?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Digite seu email e vamos notificar o administrador para redefinir sua senha.'),
            const SizedBox(height: 16),
            TextField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Email',
                hintText: 'Digite seu email',
                border: OutlineInputBorder(),
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

    if (result == true && emailController.text.trim().isNotEmpty && mounted) {
      try {
        final api = context.read<ApiService>();
        await api.requestPasswordReset(emailController.text.trim());
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Solicitacao enviada! O administrador sera notificado.')),
          );
        }
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Solicitacao enviada! O administrador sera notificado.')),
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
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(32),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Logo / Title
                  Icon(
                    Icons.shield_outlined,
                    size: 64,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'SIMEops - PROGESTAO',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sistema de Monitoramento de Ocorrencias Policiais',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey[600],
                        ),
                  ),
                  const SizedBox(height: 48),

                  // Botão de autenticação do device (se configurado)
                  if (_deviceAuthAvailable) ...[
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: OutlinedButton.icon(
                        onPressed: _loading ? null : _handleDeviceAuth,
                        icon: const Icon(Icons.fingerprint, size: 28),
                        label: const Text('Entrar com desbloqueio do celular'),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        const Expanded(child: Divider()),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text(
                            'ou entre com senha',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.grey[500],
                                ),
                          ),
                        ),
                        const Expanded(child: Divider()),
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
                        color: Colors.red[50],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _error!,
                        style: TextStyle(color: Colors.red[700]),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Email
                  TextFormField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      prefixIcon: Icon(Icons.email_outlined),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Informe o email';
                      if (!v.contains('@')) return 'Email invalido';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Password
                  TextFormField(
                    controller: _passwordCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Senha',
                      prefixIcon: Icon(Icons.lock_outlined),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Informe a senha';
                      return null;
                    },
                    onFieldSubmitted: (_) => _handleLogin(),
                  ),
                  const SizedBox(height: 24),

                  // Login button
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(
                      onPressed: _loading ? null : _handleLogin,
                      child: _loading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Entrar'),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Forgot password
                  TextButton(
                    onPressed: _loading ? null : _handleForgotPassword,
                    child: const Text('Esqueci minha senha'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

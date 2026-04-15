import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';

class ChangePasswordScreen extends StatefulWidget {
  final VoidCallback? onComplete;

  const ChangePasswordScreen({super.key, this.onComplete});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _loading = false;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  String? _error;
  bool _deviceAuthAvailable = false;
  bool _showPasswordForm = false;

  @override
  void initState() {
    super.initState();
    _checkDeviceAuth();
  }

  @override
  void dispose() {
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkDeviceAuth() async {
    final auth = context.read<AuthService>();
    final available = await auth.isDeviceAuthAvailable();
    if (mounted) {
      setState(() => _deviceAuthAvailable = available);
    }
  }

  Future<void> _handleChooseDeviceAuth() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final auth = context.read<AuthService>();
      final api = context.read<ApiService>();

      // Gera senha forte aleatoria (user nunca vai precisar digitar)
      final generatedPassword = _generateStrongPassword();

      // Troca a senha no backend
      await api.changePassword(generatedPassword);

      // Salva credenciais no secure storage
      final email = auth.currentUser?.email;
      if (email != null) {
        await auth.saveCredentials(email, generatedPassword);
        // Re-login pra renovar token
        await auth.signIn(email, generatedPassword);
      }

      if (mounted) {
        widget.onComplete?.call();
      }
    } catch (e) {
      setState(() => _error = 'Erro ao configurar. Tente novamente.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleSetPassword() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final api = context.read<ApiService>();
      await api.changePassword(_passwordCtrl.text);

      if (mounted) {
        final auth = context.read<AuthService>();
        final email = auth.currentUser?.email;
        if (email != null) {
          await auth.signIn(email, _passwordCtrl.text);
        }

        if (mounted) {
          widget.onComplete?.call();
        }
      }
    } catch (e) {
      setState(() => _error = 'Erro ao alterar senha. Tente novamente.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _generateStrongPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#\$%&*';
    final rng = Random.secure();
    return List.generate(24, (_) => chars[rng.nextInt(chars.length)]).join();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.lock_reset,
                  size: 64,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(height: 16),
                Text(
                  'Configure seu acesso',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Sua conta foi criada com uma senha temporaria.\nEscolha como deseja acessar o app:',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: Colors.grey[600],
                  ),
                ),
                const SizedBox(height: 32),

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

                // Se não mostrou o form de senha ainda, mostra as opções
                if (!_showPasswordForm) ...[
                  // Opção 1: Usar autenticação do device
                  if (_deviceAuthAvailable)
                    _OptionCard(
                      icon: Icons.fingerprint,
                      title: 'Usar desbloqueio do celular',
                      subtitle: 'Digital, reconhecimento facial, PIN ou padrao — o mesmo que voce ja usa no celular',
                      loading: _loading,
                      onTap: _loading ? null : _handleChooseDeviceAuth,
                      primary: true,
                      theme: theme,
                    ),

                  if (_deviceAuthAvailable) const SizedBox(height: 16),

                  // Opção 2: Criar senha
                  _OptionCard(
                    icon: Icons.password,
                    title: 'Criar uma senha',
                    subtitle: 'Voce vai digitar email e senha para entrar',
                    loading: false,
                    onTap: _loading
                        ? null
                        : () => setState(() => _showPasswordForm = true),
                    primary: !_deviceAuthAvailable,
                    theme: theme,
                  ),
                ],

                // Form de senha (quando clicou "Criar uma senha")
                if (_showPasswordForm) ...[
                  Form(
                    key: _formKey,
                    child: Column(
                      children: [
                        TextFormField(
                          controller: _passwordCtrl,
                          obscureText: _obscurePassword,
                          decoration: InputDecoration(
                            labelText: 'Nova senha',
                            prefixIcon: const Icon(Icons.lock_outlined),
                            suffixIcon: IconButton(
                              icon: Icon(_obscurePassword
                                  ? Icons.visibility_off
                                  : Icons.visibility),
                              onPressed: () => setState(
                                  () => _obscurePassword = !_obscurePassword),
                            ),
                            border: const OutlineInputBorder(),
                          ),
                          validator: (v) {
                            if (v == null || v.isEmpty) {
                              return 'Informe a nova senha';
                            }
                            if (v.length < 6) return 'Minimo 6 caracteres';
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _confirmCtrl,
                          obscureText: _obscureConfirm,
                          decoration: InputDecoration(
                            labelText: 'Confirmar senha',
                            prefixIcon: const Icon(Icons.lock_outlined),
                            suffixIcon: IconButton(
                              icon: Icon(_obscureConfirm
                                  ? Icons.visibility_off
                                  : Icons.visibility),
                              onPressed: () => setState(
                                  () => _obscureConfirm = !_obscureConfirm),
                            ),
                            border: const OutlineInputBorder(),
                          ),
                          validator: (v) {
                            if (v != _passwordCtrl.text) {
                              return 'Senhas não conferem';
                            }
                            return null;
                          },
                          onFieldSubmitted: (_) => _handleSetPassword(),
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: FilledButton(
                            onPressed: _loading ? null : _handleSetPassword,
                            child: _loading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text('Salvar nova senha'),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: _loading
                              ? null
                              : () =>
                                  setState(() => _showPasswordForm = false),
                          child: const Text('Voltar'),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OptionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool loading;
  final VoidCallback? onTap;
  final bool primary;
  final ThemeData theme;

  const _OptionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.loading,
    required this.onTap,
    required this.primary,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: primary ? 2 : 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: primary
              ? theme.colorScheme.primary
              : theme.colorScheme.outlineVariant,
          width: primary ? 2 : 1,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: primary
                      ? theme.colorScheme.primaryContainer
                      : theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: loading
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        icon,
                        color: primary
                            ? theme.colorScheme.primary
                            : theme.colorScheme.onSurfaceVariant,
                      ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: Colors.grey[400],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';
import '../../../main.dart';
import '../../../core/widgets/grid_background.dart';

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
  bool _rememberMe = true;
  String? _error;

  @override
  void dispose() {
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSetPassword() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final api = context.read<ApiService>();
      final auth = context.read<AuthService>();
      await api.changePassword(_passwordCtrl.text);

      final email = auth.currentUser?.email;
      if (email != null) {
        // Re-login com a nova senha
        await auth.signIn(email, _passwordCtrl.text);

        // Salvar credenciais se "lembrar minha senha" ativo
        if (_rememberMe) {
          await auth.saveCredentials(email, _passwordCtrl.text);
        }
      }

      if (mounted) {
        widget.onComplete?.call();
      }
    } catch (e) {
      setState(() => _error = 'Erro ao alterar senha. Tente novamente.');
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
                  padding: const EdgeInsets.fromLTRB(32, 40, 32, 32),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Icon
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: SIMEopsColors.teal.withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.lock_reset,
                            size: 32,
                            color: SIMEopsColors.teal,
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Title
                        Text(
                          'CRIE SUA SENHA',
                          style: GoogleFonts.rajdhani(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 2,
                            color: SIMEopsColors.white,
                          ),
                        ),
                        const SizedBox(height: 8),

                        // Subtitle
                        Text(
                          'Sua conta foi criada com uma senha temporaria.\nCrie uma senha permanente para continuar.',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.exo2(
                            fontSize: 12,
                            color: SIMEopsColors.muted.withValues(alpha: 0.7),
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 28),

                        // Error
                        if (_error != null) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.red.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: Colors.red.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Text(
                              _error!,
                              style: const TextStyle(
                                color: Colors.redAccent,
                                fontSize: 13,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // NOVA SENHA label
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'NOVA SENHA',
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
                          style: const TextStyle(color: SIMEopsColors.white),
                          decoration: InputDecoration(
                            hintText: 'Minimo 6 caracteres',
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
                              onPressed: () => setState(
                                  () => _obscurePassword = !_obscurePassword),
                            ),
                          ),
                          validator: (v) {
                            if (v == null || v.isEmpty) {
                              return 'Informe a nova senha';
                            }
                            if (v.length < 6) return 'Minimo 6 caracteres';
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),

                        // CONFIRMAR SENHA label
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'CONFIRMAR SENHA',
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
                          controller: _confirmCtrl,
                          obscureText: _obscureConfirm,
                          style: const TextStyle(color: SIMEopsColors.white),
                          decoration: InputDecoration(
                            hintText: 'Repita a senha',
                            prefixIcon: const Icon(Icons.lock_outlined,
                                color: SIMEopsColors.muted, size: 20),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscureConfirm
                                    ? Icons.visibility_off
                                    : Icons.visibility,
                                color: SIMEopsColors.muted,
                                size: 20,
                              ),
                              onPressed: () => setState(
                                  () => _obscureConfirm = !_obscureConfirm),
                            ),
                          ),
                          validator: (v) {
                            if (v != _passwordCtrl.text) {
                              return 'Senhas nao conferem';
                            }
                            return null;
                          },
                          onFieldSubmitted: (_) => _handleSetPassword(),
                        ),
                        const SizedBox(height: 20),

                        // Lembrar minha senha
                        GestureDetector(
                          onTap: () => setState(() => _rememberMe = !_rememberMe),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 20,
                                height: 20,
                                child: Checkbox(
                                  value: _rememberMe,
                                  onChanged: (v) => setState(() => _rememberMe = v ?? true),
                                  activeColor: SIMEopsColors.teal,
                                  side: BorderSide(
                                    color: SIMEopsColors.muted.withValues(alpha: 0.5),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                'Lembrar minha senha neste dispositivo',
                                style: GoogleFonts.exo2(
                                  fontSize: 13,
                                  color: SIMEopsColors.muted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // SALVAR button
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
                              onPressed: _loading ? null : _handleSetPassword,
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
                                      'SALVAR SENHA',
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
                      ],
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

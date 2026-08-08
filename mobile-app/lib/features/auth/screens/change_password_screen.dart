import 'dart:math';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';

/// Primeiro acesso: a senha provisória (que o administrador conhece) precisa
/// morrer aqui. Dois caminhos para isso:
///
/// **1. Criar uma senha** — o de sempre.
///
/// **2. Usar o desbloqueio do celular** — o app pergunta ao Android (digital,
/// rosto, PIN ou padrão, o que estiver configurado), gera uma senha aleatória
/// forte que o usuário nunca vê, troca no servidor e guarda no Keystore.
/// A partir daí entrar é desbloquear.
///
/// O caminho 2 é mais seguro que o 1 na prática — senha de 32 caracteres
/// sorteada contra "Mudar@123" que a pessoa reusa no e-mail — **mas tem um
/// custo que precisa estar escrito na tela**: quem escolhe ele não sabe a
/// própria senha. Perdeu o celular ou limpou os dados do app, só volta com
/// reset do administrador. Esconder isso seria armadilha.
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

  /// null enquanto a consulta ao device não voltou — o botão não aparece
  /// piscando e depois some.
  bool? _deviceAuthAvailable;

  @override
  void initState() {
    super.initState();
    _checkDeviceAuth();
  }

  Future<void> _checkDeviceAuth() async {
    final auth = context.read<AuthService>();
    final ok = await auth.isDeviceAuthAvailable();
    if (mounted) setState(() => _deviceAuthAvailable = ok);
  }

  @override
  void dispose() {
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  /// Senha que ninguém digita, então pode ser longa e feia.
  /// `Random.secure()` usa a fonte de entropia do sistema — `Random()` comum
  /// é previsível e não serve para credencial.
  static String _generateStrongPassword() {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        '!@#\$%^&*-_=+';
    final rnd = Random.secure();
    return List.generate(32, (_) => chars[rnd.nextInt(chars.length)]).join();
  }

  Future<void> _apply(String newPassword, {required bool remember}) async {
    final api = context.read<ApiService>();
    final auth = context.read<AuthService>();

    await api.changePassword(newPassword);

    final email = auth.currentUser?.email;
    if (email != null) {
      await auth.signIn(email, newPassword);
      if (remember) {
        await auth.saveCredentials(email, newPassword);
      } else {
        // Trocou por senha digitada: qualquer credencial guardada de antes
        // aponta pra senha velha e faria o login automático falhar em silêncio.
        await auth.clearSavedCredentials();
      }
    }
  }

  Future<void> _handleSetPassword() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _apply(_passwordCtrl.text, remember: false);
      if (mounted) widget.onComplete?.call();
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Não foi possível alterar a senha. Tente de novo.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleDeviceAuth() async {
    final auth = context.read<AuthService>();

    setState(() => _error = null);

    // Pergunta ao Android ANTES de mexer no servidor: se o usuário desistir no
    // diálogo do sistema, nada aconteceu e a senha provisória segue valendo.
    final ok = await auth.authenticateWithDevice();
    if (!ok) {
      if (mounted) {
        setState(() => _error = 'Desbloqueio cancelado. Nada foi alterado.');
      }
      return;
    }

    if (mounted) setState(() => _loading = true);
    try {
      await _apply(_generateStrongPassword(), remember: true);
      if (mounted) widget.onComplete?.call();
    } catch (_) {
      if (mounted) {
        setState(() =>
            _error = 'Não foi possível concluir. Tente criar uma senha.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 40, 18, 40),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('PRIMEIRO ACESSO',
                    style: SIMEopsType.slug(color: SIMEopsColors.tealLight)),
                const SizedBox(height: 12),
                Text('Sua senha\nprovisória expira\nagora',
                    style: SIMEopsType.title()),
                const SizedBox(height: 12),
                Text(
                  'A senha que o administrador criou é conhecida por ele. '
                  'Escolha como você vai entrar a partir de agora.',
                  style: SIMEopsType.lead(),
                ),

                if (_error != null) ...[
                  const SizedBox(height: 22),
                  Container(
                    decoration: const BoxDecoration(
                      border: Border(
                        left: BorderSide(color: SIMEopsColors.alert, width: 2),
                      ),
                    ),
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                    child: Text(_error!,
                        style: SIMEopsType.note(color: SIMEopsColors.alert)),
                  ),
                ],

                // ── Caminho 1: o celular ──
                if (_deviceAuthAvailable == true) ...[
                  const SizedBox(height: 30),
                  _SectionRule(label: 'RECOMENDADO'),
                  const SizedBox(height: 16),
                  Text('Desbloquear como o celular',
                      style: SIMEopsType.body().copyWith(fontSize: 19)),
                  const SizedBox(height: 8),
                  Text(
                    'Digital, rosto ou PIN — o mesmo que abre o aparelho. '
                    'O app cria uma senha longa sozinho e guarda protegida '
                    'pelo Android. Você não precisa decorar nada.',
                    style: SIMEopsType.lead(),
                  ),
                  const SizedBox(height: 12),
                  // A ressalva fica JUNTO da opção, não num rodapé que ninguém lê.
                  Text(
                    'SE TROCAR DE CELULAR OU LIMPAR OS DADOS DO APP, O ACESSO\n'
                    'SÓ VOLTA COM UMA REDEFINIÇÃO DO ADMINISTRADOR.',
                    style: SIMEopsType.note(),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _loading ? null : _handleDeviceAuth,
                      child: const Text('USAR O DESBLOQUEIO DO CELULAR'),
                    ),
                  ),
                ],

                // ── Caminho 2: senha ──
                const SizedBox(height: 34),
                _SectionRule(
                  label: _deviceAuthAvailable == true
                      ? 'OU CRIE UMA SENHA'
                      : 'CRIE UMA SENHA',
                ),
                const SizedBox(height: 18),
                Text('NOVA SENHA', style: SIMEopsType.fieldLabel()),
                _PasswordField(
                  controller: _passwordCtrl,
                  hint: 'Mínimo 6 caracteres',
                  obscure: _obscurePassword,
                  onToggle: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Informe a nova senha';
                    if (v.length < 6) return 'Mínimo 6 caracteres';
                    return null;
                  },
                ),
                const SizedBox(height: 20),
                Text('REPITA A SENHA', style: SIMEopsType.fieldLabel()),
                _PasswordField(
                  controller: _confirmCtrl,
                  hint: 'A mesma de cima',
                  obscure: _obscureConfirm,
                  onToggle: () =>
                      setState(() => _obscureConfirm = !_obscureConfirm),
                  validator: (v) =>
                      v != _passwordCtrl.text ? 'As senhas não conferem' : null,
                  onSubmitted: (_) => _handleSetPassword(),
                ),
                const SizedBox(height: 22),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: _loading ? null : _handleSetPassword,
                    child: const Text('SALVAR SENHA'),
                  ),
                ),

                if (_loading) ...[
                  const SizedBox(height: 26),
                  const Center(
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: SIMEopsColors.tealLight),
                    ),
                  ),
                ],

                const SizedBox(height: 30),
                Text('ESTA TELA APARECE UMA ÚNICA VEZ.',
                    style: SIMEopsType.note()),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionRule extends StatelessWidget {
  final String label;
  const _SectionRule({required this.label});

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Text(label, style: SIMEopsType.dateline(color: SIMEopsColors.faint)),
          const SizedBox(width: 11),
          const Expanded(child: Divider(color: SIMEopsColors.rule, height: 1)),
        ],
      );
}

/// Campo de senha sem caixa: filete embaixo, como o resto do fio.
class _PasswordField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final bool obscure;
  final VoidCallback onToggle;
  final String? Function(String?) validator;
  final void Function(String)? onSubmitted;

  const _PasswordField({
    required this.controller,
    required this.hint,
    required this.obscure,
    required this.onToggle,
    required this.validator,
    this.onSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      validator: validator,
      onFieldSubmitted: onSubmitted,
      style: SIMEopsType.body().copyWith(fontSize: 17),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: SIMEopsType.body()
            .copyWith(fontSize: 17, color: SIMEopsColors.hairline),
        filled: false,
        contentPadding: const EdgeInsets.only(top: 12, bottom: 9),
        enabledBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: SIMEopsColors.ruleStrong),
        ),
        focusedBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: SIMEopsColors.tealLight),
        ),
        border: const UnderlineInputBorder(
          borderSide: BorderSide(color: SIMEopsColors.ruleStrong),
        ),
        suffixIcon: InkWell(
          onTap: onToggle,
          child: Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Text(obscure ? 'VER' : 'OCULTAR',
                style: SIMEopsType.slug(color: SIMEopsColors.tealLight)),
          ),
        ),
        suffixIconConstraints: const BoxConstraints(minWidth: 64),
      ),
    );
  }
}

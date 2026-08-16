import 'dart:math';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/widgets/masthead.dart';

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

  /// **Portão** (`true`, o padrão) ou **visita** (`false`).
  ///
  /// No portão a tela é devolvida pelo gate do `main.dart` enquanto
  /// `must_change_password` for verdadeiro: não tem volta, não tem cabeçalho, e
  /// o texto fala da senha provisória que o administrador conhece.
  ///
  /// Na visita ela é empilhada pelas Configurações, e três coisas mudam: ganha
  /// seta de voltar, perde o *"Esta tela aparece uma única vez"* (que ali seria
  /// mentira) e perde a conversa sobre senha provisória — quem chegou pelo
  /// Ajustes já trocou a dele faz tempo.
  ///
  /// ⚠️ **A mecânica é a mesma nos dois casos, de propósito.** `_apply` troca a
  /// senha no servidor e depois **ou** grava a nova no cofre (desbloqueio pelo
  /// celular) **ou** limpa o cofre (senha digitada). Duplicar isso numa segunda
  /// tela "de Ajustes" seria criar um segundo lugar onde essa regra pode
  /// divergir — e é exatamente ela que, se divergir, deixa alguém trancado
  /// fora da conta.
  final bool primeiroAcesso;

  const ChangePasswordScreen({
    super.key,
    this.onComplete,
    this.primeiroAcesso = true,
  });

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

  /// Se o desbloqueio pelo celular é como a pessoa entra **hoje**. Só importa
  /// na visita: chamar de `RECOMENDADO` o caminho que já está em uso responde
  /// a pergunta errada — quem abre esta tela pelo Ajustes quer saber primeiro
  /// **como entra hoje**, e só depois o que pode mudar.
  bool _deviceAuthAtivo = false;

  @override
  void initState() {
    super.initState();
    _checkDeviceAuth();
  }

  Future<void> _checkDeviceAuth() async {
    final auth = context.read<AuthService>();
    final ok = await auth.isDeviceAuthAvailable();
    final ativo = await auth.hasDeviceAuthEnabled();
    if (mounted) {
      setState(() {
        _deviceAuthAvailable = ok;
        _deviceAuthAtivo = ativo;
      });
    }
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

  /// Fim de linha dos dois caminhos.
  ///
  /// 🚨 No portão quem decide o que vem depois é o gate — `onComplete`
  /// reconstrói o `main.dart` e a tela deixa de ser devolvida. Na visita não há
  /// gate nenhum, e sem isto a tela ficaria **parada**: sem erro, sem sinal de
  /// sucesso, depois de a senha já ter mudado no servidor e o cofre já ter sido
  /// reescrito. É o pior estado possível numa tela de credencial — a pessoa não
  /// sabe se pode sair, e tentar de novo é trocar duas vezes.
  void _concluir() {
    widget.onComplete?.call();
    if (!widget.primeiroAcesso) Navigator.pop(context, true);
  }

  Future<void> _handleSetPassword() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _apply(_passwordCtrl.text, remember: false);
      if (mounted) _concluir();
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Não foi possível alterar a senha. Tente de novo.',
        );
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
      if (mounted) _concluir();
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Não foi possível concluir. Tente criar uma senha.',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final portao = widget.primeiroAcesso;

    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      body: SafeArea(
        child: Column(
          children: [
            // No portão não existe voltar: a senha provisória tem que morrer
            // aqui, e desenhar uma saída que não existe é pior que não ter.
            if (!portao)
              Masthead(
                titulo: 'Mudar senha',
                onVoltar: () => Navigator.pop(context),
              ),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(18, portao ? 40 : 24, 18, 40),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (portao) ...[
                        Text(
                          'PRIMEIRO ACESSO',
                          style: SIMEopsType.slug(
                            color: SIMEopsColors.tealLight,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Sua senha\nprovisória expira\nagora',
                          style: SIMEopsType.title(),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'A senha que o administrador criou é conhecida por ele. '
                          'Escolha como você vai entrar a partir de agora.',
                          style: SIMEopsType.lead(),
                        ),
                      ] else
                        // 🚨 A frase que falta no portão e é obrigatória aqui: salvar
                        // **derruba a forma antiga**. `_apply` grava a nova senha no
                        // cofre ou apaga o cofre, e nos dois casos o jeito de entrar
                        // de ontem para de funcionar. Quem abre isto por curiosidade
                        // precisa saber disso antes de tocar em qualquer botão.
                        Text(
                          'A forma que você usa hoje para de valer assim que a nova '
                          'for salva.',
                          style: SIMEopsType.lead(),
                        ),

                      if (_error != null) ...[
                        const SizedBox(height: 22),
                        Container(
                          decoration: const BoxDecoration(
                            border: Border(
                              left: BorderSide(
                                color: SIMEopsColors.alert,
                                width: 2,
                              ),
                            ),
                          ),
                          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                          child: Text(
                            _error!,
                            style: SIMEopsType.note(color: SIMEopsColors.alert),
                          ),
                        ),
                      ],

                      // ── Caminho 1: o celular ──
                      if (_deviceAuthAvailable == true) ...[
                        const SizedBox(height: 30),
                        _SectionRule(
                          label: _deviceAuthAtivo
                              ? 'É COMO VOCÊ ENTRA HOJE'
                              : 'RECOMENDADO',
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Desbloquear como o celular',
                          style: SIMEopsType.body().copyWith(fontSize: 19),
                        ),
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
                          'Se trocar de celular ou limpar os dados do app, o acesso '
                          'só volta com uma redefinição do administrador.',
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
                        hint: 'Mínimo 8 caracteres',
                        obscure: _obscurePassword,
                        onToggle: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                        validator: (v) {
                          if (v == null || v.isEmpty) {
                            return 'Informe a nova senha';
                          }
                          if (v.length < 8) return 'Mínimo 8 caracteres';
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
                        validator: (v) => v != _passwordCtrl.text
                            ? 'As senhas não conferem'
                            : null,
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
                              strokeWidth: 2,
                              color: SIMEopsColors.tealLight,
                            ),
                          ),
                        ),
                      ],

                      if (portao) ...[
                        const SizedBox(height: 30),
                        Text(
                          'Esta tela aparece uma única vez.',
                          style: SIMEopsType.note(),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
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
      style: SIMEopsType.fieldValue(),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: SIMEopsType.fieldValue(color: SIMEopsColors.faint),
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
            child: Text(
              obscure ? 'VER' : 'OCULTAR',
              style: SIMEopsType.slug(color: SIMEopsColors.tealLight),
            ),
          ),
        ),
        suffixIconConstraints: const BoxConstraints(minWidth: 64),
      ),
    );
  }
}

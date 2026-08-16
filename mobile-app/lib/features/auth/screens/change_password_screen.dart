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
/// sorteada contra "Mudar@123" que a pessoa reusa no e-mail.
///
/// ⚠️ **Aqui havia uma ressalva na tela** dizendo que quem escolhesse o
/// caminho 2 não saberia a própria senha e, trocando de aparelho, só voltaria
/// com reset do administrador. Ela era verdade **enquanto a escolha era
/// permanente** — a tela só existia como portão de primeiro acesso. Com o
/// `Mudar senha` no Ajustes (16/08) a escolha virou reversível a qualquer
/// momento, e a ressalva passou a descrever um problema que não existe mais.
/// Se algum dia essa porta sumir do Ajustes, o aviso tem que voltar junto.
class ChangePasswordScreen extends StatefulWidget {
  final VoidCallback? onComplete;

  /// **Portão** (`true`, o padrão) ou **visita** (`false`).
  ///
  /// No portão a tela é devolvida pelo gate do `main.dart` enquanto
  /// `must_change_password` for verdadeiro: não tem volta, não tem cabeçalho, e
  /// o texto fala da senha provisória que o administrador conhece.
  ///
  /// Na visita ela é empilhada pelas Configurações: ganha seta de voltar e
  /// perde a manchete sobre senha provisória — quem chegou pelo Ajustes já
  /// trocou a dele faz tempo.
  ///
  /// 🚨 **É a mesma tela que o cliente vê, e por isso ela não explica nada.**
  /// Tinha quatro blocos de prosa: o que é a senha provisória, o que é
  /// biometria, o que acontece se trocar de aparelho, e um rodapé avisando que
  /// aparecia uma vez só. Saíram todos em 16/08 — *"porra o user n é burro"*.
  /// Sobraram duas seções, um `Padrão · PIN · Rosto` e dois botões.
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

  /// O atalho fica **marcado por padrão** quando o aparelho suporta: é o que
  /// quase todo mundo quer, e agora não custa nada — a senha existe do mesmo
  /// jeito. Reconciliado com o estado real em [_checkDeviceAuth].
  bool _usarDesbloqueio = false;

  @override
  void initState() {
    super.initState();
    _checkDeviceAuth();
  }

  /// ⚠️ **O `try` inteiro é obrigatório, e o motivo não é teórico.** São dois
  /// `await` antes de um único `setState`: um no plugin do Android, outro no
  /// cofre. Se qualquer um levantar, a função morre no meio e
  /// `_deviceAuthAvailable` fica **null pra sempre** — e null não desenha nada,
  /// então a falha aparece como *"o botão não existe"*, sem erro na tela e sem
  /// rastro. Falhando, o caminho do celular some (que é o certo: não dá pra
  /// oferecer o que não se sabe se existe) e a senha digitada continua lá.
  Future<void> _checkDeviceAuth() async {
    final auth = context.read<AuthService>();
    var ok = false;

    try {
      ok = await auth.isDeviceAuthAvailable();
    } catch (e) {
      debugPrint('[MudarSenha] checagem de desbloqueio falhou: $e');
    }
    if (mounted) {
      setState(() {
        _deviceAuthAvailable = ok;

        // Marcado sempre que o aparelho suporta — inclusive pra quem já usa.
        // Desmarcar é um toque, e agora não custa a conta.
        _usarDesbloqueio = ok;
      });
    }
  }

  @override
  void dispose() {
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  /// 🗑️ **AQUI MORAVA `_generateStrongPassword()`**, e com ela o pior bug que
  /// este app já teve.
  ///
  /// O desenho antigo: quem escolhesse o desbloqueio pelo aparelho recebia uma
  /// senha de 32 caracteres sorteada, trocada no servidor e guardada só no
  /// Keystore. A pessoa **nunca via essa senha** — e o cofre era a única cópia
  /// dela no universo.
  ///
  /// Quatro caminhos apagavam esse cofre, e todos deixavam a pessoa trancada
  /// para fora em definitivo, dependendo de reset do administrador:
  ///
  /// 1. `signOut()` — faz `clearSavedCredentials()` **antes** de deslogar. Ou
  ///    seja: o botão `Sair da conta` era um botão de perder a conta.
  /// 2. `_tryAutoLogin` — `catch (_)` que apaga o cofre em **qualquer**
  ///    exceção. Abrir o app sem internet destruía a senha.
  /// 3. `_handleUnlock` — o mesmo `catch (_)`, o mesmo estrago.
  /// 4. limpar dados do app / trocar de aparelho.
  ///
  /// Achado pelo João em 16/08: *"quando muda a senha pelo aparelho, as 32 são
  /// criadas, e depois… se fechar a sessão não consegue mais abrir"*. E a
  /// solução é dele: **senha + biometria, não senha OU biometria.** A senha é a
  /// credencial, sempre conhecida por quem a criou e válida em qualquer
  /// aparelho; o desbloqueio é **conveniência local**, um atalho para não
  /// digitar. Assim o cofre vira cache, e cache pode ser apagado à vontade —
  /// os quatro caminhos acima deixam de ser destrutivos de uma vez só.
  Future<void> _apply(String novaSenha, {required bool comDesbloqueio}) async {
    final api = context.read<ApiService>();
    final auth = context.read<AuthService>();

    await api.changePassword(novaSenha);

    final email = auth.currentUser?.email;
    if (email != null) {
      await auth.signIn(email, novaSenha);
      if (comDesbloqueio) {
        await auth.saveCredentials(email, novaSenha);
      } else {
        // Sem desbloqueio: qualquer credencial guardada antes aponta pra senha
        // velha e faria o login automático falhar em silêncio.
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

  /// Um caminho só: **a senha é obrigatória, o desbloqueio é opcional.**
  ///
  /// ⚠️ A ordem importa. O diálogo do Android vem **antes** de qualquer escrita
  /// no servidor: se a pessoa desistir dele, nada aconteceu e a senha de agora
  /// continua valendo. Perguntar depois de trocar deixaria a conta num estado
  /// que a tela não sabe descrever.
  ///
  /// E o desbloqueio recusado **não cancela a troca de senha** — só desliga o
  /// atalho. A senha é o que importa, e ela já foi digitada e confirmada.
  Future<void> _handleSalvar() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthService>();

    setState(() => _error = null);

    var comDesbloqueio = _usarDesbloqueio;
    if (comDesbloqueio) {
      final ok = await auth.authenticateWithDevice();
      if (!ok) {
        if (!mounted) return;
        setState(() {
          _usarDesbloqueio = false;
          comDesbloqueio = false;
          _error =
              'O desbloqueio não foi confirmado. A senha vai ser salva mesmo '
              'assim — você pode ligar o atalho depois.';
        });
      }
    }

    if (!mounted) return;
    setState(() => _loading = true);
    try {
      await _apply(_passwordCtrl.text, comDesbloqueio: comDesbloqueio);
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
                      ],

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

                      // 🚨 **Uma coluna só, e a senha é obrigatória.** Eram dois
                      // caminhos concorrentes — `USAR O DESBLOQUEIO` e `SALVAR
                      // SENHA` — e escolher o primeiro trocava a senha por 32
                      // caracteres sorteados que a pessoa nunca via. Sair da
                      // conta apagava a única cópia deles. Ver [_apply].
                      const SizedBox(height: 26),
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
                        onSubmitted: (_) => _handleSalvar(),
                      ),

                      // O atalho. Não é uma alternativa à senha — é o que
                      // dispensa digitá-la neste aparelho. A senha continua
                      // sendo a credencial, e é ela que atravessa a troca de
                      // celular.
                      if (_deviceAuthAvailable == true) ...[
                        const SizedBox(height: 26),
                        InkWell(
                          onTap: _loading
                              ? null
                              : () => setState(
                                  () => _usarDesbloqueio = !_usarDesbloqueio,
                                ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(
                                  _usarDesbloqueio
                                      ? Icons.check_box
                                      : Icons.check_box_outline_blank,
                                  size: 19,
                                  color: _usarDesbloqueio
                                      ? SIMEopsColors.greenLight
                                      : SIMEopsColors.faint,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Entrar com o desbloqueio do aparelho',
                                        style: SIMEopsType.body().copyWith(
                                          fontSize: 15,
                                          color: _usarDesbloqueio
                                              ? SIMEopsColors.white
                                              : SIMEopsColors.muted,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'Padrão · PIN · Rosto',
                                        style: SIMEopsType.slug(
                                          color: SIMEopsColors.faint,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _loading ? null : _handleSalvar,
                          child: const Text('SALVAR'),
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

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';

/// Porta de entrada. Sem cadastro público — as contas nascem no painel do
/// administrador, e é isso que dita o texto da tela inteira.
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
  bool _obscurePassword = true;
  String? _error;

  /// Já configurou desbloqueio pelo celular? Se sim, a tela abre pelo botão
  /// de desbloquear e o formulário fica abaixo, como alternativa.
  bool _deviceAuthReady = false;

  @override
  void initState() {
    super.initState();
    _tryAutoLogin();
  }

  Future<void> _tryAutoLogin() async {
    final auth = context.read<AuthService>();
    final hasCredentials = await auth.hasDeviceAuthEnabled();
    if (!hasCredentials) return;
    if (mounted) setState(() => _deviceAuthReady = true);

    setState(() => _loading = true);
    try {
      await auth.signInWithDeviceAuth();
    } catch (_) {
      await auth.clearSavedCredentials();
      if (mounted) {
        setState(() {
          _deviceAuthReady = false;
          _loading = false;
        });
      }
    }
  }

  Future<void> _handleUnlock() async {
    final auth = context.read<AuthService>();
    setState(() => _error = null);

    final ok = await auth.authenticateWithDevice();
    if (!ok) return;

    setState(() => _loading = true);
    try {
      await auth.signInWithDeviceAuth();
    } catch (_) {
      await auth.clearSavedCredentials();
      if (mounted) {
        setState(() {
          _deviceAuthReady = false;
          _error = 'O acesso salvo não vale mais. Entre com e-mail e senha.';
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auth = context.read<AuthService>();
      await auth.signIn(_emailCtrl.text.trim(), _passwordCtrl.text);
      // ⚠️ Aqui existiu o `MANTER CONECTADO NESTE APARELHO` — uma caixa que,
      // marcada, gravava a **senha em texto claro** no cofre do aparelho.
      //
      // Ela prometia o que já acontecia sem ela: quem mantém a sessão é o
      // Supabase, que persiste e renova o token sozinho, marcada ou não. A
      // senha guardada só servia pra re-logar **depois de um logout** — e um
      // único 401 já apagava o cofre. Cobrava o preço todo e entregava quase
      // nada.
      //
      // O `clearSavedCredentials` fica, e é o motivo de este bloco não ter
      // sumido inteiro: é ele que apaga a senha de quem marcou a caixa antes.
      // Sem ele, esse texto claro ficaria no Keystore para sempre, sem
      // nenhum caminho de limpeza.
      //
      // Não confundir com o **desbloqueio pelo celular**: aquele usa as mesmas
      // chaves de propósito, e quem escolheu esse caminho no primeiro acesso
      // tem uma senha de 32 caracteres que nunca viu. Mexer nele tranca gente
      // do lado de fora.
      await auth.clearSavedCredentials();
    } catch (_) {
      setState(() => _error = 'E-mail ou senha incorretos.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// "Esqueci a senha" NÃO dispara e-mail de redefinição automático — ele abre
  /// um chamado para o administrador. Se a tela não disser isso, o usuário
  /// fica olhando a caixa de entrada esperando algo que nunca chega, e o
  /// suporte recebe a ligação de qualquer jeito, só que mais irritada.
  Future<void> _handleForgotPassword() async {
    final ctrl = TextEditingController(text: _emailCtrl.text.trim());

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SIMEopsColors.navyLight,
        shape: const RoundedRectangleBorder(
          side: BorderSide(color: SIMEopsColors.ruleStrong),
        ),
        titlePadding: const EdgeInsets.fromLTRB(22, 22, 22, 0),
        contentPadding: const EdgeInsets.fromLTRB(22, 14, 22, 0),
        title: Text('Solicitar acesso', style: SIMEopsType.dialogTitle()),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // A frase diz o que vai acontecer **quando você tocar em
            // SOLICITAR** — antes ela descrevia o trabalho do administrador
            // ("um administrador libera uma senha") sem dizer que o toque
            // manda um pedido. É a mesma promessa do aviso que aparece depois.
            Text(
              'Confirme o e-mail cadastrado. A solicitação vai para um '
              'administrador e a senha nova chega nesse mesmo e-mail.',
              style: SIMEopsType.lead(),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: ctrl,
              keyboardType: TextInputType.emailAddress,
              style: SIMEopsType.body().copyWith(fontSize: 16),
              decoration: const InputDecoration(
                hintText: 'seu e-mail',
                filled: false,
                enabledBorder: UnderlineInputBorder(
                  borderSide: BorderSide(color: SIMEopsColors.ruleStrong),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('CANCELAR'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('SOLICITAR'),
          ),
        ],
      ),
    );

    final email = ctrl.text.trim();
    ctrl.dispose();
    if (confirmed != true || email.isEmpty || !mounted) return;

    try {
      await context.read<ApiService>().requestPasswordReset(email);
    } catch (_) {
      // Silencioso de propósito: confirmar ou não a existência do e-mail
      // entregaria quem tem conta no sistema pra quem só está testando.
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: SIMEopsColors.navyLight,
        content: Text(
          'A solicitação foi enviada para um administrador. Sua senha deve '
          'chegar no e-mail cadastrado em breve',
          style: SIMEopsType.lead(color: SIMEopsColors.white),
        ),
        duration: const Duration(seconds: 6),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 40),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: MediaQuery.sizeOf(context).height - 90,
            ),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(
                    TextSpan(
                      children: [
                        const TextSpan(text: 'SIME'),
                        TextSpan(
                          text: 'OPS',
                          style: TextStyle(color: SIMEopsColors.greenLight),
                        ),
                      ],
                    ),
                    style: SIMEopsType.wordmark(size: 38),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'MONITORAMENTO DE OCORRÊNCIAS\nNA IMPRENSA · 24 HORAS',
                    style: SIMEopsType.tagline(),
                  ),

                  if (_error != null) ...[
                    const SizedBox(height: 26),
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

                  if (_deviceAuthReady) ...[
                    const SizedBox(height: 34),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _loading ? null : _handleUnlock,
                        child: const Text('DESBLOQUEAR'),
                      ),
                    ),
                    const SizedBox(height: 30),
                    Row(
                      children: [
                        Text(
                          'OU ENTRE COM A SENHA',
                          style: SIMEopsType.dateline(
                            color: SIMEopsColors.faint,
                          ),
                        ),
                        const SizedBox(width: 11),
                        const Expanded(
                          child: Divider(color: SIMEopsColors.rule, height: 1),
                        ),
                      ],
                    ),
                  ],

                  const SizedBox(height: 30),
                  Text('E-MAIL', style: SIMEopsType.fieldLabel()),
                  TextFormField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    style: SIMEopsType.fieldValue(),
                    decoration: _lineField('voce@empresa.com.br'),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'Informe o e-mail'
                        : null,
                  ),
                  const SizedBox(height: 22),
                  Text('SENHA', style: SIMEopsType.fieldLabel()),
                  TextFormField(
                    controller: _passwordCtrl,
                    obscureText: _obscurePassword,
                    style: SIMEopsType.fieldValue(),
                    decoration: _lineField('••••••••').copyWith(
                      suffixIcon: InkWell(
                        onTap: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.only(top: 14),
                          child: Text(
                            _obscurePassword ? 'VER' : 'OCULTAR',
                            style: SIMEopsType.slug(
                              color: SIMEopsColors.tealLight,
                            ),
                          ),
                        ),
                      ),
                      suffixIconConstraints: const BoxConstraints(minWidth: 64),
                    ),
                    validator: (v) =>
                        (v == null || v.isEmpty) ? 'Informe a senha' : null,
                    onFieldSubmitted: (_) => _handleLogin(),
                  ),

                  const SizedBox(height: 26),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _loading ? null : _handleLogin,
                      child: const Text('ENTRAR'),
                    ),
                  ),

                  if (_loading) ...[
                    const SizedBox(height: 24),
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

                  const SizedBox(height: 34),
                  InkWell(
                    onTap: _handleForgotPassword,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Text(
                        'ESQUECEU A SENHA? SOLICITAR ACESSO →',
                        style: SIMEopsType.slug(color: SIMEopsColors.tealLight),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _lineField(String hint) => InputDecoration(
    hintText: hint,
    // `faint`, não `hairline`: o placeholder é instrução de formato
    // ("voce@empresa.com.br"), e a 1.8:1 ele simplesmente não existia.
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
  );
}

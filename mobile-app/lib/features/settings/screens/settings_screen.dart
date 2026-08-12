import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/services/push_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/widgets/masthead.dart';
import 'notificacoes_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _notificationsEnabled = true;

  /// Lida do pacote instalado, não escrita à mão.
  /// Antes era a string '1.1.0' no meio do widget — e já estava errada (o
  /// pubspec dizia 1.1.1). Versão chumbada envelhece calada e depois manda o
  /// suporte investigar o bug errado.
  String _version = '';

  @override
  void initState() {
    super.initState();
    _loadNotificationPref();
    _loadVersion();
  }

  Future<void> _loadVersion() async {
    final info = await PackageInfo.fromPlatform();
    if (mounted) {
      setState(() => _version = '${info.version} (${info.buildNumber})');
    }
  }

  Future<void> _loadNotificationPref() async {
    final enabled = await PushService.areNotificationsEnabled();
    if (mounted) setState(() => _notificationsEnabled = enabled);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return ListView(
      padding: const EdgeInsets.only(bottom: 20),
      children: [
        const Masthead(titulo: 'Configurações'),
        const _SectionHead('CONTA'),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                auth.currentUser?.email ?? 'Modo anônimo',
                style: SIMEopsType.body().copyWith(fontSize: 18),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 6),
              // Sessão ativa é o estado normal — vale como informação, não como
              // celebração. Em verde ela era o elemento mais saturado da tela
              // pra dizer "está tudo como sempre". Verde é da interface, não do
              // conteúdo; quem merece cor aqui é a ausência de login.
              Text(
                auth.isAuthenticated
                    ? 'SESSÃO ATIVA · ACESSO LIBERADO PELO ADMINISTRADOR'
                    : 'SEM LOGIN',
                style: SIMEopsType.slug(
                  color: auth.isAuthenticated
                      ? SIMEopsColors.faint
                      : SIMEopsColors.alert,
                ),
              ),
            ],
          ),
        ),

        const _SectionHead('ALERTAS'),
        // ⚠️ Aqui a linha era o próprio interruptor: uma chave só, tudo ou
        // nada. Virou porta de entrada, porque o que estava faltando não era um
        // botão — era **escolha**: o push ia para todo aparelho, de toda
        // cidade, de todo assunto.
        _SettingRow(
          title: 'Notificações',
          description: _notificationsEnabled
              ? 'Escolha as cidades e os assuntos que avisam este aparelho'
              : 'Desligadas — as ocorrências continuam sendo coletadas',
          value: _notificationsEnabled ? null : 'DESLIGADAS',
          onTap: () async {
            await Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const NotificacoesScreen()),
            );
            _loadNotificationPref();
          },
        ),

        const _SectionHead('APLICATIVO'),
        _SettingRow(title: 'Versão', value: _version.isEmpty ? '—' : _version),
        const _SettingRow(
          title: 'SIMEops',
          description: 'PROGESTÃO · monitoramento de ocorrências na imprensa',
        ),

        if (auth.isAuthenticated) ...[
          const SizedBox(height: 30),
          _SettingRow(
            title: 'Sair da conta',
            titleColor: SIMEopsColors.alert,
            onTap: _confirmLogout,
          ),
        ],

        const SizedBox(height: 40),
      ],
    );
  }

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SIMEopsColors.navyLight,
        shape: const RoundedRectangleBorder(
          side: BorderSide(color: SIMEopsColors.ruleStrong),
        ),
        title: Text('Sair da conta', style: SIMEopsType.dialogTitle()),
        content: Text(
          // O desbloqueio pelo celular é apagado junto — senão o login
          // automático relogava na hora e o usuário não conseguia sair.
          'O acesso salvo neste aparelho é apagado. Para voltar você vai '
          'precisar do e-mail e da senha.',
          style: SIMEopsType.lead(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('CANCELAR'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<AuthService>().signOut();
            },
            child: const Text('SAIR'),
          ),
        ],
      ),
    );
  }
}

class _SectionHead extends StatelessWidget {
  final String label;
  const _SectionHead(this.label);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 28, 18, 0),
    child: Row(
      children: [
        Text(label, style: SIMEopsType.dateline(color: SIMEopsColors.faint)),
        const SizedBox(width: 11),
        const Expanded(child: Divider(color: SIMEopsColors.rule, height: 1)),
      ],
    ),
  );
}

class _SettingRow extends StatelessWidget {
  final String title;
  final String? description;
  final String? value;
  final VoidCallback? onTap;
  final Color? titleColor;

  const _SettingRow({
    required this.title,
    this.description,
    this.value,
    this.onTap,
    this.titleColor,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
        ),
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: SIMEopsType.body().copyWith(color: titleColor),
                  ),
                  if (description != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      description!,
                      style: SIMEopsType.lead(
                        color: SIMEopsColors.faint,
                      ).copyWith(fontSize: 12.5),
                    ),
                  ],
                ],
              ),
            ),
            if (value != null) ...[
              const SizedBox(width: 14),
              Text(value!, style: SIMEopsType.slug()),
            ],
          ],
        ),
      ),
    );
  }
}

// O `_Switch` retangular nasceu aqui e virou `core/widgets/interruptor.dart`
// em 09/08, quando o relatório precisou do mesmo desenho pra ligar a região
// metropolitana.

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/push_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../feed/widgets/take_card.dart';

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

  Future<void> _toggleNotifications(bool value) async {
    final api = context.read<ApiService>();
    setState(() => _notificationsEnabled = value);
    await PushService.setNotificationsEnabled(value);

    try {
      if (value) {
        final token = await FirebaseMessaging.instance.getToken();
        if (token != null) {
          final platform = Platform.isIOS ? 'ios' : 'android';
          await api.registerDevice(token, platform);
        }
      } else {
        await api.unregisterDevice();
      }
    } catch (e) {
      debugPrint('[Settings] Toggle push registration error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return ListView(
      padding: const EdgeInsets.only(bottom: 20),
      children: [
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
              Text(
                auth.isAuthenticated
                    ? 'SESSÃO ATIVA · ACESSO LIBERADO PELO ADMINISTRADOR'
                    : 'SEM LOGIN',
                style: SIMEopsType.slug(
                  color: auth.isAuthenticated
                      ? SIMEopsColors.greenLight
                      : SIMEopsColors.faint,
                ),
              ),
            ],
          ),
        ),

        const _SectionHead('ALERTAS'),
        _SettingRow(
          title: 'Notificações',
          description: _notificationsEnabled
              ? 'Avisa quando uma consulta termina e quando chega ocorrência nova'
              : 'Nenhum aviso — as ocorrências continuam sendo coletadas',
          trailing: _Switch(
            value: _notificationsEnabled,
            onChanged: _toggleNotifications,
          ),
          onTap: () => _toggleNotifications(!_notificationsEnabled),
        ),

        const _SectionHead('APLICATIVO'),
        _SettingRow(
          title: 'Versão',
          value: _version.isEmpty ? '—' : _version,
        ),
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

        const EndMark(),
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
        title: Text('Sair da conta',
            style: SIMEopsType.body().copyWith(fontSize: 21)),
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
            const Expanded(
                child: Divider(color: SIMEopsColors.rule, height: 1)),
          ],
        ),
      );
}

class _SettingRow extends StatelessWidget {
  final String title;
  final String? description;
  final String? value;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? titleColor;

  const _SettingRow({
    required this.title,
    this.description,
    this.value,
    this.trailing,
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
                  Text(title,
                      style: SIMEopsType.body().copyWith(color: titleColor)),
                  if (description != null) ...[
                    const SizedBox(height: 4),
                    Text(description!,
                        style: SIMEopsType.lead(color: SIMEopsColors.faint)
                            .copyWith(fontSize: 12.5)),
                  ],
                ],
              ),
            ),
            if (value != null) ...[
              const SizedBox(width: 14),
              Text(value!, style: SIMEopsType.slug()),
            ],
            if (trailing != null) ...[
              const SizedBox(width: 14),
              trailing!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Interruptor retangular — o `Switch` do Material é a peça mais arredondada
/// que existe e destoava de uma tela feita só de filete.
class _Switch extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;

  const _Switch({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        width: 42,
        height: 23,
        decoration: BoxDecoration(
          color: value
              ? SIMEopsColors.green.withValues(alpha: 0.18)
              : SIMEopsColors.navyLight,
          border: Border.all(
            color: value ? SIMEopsColors.green : SIMEopsColors.ruleStrong,
          ),
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOut,
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 15,
            height: 15,
            margin: const EdgeInsets.symmetric(horizontal: 2),
            color: value ? SIMEopsColors.greenLight : SIMEopsColors.faint,
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/auth_service.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // User info
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor:
                      Theme.of(context).colorScheme.primaryContainer,
                  child: Icon(
                    Icons.person,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        auth.currentUser?.email ?? 'Modo anonimo',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        auth.isAuthenticated ? 'Conectado' : 'Sem login',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: auth.isAuthenticated ? Colors.green : Colors.grey,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),

        // App info
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.info_outline),
                title: const Text('Versao'),
                trailing: const Text('1.0.0'),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.shield_outlined),
                title: const Text('Netrios News'),
                subtitle: const Text('Monitoramento de Ocorrencias'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Logout (so mostra se logado)
        if (auth.isAuthenticated)
          FilledButton.tonal(
            onPressed: () => _confirmLogout(context),
            style: FilledButton.styleFrom(
              foregroundColor: Colors.red,
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.logout),
                SizedBox(width: 8),
                Text('Sair'),
              ],
            ),
          ),
      ],
    );
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sair'),
        content: const Text('Deseja sair da sua conta?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<AuthService>().signOut();
            },
            child: const Text('Sair'),
          ),
        ],
      ),
    );
  }
}

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../main.dart';
import 'api_service.dart';

/// Os dois canais Android. **Têm que bater com os ids do `pushService.ts`** —
/// o backend carimba o canal em cada mensagem e o Android só respeita se o app
/// tiver criado um canal com aquele id.
const canalUrgente = 'simeops_urgente';
const canalRotina = 'simeops_rotina';

class PushService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final ApiService _api;
  static const _storage = FlutterSecureStorage();
  static const _notificationsKey = 'notifications_enabled';

  PushService(this._api);

  /// Verifica se notificações estão habilitadas (default: true)
  static Future<bool> areNotificationsEnabled() async {
    final value = await _storage.read(key: _notificationsKey);
    return value != 'false';
  }

  /// Habilita/desabilita notificações (storage local)
  static Future<void> setNotificationsEnabled(bool enabled) async {
    await _storage.write(
      key: _notificationsKey,
      value: enabled ? 'true' : 'false',
    );
  }

  /// Registra este aparelho no backend.
  ///
  /// Estava escrito à mão dentro do `settings_screen` — pegar o token do FCM,
  /// descobrir a plataforma, chamar a API. Virou peça quando a tela de
  /// Notificações passou a precisar do mesmo gesto: duas cópias de "como este
  /// aparelho se apresenta ao servidor" é como as duas passam a divergir.
  Future<void> registerCurrentDevice() async {
    final token = await _fcm.getToken();
    if (token == null) return;
    await _api.registerDevice(token, Platform.isIOS ? 'ios' : 'android');
  }

  Future<void> init() async {
    // Request permission (iOS + Android 13+)
    await _fcm.requestPermission(alert: true, badge: true, sound: true);

    // Local notifications setup
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings();
    await _localNotifications.initialize(
      settings: const InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      ),
    );

    // ⚠️ Aqui existia UM canal, `crime_news`, com tudo dentro — e com um canal
    // só o Android oferece **um interruptor para tudo**: silenciar o balanço
    // estatístico silenciava também o homicídio no Centro.
    //
    // São dois porque o João decidiu que quem define o som é o Android, não o
    // app: *"o user que vai configurar as notificações no próprio android, se
    // tiver volume alto toca, se tiver vibração vibra"*. Para essa escolha
    // existir, ele precisa de dois canais para separar — e o app decide só o
    // que é urgente.
    //
    // 🚨 Os ids têm que bater com `CANAL_URGENTE`/`CANAL_ROTINA` do
    // `pushService.ts`. Canal que o app não criou faz o Android cair no default
    // **sem erro nenhum** — a separação some em silêncio.
    const urgente = AndroidNotificationChannel(
      canalUrgente,
      'Ocorrências urgentes',
      description: 'Segurança — homicídio, roubo, tráfico e afins',
      importance: Importance.high,
    );
    const rotina = AndroidNotificationChannel(
      canalRotina,
      'Rotina',
      description:
          'Demais assuntos, números e balanços, e o aviso de consulta pronta',
      importance: Importance.defaultImportance,
    );

    final android = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await android?.createNotificationChannel(urgente);
    await android?.createNotificationChannel(rotina);
    // O canal antigo fica órfão na lista de notificações do Android até o app
    // ser reinstalado. Deletar é uma linha e evita três canais na tela do
    // sistema, sendo que um deles não recebe mais nada.
    await android?.deleteNotificationChannel(channelId: 'crime_news');

    // Register device token with backend (só se notificações habilitadas)
    final enabled = await areNotificationsEnabled();
    if (enabled) {
      final token = await _fcm.getToken();
      if (token != null) {
        final platform = Platform.isIOS ? 'ios' : 'android';
        try {
          await _api.registerDevice(token, platform);
        } catch (_) {
          // Will retry on next app open
        }
      }
    }

    // Token refresh
    _fcm.onTokenRefresh.listen((newToken) async {
      final platform = Platform.isIOS ? 'ios' : 'android';
      try {
        await _api.registerDevice(newToken, platform);
      } catch (e) {
        debugPrint('[Push] Token refresh error: $e');
      }
    });

    // Foreground messages → local notification
    FirebaseMessaging.onMessage.listen(_showLocalNotification);

    // Tap na notificação quando app está em background
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Tap na notificação que abriu o app (estava fechado)
    final initialMessage = await _fcm.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }
  }

  void _handleNotificationTap(RemoteMessage message) {
    // Push de busca manual (concluída ou falha) carrega search_id —
    // abre direto o resultado, sem navegar pelo histórico na mão.
    final searchId = message.data['search_id'] as String?;
    if (searchId != null && searchId.isNotEmpty) {
      _navigateToSearch(searchId);
      return;
    }

    final cidade = message.data['cidade'] as String?;
    if (cidade != null && cidade.isNotEmpty) {
      // Import lazily to avoid circular deps
      _navigateToCity(cidade);
    }
  }

  void _navigateToSearch(String searchId) {
    try {
      final nav = navigatorKey.currentState;
      if (nav == null) return;
      nav.pushNamed('/search', arguments: searchId);
    } catch (e) {
      debugPrint('[Push] Navigate to search error: $e');
    }
  }

  void _navigateToCity(String cidade) {
    // Uses global navigatorKey from main.dart
    try {
      final nav = navigatorKey.currentState;
      if (nav == null) return;
      // Lazy import via route — push CityDetailScreen
      nav.pushNamed('/city', arguments: cidade);
    } catch (e) {
      debugPrint('[Push] Navigate to city error: $e');
    }
  }

  void _showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    // Respeitar preferência do usuário
    final enabled = await areNotificationsEnabled();
    if (!enabled) return;

    // Com o app aberto, quem desenha a notificação é o próprio app — e ele
    // precisa repetir o canal que o backend escolheu, senão a mesma notícia
    // toca de um jeito com o app fechado e de outro com ele aberto.
    final canal = notification.android?.channelId ?? canalRotina;
    final urgente = canal == canalUrgente;

    _localNotifications.show(
      id: notification.hashCode,
      title: notification.title,
      body: notification.body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          canal,
          urgente ? 'Ocorrências urgentes' : 'Rotina',
          importance: urgente ? Importance.high : Importance.defaultImportance,
          priority: urgente ? Priority.high : Priority.defaultPriority,
        ),
        iOS: const DarwinNotificationDetails(),
      ),
    );
  }
}

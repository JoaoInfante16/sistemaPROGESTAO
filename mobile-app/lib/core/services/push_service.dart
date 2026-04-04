import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_service.dart';

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

  /// Habilita/desabilita notificações
  static Future<void> setNotificationsEnabled(bool enabled) async {
    await _storage.write(key: _notificationsKey, value: enabled ? 'true' : 'false');
  }

  Future<void> init() async {
    // Request permission (iOS + Android 13+)
    await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Local notifications setup
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    await _localNotifications.initialize(
      settings: const InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      ),
    );

    // Create notification channel (Android)
    const channel = AndroidNotificationChannel(
      'crime_news',
      'SIMEops',
      description: 'Notificações de ocorrências e buscas',
      importance: Importance.high,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

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
      } catch (e) { debugPrint('[Push] Token refresh error: $e'); }
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
    // Por enquanto, apenas abre o app normalmente.
    // O app já navega pro feed/busca conforme o estado do auth.
    // Futuramente: checar message.data['type'] pra navegar direto
    // pro resultado da busca manual.
  }

  void _showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    // Respeitar preferência do usuário
    final enabled = await areNotificationsEnabled();
    if (!enabled) return;

    _localNotifications.show(
      id: notification.hashCode,
      title: notification.title,
      body: notification.body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'crime_news',
          'SIMEops',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }
}

import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api_service.dart';

class PushService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final ApiService _api;

  PushService(this._api);

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
      'Crime News',
      description: 'Notificações de novas notícias de crime',
      importance: Importance.high,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    // Register device token with backend
    final token = await _fcm.getToken();
    if (token != null) {
      final platform = Platform.isIOS ? 'ios' : 'android';
      try {
        await _api.registerDevice(token, platform);
      } catch (_) {
        // Silently fail — will retry on next app open
      }
    }

    // Token refresh
    _fcm.onTokenRefresh.listen((newToken) async {
      final platform = Platform.isIOS ? 'ios' : 'android';
      try {
        await _api.registerDevice(newToken, platform);
      } catch (_) {}
    });

    // Foreground messages → local notification
    FirebaseMessaging.onMessage.listen(_showLocalNotification);
  }

  void _showLocalNotification(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    _localNotifications.show(
      id: notification.hashCode,
      title: notification.title,
      body: notification.body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'crime_news',
          'Crime News',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }
}

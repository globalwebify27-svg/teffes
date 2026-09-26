import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../network/api_client.dart';
import '../../screens/orders/order_tracking_screen.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('[FCM Background] Received message: ${message.messageId}, data: ${message.data}');
}

class FcmService {
  static final FcmService instance = FcmService._internal();
  factory FcmService() => instance;
  FcmService._internal();

  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  final ApiClient _api = ApiClient();

  GlobalKey<NavigatorState>? _navigatorKey;
  String? _currentToken;
  bool _isInitialized = false;

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'teffes_customer_channel',
    "TeFFe's Order Alerts",
    description: 'Real-time order confirmation, butchery prep, and delivery notifications',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
  );

  Future<void> initialize(GlobalKey<NavigatorState> navigatorKey) async {
    if (_isInitialized) return;
    _navigatorKey = navigatorKey;

    try {
      // 1. Initialize Firebase Core
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // 2. Request notification permissions (Android 13+ & iOS)
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      debugPrint('[FCM] Notification authorization status: ${settings.authorizationStatus}');

      // 3. Set up Local Notifications for foreground heads-up banners
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosInit = DarwinInitializationSettings();
      const initSettings = InitializationSettings(android: androidInit, iOS: iosInit);

      await _localNotifications.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (response) {
          if (response.payload != null && response.payload!.isNotEmpty) {
            try {
              final Map<String, dynamic> data = jsonDecode(response.payload!);
              _handlePayloadNavigation(data);
            } catch (e) {
              debugPrint('[FCM] Error parsing payload: $e');
            }
          }
        },
      );

      // Create Android Notification Channel
      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_channel);

      // Set presentation options for foreground messages on iOS
      await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      // 4. Retrieve initial token & register with backend
      _currentToken = await FirebaseMessaging.instance.getToken();
      debugPrint('[FCM] Device Token: $_currentToken');
      if (_currentToken != null) {
        await _registerTokenWithBackend(_currentToken!);
      }

      // 5. Listen to token refresh
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        _currentToken = newToken;
        debugPrint('[FCM] Token refreshed: $newToken');
        _registerTokenWithBackend(newToken);
      });

      // 6. Listen to foreground messages
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('[FCM Foreground] Title: ${message.notification?.title}, Body: ${message.notification?.body}');
        _showForegroundNotification(message);
      });

      // 7. Handle notification click when app is in background but open
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('[FCM onMessageOpenedApp] Tapped: ${message.data}');
        _handlePayloadNavigation(message.data);
      });

      // 8. Handle cold start from terminated state
      final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
      if (initialMessage != null) {
        debugPrint('[FCM getInitialMessage] Cold start tapped: ${initialMessage.data}');
        Future.delayed(const Duration(milliseconds: 600), () {
          _handlePayloadNavigation(initialMessage.data);
        });
      }

      _isInitialized = true;
    } catch (e) {
      debugPrint('[FCM] Initialization error: $e');
    }
  }

  /// Display a local notification banner when notification arrives while app is in foreground
  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    final title = notification?.title ?? message.data['title'] ?? "TeFFe's Fresh Alert";
    final body = notification?.body ?? message.data['body'] ?? '';

    final androidDetails = AndroidNotificationDetails(
      _channel.id,
      _channel.name,
      channelDescription: _channel.description,
      importance: Importance.max,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
      color: const Color(0xFF941717),
      playSound: true,
      enableVibration: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      message.hashCode,
      title,
      body,
      notificationDetails,
      payload: jsonEncode(message.data),
    );
  }

  /// Register current token with backend
  Future<void> _registerTokenWithBackend(String token) async {
    try {
      await _api.post(
        '/notifications/register-token',
        data: {
          'fcmToken': token,
          'deviceType': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
          'appType': 'customer',
          'deviceInfo': {
            'platform': defaultTargetPlatform.name,
            'isWeb': kIsWeb,
          },
        },
      );
      debugPrint('[FCM] Registered token with backend successfully');
    } catch (e) {
      debugPrint('[FCM] Backend token registration error: $e');
    }
  }

  /// Sync token upon customer login
  Future<void> syncUserSession() async {
    if (_currentToken != null) {
      await _registerTokenWithBackend(_currentToken!);
    } else {
      _currentToken = await FirebaseMessaging.instance.getToken();
      if (_currentToken != null) {
        await _registerTokenWithBackend(_currentToken!);
      }
    }
  }

  /// Unregister token on customer logout (deactivates this device token only)
  Future<void> unregisterOnLogout() async {
    if (_currentToken != null) {
      try {
        await _api.post(
          '/notifications/unregister-token',
          data: {'fcmToken': _currentToken},
        );
        debugPrint('[FCM] Unregistered device token on logout');
      } catch (e) {
        debugPrint('[FCM] Error unregistering token: $e');
      }
    }
  }

  /// Navigate to target screen based on payload
  void _handlePayloadNavigation(Map<String, dynamic> data) {
    if (_navigatorKey == null || _navigatorKey!.currentState == null) return;

    final orderId = data['orderId'] ?? data['entityId'];
    if (orderId != null && orderId.toString().isNotEmpty) {
      _navigatorKey!.currentState!.push(
        MaterialPageRoute(
          builder: (_) => OrderTrackingScreen(orderId: orderId.toString()),
        ),
      );
    }
  }
}

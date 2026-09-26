import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../network/api_client.dart';
import '../../screens/main_shell_screen.dart';

@pragma('vm:entry-point')
Future<void> _riderFirebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('[Rider FCM Background] Message: ${message.messageId}, data: ${message.data}');
}

class RiderFcmService {
  static final RiderFcmService instance = RiderFcmService._internal();
  factory RiderFcmService() => instance;
  RiderFcmService._internal();

  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  final ApiClient _api = ApiClient();

  GlobalKey<NavigatorState>? _navigatorKey;
  String? _currentToken;
  bool _isInitialized = false;

  static const AndroidNotificationChannel _riderAlertChannel = AndroidNotificationChannel(
    'teffes_rider_alerts',
    'Rider Delivery Alerts',
    description: 'Urgent push alerts for incoming order assignments and pickups',
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
      FirebaseMessaging.onBackgroundMessage(_riderFirebaseMessagingBackgroundHandler);

      // 2. Request notification permissions
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        announcement: true,
        badge: true,
        sound: true,
      );

      debugPrint('[Rider FCM] Permission status: ${settings.authorizationStatus}');

      // 3. Local notification plugin for heads-up alert sound and banner
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosInit = DarwinInitializationSettings();
      const initSettings = InitializationSettings(android: androidInit, iOS: iosInit);

      await _localNotifications.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (response) {
          if (response.payload != null && response.payload!.isNotEmpty) {
            try {
              final Map<String, dynamic> data = jsonDecode(response.payload!);
              _handleRiderNotificationTap(data);
            } catch (e) {
              debugPrint('[Rider FCM] Payload parse error: $e');
            }
          }
        },
      );

      // Register Android high-priority channel
      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_riderAlertChannel);

      await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      // 4. Retrieve token & register with backend as rider
      _currentToken = await FirebaseMessaging.instance.getToken();
      debugPrint('[Rider FCM] Token: $_currentToken');
      if (_currentToken != null) {
        await _registerRiderToken(_currentToken!);
      }

      // 5. Listen to token refresh
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        _currentToken = newToken;
        _registerRiderToken(newToken);
      });

      // 6. Foreground message listener
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('[Rider FCM Foreground] ${message.notification?.title}: ${message.notification?.body}');
        _showRiderAlert(message);
      });

      // 7. Background tap listener
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('[Rider FCM Tapped] ${message.data}');
        _handleRiderNotificationTap(message.data);
      });

      // 8. Cold start tap listener
      final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
      if (initialMessage != null) {
        Future.delayed(const Duration(milliseconds: 600), () {
          _handleRiderNotificationTap(initialMessage.data);
        });
      }

      _isInitialized = true;
    } catch (e) {
      debugPrint('[Rider FCM] Initialization error: $e');
    }
  }

  /// Display high priority notification alert with sound
  Future<void> _showRiderAlert(RemoteMessage message) async {
    final notification = message.notification;
    final title = notification?.title ?? message.data['title'] ?? 'New Delivery Assignment! 🛵';
    final body = notification?.body ?? message.data['body'] ?? 'You have a new delivery task assigned';

    final androidDetails = AndroidNotificationDetails(
      _riderAlertChannel.id,
      _riderAlertChannel.name,
      channelDescription: _riderAlertChannel.description,
      importance: Importance.max,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
      color: const Color(0xFF941717),
      playSound: true,
      enableVibration: true,
      fullScreenIntent: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    await _localNotifications.show(
      message.hashCode,
      title,
      body,
      NotificationDetails(android: androidDetails, iOS: iosDetails),
      payload: jsonEncode(message.data),
    );
  }

  /// Register rider token with backend
  Future<void> _registerRiderToken(String token) async {
    try {
      await _api.post(
        '/notifications/register-token',
        data: {
          'fcmToken': token,
          'deviceType': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
          'appType': 'rider',
          'deviceInfo': {
            'platform': defaultTargetPlatform.name,
            'isRider': true,
          },
        },
      );
      debugPrint('[Rider FCM] Registered token with backend as rider');
    } catch (e) {
      debugPrint('[Rider FCM] Error registering token: $e');
    }
  }

  /// Sync token on rider login
  Future<void> syncUserSession() async {
    if (_currentToken != null) {
      await _registerRiderToken(_currentToken!);
    } else {
      _currentToken = await FirebaseMessaging.instance.getToken();
      if (_currentToken != null) {
        await _registerRiderToken(_currentToken!);
      }
    }
  }

  /// Unregister token on rider logout
  Future<void> unregisterOnLogout() async {
    if (_currentToken != null) {
      try {
        await _api.post(
          '/notifications/unregister-token',
          data: {'fcmToken': _currentToken},
        );
        debugPrint('[Rider FCM] Unregistered rider token on logout');
      } catch (e) {
        debugPrint('[Rider FCM] Error unregistering rider token: $e');
      }
    }
  }

  /// Deep-link to assigned order when tapped
  void _handleRiderNotificationTap(Map<String, dynamic> data) {
    if (_navigatorKey == null || _navigatorKey!.currentState == null) return;

    // Navigate to MainShellScreen where active delivery order card is displayed & refreshed
    _navigatorKey!.currentState!.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const MainShellScreen()),
      (route) => false,
    );
  }
}

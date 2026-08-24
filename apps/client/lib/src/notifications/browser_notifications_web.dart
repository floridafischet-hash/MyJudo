// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:html' as html;
import 'browser_notification_permission.dart';

BrowserNotificationPermission get browserNotificationPermission =>
    _fromBrowser(html.Notification.permission);
Future<BrowserNotificationPermission>
requestBrowserNotificationPermission() async =>
    _fromBrowser(await html.Notification.requestPermission());
void showBrowserNotification({required String title, String? body}) {
  if (browserNotificationPermission == BrowserNotificationPermission.granted) {
    html.Notification(title, body: body, icon: 'icons/Icon-192.png');
  }
}

BrowserNotificationPermission _fromBrowser(String? value) => switch (value) {
  'granted' => BrowserNotificationPermission.granted,
  'denied' => BrowserNotificationPermission.denied,
  _ => BrowserNotificationPermission.prompt,
};

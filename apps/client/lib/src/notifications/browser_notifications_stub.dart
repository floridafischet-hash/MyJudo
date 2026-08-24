import 'browser_notification_permission.dart';

BrowserNotificationPermission get browserNotificationPermission =>
    BrowserNotificationPermission.unsupported;
Future<BrowserNotificationPermission>
requestBrowserNotificationPermission() async =>
    BrowserNotificationPermission.unsupported;
void showBrowserNotification({required String title, String? body}) {}

import 'browser_notifications_stub.dart'
    if (dart.library.html) 'browser_notifications_web.dart'
    as platform;
export 'browser_notification_permission.dart';
import 'browser_notification_permission.dart';

BrowserNotificationPermission get browserNotificationPermission =>
    platform.browserNotificationPermission;
Future<BrowserNotificationPermission> requestBrowserNotificationPermission() =>
    platform.requestBrowserNotificationPermission();
void showBrowserNotification({required String title, String? body}) =>
    platform.showBrowserNotification(title: title, body: body);

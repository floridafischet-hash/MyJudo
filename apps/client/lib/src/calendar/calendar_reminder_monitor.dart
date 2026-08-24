import 'dart:async';
import 'package:flutter/widgets.dart';
import '../notifications/browser_notifications.dart';
import '../notifications/notification_repository.dart';
import 'calendar_repository.dart';

class CalendarReminderMonitor extends StatefulWidget {
  const CalendarReminderMonitor({super.key, required this.token});
  final String token;
  @override
  State<CalendarReminderMonitor> createState() =>
      _CalendarReminderMonitorState();
}

class _CalendarReminderMonitorState extends State<CalendarReminderMonitor> {
  late final CalendarRepository calendar = CalendarRepository(
    token: widget.token,
  );
  late final NotificationRepository notifications = NotificationRepository(
    accessToken: widget.token,
  );
  final shown = <String>{};
  Timer? timer;
  @override
  void initState() {
    super.initState();
    _poll();
    timer = Timer.periodic(const Duration(minutes: 1), (_) => _poll());
  }

  @override
  void dispose() {
    timer?.cancel();
    notifications.dispose();
    super.dispose();
  }

  Future<void> _poll() async {
    try {
      final settings = await notifications.getSettings();
      if (!settings.enabled) return;
      final now = DateTime.now(),
          events = await calendar.list(
            now.subtract(const Duration(minutes: 1)),
            now.add(const Duration(days: 1)),
          );
      for (final event in events) {
        final minutes = event.reminderMinutes;
        if (minutes == null || shown.contains(event.id)) continue;
        final due = event.startsAt.subtract(Duration(minutes: minutes));
        if (!due.isAfter(now) &&
            now.difference(due) < const Duration(minutes: 2)) {
          shown.add(event.id);
          showBrowserNotification(
            title: event.title,
            body:
                'Beginnt um ${event.startsAt.hour.toString().padLeft(2, '0')}:${event.startsAt.minute.toString().padLeft(2, '0')}${event.location == null ? '' : ' · ${event.location}'}',
          );
        }
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

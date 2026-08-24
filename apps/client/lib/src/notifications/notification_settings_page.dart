import 'package:flutter/material.dart';
import 'browser_notifications.dart';
import 'notification_repository.dart';

class NotificationSettingsPage extends StatefulWidget {
  const NotificationSettingsPage({required this.accessToken, super.key});
  final String accessToken;
  @override
  State<NotificationSettingsPage> createState() =>
      _NotificationSettingsPageState();
}

class _NotificationSettingsPageState extends State<NotificationSettingsPage> {
  late final NotificationRepository _repository = NotificationRepository(
    accessToken: widget.accessToken,
  );
  NotificationSettings? _settings;
  String? _error;
  bool _saving = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _repository.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final value = await _repository.getSettings();
      if (mounted) {
        setState(() => _settings = value);
      }
    } on Object {
      if (mounted) {
        setState(
          () => _error = 'Die Einstellungen konnten nicht geladen werden.',
        );
      }
    }
  }

  Future<void> _setEnabled(bool enabled) async {
    final current = _settings;
    if (current == null || _saving) return;
    if (enabled) {
      final permission = await requestBrowserNotificationPermission();
      if (!mounted) return;
      if (permission != BrowserNotificationPermission.granted) {
        setState(
          () => _error = permission == BrowserNotificationPermission.unsupported
              ? 'Dieser Browser unterstützt keine Benachrichtigungen.'
              : 'Die Browser-Berechtigung wurde nicht erteilt. Du kannst sie in den Website-Einstellungen ändern.',
        );
        return;
      }
    }
    await _save(current.copyWith(enabled: enabled));
  }

  Future<void> _save(NotificationSettings value) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final saved = await _repository.updateSettings(value);
      if (mounted) {
        setState(() => _settings = saved);
      }
    } on Object {
      if (mounted) {
        setState(
          () => _error = 'Die Einstellungen konnten nicht gespeichert werden.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = _settings;
    if (settings == null && _error == null) {
      return const Center(child: CircularProgressIndicator());
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Benachrichtigungen',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            const Text(
              'MyJudo fragt erst nach deiner ausdrücklichen Aktivierung nach der Browser-Berechtigung.',
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            if (settings != null) ...[
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Browser-Benachrichtigungen aktivieren'),
                value: settings.enabled,
                onChanged: _saving ? null : _setEnabled,
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Neue Chatnachrichten'),
                value: settings.chatMessages,
                onChanged: !settings.enabled || _saving
                    ? null
                    : (v) => _save(settings.copyWith(chatMessages: v)),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Nachrichtenvorschau anzeigen'),
                subtitle: const Text(
                  'Aus Datenschutzgründen standardmäßig deaktiviert.',
                ),
                value: settings.showMessagePreview,
                onChanged: !settings.enabled || _saving
                    ? null
                    : (v) => _save(settings.copyWith(showMessagePreview: v)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

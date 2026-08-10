import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../config/app_config.dart';

class PendingUser {
  const PendingUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
  });
  final String id;
  final String email;
  final String firstName;
  final String lastName;

  factory PendingUser.fromJson(Map<String, dynamic> json) => PendingUser(
    id: json['id'] as String,
    email: json['email'] as String,
    firstName: json['firstName'] as String,
    lastName: json['lastName'] as String,
  );
}

class PendingUsersPage extends StatefulWidget {
  const PendingUsersPage({required this.accessToken, super.key});
  final String accessToken;

  @override
  State<PendingUsersPage> createState() => _PendingUsersPageState();
}

class _PendingUsersPageState extends State<PendingUsersPage> {
  late final Dio _dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      connectTimeout: const Duration(seconds: 10),
    ),
  );
  late Future<List<PendingUser>> _users = _load();
  String? _busyUserId;

  Future<List<PendingUser>> _load() async {
    final response = await _dio.get<List<dynamic>>(
      '/users',
      queryParameters: {'status': 'pending'},
    );
    return (response.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(PendingUser.fromJson)
        .toList();
  }

  Future<void> _approve(PendingUser user) async {
    setState(() => _busyUserId = user.id);
    try {
      await _dio.patch<void>('/users/${user.id}/approve');
      if (mounted) setState(() => _users = _load());
    } on DioException {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Die Freigabe konnte nicht gespeichert werden.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busyUserId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<PendingUser>>(
      future: _users,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(
            child: FilledButton.tonal(
              onPressed: () => setState(() => _users = _load()),
              child: const Text(
                'Benutzer konnten nicht geladen werden – erneut versuchen',
              ),
            ),
          );
        }
        final users = snapshot.data ?? const [];
        if (users.isEmpty) {
          return const Center(
            child: Text('Keine ausstehenden Registrierungen.'),
          );
        }
        return ListView.separated(
          itemCount: users.length,
          separatorBuilder: (_, _) => const Divider(height: 1),
          itemBuilder: (context, index) {
            final user = users[index];
            return ListTile(
              title: Text('${user.firstName} ${user.lastName}'),
              subtitle: Text(user.email),
              trailing: FilledButton(
                onPressed: _busyUserId == null ? () => _approve(user) : null,
                child: _busyUserId == user.id
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Freigeben'),
              ),
            );
          },
        );
      },
    );
  }
}

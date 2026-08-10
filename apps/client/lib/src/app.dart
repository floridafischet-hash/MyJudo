import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth/auth_controller.dart';
import 'auth/login_page.dart';
import 'dashboard/dashboard_page.dart';

class MyJudoApp extends ConsumerWidget {
  const MyJudoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    return MaterialApp(
      title: 'MyJudo',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF173C5E),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
        ),
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF80B8E8),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: auth.when(
        data: (session) =>
            session == null ? const LoginPage() : const DashboardPage(),
        loading: () =>
            const Scaffold(body: Center(child: CircularProgressIndicator())),
        error: (error, _) => LoginPage(initialError: error.toString()),
      ),
    );
  }
}

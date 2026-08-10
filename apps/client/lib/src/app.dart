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
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF9E2A2B),
          onPrimary: Colors.white,
          secondary: Color(0xFFB88A44),
          onSecondary: Color(0xFF251B12),
          surface: Color(0xFFFFFCF7),
          onSurface: Color(0xFF25221E),
          surfaceContainerHighest: Color(0xFFF1EAE0),
          outline: Color(0xFFD8CDC0),
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF7F3ED),
        cardTheme: const CardThemeData(
          elevation: 0,
          color: Color(0xFFFFFCF7),
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(20)),
            side: BorderSide(color: Color(0xFFE5DDD2)),
          ),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFF7F3ED),
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),
        inputDecorationTheme: const InputDecorationTheme(
          filled: true,
          fillColor: Color(0xFFFFFCF7),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(14)),
          ),
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

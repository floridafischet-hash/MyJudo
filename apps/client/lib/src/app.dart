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
          primary: Color(0xFF0B4F8A),
          onPrimary: Colors.white,
          secondary: Color(0xFF52A9D8),
          onSecondary: Color(0xFF061D30),
          surface: Colors.white,
          onSurface: Color(0xFF0A2235),
          surfaceContainerHighest: Color(0xFFE8F4FC),
          outline: Color(0xFFBDD4E5),
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF4F8FB),
        fontFamily: 'Roboto',
        textTheme: const TextTheme(
          headlineLarge: TextStyle(
            color: Color(0xFF071F33),
            fontWeight: FontWeight.w900,
          ),
          headlineMedium: TextStyle(
            color: Color(0xFF071F33),
            fontWeight: FontWeight.w800,
          ),
          titleLarge: TextStyle(
            color: Color(0xFF0A2A42),
            fontWeight: FontWeight.w800,
          ),
          bodyLarge: TextStyle(color: Color(0xFF29475D), height: 1.45),
          bodyMedium: TextStyle(color: Color(0xFF466175), height: 1.4),
        ),
        cardTheme: const CardThemeData(
          elevation: 0,
          color: Colors.white,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(18)),
            side: BorderSide(color: Color(0xFFD7E5EF)),
          ),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFF4F8FB),
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),
        inputDecorationTheme: const InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: EdgeInsets.symmetric(horizontal: 17, vertical: 17),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(14)),
            borderSide: BorderSide(color: Color(0xFFC5D8E5)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(14)),
            borderSide: BorderSide(color: Color(0xFFC5D8E5)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(14)),
            borderSide: BorderSide(color: Color(0xFF075A9C), width: 2),
          ),
          labelStyle: TextStyle(color: Color(0xFF263238)),
          floatingLabelStyle: TextStyle(color: Color(0xFF075A9C)),
          hintStyle: TextStyle(color: Color(0xFF607D8B)),
          prefixIconColor: Color(0xFF455A64),
          suffixIconColor: Color(0xFF455A64),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF075A9C),
            foregroundColor: Colors.white,
            minimumSize: const Size(0, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(13),
            ),
            textStyle: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        chipTheme: ChipThemeData(
          backgroundColor: const Color(0xFFE8F4FC),
          side: BorderSide.none,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          labelStyle: const TextStyle(
            color: Color(0xFF075A9C),
            fontWeight: FontWeight.w700,
          ),
        ),
        dividerColor: const Color(0xFFD9E7F0),
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

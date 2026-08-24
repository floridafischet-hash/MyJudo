import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_controller.dart';

const _navy = Color(0xFF071F33);
const _blue = Color(0xFF075A9C);
const _cyan = Color(0xFF54B6E8);

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key, this.initialError});
  final String? initialError;
  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final error = auth.hasError ? auth.error.toString() : widget.initialError;
    return Scaffold(
      backgroundColor: const Color(0xFFF2F7FB),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 880;
          return Row(
            children: [
              if (wide) Expanded(flex: 11, child: const _BrandPanel()),
              Expanded(
                flex: wide ? 9 : 1,
                child: SafeArea(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.symmetric(
                        horizontal: wide ? 56 : 24,
                        vertical: 32,
                      ),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 440),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (!wide) ...[
                              const _CompactBrand(),
                              const SizedBox(height: 44),
                            ],
                            Text(
                              'Willkommen zurück',
                              style: Theme.of(context).textTheme.headlineMedium
                                  ?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: _navy,
                                  ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              'Melde dich an und plane deine nächsten Trainings.',
                              style: Theme.of(context).textTheme.bodyLarge
                                  ?.copyWith(color: const Color(0xFF60788B)),
                            ),
                            const SizedBox(height: 34),
                            Form(
                              key: _formKey,
                              child: Column(
                                children: [
                                  TextFormField(
                                    controller: _username,
                                    style: const TextStyle(color: Colors.black),
                                    cursorColor: Colors.black,
                                    decoration: const InputDecoration(
                                      labelText: 'Benutzername',
                                      prefixIcon: Icon(
                                        Icons.person_outline_rounded,
                                      ),
                                    ),
                                    autofillHints: const [
                                      AutofillHints.username,
                                    ],
                                    textInputAction: TextInputAction.next,
                                    validator: _required,
                                  ),
                                  const SizedBox(height: 16),
                                  TextFormField(
                                    controller: _password,
                                    style: const TextStyle(color: Colors.black),
                                    cursorColor: Colors.black,
                                    obscureText: _obscurePassword,
                                    decoration: InputDecoration(
                                      labelText: 'Passwort',
                                      prefixIcon: const Icon(
                                        Icons.lock_outline_rounded,
                                      ),
                                      suffixIcon: IconButton(
                                        onPressed: () => setState(
                                          () => _obscurePassword =
                                              !_obscurePassword,
                                        ),
                                        icon: Icon(
                                          _obscurePassword
                                              ? Icons.visibility_outlined
                                              : Icons.visibility_off_outlined,
                                        ),
                                      ),
                                    ),
                                    autofillHints: const [
                                      AutofillHints.password,
                                    ],
                                    onFieldSubmitted: (_) => _submit(),
                                    validator: _required,
                                  ),
                                ],
                              ),
                            ),
                            if (error != null) ...[
                              const SizedBox(height: 16),
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFECEC),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.error_outline,
                                      color: Color(0xFFB42318),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        error,
                                        style: const TextStyle(
                                          color: Color(0xFF8A1C14),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            const SizedBox(height: 26),
                            FilledButton.icon(
                              onPressed: auth.isLoading ? null : _submit,
                              icon: auth.isLoading
                                  ? const SizedBox.square(
                                      dimension: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.arrow_forward_rounded),
                              label: const Padding(
                                padding: EdgeInsets.symmetric(vertical: 14),
                                child: Text('Anmelden'),
                              ),
                            ),
                            const SizedBox(height: 24),
                            const Text(
                              'Kodokan Osterholz e.V. · Sicherer Mitgliederbereich',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Color(0xFF71889A),
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'Pflichtfeld' : null;
  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    ref
        .read(authControllerProvider.notifier)
        .login(username: _username.text.trim(), password: _password.text);
  }
}

class _BrandPanel extends StatelessWidget {
  const _BrandPanel();
  @override
  Widget build(BuildContext context) => Container(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [_navy, Color(0xFF063F6A), _blue],
      ),
    ),
    child: Stack(
      children: [
        const Positioned(
          right: -90,
          top: -70,
          child: _DecorativeCircle(size: 330, color: Color(0x1854B6E8)),
        ),
        const Positioned(
          left: -110,
          bottom: -130,
          child: _DecorativeCircle(size: 390, color: Color(0x12000000)),
        ),
        Padding(
          padding: const EdgeInsets.all(64),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _LogoMark(light: true),
              const Spacer(),
              Container(
                width: 52,
                height: 5,
                decoration: BoxDecoration(
                  color: _cyan,
                  borderRadius: BorderRadius.circular(5),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Gemeinsam auf\nder Matte.',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  height: 1.06,
                ),
              ),
              const SizedBox(height: 20),
              const SizedBox(
                width: 480,
                child: Text(
                  'Trainingszeiten, Gruppen und Anwesenheiten – einfach organisiert für unsere Judo-Familie.',
                  style: TextStyle(
                    color: Color(0xFFD5E9F6),
                    fontSize: 19,
                    height: 1.5,
                  ),
                ),
              ),
              const Spacer(),
              const Row(
                children: [
                  Icon(Icons.shield_outlined, color: _cyan),
                  SizedBox(width: 10),
                  Text(
                    'Geschützt. Übersichtlich. Vereinsnah.',
                    style: TextStyle(color: Colors.white70),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _CompactBrand extends StatelessWidget {
  const _CompactBrand();
  @override
  Widget build(BuildContext context) =>
      const Align(alignment: Alignment.centerLeft, child: _LogoMark());
}

class _LogoMark extends StatelessWidget {
  const _LogoMark({this.light = false});
  final bool light;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 168,
        height: 168,
        padding: const EdgeInsets.all(21),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(51),
          boxShadow: const [
            BoxShadow(color: Color(0x22000000), blurRadius: 18),
          ],
        ),
        child: Image.asset(
          'assets/kodokan_osterholz_display.png',
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
          isAntiAlias: true,
          errorBuilder: (_, _, _) =>
              const Icon(Icons.sports_martial_arts, color: _blue),
        ),
      ),
      const SizedBox(width: 45),
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'KODOKAN',
            style: TextStyle(
              color: light ? Colors.white : _navy,
              fontSize: 63,
              fontWeight: FontWeight.w900,
              letterSpacing: 3.9,
            ),
          ),
          Text(
            'OSTERHOLZ',
            style: TextStyle(
              color: light ? _cyan : _blue,
              fontSize: 36,
              fontWeight: FontWeight.w800,
              letterSpacing: 6.3,
            ),
          ),
        ],
      ),
    ],
  );
}

class _DecorativeCircle extends StatelessWidget {
  const _DecorativeCircle({required this.size, required this.color});
  final double size;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(shape: BoxShape.circle, color: color),
  );
}

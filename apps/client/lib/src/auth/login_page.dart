import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_controller.dart';

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
      body: Stack(
        children: [
          Positioned(
            right: -90,
            top: -100,
            child: _Sun(
              color: Theme.of(
                context,
              ).colorScheme.primary.withValues(alpha: 0.10),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'MyJudo',
                              style: Theme.of(context).textTheme.headlineMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Willkommen zurück',
                              style: Theme.of(context).textTheme.bodyLarge,
                            ),
                            const SizedBox(height: 28),
                            TextFormField(
                              controller: _username,
                              decoration: const InputDecoration(
                                labelText: 'Benutzername',
                                prefixIcon: Icon(Icons.person_outline),
                              ),
                              autofillHints: const [AutofillHints.username],
                              textInputAction: TextInputAction.next,
                              validator: _required,
                            ),
                            const SizedBox(height: 16),
                            TextFormField(
                              controller: _password,
                              decoration: const InputDecoration(
                                labelText: 'Passwort',
                                prefixIcon: Icon(Icons.lock_outline),
                              ),
                              obscureText: true,
                              autofillHints: const [AutofillHints.password],
                              onFieldSubmitted: (_) => _submit(),
                              validator: _required,
                            ),
                            if (error != null) ...[
                              const SizedBox(height: 16),
                              Semantics(
                                liveRegion: true,
                                child: Text(
                                  error,
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.error,
                                  ),
                                ),
                              ),
                            ],
                            const SizedBox(height: 24),
                            FilledButton.icon(
                              onPressed: auth.isLoading ? null : _submit,
                              icon: auth.isLoading
                                  ? const SizedBox.square(
                                      dimension: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.login),
                              label: const Padding(
                                padding: EdgeInsets.symmetric(vertical: 13),
                                child: Text('Anmelden'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
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

class _Sun extends StatelessWidget {
  const _Sun({required this.color});
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    width: 280,
    height: 280,
    decoration: BoxDecoration(shape: BoxShape.circle, color: color),
  );
}

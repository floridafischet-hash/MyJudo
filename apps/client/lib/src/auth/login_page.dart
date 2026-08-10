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
  final _organization = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _organization.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final error = auth.hasError ? auth.error.toString() : widget.initialError;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'MyJudo',
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Sicher bei deinem Verein anmelden',
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                        const SizedBox(height: 28),
                        TextFormField(
                          controller: _organization,
                          decoration: const InputDecoration(
                            labelText: 'Vereinskennung',
                          ),
                          textInputAction: TextInputAction.next,
                          validator: _required,
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _email,
                          decoration: const InputDecoration(
                            labelText: 'E-Mail-Adresse',
                          ),
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.username],
                          textInputAction: TextInputAction.next,
                          validator: _required,
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _password,
                          decoration: const InputDecoration(
                            labelText: 'Passwort',
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
                        FilledButton(
                          onPressed: auth.isLoading ? null : _submit,
                          child: auth.isLoading
                              ? const SizedBox.square(
                                  dimension: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Anmelden'),
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
    );
  }

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'Pflichtfeld' : null;

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    ref
        .read(authControllerProvider.notifier)
        .login(
          organizationSlug: _organization.text.trim(),
          email: _email.text.trim(),
          password: _password.text,
        );
  }
}

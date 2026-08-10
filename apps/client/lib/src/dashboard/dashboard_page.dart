import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  int _selectedIndex = 0;

  static const destinations = [
    NavigationDestination(
      icon: Icon(Icons.home_outlined),
      selectedIcon: Icon(Icons.home),
      label: 'Home',
    ),
    NavigationDestination(
      icon: Icon(Icons.calendar_month_outlined),
      label: 'Kalender & Training',
    ),
    NavigationDestination(
      icon: Icon(Icons.forum_outlined),
      label: 'Kommunikation',
    ),
    NavigationDestination(
      icon: Icon(Icons.groups_outlined),
      label: 'Mitglieder & Prüfungen',
    ),
    NavigationDestination(
      icon: Icon(Icons.settings_outlined),
      label: 'Einstellungen',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final desktop = constraints.maxWidth >= 900;
        final content = _Content(index: _selectedIndex);
        if (!desktop) {
          return Scaffold(
            appBar: AppBar(title: const Text('MyJudo')),
            body: content,
            bottomNavigationBar: NavigationBar(
              selectedIndex: _selectedIndex,
              onDestinationSelected: (index) =>
                  setState(() => _selectedIndex = index),
              destinations: destinations,
            ),
          );
        }
        return Scaffold(
          body: Row(
            children: [
              NavigationRail(
                extended: constraints.maxWidth >= 1200,
                selectedIndex: _selectedIndex,
                onDestinationSelected: (index) =>
                    setState(() => _selectedIndex = index),
                leading: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text(
                    'MyJudo',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 22),
                  ),
                ),
                trailing: Expanded(
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: IconButton(
                      tooltip: 'Abmelden',
                      onPressed: () =>
                          ref.read(authControllerProvider.notifier).logout(),
                      icon: const Icon(Icons.logout),
                    ),
                  ),
                ),
                destinations: destinations
                    .map(
                      (item) => NavigationRailDestination(
                        icon: item.icon,
                        label: Text(item.label),
                      ),
                    )
                    .toList(),
              ),
              const VerticalDivider(width: 1),
              Expanded(child: content),
            ],
          ),
        );
      },
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.index});
  final int index;

  @override
  Widget build(BuildContext context) {
    final titles = [
      'Dashboard',
      'Kalender & Training',
      'Chat & Kommunikation',
      'Mitglieder & Prüfungen',
      'Einstellungen',
    ];
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(titles[index], style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 16),
        if (index == 0)
          const Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              _StatusCard(title: 'Nächste Termine'),
              _StatusCard(title: 'Benachrichtigungen'),
              _StatusCard(title: 'Schnellzugriffe'),
            ],
          )
        else
          const Card(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('Dieses Fachmodul ist noch nicht implementiert.'),
            ),
          ),
      ],
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 320,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              const Text('Noch keine Daten verfügbar.'),
            ],
          ),
        ),
      ),
    );
  }
}

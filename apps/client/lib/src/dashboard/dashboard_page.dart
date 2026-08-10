import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../chat/chat_page.dart';
import '../calendar/calendar_page.dart';
import '../exams/exam_page.dart';
import '../members/member_list_page.dart';
import '../polls/poll_page.dart';
import '../users/pending_users_page.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  int _selectedIndex = 0;

  static const destinations = [
    NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
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
        final extended = constraints.maxWidth >= 1200;
        final session = ref.watch(authControllerProvider).value;
        final content = _Content(
          index: _selectedIndex,
          accessToken: session?.accessToken,
          currentUserId: session?.userId,
          permissions: session?.permissions ?? const {},
          greetingName: session?.greetingName ?? '',
        );
        if (!desktop) {
          return Scaffold(
            appBar: AppBar(
              title: const _Brand(compact: true),
              actions: [
                IconButton(
                  tooltip: 'Abmelden',
                  onPressed: () =>
                      ref.read(authControllerProvider.notifier).logout(),
                  icon: const Icon(Icons.logout_rounded),
                ),
                const SizedBox(width: 8),
              ],
            ),
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
              Container(
                width: extended ? 372 : 135,
                color: const Color(0xFF201D1A),
                child: NavigationRail(
                  backgroundColor: Colors.transparent,
                  extended: extended,
                  minWidth: 135,
                  minExtendedWidth: 372,
                  selectedIndex: _selectedIndex,
                  onDestinationSelected: (index) =>
                      setState(() => _selectedIndex = index),
                  indicatorColor: const Color(0xFF9E2A2B),
                  selectedIconTheme: const IconThemeData(
                    color: Colors.white,
                    size: 36,
                  ),
                  unselectedIconTheme: const IconThemeData(
                    color: Color(0xFFD8CDC0),
                    size: 35,
                  ),
                  selectedLabelTextStyle: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 21,
                  ),
                  unselectedLabelTextStyle: const TextStyle(
                    color: Color(0xFFEAE1D6),
                    fontWeight: FontWeight.w500,
                    fontSize: 21,
                  ),
                  leading: const Padding(
                    padding: EdgeInsets.fromLTRB(23, 34, 23, 39),
                    child: _Brand(),
                  ),
                  trailing: Expanded(
                    child: Align(
                      alignment: Alignment.bottomCenter,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 26),
                        child: IconButton(
                          tooltip: 'Abmelden',
                          onPressed: () => ref
                              .read(authControllerProvider.notifier)
                              .logout(),
                          icon: const Icon(
                            Icons.logout,
                            color: Color(0xFFEAE1D6),
                            size: 31,
                          ),
                        ),
                      ),
                    ),
                  ),
                  destinations: destinations
                      .map(
                        (item) => NavigationRailDestination(
                          icon: item.icon,
                          label: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 17),
                            child: Text(item.label),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
              Expanded(child: content),
            ],
          ),
        );
      },
    );
  }
}

class _Content extends ConsumerWidget {
  const _Content({
    required this.index,
    required this.accessToken,
    required this.currentUserId,
    required this.permissions,
    required this.greetingName,
  });
  final int index;
  final String? accessToken;
  final String? currentUserId;
  final Set<String> permissions;
  final String greetingName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const titles = [
      'Dashboard',
      'Kalender & Training',
      'Chat & Kommunikation',
      'Mitglieder & Prüfungen',
      'Einstellungen',
    ];
    return ListView(
      padding: EdgeInsets.symmetric(
        horizontal: MediaQuery.sizeOf(context).width >= 1200 ? 48 : 24,
        vertical: 32,
      ),
      children: [
        if (index == 0)
          _WelcomeHeader(greetingName: greetingName)
        else
          Text(
            titles[index],
            style: Theme.of(
              context,
            ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
        const SizedBox(height: 28),
        if (index == 0)
          const _DashboardOverview()
        else if (index == 1 &&
            accessToken != null &&
            permissions.contains('calendar.view'))
          SizedBox(
            height: MediaQuery.sizeOf(context).height - 145,
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: CalendarPage(
                accessToken: accessToken!,
                permissions: permissions,
              ),
            ),
          )
        else if (index == 2 &&
            accessToken != null &&
            currentUserId != null &&
            permissions.contains('chat.general.access'))
          SizedBox(
            height: MediaQuery.sizeOf(context).height - 145,
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: DefaultTabController(
                length: permissions.contains('polls.vote') ? 2 : 1,
                child: Column(
                  children: [
                    TabBar(
                      tabs: [
                        const Tab(
                          icon: Icon(Icons.forum_outlined),
                          text: 'Chat',
                        ),
                        if (permissions.contains('polls.vote'))
                          const Tab(
                            icon: Icon(Icons.poll_outlined),
                            text: 'Umfragen',
                          ),
                      ],
                    ),
                    Expanded(
                      child: TabBarView(
                        children: [
                          ChatPage(
                            accessToken: accessToken!,
                            currentUserId: currentUserId!,
                          ),
                          if (permissions.contains('polls.vote'))
                            PollPage(
                              accessToken: accessToken!,
                              permissions: permissions,
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else if (index == 3 &&
            accessToken != null &&
            (permissions.contains('users.approve') ||
                permissions.contains('members.view') ||
                permissions.contains('exams.view'))) ...[
          if (permissions.contains('members.view')) ...[
            Text('Mitglieder', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            SizedBox(
              height: 420,
              child: MemberListPage(
                accessToken: accessToken!,
                permissions: permissions,
              ),
            ),
          ],
          if (permissions.contains('exams.view')) ...[
            const SizedBox(height: 28),
            SizedBox(
              height: 520,
              child: Card(
                clipBehavior: Clip.antiAlias,
                child: ExamPage(
                  accessToken: accessToken!,
                  permissions: permissions,
                ),
              ),
            ),
          ],
          if (permissions.contains('users.approve')) ...[
            const SizedBox(height: 28),
            Text(
              'Ausstehende Registrierungen',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 360,
              child: PendingUsersPage(accessToken: accessToken!),
            ),
          ],
        ] else if (index == 4)
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton.tonalIcon(
              onPressed: () =>
                  ref.read(authControllerProvider.notifier).logout(),
              icon: const Icon(Icons.logout),
              label: const Text('Abmelden'),
            ),
          )
        else
          const _ModuleInProgress(),
      ],
    );
  }
}

class _DashboardOverview extends StatelessWidget {
  const _DashboardOverview();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth >= 980
            ? (constraints.maxWidth - 40) / 3
            : constraints.maxWidth >= 620
            ? (constraints.maxWidth - 20) / 2
            : constraints.maxWidth;
        return Wrap(
          spacing: 20,
          runSpacing: 20,
          children: [
            _StatusCard(
              width: width,
              icon: Icons.event_available_rounded,
              title: 'Nächste Termine',
              body: 'Deine kommenden Trainings und Vereinstermine.',
            ),
            _StatusCard(
              width: width,
              icon: Icons.notifications_none_rounded,
              title: 'Benachrichtigungen',
              body: 'Wichtige Neuigkeiten erscheinen gesammelt hier.',
            ),
            _StatusCard(
              width: width,
              icon: Icons.bolt_rounded,
              title: 'Schnellzugriffe',
              body: 'Direkter Einstieg in deine häufigsten Bereiche.',
            ),
          ],
        );
      },
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.width,
    required this.icon,
    required this.title,
    required this.body,
  });
  final double width;
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DecoratedBox(
                decoration: const BoxDecoration(
                  color: Color(0xFFF3E4E1),
                  shape: BoxShape.circle,
                ),
                child: Padding(
                  padding: const EdgeInsets.all(11),
                  child: Icon(icon, color: const Color(0xFF9E2A2B)),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 9),
              Text(body, style: Theme.of(context).textTheme.bodyLarge),
            ],
          ),
        ),
      ),
    );
  }
}

class _WelcomeHeader extends StatelessWidget {
  const _WelcomeHeader({required this.greetingName});
  final String greetingName;

  @override
  Widget build(BuildContext context) {
    final name = greetingName.trim();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 26),
      decoration: BoxDecoration(
        color: const Color(0xFF201D1A),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          Container(width: 5, height: 62, color: const Color(0xFF9E2A2B)),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name.isEmpty ? 'Willkommen bei MyJudo' : 'Hallo $name',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Dein Verein. Dein Training. Dein Weg.',
                  style: TextStyle(color: Color(0xFFD8CDC0), fontSize: 16),
                ),
              ],
            ),
          ),
          const Icon(Icons.circle, color: Color(0xFF9E2A2B), size: 18),
        ],
      ),
    );
  }
}

class _ModuleInProgress extends StatelessWidget {
  const _ModuleInProgress();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(28),
        child: Row(
          children: [
            Icon(Icons.construction_rounded, color: Color(0xFF9E2A2B)),
            SizedBox(width: 16),
            Expanded(
              child: Text(
                'Dieses Modul wird gerade funktionsfähig aufgebaut.',
                style: TextStyle(fontSize: 17),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Brand extends StatelessWidget {
  const _Brand({this.compact = false});
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: compact ? 34 : 55,
          height: compact ? 34 : 55,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Color(0xFF9E2A2B),
            shape: BoxShape.circle,
          ),
          child: Text(
            '柔',
            style: TextStyle(
              color: Colors.white,
              fontSize: compact ? 18 : 27,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        SizedBox(width: compact ? 11 : 14),
        Text(
          'MyJudo',
          style: TextStyle(
            color: compact ? const Color(0xFF25221E) : Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: compact ? 20 : 31,
          ),
        ),
      ],
    );
  }
}

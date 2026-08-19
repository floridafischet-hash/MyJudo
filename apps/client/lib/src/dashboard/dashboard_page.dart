import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../chat/chat_page.dart';
import '../chat/chat_admin_page.dart';
import '../members/member_list_page.dart';
import '../members/member_excel_import_page.dart';
import '../users/pending_users_page.dart';
import '../training/training_page.dart';
import '../users/user_management_page.dart';
import '../notifications/chat_notification_monitor.dart';
import '../notifications/notification_settings_page.dart';
import '../projects/projects_page.dart';
import '../downloads/downloads_page.dart';
import '../browser_title/browser_title.dart';
import '../calendar/home_calendar_summary.dart';
import '../calendar/calendar_reminder_monitor.dart';
import '../audit/audit_log_page.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  int _selectedIndex = 0;
  int _unreadMessages = 0;

  void _setUnreadMessages(int value) {
    if (!mounted || value == _unreadMessages) return;
    setState(() => _unreadMessages = value);
    setMyJudoBrowserTitle(value);
  }

  @override
  void dispose() {
    setMyJudoBrowserTitle(0);
    super.dispose();
  }

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
      icon: Icon(Icons.dashboard_outlined),
      label: 'Projekte',
    ),
    NavigationDestination(
      icon: Icon(Icons.download_outlined),
      label: 'Downloads',
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
        final content = Stack(
          children: [
            _Content(
              index: _selectedIndex,
              accessToken: session?.accessToken,
              currentUserId: session?.userId,
              permissions: session?.permissions ?? const {},
              greetingName: session?.greetingName ?? '',
              isSuperuser: session?.isSuperuser ?? false,
            ),
            if (session != null &&
                session.permissions.contains('chat.general.access'))
              ChatNotificationMonitor(
                accessToken: session.accessToken,
                currentUserId: session.userId,
                chatIsOpen: _selectedIndex == 2,
                onUnreadChanged: _setUnreadMessages,
              ),
            if (session != null)
              CalendarReminderMonitor(token: session.accessToken),
          ],
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
              labelBehavior:
                  NavigationDestinationLabelBehavior.onlyShowSelected,
              onDestinationSelected: (index) =>
                  setState(() => _selectedIndex = index),
              destinations: _destinationsWithUnread(),
            ),
          );
        }
        return Scaffold(
          body: Row(
            children: [
              Container(
                width: extended ? 286 : 104,
                color: const Color(0xFF082D4B),
                child: NavigationRail(
                  backgroundColor: Colors.transparent,
                  extended: extended,
                  minWidth: 104,
                  minExtendedWidth: 286,
                  selectedIndex: _selectedIndex,
                  onDestinationSelected: (index) =>
                      setState(() => _selectedIndex = index),
                  indicatorColor: const Color(0xFF0B4F8A),
                  selectedIconTheme: const IconThemeData(
                    color: Colors.white,
                    size: 28,
                  ),
                  unselectedIconTheme: const IconThemeData(
                    color: Color(0xFFD8CDC0),
                    size: 27,
                  ),
                  selectedLabelTextStyle: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                  unselectedLabelTextStyle: const TextStyle(
                    color: Color(0xFFEAE1D6),
                    fontWeight: FontWeight.w500,
                    fontSize: 16,
                  ),
                  leading: const Padding(
                    padding: EdgeInsets.fromLTRB(18, 26, 18, 30),
                    child: _Brand(),
                  ),
                  trailing: Expanded(
                    child: Align(
                      alignment: Alignment.bottomCenter,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 20),
                        child: IconButton(
                          tooltip: 'Abmelden',
                          onPressed: () => ref
                              .read(authControllerProvider.notifier)
                              .logout(),
                          icon: const Icon(
                            Icons.logout,
                            color: Color(0xFFEAE1D6),
                          ),
                        ),
                      ),
                    ),
                  ),
                  destinations: _destinationsWithUnread()
                      .map(
                        (item) => NavigationRailDestination(
                          icon: item.icon,
                          label: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 13),
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

  List<NavigationDestination> _destinationsWithUnread() => destinations
      .asMap()
      .entries
      .map(
        (entry) => entry.key == 2 && _unreadMessages > 0
            ? NavigationDestination(
                icon: Badge(
                  label: Text('$_unreadMessages'),
                  child: entry.value.icon,
                ),
                label: 'Kommunikation',
              )
            : entry.value,
      )
      .toList();
}

class _Content extends ConsumerWidget {
  const _Content({
    required this.index,
    required this.accessToken,
    required this.currentUserId,
    required this.permissions,
    required this.greetingName,
    required this.isSuperuser,
  });
  final int index;
  final String? accessToken;
  final String? currentUserId;
  final Set<String> permissions;
  final String greetingName;
  final bool isSuperuser;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const titles = [
      'Dashboard',
      'Kalender & Training',
      'Chat & Kommunikation',
      'Mitglieder & Prüfungen',
      'Pinnwand & Projekte',
      'Downloads',
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
        if (index == 0 && accessToken != null) ...[
          HomeCalendarSummary(token: accessToken!, showActivity: false),
          const SizedBox(height: 30),
          const Text(
            'Pinnwand',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 14),
          ProjectsPage(
            accessToken: accessToken!,
            canCreate: permissions.contains('roles.manage'),
          ),
          const SizedBox(height: 34),
          const Text(
            'Kalender',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 14),
          TrainingPage(
            accessToken: accessToken!,
            canManage: permissions.contains('training.manage'),
            embedded: true,
            showCalendar: true,
            calendarOnly: true,
          ),
        ] else if (index == 1 && accessToken != null)
          TrainingPage(
            accessToken: accessToken!,
            canManage: permissions.contains('training.manage'),
            embedded: true,
            showCalendar: true,
          )
        else if (index == 2 &&
            accessToken != null &&
            currentUserId != null &&
            permissions.contains('chat.general.access'))
          SizedBox(
            height: MediaQuery.sizeOf(context).height - 145,
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: ChatPage(
                accessToken: accessToken!,
                currentUserId: currentUserId!,
                canDeleteAll: isSuperuser,
              ),
            ),
          )
        else if (index == 3 &&
            accessToken != null &&
            (permissions.contains('users.approve') ||
                permissions.contains('members.view'))) ...[
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
        ] else if (index == 4 && accessToken != null)
          ProjectsPage(
            accessToken: accessToken!,
            canCreate: permissions.contains('roles.manage'),
          )
        else if (index == 5 && accessToken != null)
          DownloadsPage(
            token: accessToken!,
            admin: permissions.contains('roles.manage'),
          )
        else if (index == 6 && accessToken != null) ...[
          NotificationSettingsPage(accessToken: accessToken!),
          const SizedBox(height: 28),
          HomeCalendarSummary(token: accessToken!, showUpcoming: false),
          if (permissions.contains('roles.manage')) ...[
            const SizedBox(height: 28),
            ChatAdminPage(accessToken: accessToken!),
            const SizedBox(height: 28),
            UserManagementPage(accessToken: accessToken!, embedded: true),
            const SizedBox(height: 28),
            MemberExcelImportPage(accessToken: accessToken!),
          ],
          if (isSuperuser) ...[
            const SizedBox(height: 28),
            AuditLogPage(accessToken: accessToken!),
          ],
        ] else
          const _ModuleInProgress(),
      ],
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
        color: const Color(0xFF082D4B),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          Container(width: 5, height: 62, color: const Color(0xFF52A9D8)),
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
          const Icon(Icons.circle, color: Color(0xFF52A9D8), size: 18),
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
    final name = Text(
      'Kodokan OHZ',
      style: TextStyle(
        color: compact ? const Color(0xFF25221E) : Colors.white,
        fontWeight: FontWeight.w800,
        fontSize: compact ? 20 : 24,
      ),
    );
    final logo = Image.asset(
      'assets/kodokan_osterholz_display.png',
      width: compact ? 42 : 144,
      height: compact ? 42 : 144,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      isAntiAlias: true,
    );
    if (compact) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [logo, const SizedBox(width: 11), name],
      );
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [name, const SizedBox(height: 12), logo],
    );
  }
}

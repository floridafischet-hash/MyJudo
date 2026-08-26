import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

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
  int _newProjectsCount = 0;
  Timer? _projectsTimer;
  static const _storage = FlutterSecureStorage();
  static const _projectsViewedKey = 'projects_last_viewed_at';

  void _setUnreadMessages(int value) {
    if (!mounted || value == _unreadMessages) return;
    setState(() => _unreadMessages = value);
    setMyJudoBrowserTitle(value);
  }

  @override
  void initState() {
    super.initState();
    _scheduleProjectsCheck();
  }

  void _scheduleProjectsCheck() {
    _projectsTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      final session = ref.read(authControllerProvider).value;
      if (session != null) _checkNewProjects(session.accessToken);
    });
    // initial check after first frame so session is available
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = ref.read(authControllerProvider).value;
      if (session != null) _checkNewProjects(session.accessToken);
    });
  }

  Future<void> _checkNewProjects(String token) async {
    try {
      final storedStr = await _storage.read(key: _projectsViewedKey);
      final lastViewed = storedStr != null
          ? DateTime.tryParse(storedStr)
          : null;
      final dio = Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          headers: {'Authorization': 'Bearer $token'},
        ),
      );
      final r = await dio.get<List<dynamic>>('/projects');
      dio.close();
      if (!mounted) return;
      final projects = r.data ?? [];
      if (lastViewed == null) return;
      final count = projects.where((p) {
        final raw = (p as Map)['updatedAt'];
        if (raw == null) return false;
        final updated = DateTime.tryParse(raw.toString());
        return updated != null && updated.isAfter(lastViewed);
      }).length;
      if (count != _newProjectsCount) {
        setState(() => _newProjectsCount = count);
      }
    } catch (_) {}
  }

  Future<void> _onDestinationSelected(int index, String? token) async {
    setState(() => _selectedIndex = index);
    if (index == 4) {
      // Mark projects as viewed
      await _storage.write(
        key: _projectsViewedKey,
        value: DateTime.now().toIso8601String(),
      );
      if (mounted) setState(() => _newProjectsCount = 0);
    }
  }

  @override
  void dispose() {
    _projectsTimer?.cancel();
    setMyJudoBrowserTitle(0);
    super.dispose();
  }

  static const _mainDestinations = [
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
  ];

  static const _settingsDestination = NavigationDestination(
    icon: Icon(Icons.settings_outlined),
    label: 'Einstellungen',
  );

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
                  _onDestinationSelected(index, session?.accessToken),
              destinations: _destinationsWithBadges(
                session?.isSuperuser ?? false,
              ),
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
                      _onDestinationSelected(index, session?.accessToken),
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
                  destinations:
                      _destinationsWithBadges(session?.isSuperuser ?? false)
                          .map(
                            (item) => NavigationRailDestination(
                              icon: item.icon,
                              label: Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 13,
                                ),
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

  List<NavigationDestination> _destinationsWithBadges(bool isSuperuser) {
    final destinations = [
      ..._mainDestinations,
      if (isSuperuser) _settingsDestination,
    ];
    return destinations.asMap().entries.map((entry) {
      if (entry.key == 2 && _unreadMessages > 0) {
        return NavigationDestination(
          icon: Badge(label: Text('$_unreadMessages'), child: entry.value.icon),
          label: 'Kommunikation',
        );
      }
      if (entry.key == 4 && _newProjectsCount > 0) {
        return NavigationDestination(
          icon: Badge(
            label: Text('$_newProjectsCount'),
            child: entry.value.icon,
          ),
          label: 'Projekte',
        );
      }
      return entry.value;
    }).toList();
  }
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
          const Text(
            'Pinnwand',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 14),
          ProjectsPage(
            accessToken: accessToken!,
            canCreate: permissions.contains('roles.manage'),
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
        else if (index == 6 && accessToken != null && isSuperuser) ...[
          NotificationSettingsPage(accessToken: accessToken!),
          const SizedBox(height: 28),
          HomeCalendarSummary(token: accessToken!, showUpcoming: false),
          const SizedBox(height: 28),
          ChatAdminPage(accessToken: accessToken!),
          const SizedBox(height: 28),
          UserManagementPage(
            accessToken: accessToken!,
            currentUserId: currentUserId!,
            embedded: true,
          ),
          const SizedBox(height: 28),
          MemberExcelImportPage(accessToken: accessToken!),
          const SizedBox(height: 28),
          AuditLogPage(accessToken: accessToken!),
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
                  name.isEmpty ? 'Willkommen bei Zenyo Kizuna' : 'Hallo $name',
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
    final logoSize = compact ? 42.0 : 220.0;
    final logoCache = (logoSize * 3).round();
    final logo = Image.asset(
      'assets/kodokan_osterholz_display.png',
      width: logoSize,
      height: logoSize,
      cacheWidth: logoCache,
      cacheHeight: logoCache,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.medium,
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

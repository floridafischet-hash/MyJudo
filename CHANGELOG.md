# Changelog

All notable changes to MyJudo are documented here.

---

## [Unreleased] – 2026-08-19

### Fixed

#### Chat – Nachrichten konnten nicht geladen werden (400-Fehler)
- **Problem:** Dio sendete den optionalen `before`-Parameter als leeren String (`?before&limit=50`), was die UUID-Validierung im Backend mit HTTP 400 abwies.
- **Lösung:** `queryParameters` nutzt jetzt `if (before != null) 'before': before` (Dart Collection-If), sodass der Parameter nur gesendet wird, wenn er gesetzt ist.
- **Datei:** `apps/client/lib/src/chat/chat_repository.dart`

#### Chat – Nachrichten-Reihenfolge falsch (neueste Nachricht oben statt unten)
- **Problem:** Die API liefert Nachrichten absteigend (neueste zuerst). `ListView` mit `reverse: true` rendert Index 0 unten – beides zusammen ergibt WhatsApp-Verhalten. Fehler war ein versehentliches Doppel-Umkehren (`messages.length - 1 - index`).
- **Lösung:** `itemBuilder` verwendet direkt `messages[index]`, `_scrollToBottom()` springt zu `jumpTo(0)`, Polling/Senden/Older-Load präpendiert/appendiert konsistent zur DESC-Liste.
- **Datei:** `apps/client/lib/src/chat/chat_page.dart`

#### RBAC – Audit-Log für alle authentifizierten Nutzer erreichbar
- **Problem:** `AuditController` hatte nur `AuthGuard('jwt')`, aber keinen `PermissionGuard` und keine `@RequirePermissions`-Annotation. Jeder eingeloggte Benutzer konnte `/audit-logs` aufrufen.
- **Lösung:** `@UseGuards(AuthGuard('jwt'), PermissionGuard)` + `@RequirePermissions('audit.view')` auf Controller-Ebene.
- **Datei:** `apps/api/src/audit/audit.controller.ts`

### Added

#### Downloads – Vorschau für PDFs und Bilder
- **Bilder** (JPEG, PNG, GIF, WebP, SVG): Vollbild-Dialog mit `Image.memory` + `InteractiveViewer` (Pinch-to-Zoom).
- **PDFs:** Blob-URL via `dart:html` wird in neuem Tab geöffnet (`window.open(..., '_blank')`).
- **DOCX/XLSX:** Vorschau-Button deaktiviert (kein nativer Browser-Support).
- **Dateien:**
  - `apps/client/lib/src/downloads/downloads_page.dart` – Preview-Logik, `_PreviewButton`-Widget
  - `apps/client/lib/src/downloads/download_file_web.dart` – `openBlobPreview`, `revokeBlobUrl`
  - `apps/client/lib/src/downloads/download_file_stub.dart` – Stubs für non-web Targets
  - `apps/client/lib/src/downloads/download_file.dart` – Delegating-Wrapper

#### Dashboard – Projekte-Benachrichtigungsbadge
- Zählt Projekte, deren `updatedAt` nach dem letzten Besuch des Tabs liegt.
- Timestamp wird in `flutter_secure_storage` unter `projects_last_viewed_at` gespeichert.
- Polling alle 60 Sekunden; Badge wird beim Öffnen des Projekte-Tabs zurückgesetzt.
- **Datei:** `apps/client/lib/src/dashboard/dashboard_page.dart`

#### Dashboard – Home-Tab Reihenfolge
- Neue Reihenfolge: **Pinnwand** (Projekte) → **Kommende Termine** (max. 3) → **Kalender/Training**
- **Dateien:** `dashboard_page.dart`, `apps/client/lib/src/calendar/home_calendar_summary.dart` (neuer `maxUpcoming`-Parameter)

#### Mitglieder-Import – zusätzliche Felder in der Vorschau
- Expandierte Zeilen zeigen jetzt: `Letzte Prüfung`, `Prüfungen im laufenden Jahr`, `Alle Gürtel`.
- **Datei:** `apps/client/lib/src/members/member_excel_import_page.dart`

#### Mobile Navigation – Label-Überlauf behoben
- `NavigationBar` auf kleinen Screens nutzt jetzt `NavigationDestinationLabelBehavior.onlyShowSelected`, damit lange Labels nicht umbrechen.
- **Datei:** `apps/client/lib/src/dashboard/dashboard_page.dart`

---

## Deployment-Hinweise

- Flutter-Web-Build erfolgt **immer auf dem Produktionsserver** (`/home/jarvis/jarvis-brain/projects/myjudo`), nicht aus dem Workspace-Repo.
- Nach `rsync -a --delete build/web/ /var/www/myjudo/` zwingend `chown -R www-data:www-data /var/www/myjudo && chmod -R 750 /var/www/myjudo` ausführen.
- API-Rebuild via `docker compose build api && docker compose up -d api` im `/home/jarvis/jarvis-brain/projects/myjudo/docker`-Verzeichnis.
- Produktions-URL: `https://212.227.20.171:18780`

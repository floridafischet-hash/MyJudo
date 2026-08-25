# MyJudo

MyJudo ist eine mandantenfähige Vereinsplattform für Android, iOS, Windows und
Web, entwickelt für den Kodokan Osterholz. Sie bündelt Mitgliederverwaltung,
Kommunikation, Terminplanung und Trainingsorganisation an einem Ort und ersetzt
verstreute Excel-Listen, WhatsApp-Gruppen und Zettelwirtschaft.

Produktiv erreichbar unter: `https://212.227.20.171:18780`

---

## Inhaltsverzeichnis

- [Funktionsumfang](#funktionsumfang)
- [Architektur](#architektur)
- [Projektstruktur](#projektstruktur)
- [Entwicklung – Backend](#entwicklung--backend)
- [Entwicklung – Client (Flutter)](#entwicklung--client-flutter)
- [Berechtigungsmodell (RBAC)](#berechtigungsmodell-rbac)
- [Training und Anwesenheit](#training-und-anwesenheit)
- [Deployment](#deployment)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Sicherheit](#sicherheit)
- [Tests](#tests)
- [Roadmap](#roadmap)
- [Troubleshooting](#troubleshooting)

---

## Funktionsumfang

- **Dashboard** – persönliche Startseite mit Pinnwand (Projekt-/Aufgabenkarten
  mit Drag-Reihenfolge und Status), kommenden Terminen und Schnellzugriff auf
  Kalender, Chat, Mitglieder und Projekte.
- **Kalender & Termine** – wiederkehrende Trainingszeiten, Einzeltermine,
  Online-Meeting-Links (Google Meet/Teams, manuell hinterlegt und
  serverseitig validiert), Anwesenheitsabstimmungen pro Termin.
- **Chat** – persistente Gruppen- und Direktnachrichten, Sprachnachrichten,
  Bild-Uploads, administrative Löschrechte für Superuser, ein separat
  geschützter PSG-Bereich (Prüfungs-/Sonderbereich) mit eigenem Zugriffsscope.
- **Mitgliederverwaltung** – Mitgliederliste, ausstehende Registrierungen mit
  Freigabeprozess, Fachgruppenzuweisung unabhängig vom RBAC.
- **Projekte / Pinnwand** – Vereinsprojekte und Aufgaben mit Status (Aktiv,
  Abgeschlossen), Beschreibung und manueller Sortierung.
- **Prüfungen/Graduierungen** – Verwaltung anstehender Prüfungstermine und
  Prüflinge.
- **Benutzerverwaltung (nur Superuser)** – Benutzer anlegen/bearbeiten/löschen,
  Rollen und Gruppen zuweisen, Avatare verwalten.
- **Audit-Log (nur Superuser)** – Nachvollziehbarkeit sicherheitsrelevanter
  Aktionen ohne Klartext-Passwörter, -Tokens oder Chatinhalte.
- **Excel-Import** – Massenimport von Mitgliederdaten für Superuser.
- **Downloads** – Dateiablage für Vereinsdokumente.

## Architektur

| Bereich          | Technologie                                            |
| ---------------- | ------------------------------------------------------ |
| Client            | Flutter (Android, iOS, Windows, Web)                    |
| Backend           | NestJS / TypeScript                                     |
| Datenbank         | PostgreSQL 17                                           |
| Authentifizierung | lokale Argon2id-Passwort-Hashes, signierte Access-Tokens, rotierende Refresh-Tokens |
| Berechtigungen    | mandantenbezogenes RBAC mit separatem PSG-Scope          |
| Deployment        | Docker Compose (API + Postgres) hinter Nginx/TLS; Web-Client als statisches Flutter-Web-Build |

Weiterführende Dokumente: [Architektur](docs/architecture.md),
[Berechtigungen](docs/permissions.md), [API](docs/api.md),
[Datenbank](docs/database.md) und
[Implementierungsplan](docs/implementation-plan.md).

Für Vereinsmitglieder ohne Technik-Hintergrund gibt es zudem ein
laienverständliches [Benutzerhandbuch](docs/benutzerhandbuch.md).

## Projektstruktur

```
myjudo/
├── apps/
│   ├── api/                 # NestJS-Backend
│   │   └── src/
│   │       ├── auth/        # Login, Tokens, Sessions
│   │       ├── rbac/        # PermissionGuard, Decorators, Rollenlogik
│   │       ├── users/       # Nutzerverwaltung (Admin, Rollen, Avatare)
│   │       ├── projects/    # Pinnwand/Projekte
│   │       ├── calendar/    # Termine, Trainingszeiten, Anwesenheit
│   │       ├── chat/        # Gruppen-/Direktchat, PSG
│   │       ├── audit/       # Audit-Log
│   │       └── database/    # Migrationen, Seeds, Bootstrap-Skripte
│   └── client/               # Flutter-App
│       └── lib/src/
│           ├── dashboard/    # Startseite (Pinnwand, Termine-Übersicht)
│           ├── calendar/     # Kalender-UI
│           ├── chat/         # Chat-UI
│           ├── projects/     # Projekt-/Pinnwand-UI
│           ├── members/      # Mitgliederliste, Registrierungen
│           ├── users/        # Nutzerverwaltung-UI (Superuser)
│           ├── training/     # Trainingszeiten/-gruppen
│           ├── audit/        # Audit-Log-UI
│           └── auth/         # Login/Session
├── deploy/                   # nginx-Konfiguration
├── docs/                     # Architektur-, API- und Berechtigungsdokumente
└── docker-compose.yml        # Produktions-Stack (Postgres + API)
```

## Entwicklung – Backend

Voraussetzungen: Node.js 22–24, npm, Docker.

```bash
npm ci
cp .env.example .env
docker compose up -d postgres
npm run migration:run --workspace @myjudo/api
npm run seed --workspace @myjudo/api
npm run lint
npm run typecheck
npm test
npm run build
```

Die beiden initialen Superuser werden idempotent mit ausschließlich zur
Laufzeit gesetzten Passwörtern angelegt:

```bash
FLORIAN_PASSWORD=... STEFAN_PASSWORD=... npm run users:bootstrap --workspace @myjudo/api
```

`PASSWORD_PEPPER`, Passwörter und JWT-Secrets dürfen niemals committed werden.

## Entwicklung – Client (Flutter)

Voraussetzungen: Flutter SDK (aktuell 3.44.9).

```bash
cd apps/client
flutter pub get
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build web --release --dart-define=API_BASE_URL=https://example.org/api/v1
```

Der Produktions-Build (`flutter build web --release`) wird ohne Argument
gegen die im Code konfigurierte Standard-API-URL gebaut und anschließend als
statisches Verzeichnis (`build/web`) ausgeliefert.

## Berechtigungsmodell (RBAC)

MyJudo verwendet mandantenbezogenes RBAC: Benutzer erhalten Rollen, Rollen
enthalten Berechtigungen (Permissions). Mehrfachrollen ergeben die
Vereinigungsmenge der aktiven Berechtigungen. MyJudo ist die alleinige Source
of Truth für Identität, Fachrollen und Permissions – es gibt keine externe
Identity-Anbindung.

**Superuser-Rolle**

- Die Rolle `Superuser` ist die höchste Berechtigungsstufe im System.
- Nur Superuser sehen und bearbeiten die Einstellungen und die
  Benutzerverwaltung – sowohl im Frontend (Menüpunkt nur bei
  `session.isSuperuser` sichtbar) als auch serverseitig
  (`@RequireSuperuser()`-Guard auf allen entsprechenden Endpunkten).
- Benutzer anlegen, bearbeiten, löschen und **Rollen zuweisen** sind
  ausschließlich Superusern vorbehalten. Die Permission `roles.manage` allein
  reicht dafür ausdrücklich **nicht** – es ist keine self-service
  Rechtevergabe möglich, ein Nutzer kann sich also nicht selbst zum Superuser
  machen oder anderen Nutzern Rollen zuweisen, ohne selbst Superuser zu sein.
- Das eigene Superuser-Konto kann nicht gelöscht werden.
- Die Rolle `Superuser` enthält `chat.psg.access` bewusst **nicht** – der
  PSG-Bereich bleibt unabhängig vom Superuser-Status separat geschützt.

**Zugriffsprüfung**

Jeder fachliche Zugriff prüft mindestens:

1. gültige Authentifizierung (JWT),
2. aktiven Benutzerstatus,
3. Organisation/Mandant,
4. konkrete Permission,
5. Objektbezug (z. B. Gruppenzugehörigkeit, Chat-Mitgliedschaft).

Rollenänderungen erhöhen die `authorizationVersion` des Benutzers, wodurch
bereits ausgestellte Access-Tokens sofort ungültig werden – ein Rechteentzug
wirkt also unmittelbar, nicht erst nach Tokenablauf.

Einladungstokens werden nur als SHA-256-Hash gespeichert, sind widerrufbar und
können genau einmal angenommen werden.

Details: [docs/permissions.md](docs/permissions.md).

## Training und Anwesenheit

- Fachgruppen sind unabhängig von RBAC-Rollen und werden ausschließlich durch
  berechtigte Administratoren zugewiesen.
- Wiederkehrende Trainingszeiten erzeugen beim Abruf konkrete Termine in der
  Vereinszeitzone. Jede Anwesenheitsantwort gehört eindeutig zu Benutzer und
  Termin.
- Terminlisten und Abstimmungen werden serverseitig gegen die aktuelle
  Gruppenzugehörigkeit geprüft; Gruppenwechsel erhöhen zusätzlich die
  Autorisierungsversion des Benutzers.
- Die initialen Gruppen und Trainingszeiten werden idempotent durch
  `npm run seed --workspace @myjudo/api` angelegt und bleiben danach über die
  Adminoberfläche bearbeitbar.

## Deployment

**Backend (API + Postgres)**

```bash
docker compose build api
docker compose up -d api
```

Läuft auf `127.0.0.1:18880` (intern), globaler Präfix `/api/v1`,
Health-Check unter `/api/v1/health`. Vor einem Deploy das laufende Image für
einen Rollback taggen:

```bash
docker tag myjudo-api myjudo-api:rollback-<timestamp>
```

**Web-Client**

```bash
cd apps/client
flutter build web --release --output=build/webnew
rsync -a --delete --chown=jarvis:www-data --chmod=D2750,F640 \
  build/webnew/ /var/www/myjudo/
```

Ausgeliefert wird `/var/www/myjudo` intern auf Port 18882, öffentlich über
Nginx/TLS auf `https://212.227.20.171:18780`.

> **Berechtigungshinweis:** `/var/www/myjudo` gehört `www-data:www-data`.
> Ein direktes `rsync` als normaler Nutzer schlägt mit *Permission denied*
> fehl. In dieser Umgebung ohne interaktives `sudo` wird stattdessen über die
> `docker`-Gruppenmitgliedschaft ein root-äquivalenter Kurzcontainer für den
> Dateitransfer genutzt:
>
> ```bash
> docker run --rm \
>   -v /var/www/myjudo:/dst \
>   -v "$(pwd)/build/webnew:/src:ro" \
>   alpine sh -c "apk add --no-cache rsync >/dev/null && \
>     rsync -a --delete --chown=1000:33 --chmod=D2750,F640 /src/ /dst/"
> ```
>
> Danach Browser-Cache der Flutter-Web-Assets per Hard-Reload
> (Strg+Shift+R) umgehen.

## Umgebungsvariablen

Siehe [.env.example](.env.example) für die vollständige, kommentierte Liste.
Wichtige Pflichtwerte für Produktion:

| Variable              | Zweck                                             |
| ---------------------- | -------------------------------------------------- |
| `POSTGRES_PASSWORD`    | Datenbankpasswort                                  |
| `DATABASE_URL`         | Postgres-Verbindungsstring                         |
| `APP_ORIGIN`           | Erlaubte CORS-Origin                               |
| `JWT_ACCESS_SECRET`    | Signaturschlüssel für Access-Tokens (≥32 Zeichen)  |
| `JWT_ACCESS_TTL`       | Gültigkeitsdauer der Access-Tokens (Default `15m`) |
| `PASSWORD_PEPPER`      | Zusätzlicher serverseitiger Pfeffer für Argon2id   |
| `INITIAL_ORGANIZATION_SLUG` / `_NAME` | Initialer Mandant beim Bootstrap    |

Google/Microsoft-OAuth-Variablen für automatische Meeting-Erstellung sind
dokumentiert, aber aktuell **nicht implementiert** – manuelle Meeting-Links
funktionieren bereits vollständig ohne diese Variablen.

## Sicherheit

- Jede Fachaktion wird serverseitig authentifiziert und autorisiert –
  Frontend-Sichtbarkeit (z. B. ausgeblendete Menüpunkte) ist reine
  Komfortebene, keine Sicherheitsgrenze.
- Passwörter werden mit Argon2id plus serverseitigem Pepper gehasht.
- Refresh-Tokens werden nur als SHA-256-Hash gespeichert und bei Nutzung
  rotiert.
- Rollenänderungen invalidieren vorhandene Access-Tokens sofort.
- Superuser erhalten keinen impliziten PSG-Zugriff.
- Self-Escalation ist ausgeschlossen: Rollenzuweisung erfordert explizit die
  Superuser-Rolle, nicht nur `roles.manage`.
- Audit-Logs enthalten keine Passwörter, Tokens oder Chat-Inhalte.

Vor einer öffentlichen produktiven Nutzung sind ein vertrauenswürdiges
TLS-Zertifikat, ein Datenschutzkonzept und ein getestetes Backup/Restore
erforderlich.

## Tests

```bash
# Backend
npm test --workspace @myjudo/api
npm run test:cov --workspace @myjudo/api

# Client
cd apps/client && flutter test
```

## Roadmap

- **Phase 1** *(aktuell)*: Auth/RBAC, Mitglieder, Chat, Umfragen, Kalender,
  Prüfungen, Dashboard
- **Phase 2**: Trainerlizenzen, Einsatzplanung, Protokolle,
  Prüfungsvorbereitung
- **Phase 3**: Dokumente, Prüfungsmaterial und strukturierte Trainingspläne
- **Phase 4**: Sitzungen, Anträge und organisatorische Workflows

## Troubleshooting

- **`MissingPluginException` bei Sprachnachrichten im Web-Build**: der
  generierte `web_plugin_registrant.dart` ist veraltet und listet neue
  Web-Plugins nicht. Fix: `rm -rf .dart_tool/flutter_build build/web*` und
  neu bauen, damit der Registrant (inkl. `RecordPluginWeb`,
  `AudioplayersPlugin` etc.) neu generiert wird.
- **`403 Forbidden` nach Deploy**: falsche Datei-/Verzeichnisrechte unter
  `/var/www/myjudo`. Muss `www-data`-lesbar sein:
  `chgrp -R www-data /var/www/myjudo; find /var/www/myjudo -type d -exec chmod 2750 {} +; find /var/www/myjudo -type f -exec chmod 640 {} +`.
- **Build-Ordner mit root-owned Dateien**: bei Builds, die versehentlich als
  root liefen, in einen frischen Output-Ordner bauen
  (`--output=build/webnew`) statt den bestehenden `build/web` zu
  überschreiben.

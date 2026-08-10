# MyJudo

MyJudo ist eine sichere, mandantenfähige Vereinsplattform mit Schwerpunkt auf
Judo-Vereinen. Zielplattformen sind Android, iOS, Windows und Web aus einer
gemeinsamen Flutter-Codebasis. Das modulare Backend stellt Authentifizierung,
serverseitiges RBAC, Datenhaltung, Realtime-Kommunikation und Hintergrundjobs
bereit.

Das Projekt befindet sich im Aufbau. Der aktuelle Stand umfasst das getestete
Backend-Fundament, einen echten Flutter-Login, permission-gesteuerte
Benutzerfreigabe sowie eine angebundene Mitgliederliste mit Suche, Pagination,
Detailbearbeitung, Statuswechseln und automatischer Austrittsverarbeitung.
Chat, Kalender, Prüfungen und weitere Fachmodule sind noch nicht fertig.

## Architektur

- Client: Flutter für Android, iOS, Windows und Web
- Backend: NestJS/TypeScript
- Datenbank: PostgreSQL 17
- Auth: Keycloak 26.7, OpenID Connect Authorization Code mit PKCE
- Berechtigungen: mandantenbezogenes RBAC mit explizitem PSG-Scope
- Deployment: Docker Compose hinter Nginx/TLS
- Zielroute: `https://212.227.20.171:18780`

Details stehen in [docs/architecture.md](docs/architecture.md),
[docs/permissions.md](docs/permissions.md), [docs/keycloak.md](docs/keycloak.md) und
[docs/implementation-plan.md](docs/implementation-plan.md).

## Entwicklung

Voraussetzungen: Node.js 22–24, npm und Docker Desktop.

```bash
npm ci
cp .env.example .env
npm run lint
npm run typecheck
npm test
npm run build
docker compose up --build
```

Die Beispielwerte müssen vor jedem nichtlokalen Einsatz ersetzt werden. Eine
echte `.env` darf nicht committed werden.

## Datenbank

Migrationen werden explizit ausgeführt; `synchronize` ist deaktiviert.

```bash
npm run migration:run --workspace @myjudo/api
npm run migration:revert --workspace @myjudo/api
npm run seed --workspace @myjudo/api
```

Der Seed ist idempotent und legt Organisation, Permissions und Rollen an.
Keycloak-Benutzer werden anschließend über den dokumentierten, serverseitigen
Bootstrap verknüpft; Passwörter stehen niemals im Repository.

## Tests und Builds

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run test:cov
npm run build
npm audit --audit-level=high
```

Client-Prüfungen:

```bash
cd apps/client
flutter pub get
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build web --release --dart-define=API_BASE_URL=https://example.org/api/v1 --dart-define=KEYCLOAK_URL=https://example.org/keycloak
flutter build windows --release
flutter build apk --release
```

iOS-Build und Signierung benötigen einen macOS-Runner mit Xcode. Auf Windows
benötigen Plugin-Builds aktivierten Developer Mode und die vollständige
Visual-Studio-C++-Desktop-Toolchain; Android benötigt Android Studio/SDK.

## Sicherheit

Registrierungen können durch den Vorstand freigegeben oder über eine zeitlich begrenzte,
widerrufbare Einmal-Einladung bestätigt werden. Einladungstokens werden niemals im Klartext
gespeichert. Optional lässt sich eine Einladung an eine E-Mail-Adresse und Mitgliedsnummer
binden.

- Jede Fachaktion wird serverseitig authentifiziert und autorisiert.
- PSG-Zugriff ist nicht Bestandteil von Vorstand oder Trainer.
- Passwörter, Login, Reset und Sessions liegen ausschließlich in Keycloak.
- Das Backend validiert RS256-Signatur, Issuer, Audience und Ablauf über JWKS.
- Geheimnisse, Schlüssel und Zertifikate sind durch `.gitignore` ausgeschlossen.
- Keycloak schützt Login und Registrierung; die API akzeptiert ausschließlich korrekt
  ausgestellte RS256-Tokens und erzwingt zusätzlich lokalen Kontostatus und RBAC.
- Audit-Logs speichern keine Passwörter, Tokens oder Chat-Inhalte.

Vor einer produktiven Freischaltung sind Domain/öffentlich vertrauenswürdiges
TLS, Datenschutzkonzept, Backup/Restore-Test und fachliche Rollenabnahme nötig.

## Rollen

Das Fundament seedet Superuser, Vorstand, Trainer, Jugendtrainer, PSG/Kinderschutz,
Vereinsarbeit/Funktionäre und Mitglied/Eltern. Rollen sind reine Sammlungen von
Permissions; Endpunkte prüfen konkrete Permissions statt Rollennamen.

## Roadmap

- Phase 1: Auth/RBAC, Mitglieder, Chat, Umfragen, Kalender, Prüfungen, Dashboard
- Phase 2: Trainerlizenzen, Einsatzplanung, Protokolle, Prüfungsvorbereitung
- Phase 3: Dokumente, Prüfungsmaterial und strukturierte Trainingspläne
- Phase 4: Sitzungen, Anträge und organisatorische Workflows

Der detaillierte, testorientierte Plan steht in
[docs/implementation-plan.md](docs/implementation-plan.md).

## Token Usage / Development Costs

Messbare OpenClaw-/Codex-Usage-Daten werden ausschließlich unter
[docs/token-usage](docs/token-usage/README.md) protokolliert. Die Metriken sind
nicht Teil der Vereins-App. Fehlende Token- oder Kostendaten werden als
`nicht verfügbar` markiert und niemals geschätzt.

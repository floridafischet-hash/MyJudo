# MyJudo

MyJudo ist eine sichere, mandantenfähige Vereinsplattform mit Schwerpunkt auf
Judo-Vereinen. Zielplattformen sind Android, iOS, Windows und Web aus einer
gemeinsamen Flutter-Codebasis. Das modulare Backend stellt Authentifizierung,
serverseitiges RBAC, Datenhaltung, Realtime-Kommunikation und Hintergrundjobs
bereit.

Das Projekt befindet sich im Aufbau. Der aktuelle Stand ist das getestete
Backend-Fundament; Fachmodule und Flutter-Client sind noch nicht als fertig zu
betrachten.

## Architektur

- Client: Flutter (geplant; Toolchain wird eingerichtet)
- Backend: NestJS/TypeScript
- Datenbank: PostgreSQL 17
- Auth: Argon2id, kurze JWT-Access-Tokens, rotierende Refresh-Sessions
- Berechtigungen: mandantenbezogenes RBAC mit explizitem PSG-Scope
- Deployment: Docker Compose hinter Nginx/TLS
- Zielroute: `https://212.227.20.171:18780`

Details stehen in [docs/architecture.md](docs/architecture.md),
[docs/permissions.md](docs/permissions.md) und
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

Der Seed ist idempotent und benötigt die `INITIAL_*`-Variablen aus
`.env.example`. Das Initialpasswort gehört ausschließlich in einen Secret Store
und muss nach dem Deployment gewechselt werden.

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
flutter build web --release --dart-define=API_BASE_URL=https://example.org/api/v1
flutter build windows --release
flutter build apk --release
```

iOS-Build und Signierung benötigen einen macOS-Runner mit Xcode. Auf Windows
benötigen Plugin-Builds aktivierten Developer Mode und die vollständige
Visual-Studio-C++-Desktop-Toolchain; Android benötigt Android Studio/SDK.

## Sicherheit

- Jede Fachaktion wird serverseitig authentifiziert und autorisiert.
- PSG-Zugriff ist nicht Bestandteil von Vorstand oder Trainer.
- Refresh-Tokens werden nur gehasht gespeichert und bei Nutzung rotiert.
- Geheimnisse, Schlüssel und Zertifikate sind durch `.gitignore` ausgeschlossen.
- Login und Registrierung sind rate-limitiert.
- Audit-Logs speichern keine Passwörter, Tokens oder Chat-Inhalte.

Vor einer produktiven Freischaltung sind Domain/öffentlich vertrauenswürdiges
TLS, Datenschutzkonzept, Backup/Restore-Test und fachliche Rollenabnahme nötig.

## Rollen

Das Fundament seedet Vorstand, Trainer, Jugendtrainer, PSG/Kinderschutz,
Vereinsarbeit/Funktionäre und Mitglied/Eltern. Rollen sind reine Sammlungen von
Permissions; Endpunkte prüfen konkrete Permissions statt Rollennamen.

## Roadmap

- Phase 1: Auth/RBAC, Mitglieder, Chat, Umfragen, Kalender, Prüfungen, Dashboard
- Phase 2: Trainerlizenzen, Einsatzplanung, Protokolle, Prüfungsvorbereitung
- Phase 3: Dokumente, Prüfungsmaterial und strukturierte Trainingspläne
- Phase 4: Sitzungen, Anträge und organisatorische Workflows

Der detaillierte, testorientierte Plan steht in
[docs/implementation-plan.md](docs/implementation-plan.md).

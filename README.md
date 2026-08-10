# MyJudo

MyJudo ist eine mandantenfähige Vereinsplattform für Android, iOS, Windows und
Web. Der aktuelle Stand umfasst lokale Anmeldung, serverseitiges RBAC,
Mitgliederverwaltung, persistente Chats, Umfragen, Kalender und Trainingszeiten.

## Architektur

- Client: Flutter
- Backend: NestJS/TypeScript
- Datenbank: PostgreSQL 17
- Authentifizierung: lokale Argon2id-Passwort-Hashes, signierte Access-Tokens
  und rotierende Refresh-Tokens
- Berechtigungen: mandantenbezogenes RBAC mit getrenntem PSG-Scope
- Deployment: Docker Compose hinter Nginx/TLS
- Produktivroute: `https://212.227.20.171:18780`

Details: [Architektur](docs/architecture.md),
[Berechtigungen](docs/permissions.md), [API](docs/api.md),
[Integrationen](docs/integrations.md) und
[Implementierungsplan](docs/implementation-plan.md).

## Entwicklung

Voraussetzungen: Node.js 22–24, npm, Flutter und Docker.

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

## Client

```bash
cd apps/client
flutter pub get
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build web --release --dart-define=API_BASE_URL=https://example.org/api/v1
```

## Sicherheit

- Jede Fachaktion wird serverseitig authentifiziert und autorisiert.
- Passwörter werden mit Argon2id plus serverseitigem Pepper gehasht.
- Refresh-Tokens werden nur als SHA-256-Hash gespeichert und bei Nutzung rotiert.
- Rollenänderungen invalidieren vorhandene Access-Tokens.
- Superuser erhalten keinen impliziten PSG-Zugriff.
- Audit-Logs enthalten keine Passwörter, Tokens oder Chat-Inhalte.

Vor einer öffentlichen produktiven Nutzung sind ein vertrauenswürdiges
TLS-Zertifikat, Datenschutzkonzept und getestetes Backup/Restore erforderlich.

## Roadmap

- Phase 1: Auth/RBAC, Mitglieder, Chat, Umfragen, Kalender, Prüfungen, Dashboard
- Phase 2: Trainerlizenzen, Einsatzplanung, Protokolle, Prüfungsvorbereitung
- Phase 3: Dokumente, Prüfungsmaterial und strukturierte Trainingspläne
- Phase 4: Sitzungen, Anträge und organisatorische Workflows

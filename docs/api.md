# API

Basispräfix: `/api/v1`

| Methode | Pfad | Auth | Zweck |
|---|---|---|---|
| `GET` | `/health` | nein | Liveness-Prüfung |
| `POST` | `/auth/register` | nein | Registrierung im Status `pending` |
| `POST` | `/auth/login` | nein | Access- und Refresh-Token für freigegebene Benutzer |
| `POST` | `/auth/refresh` | Refresh-Token | Rotiert die Session und stellt ein neues Tokenpaar aus |
| `POST` | `/auth/logout` | Refresh-Token | Widerruft die serverseitige Session idempotent |
| `GET` | `/users?status=pending` | `users.approve` | Ausstehende Benutzer des eigenen Vereins |
| `PATCH` | `/users/{id}/approve` | `users.approve` | Benutzer freigeben und auditieren |
| `PUT` | `/users/{id}/roles` | `roles.manage` | Rollen vollständig und transaktional ersetzen |
| `GET` | `/roles` | `roles.manage` | Rollen des eigenen Vereins auflisten |
| `GET` | `/members` | `members.view` | Mitglieder des eigenen Vereins auflisten |
| `POST` | `/members` | `members.create` | Mitglied anlegen |
| `PATCH` | `/members/{id}/status` | `members.status.change` | Status oder Austrittsvormerkung ändern |

Validierungsfehler liefern HTTP 400, doppelte Registrierungen HTTP 409 und
fehlgeschlagene beziehungsweise noch nicht freigegebene Anmeldungen HTTP 401.
Geschützte Fachendpunkte verwenden Bearer-Access-Tokens und liefern bei
fehlender Permission HTTP 403.

Eine generierte OpenAPI-Ausgabe wird mit den ersten Fachendpunkten ergänzt. Die
aktuell verfügbare `@nestjs/swagger`-Version wurde bewusst nicht aufgenommen,
weil ihre fest gepinnte transitive YAML-Abhängigkeit am 10. August 2026 einen
offenen High-Severity-DoS-Befund verursachte. Der Sicherheitsbefund wird nicht
durch eine ungültige Dependency-Override-Konfiguration kaschiert.

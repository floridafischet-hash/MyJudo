# API

Basispräfix: `/api/v1`

| Methode | Pfad | Auth | Zweck |
|---|---|---|---|
| `GET` | `/health` | nein | Liveness-Prüfung |
| `GET` | `/auth/me` | Keycloak Bearer-Token | Profil und effektive Permissions |
| `GET` | `/users?status=pending` | `users.approve` | Ausstehende Benutzer des eigenen Vereins |
| `PATCH` | `/users/{id}/approve` | `users.approve` | Benutzer freigeben und auditieren |
| `PUT` | `/users/{id}/roles` | `roles.manage` | Rollen transaktional ersetzen |
| `GET` | `/roles` | `roles.manage` | Rollen des eigenen Vereins auflisten |
| `GET` | `/members` | `members.view` | Suche, Filter, Sortierung und Pagination |
| `POST` | `/members` | `members.create` | Mitglied anlegen |
| `GET` | `/members/{id}` | `members.view` | Mandantengeschützte Detailansicht |
| `PATCH` | `/members/{id}` | `members.edit` | Stammdaten ändern und auditieren |
| `PATCH` | `/members/{id}/status` | `members.status.change` | Status oder Austritt ändern |
| `GET` | `/members/export.csv` | `members.export` | UTF-8-CSV exportieren und auditieren |
| `GET` | `/members/export.xlsx` | `members.export` | XLSX exportieren und auditieren |
| `POST` | `/invitations` | `users.invite` | einmaliges Einladungstoken erstellen |
| `POST` | `/invitations/{id}/revoke` | `users.invite` | Einladung widerrufen |
| `POST` | `/invitations/accept` | Keycloak-Token eines Pending-Kontos | Einladung einmalig annehmen |

Ungültige, abgelaufene, falsch ausgestellte oder nicht lokal zugeordnete
Keycloak-Tokens liefern HTTP 401. Fehlende Fach-Permissions liefern HTTP 403.

# API

Basispräfix: `/api/v1`

| Methode | Pfad | Auth | Zweck |
|---|---|---|---|
| `GET` | `/health` | nein | Liveness-Prüfung |
| `POST` | `/auth/login` | nein | Anmeldung mit Benutzername und Passwort |
| `POST` | `/auth/refresh` | Refresh-Token | Sitzung sicher rotieren |
| `POST` | `/auth/logout` | Refresh-Token | Sitzung widerrufen |
| `GET` | `/auth/me` | Bearer-Token | Profil und effektive Permissions |
| `GET` | `/users?status=pending` | `users.approve` | Ausstehende Benutzer des eigenen Vereins |
| `PATCH` | `/users/{id}/approve` | `users.approve` | Benutzer freigeben und auditieren |
| `PUT` | `/users/{id}/roles` | `roles.manage` | Rollen transaktional ersetzen |
| `GET` | `/users/directory` | `chat.general.access` | Freigegebene Personen datensparsam suchen |
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
| `POST` | `/invitations/accept` | Bearer-Token eines Pending-Kontos | Einladung einmalig annehmen |
| `GET` | `/chats` | `chat.general.access` | Sichtbare Gruppen- und Direktchats mit Ungelesen-Zähler |
| `POST` | `/chats/direct` | `chat.general.access` | Idempotenten Direktchat anlegen |
| `GET` | `/chats/{id}/messages` | aktuelle Chatberechtigung | Nachrichten cursorbasiert laden |
| `POST` | `/chats/{id}/messages` | aktuelle Chatberechtigung | Textnachricht persistent senden |
| `POST` | `/chats/{id}/read` | aktuelle Chatberechtigung | Lesestand aktualisieren |
| `GET` | `/polls` | `polls.vote` + Zielgruppe | Sichtbare Umfragen und eigene Stimme laden |
| `GET` | `/polls/{id}` | `polls.vote` + Zielgruppe | Umfrage mit erlaubter Ergebnissicht laden |
| `POST` | `/polls` | `polls.create` | Teilnahme- oder Auswahlumfrage erstellen |
| `POST` | `/polls/{id}/vote` | `polls.vote` + Zielgruppe | Stimme atomar erstellen oder ändern |
| `GET` | `/calendars` | `calendar.view` | Sichtbare Kalender mit ACL laden |
| `POST` | `/calendars` | `calendar.create` | Privaten oder Vereinskalender erstellen |
| `GET` | `/calendar-events?from=&to=` | `calendar.view` + Kalender-ACL | Termine im Zeitraum laden |
| `POST` | `/calendars/{id}/events` | `calendar.create` + Kalender-ACL | Vereinseigenen Termin erstellen |
| `PATCH` | `/calendar-events/{id}` | `calendar.edit` + Kalender-ACL | Vereinseigenen Termin ändern |
| `GET` | `/training-sessions` | `calendar.view` | Wöchentliche Trainingszeiten laden |
| `POST` | `/training-sessions` | `calendar.create` | Trainingszeit erstellen |
| `PATCH` | `/training-sessions/{id}` | `calendar.edit` | Trainingszeit ändern |
| `POST` | `/calendar-sync/njv` | `calendar.edit` | Offiziellen NJV-ICS-Import auslösen |
| `GET` | `/exams` | `exams.view` | Prüfungen mit Teilnehmenden paginiert laden |
| `POST` | `/exams` | `exams.create` | Prüfung erstellen |
| `PATCH` | `/exams/{id}` | `exams.edit` | Prüfung bearbeiten |
| `POST` | `/exams/{id}/participants` | `exams.edit` | Mitglied eindeutig zur Prüfung hinzufügen |
| `PATCH` | `/exam-participants/{id}` | `exams.edit` | Grad oder Prüfungsstatus ändern |
| `GET` | `/exams/export.csv` | `exams.export` | Prüfungsdaten als UTF-8-CSV exportieren und auditieren |
| `GET` | `/exams/export.xlsx` | `exams.export` | Prüfungsdaten als XLSX exportieren und auditieren |

Ungültige oder abgelaufene Tokens liefern HTTP 401. Fehlende Fach-Permissions liefern HTTP 403.
Nicht sichtbare oder mandantenfremde Ressourcen liefern zur Vermeidung von
IDOR/BOLA einheitlich HTTP 404.

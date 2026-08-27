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
| `POST` | `/members/import/analyze` | `roles.manage` | Makrofreie XLSX-Datei prüfen und Importvorschau erzeugen |
| `POST` | `/members/import/{id}/confirm` | `roles.manage` | Vorschau mit zeilenweisen Entscheidungen bestätigen |
| `GET` | `/members/import/history` | `roles.manage` | Importprotokoll des eigenen Vereins auflisten |
| `POST` | `/invitations` | `users.invite` | einmaliges Einladungstoken erstellen |
| `POST` | `/invitations/{id}/revoke` | `users.invite` | Einladung widerrufen |
| `POST` | `/invitations/accept` | Bearer-Token eines Pending-Kontos | Einladung einmalig annehmen |
| `GET` | `/chats` | `chat.general.access` | Sichtbare Gruppen- und Direktchats mit Ungelesen-Zähler |
| `POST` | `/chats/direct` | `chat.general.access` | Idempotenten Direktchat anlegen |
| `GET` | `/chats/{id}/messages` | aktuelle Chatberechtigung | Nachrichten cursorbasiert laden |
| `POST` | `/chats/{id}/messages` | aktuelle Chatberechtigung | Textnachricht persistent senden |
| `POST` | `/chats/{id}/read` | aktuelle Chatberechtigung | Lesestand aktualisieren |

Ungültige, abgelaufene, falsch ausgestellte oder nicht lokal zugeordnete
Ungültige oder abgelaufene Tokens liefern HTTP 401. Fehlende Fach-Permissions liefern HTTP 403.
Nicht sichtbare oder mandantenfremde Chats liefern zur Vermeidung von IDOR/BOLA
einheitlich HTTP 404.

## XLSX-Mitgliederimport

`POST /members/import/analyze` erwartet das Multipart-Feld `file`. Erlaubt
sind makrofreie XLSX-Dateien bis 10 MB. Der Parser unterstützt Shared Strings,
Inline Strings, unformatierte Tabellen und DokuMe-Tabellen mit grünen
Importspalten. Nicht mehr verwendete grüne Styles in der Arbeitsmappe lösen
keinen irrtümlichen Formatfilter aus. Nach Auswahl einer gültigen Spalte werden
deren Daten auch dann gelesen, wenn ein Tabellenprogramm die Zellformatierung
beim Export nur in der Kopfzeile erhalten hat.

Die Überschriften `Vorname` und `Nachname` sind erforderlich. Weitere deutsche
und englische Synonyme werden normalisiert zugeordnet. Datumsfelder akzeptieren
deutsche Schreibweisen, ISO-Daten und numerische Excel-Datumswerte. Die Analyse
ändert keine Mitgliedsdaten und liefert Zeilenstatus, Konflikte, Warnungen und
einmalige `rowId`-Werte zurück. Erst die Bestätigung führt die gewählten
Aktionen transaktional aus; nicht ausgewählte oder explizit übersprungene
Zeilen bleiben unverändert.

Der produktive End-to-End-Test umfasst einen realen DokuMe-Upload sowie einen
unformatierten Inline-String-Upload über die öffentliche API. Dabei wurden alle
Testzeilen erkannt, die Bestätigungsroute mit `skip` fehlerfrei abgeschlossen
und nachweislich keine Testmitglieder angelegt.

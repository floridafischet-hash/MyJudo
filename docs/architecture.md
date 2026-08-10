# Architektur

Flutter liefert Android, iOS, Windows und Web aus einer Codebasis. Das modulare
NestJS-Backend ist die Vertrauensinstanz. PostgreSQL speichert normalisierte,
mandantenbezogene Fach-, Authentifizierungs- und Auditdaten.

## Authentifizierung

- Passwörter werden ausschließlich als Argon2id-Hashes mit serverseitigem
  Pepper gespeichert.
- Das Backend stellt kurzlebige signierte Access-Tokens aus.
- Refresh-Tokens sind zufällig, nur gehasht gespeichert, rotieren bei jeder
  Verwendung und können beim Logout widerrufen werden.
- Benutzerstatus, Mandant und `authorizationVersion` werden bei jedem
  geschützten Request geprüft.
- Lokales RBAC ist alleinige Source of Truth für Rollen und Permissions.
- Superuser umfasst PSG-Zugriff nicht automatisch.

## Kommunikation

Gruppenkanäle referenzieren eine konkrete RBAC-Permission. Diese wird bei jedem
Listen-, Lese-, Schreib- und Lesestatus-Zugriff erneut serverseitig ausgewertet.
Direktchats verwenden explizite Teilnehmer. Nachrichten werden cursorbasiert
paginiert; Lesestände und Ungelesen-Zähler liegen persistent in PostgreSQL.

## Deployment

API und PostgreSQL laufen in privaten Docker-Netzen. Nginx terminiert TLS auf
Port 18780 und proxyt Web-App und API. Secrets liegen ausschließlich in der
serverseitigen Environment-Konfiguration und niemals im Repository.

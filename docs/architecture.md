# Architektur

## Client und Backend

Flutter liefert Android, iOS, Windows und Web aus einer Codebasis. Das modulare
NestJS-Backend ist die Vertrauensinstanz. PostgreSQL speichert normalisierte,
mandantenbezogene Fach- und Auditdaten. Jede fachliche Abfrage erzwingt den
`organizationId`-Scope serverseitig.

## Authentifizierung

- Keycloak ist alleinige Quelle für Passwort, Login, Reset, Identität, Tokens
  und Sessions.
- Flutter verwendet Authorization Code Flow mit PKCE S256; der öffentliche
  Client enthält kein Client Secret.
- Das Backend validiert RS256-Signatur, Issuer, Audience und Ablauf gegen die
  gecachten Keycloak-JWKS.
- Lokale Benutzer werden unveränderlich über den Keycloak-`sub`-Claim verknüpft.
- Eine neue Keycloak-Identität wird beim ersten API-Kontakt lokal nur als `pending`
  provisioniert. Fachzugriff entsteht erst nach Vorstandsfreigabe oder gültiger Einladung.
- Keycloak liefert Identität und die grobe `superuser`-Entitlement-Rolle; das
  lokale, mandantenbezogene RBAC bleibt Source of Truth für Fach-Permissions.
- Superuser-Zugriff erfordert die Keycloak-Rolle und die lokale Rolle. PSG wird
  davon nicht implizit umfasst.

## Geplante Infrastruktur

- Redis/BullMQ für idempotente Hintergrundjobs und Benachrichtigungen
- WebSockets für Realtime-Ereignisse; REST bleibt führend für Historie
- S3-kompatibler Objektspeicher mit privaten Buckets
- Firebase Cloud Messaging als gemeinsame Push-Abstraktion
- OpenAPI für die API-Dokumentation und typisierte Client-Verträge

## Realtime, Push und Offline

WebSockets verteilen nur Ereignisse mit aktuell bestätigtem Zugriff. Push-
Nutzdaten enthalten keine sensiblen Chat- oder PSG-Inhalte. Clients cachen nur
geeignete Daten und zeigen explizite Lade-, Fehler- und Retry-Zustände.

## Deployment

API, Keycloak und beide PostgreSQL-Datenbanken laufen in privaten Docker-Netzen.
Nginx terminiert TLS auf Port 18780 und proxyt Web-App, API und `/keycloak/`.
Secrets liegen serverseitig außerhalb des Repositorys.

# Keycloak

## Verantwortlichkeiten

Keycloak ist die einzige Authentifizierungsplattform. Dort liegen Benutzername,
E-Mail, Vor- und Nachname, Passwort, Passwort-Reset, Session und Tokens. Die
MyJudo-Datenbank speichert keine Passwörter oder Refresh-Tokens. Sie behält
Mitgliedsdaten und das granulare Vereins-RBAC. Die stabile Verbindung ist
`users.identityProviderSubject = Keycloak sub`; E-Mail ist keine technische ID.

## Clients und Flow

Realm: `myjudo`. Der öffentliche Client `myjudo-client` verwendet ausschließlich
Authorization Code mit PKCE S256. Direct Access Grant und Implicit Flow sind
deaktiviert. Das Backend erwartet Audience `myjudo-api` und validiert Signatur,
Issuer, Audience und Ablauf über JWKS. Es gibt kein Client Secret in Flutter.

Redirects:

- Web: `https://212.227.20.171:18780/auth.html`
- Android/iOS/Desktop: `myjudo://auth`
- lokale Webentwicklung: `http://localhost:*/auth.html`

## Rollen

Keycloak ist Source of Truth für die grobe Realm-Rolle `superuser`. MyJudo ist
Source of Truth für fachliche Rollen und Permissions. Effektive Superuser-
Rechte erfordern gleichzeitig `superuser` im validierten Keycloak-Token und die
lokale Rolle `Superuser`. Diese lokale Rolle enthält alle administrativen
Permissions außer `chat.psg.access`; PSG muss separat vergeben werden.

## Lokale Entwicklung

1. `.env.example` nach `.env` kopieren und alle Platzhalter ersetzen.
2. `docker compose up -d keycloak-postgres keycloak postgres`
3. `npm run migration:run --workspace @myjudo/api`
4. `npm run seed --workspace @myjudo/api`
5. Benutzer über die Keycloak Admin Console oder den Bootstrap anlegen.

Die Realm-Datei unter `deploy/keycloak/myjudo-realm.json` enthält keine Benutzer
oder Secrets. Der Import wird nur ausgeführt, wenn der Realm noch nicht besteht.

## Florian und Stefan bootstrappen

Der serverseitige Bootstrap legt beide Benutzer idempotent in Keycloak an,
setzt die Realm-Rolle `superuser`, korrigiert Stefan, verknüpft die `sub`-IDs mit
den bestehenden lokalen Datensätzen und weist lokal `Superuser` zu. Passwörter
werden nur als Prozess-Umgebungsvariablen übergeben:

```powershell
$env:BOOTSTRAP_FLORIAN_PASSWORD = '<aus Secret Store>'
$env:BOOTSTRAP_STEFAN_PASSWORD = '<aus Secret Store>'
npm run keycloak:bootstrap --workspace @myjudo/api
```

`KEYCLOAK_ADMIN_USERNAME` und `KEYCLOAK_ADMIN_PASSWORD` sind ebenfalls nur
serverseitige Secrets. Sie dürfen niemals an Flutter oder Git übergeben werden.

## Migration

Migration `1786371600000-KeycloakIdentity` ergänzt die eindeutige Keycloak-ID und
entfernt lokale Passwort- und Sessiondaten. Bestehende Fach-IDs und Beziehungen
bleiben erhalten. Das Deployment stellt Keycloak und seine Realm-Konfiguration
bereit, führt dann die Migration und unmittelbar danach den Bootstrap aus.

# Architektur

## Entscheidung: Flutter

Der Client wird mit Flutter entwickelt. Flutter unterstützt Android, iOS,
Windows und Web offiziell aus einer gemeinsamen Codebasis. Für die geforderte
Plattformkombination ist dies gegenüber React Native die risikoärmere Wahl:
React Native benötigt für Windows `react-native-windows`, und nicht jedes
Community-Modul unterstützt Windows. Flutter Web wird als App-Oberfläche
bereitgestellt; eine SEO-orientierte öffentliche Website wäre getrennt zu
bewerten.

## Backend

Das Backend ist ein modularer NestJS-Dienst in TypeScript. PostgreSQL ist die
führende Datenhaltung. Die API ist die einzige Vertrauensinstanz und erzwingt
Mandant, Status und Berechtigungen an jedem geschützten Endpunkt.

Geplante Infrastruktur:

- PostgreSQL für normalisierte Fach- und Auditdaten
- Redis/BullMQ für idempotente Hintergrundjobs und Benachrichtigungen
- WebSockets für Realtime-Ereignisse; REST bleibt führend für Historie
- S3-kompatibler Objektspeicher mit privaten Buckets und autorisierten Downloads
- Firebase Cloud Messaging als gemeinsame Push-Abstraktion; APNs wird über FCM
  für iOS angesprochen, plattformspezifische Tokens bleiben gekapselt
- OpenAPI für die API-Dokumentation und typisierte Client-Verträge

## Schichten

Der Client trennt Präsentation, State, Domain und Datenzugriff. Das Backend ist
nach Fachmodulen gegliedert. Module greifen nicht direkt in fremde Tabellen ein,
sondern verwenden explizite Services und Transaktionen.

Mandantenfähige Entitäten tragen eine `organization_id`. Repository- und
Service-Abfragen müssen diesen Scope immer erzwingen. Globale IDs verhindern
Kollisionen, ersetzen aber niemals die Mandantenprüfung.

## Authentifizierung

- Argon2id-Passworthashes plus separat verwalteter Pepper
- kurze signierte Access-Tokens
- rotierende, serverseitig widerrufbare Refresh-Sessions; nur Token-Hashes
  werden gespeichert
- Secure/HttpOnly/SameSite-Cookies im Web, sichere Plattformablage auf nativen
  Clients
- Login-Rate-Limit, generische Fehlermeldungen und Audit-Ereignisse
- Registrierung beginnt immer im Status `pending`

Die vorgelagerte Nginx-Basic-Authentication ist nur ein temporärer zusätzlicher
Schutz der vorbereiteten Umgebung.

## Realtime, Push und Offline

WebSockets verteilen nur Ereignisse, für die der Server den aktuellen Zugriff
bestätigt. Historie und Attachments werden über autorisierte REST-Endpunkte
geladen. Push-Nutzdaten enthalten keine sensiblen Chat- oder PSG-Inhalte.
Clients cachen nur geeignete Daten und zeigen explizite Lade-, Fehler- und
Retry-Zustände.

## Deployment

API und PostgreSQL laufen in privaten Docker-Netzen. Nur Nginx ist öffentlich.
Port 18780 terminiert TLS und wird später an das intern auf Loopback gebundene
Backend beziehungsweise den Web-Client weitergeleitet. Secrets liegen
serverseitig außerhalb des Repositorys.

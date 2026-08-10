# Priorisierter Implementierungsplan

## 1. Fundament

1. Monorepo, Formatierung, Linting, Tests und CI etablieren.
2. PostgreSQL-Konfiguration und versionierte Migrationen einführen.
3. `Organization`, `User`, `Role`, `Permission`, Zuordnungen, Sessions und
   `AuditLog` modellieren; Mandantenindizes und Constraints anlegen.
4. Registrierung (`pending`), Login, Refresh-Rotation und Logout implementieren.
5. Permission-Decorator und serverseitigen Guard implementieren.
6. Initiale Permissions und Standardrollen idempotent seeden.
7. Negative Auth-/RBAC-/Mandantentests ergänzen.
8. Flutter-Projekt mit responsiver Navigation und sicherem Session-Handling
   erstellen.
9. Registrierungs-, Login-, Pending- und Fehlerzustände verbinden.

## 2. Mitglieder

1. Mitgliedsmodell und Verknüpfung zu Benutzer/Organisation migrieren.
2. Freigabe, Einladung, Statuswechsel und Auditierung implementieren.
3. Monatsschlussregel als idempotenten, zeitzonenfesten Background Job bauen.
4. Suche, Filter, Sortierung und Cursor-Pagination implementieren.
5. CSV/XLSX-Export mit Permission und Audit-Log ergänzen.
6. API-, Monatsgrenzen-, Jahreswechsel- und negative Berechtigungstests.
7. Flutter-Listen, Detailansicht, Freigabe und Exporte anbinden.

## 3. Kommunikation und Umfragen

1. Chat-, Teilnehmer-, Nachrichten- und Attachment-Schema migrieren.
2. Objekt- und Gruppenautorisierung einschließlich PSG implementieren.
3. Gruppensynchronisation transaktional an Rollenänderungen koppeln.
4. Nachrichtenhistorie, Cursor-Pagination, unread state und WebSockets bauen.
5. Upload-Pipeline mit Signatur-/MIME-Prüfung, Limits und privatem Storage.
6. Polls, Optionen und eindeutige Upsert-Stimmen implementieren.
7. Parallelitäts-, Doppelstimmen-, PSG-Entzug- und IDOR-Tests.
8. Flutter-Chat, Direktnachrichten, Uploads und Polls anbinden.

## 4. Kalender und Training

1. Kalender, ACL, Termine und Trainingszeiten modellieren.
2. Ansichten und gefilterte Zeitbereichsabfragen implementieren.
3. Offizielle NJV-/DJB-Datenquellen verifizieren und Importadapter isolieren.
4. Quellen-ID, Upsert, Deduplizierung, Monitoring und Import-Audit ergänzen.
5. Flutter Tag/Woche/Monat/Liste responsiv implementieren.

## 5. Prüfungen und Dashboard

1. Prüfungen, Teilnehmer, Kyu/Dan und Statusworkflow migrieren.
2. RBAC, CSV/XLSX-Export und Auditierung ergänzen.
3. Rollenabhängige Dashboard-Aggregate implementieren.
4. Flutter-Prüfungsverwaltung und adaptives Dashboard verbinden.

## 6. Produktionsreife

1. Unit-, Integration-, Widget- und E2E-Suite vervollständigen.
2. OWASP-orientierte Auth-, BOLA-, Upload-, Rate-Limit- und Secret-Checks.
3. Android-, Windows-, Web- und macOS-CI/iOS-Builds etablieren.
4. Backup/Restore, Monitoring, strukturierte Logs und Runbooks testen.
5. Datenschutz-, Rollen- und Löschkonzept fachlich abnehmen lassen.

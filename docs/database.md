# Datenbank

## Einladungen

`invitations` speichert ausschließlich den SHA-256-Hash eines kryptographisch zufälligen
Tokens. Ablauf, Widerruf, Einmalverwendung, optionale E-Mail-Bindung und Zuordnung zu einer
noch freien Mitgliedsnummer werden innerhalb derselben PostgreSQL-Transaktion wie die
Benutzeranlage geprüft. Erfolgreiche Annahmen erhalten ausschließlich die Standardrolle
`Mitglied / Eltern`.

## Mitgliederabfragen

Die Mitgliederliste wird serverseitig gesucht, nach Status gefiltert, über eine feste
Whitelist sortiert und mit maximal 100 Datensätzen pro Seite paginiert. Jede Abfrage ist
zwingend auf die Organisation aus dem authentifizierten Benutzerkontext begrenzt.

PostgreSQL ist die führende Datenhaltung. Schemaänderungen erfolgen nur über
versionierte TypeORM-Migrationen; automatisches `synchronize` ist deaktiviert.

## Umfragen

`polls`, `poll_options` und `poll_votes` sind mandantenbezogen. Ein eindeutiger
Constraint auf `(pollId, userId)` erzwingt genau eine Stimme je Benutzer und
Umfrage; erneute Abstimmungen aktualisieren diese Zeile atomar. Optionen sind
positionsstabil und gehören per Fremdschlüssel zur Umfrage. Beginn und Ende
werden als `timestamptz` gespeichert und zusätzlich durch einen Datenbank-Check
auf eine gültige Reihenfolge begrenzt. Zielgruppen werden bei jeder Lese- und
Schreiboperation anhand der aktuellen Permission geprüft.

## Mitgliedschaft

`members` ist mandantenbezogen und optional mit einem Benutzerkonto verknüpft.
Mitgliedsnummern sind innerhalb eines Vereins für nicht gelöschte Datensätze
eindeutig. Unterstützte Statuswerte sind `active`, `exit_scheduled`, `former`,
`suspended` und `archived`.

Bei `exit_scheduled` ist ein Austrittsdatum durch API-Validierung und
Datenbank-Constraint verpflichtend. Ein täglicher idempotenter Job bestimmt den
Monatsanfang in der Zeitzone des Vereins. Ab dem ersten Tag des Folgemonats
wird der Status `former`, ausschließlich die Rolle `Mitglied / Eltern` wird
entzogen und die Autorisierungsversion erhöht. Weitere Rollen bleiben erhalten.
Ein PostgreSQL-Advisory-Lock verhindert parallele Verarbeitung durch mehrere
Instanzen. Jeder Übergang erzeugt genau ein Audit-Ereignis.

## Kalender und Training

`calendars` kapselt private, vereinsweite, rollenbezogene und externe Kalender.
Private Kalender sind genau einem Benutzer zugeordnet; andere Kalender können
eine aktuelle RBAC-Permission als ACL tragen. `calendar_events` wird immer über
Organisation und sichtbare Kalender begrenzt. Externe IDs sind je Quelle und
Kalender eindeutig, sodass wiederholte Importe idempotent bleiben.

`training_sessions` speichert dauerhafte wöchentliche Trainingszeiten mit
Wochentag, Uhrzeit, Halle, Ort, Alters- und Trainingsgruppe. Datenbank-Checks
erzwingen gültige Wochentage und eine Endzeit nach der Startzeit.

## Gürtelprüfungen

`exams` speichert Datum, Bezeichnung und Ort einer Prüfung. Die normalisierte
Tabelle `exam_participants` verbindet Prüfungen mit Mitgliedern und hält Zielgrad
(`kyu` oder `dan`) und Status. Ein eindeutiger Constraint verhindert doppelte
Teilnahmen desselben Mitglieds an derselben Prüfung. Ein Datenbank-Check erlaubt
nur 1.–8. Kyu beziehungsweise 1.–10. Dan. Alle Lese- und Schreibzugriffe werden
zusätzlich über die Organisation des authentifizierten Benutzers begrenzt.

# Datenbank

## Einladungen

`invitations` speichert ausschließlich den SHA-256-Hash eines kryptographisch zufälligen
Tokens. Ablauf, Widerruf, Einmalverwendung, optionale E-Mail-Bindung und Zuordnung zu einer
noch freien Mitgliedsnummer werden innerhalb derselben PostgreSQL-Transaktion wie die
Benutzeranlage geprüft. Erfolgreiche Annahmen erhalten ausschließlich die Standardrolle
`Mitglied / Eltern`.

PostgreSQL ist die führende Datenhaltung. Schemaänderungen erfolgen nur über
versionierte TypeORM-Migrationen; automatisches `synchronize` ist deaktiviert.

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

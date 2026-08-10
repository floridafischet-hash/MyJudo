# Berechtigungsmodell

MyJudo verwendet mandantenbezogenes RBAC. Benutzer erhalten Rollen; Rollen
enthalten Berechtigungen. Mehrfachrollen ergeben die Vereinigungsmenge der
aktiven Berechtigungen. Es gibt keine fachliche Autorisierung über hartcodierte
Rollennamen.

Keycloak ist Source of Truth für Identität und die grobe Realm-Rolle
`superuser`; MyJudo bleibt Source of Truth für Fachrollen und Permissions.
Superuser-Zugriff erfordert die Rolle in beiden Systemen. Die Superuser-Rolle
enthält `chat.psg.access` bewusst nicht; PSG bleibt separat geschützt.

Jeder Zugriff prüft mindestens:

1. gültige Authentifizierung und aktive Session,
2. aktiven Benutzerstatus,
3. Organisation/Mandant,
4. konkrete Permission,
5. Objektbezug und gegebenenfalls Gruppenmitgliedschaft.

PSG ist nicht implizit Teil einer Vorstand- oder Trainerrolle. Zugriff benötigt
explizite `chat.psg.access`- beziehungsweise objektspezifische Berechtigungen.
Beim Entzug werden Gruppenmitgliedschaft und laufende Realtime-Sitzungen
invalidiert. Datei-Downloads wiederholen dieselben Prüfungen und vertrauen nicht
auf eine zuvor erzeugte URL.

Die endgültige fachliche Zuordnung sensibler Mitgliedsfelder und PSG-Aktionen
zu Rollen muss vor Freischaltung dieser Module vom Verein bestätigt werden.

Rollenänderungen ersetzen die Zuordnung transaktional und erhöhen die
`authorizationVersion` des Benutzers. Bereits ausgestellte Access-Tokens sind
dadurch sofort ungültig. Freigaben und Rollenänderungen sind mandantenbegrenzt
und werden im Audit-Log protokolliert.
`users.invite` erlaubt das Erstellen und Widerrufen zeitlich begrenzter Einladungen.
Einladungstokens werden nur als SHA-256-Hash gespeichert und genau einmal akzeptiert.

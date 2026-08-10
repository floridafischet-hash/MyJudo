# Berechtigungsmodell

MyJudo verwendet mandantenbezogenes RBAC. Benutzer erhalten Rollen; Rollen
enthalten Berechtigungen. Mehrfachrollen ergeben die Vereinigungsmenge der
aktiven Berechtigungen. Es gibt keine fachliche Autorisierung über hartcodierte
Rollennamen.

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

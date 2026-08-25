# Berechtigungsmodell

MyJudo verwendet mandantenbezogenes RBAC. Benutzer erhalten Rollen; Rollen
enthalten Berechtigungen. Mehrfachrollen ergeben die Vereinigungsmenge der
aktiven Berechtigungen. MyJudo ist die alleinige Source of Truth für Identität,
Fachrollen und Permissions.

Superuser-Zugriff erfordert die lokale Rolle `Superuser`. Diese Rolle enthält
`chat.psg.access` bewusst nicht; PSG bleibt separat geschützt.

Die Einstellungen und die Benutzerverwaltung sind ausschließlich für
Superuser sichtbar. Benutzer anlegen, bearbeiten, löschen und Rollen zuweisen
werden zusätzlich serverseitig auf die Rolle `Superuser` geprüft. Die
Permission `roles.manage` allein reicht dafür ausdrücklich nicht. Das eigene
Superuser-Konto kann nicht gelöscht werden.

Jeder Zugriff prüft mindestens gültige Authentifizierung, aktiven
Benutzerstatus, Organisation/Mandant, konkrete Permission und Objektbezug.
Rollenänderungen erhöhen die `authorizationVersion`, wodurch bereits
ausgestellte Access-Tokens sofort ungültig werden.

Einladungstokens werden nur als SHA-256-Hash gespeichert, sind widerrufbar und
können genau einmal angenommen werden.

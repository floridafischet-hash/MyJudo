# Technische Bestandsaufnahme

Stand: 10. August 2026

## Repository

`floridafischet-hash/MyJudo` war beim Start ein vollständig leeres privates
GitHub-Repository ohne Commit, Quellcode, Abhängigkeiten, Tests oder
Dokumentation. Das Vorhaben ist deshalb ein Greenfield-Projekt.

Auf dem Zielserver war vor der Programmentwicklung bereits ein durch TLS und
eine eigene HTTP-Basic-Authentication geschützter Platzhalter unter
`https://212.227.20.171:18780` eingerichtet. Dieser Schutz ist eine äußere
Deployment-Schicht und ersetzt nicht die Anwendungs-Authentifizierung.

## Lokale Werkzeuge

- Node.js 24.15.0 und npm 11.12.1 vorhanden
- Git und GitHub CLI vorhanden und authentifiziert
- Docker CLI vorhanden; Docker-Desktop-Linux-Daemon nicht aktiv
- Flutter/Dart zum Zeitpunkt der Bestandsaufnahme nicht installiert
- iOS-Builds sind auf Windows technisch nicht möglich und benötigen einen
  macOS-CI-Runner mit Xcode

## Ist/Soll-Abgleich

Vor Beginn des Fundaments fehlten sämtliche Anforderungen des Master-Prompts:
Client, Backend, Datenbank, Authentifizierung, RBAC, Fachmodule, Tests, CI/CD,
Builds und Architekturdokumentation. Vorhanden waren nur das private Repository
und die vorbereitete äußere Serverroute.

Die folgenden Bereiche sind sicherheitskritisch und werden vor Fachmodulen
umgesetzt: Mandantentrennung, Authentifizierung, serverseitige Autorisierung,
PSG-Isolation, Auditierung, Upload-Prüfung und Secret-Verwaltung.

## Technische Risiken

- Breiter MVP-Umfang: Entwicklung erfolgt vertikal und phasenweise.
- Personenbezogene und besonders schützenswerte PSG-Daten erfordern eine
  belastbare fachliche Berechtigungsmatrix vor Aktivierung in Produktion.
- Flutter-Builds können lokal erst nach Installation der Toolchain geprüft
  werden; iOS benötigt zusätzlich macOS.
- Externe NJV-/DJB-Quellen sind noch nicht als stabile API/ICS bestätigt.
  Eine Integration wird erst nach dokumentierter Prüfung offizieller Quellen
  implementiert.
- Das IP-basierte TLS verwendet vorerst ein serverseitig vorhandenes
  selbstsigniertes Zertifikat. Für mobile Releases ist eine Domain mit
  öffentlich vertrauenswürdigem Zertifikat erforderlich.
- Automatisch generiertes OpenAPI ist vorübergehend blockiert, weil die aktuelle
  NestJS-Swagger-Version eine fest gepinnte verwundbare YAML-Abhängigkeit
  enthält. Die vorhandenen Foundation-Endpunkte sind bis zur sicheren
  Wiedereinführung strukturiert in `docs/api.md` dokumentiert.

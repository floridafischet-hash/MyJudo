# Externe Integrationen

## NJV-Termine

Stand der Prüfung: 10.08.2026.

Der Niedersächsische Judo-Verband bietet auf seiner offiziellen Terminseite
einen ICS-Export an. MyJudo verwendet ausschließlich den konfigurierbaren
offiziellen Export:

`https://www.njv.de/judo-kaempfen/termine-ics/calendar/ics/export/1-njv-kalender/calendar.ics?no_cache=1`

Der Server kennzeichnet die Antwort aktuell fälschlich als `text/html`, der
Inhalt ist jedoch ein gültiges `VCALENDAR`. Der Adapter prüft deshalb Status,
Größe und den tatsächlichen Inhalt statt nur den Content-Type. Ereignisse werden
über die offizielle ICS-UID dedupliziert, externe URLs auf HTTPS begrenzt und
Importe auditiert. Der tägliche Job läuft nur bei
`EXTERNAL_CALENDAR_SYNC_ENABLED=true`; ein berechtigter Administrator kann ihn
zusätzlich über die API auslösen.

## DJB-Termine

Die offizielle DJB-Terminseite stellt derzeit keine öffentlich dokumentierte
API oder ICS-Quelle bereit und weist darauf hin, dass der Kalender 2026 noch in
Planung ist. Regionale Termine werden auf zugangsgeschützte DJB-/DokuMe-Portale
verwiesen: `https://www.judobund.de/aktuelles/termine/`.

Deshalb wird kein DJB-Endpunkt erfunden und noch kein Scraper aktiviert. Der
Quellentyp `djb` ist im Datenmodell vorbereitet; eine automatische Integration
folgt erst, wenn eine belastbare offizielle strukturierte Quelle verfügbar oder
ein rechtlich und betrieblich freigegebener Adapter beschlossen ist.

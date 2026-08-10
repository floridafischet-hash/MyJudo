# Token Usage / Development Costs

Dieses Verzeichnis protokolliert ausschließlich Entwicklungsmetriken von
OpenClaw/Codex. Es ist kein Bestandteil der MyJudo-API oder Benutzeroberfläche.

`token-usage.csv` enthält pro sinnvoller Arbeitseinheit getrennte Input- und
Output-Tokens. Ein Eintrag darf nur aus strukturierten Provider-, Codex- oder
OpenClaw-Usage-Metadaten entstehen. Textlängen, Schätzungen und Beispielwerte
sind unzulässig. Der erste Eintrag stammt aus dem für diese Sitzung tatsächlich
aufgerufenen OpenClaw-`session_status` um 14:50 Uhr.

## Erfassung

Der Recorder akzeptiert ausschließlich explizite ganzzahlige Messwerte:

```powershell
$env:TOKEN_USAGE_JSON = '{"date":"2026-08-10","time":"14:50","task":"Arbeitseinheit","provider":"OpenAI","model":"openai/gpt-5.6-sol","input_tokens":382,"output_tokens":63,"source":"OpenClaw session_status"}'
npm run token-usage:record
```

Der Recorder berechnet nur die mathematische Summe der gelieferten Input- und
Output-Tokens. Er beschafft oder schätzt keine Messwerte. Codex-JSONL kann bei
nicht-interaktiven Runs ein strukturiertes `turn.completed.usage` mit
`input_tokens`, `cached_input_tokens`, `output_tokens` und
`reasoning_output_tokens` liefern; OpenClaw stellt in dieser Umgebung außerdem
eine sitzungsbezogene Statusanzeige bereit.

## Kosten und kumulierte Bilanz

Für die aktuelle OAuth-basierte OpenClaw-Sitzung wurde keine eindeutige
Dollar-Preisbasis oder API-Kostenmetrik geliefert. Deshalb stehen sämtliche
Kostenfelder ausdrücklich auf `nicht verfügbar`; es werden weder Preise noch
Kosten erfunden. Eine kumulierte Bilanz darf nur vollständig messbare Zeilen
summieren. Zeilen ohne Tokenwerte oder mit unbekannter Kostenbasis müssen
separat als unbekannt ausgewiesen werden und dürfen nicht als null gelten.

Aktuell exakt protokolliert:

- Input-Tokens: 382
- Output-Tokens: 63
- Gesamt-Tokens: 445
- Kosten: nicht verfügbar

Im Log sind keine Prompts, Passwörter, Tokens, API-Schlüssel oder vertraulichen
Vereinsdaten zulässig.

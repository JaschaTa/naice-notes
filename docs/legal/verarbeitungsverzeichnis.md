# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 Abs. 1 DSGVO)

**Dienst:** Naice Notes (naice-notes.com), kostenlose Notiz- und Listen-App, nur auf Einladung
**Angelegt:** 27.11.2026 · **Zuletzt geändert:** 27.11.2026

## Verantwortlicher

{{name}}, {{street}}, {{postcode}} {{city}}, Deutschland
E-Mail: {{email}}

(Angaben wie im Impressum; im Repo nur als Platzhalter, siehe `docs/legal/README.md`.)

Ein Datenschutzbeauftragter ist nicht benannt (keine Pflicht nach Art. 37 DSGVO, § 38 BDSG).
Zuständige Aufsichtsbehörde: Der Hamburgische Beauftragte für Datenschutz und
Informationsfreiheit.

## Auftragsverarbeiter und Empfänger (Übersicht)

| Empfänger | Rolle | Sitz | Drittland-Grundlage | Vertrag |
|---|---|---|---|---|
| Cloudflare, Inc. | Hosting Website/App (Workers) | USA | EU-US Data Privacy Framework (Art. 45) | Customer DPA v6.4 (03.04.2026), Teil der Self-Serve-Bedingungen |
| Supabase Pte. Ltd. | Datenbank, Authentifizierung, Edge Functions; Region Frankfurt (AWS) | Singapur | SCC Modul 2 (Art. 46 Abs. 2 lit. c), irisches Recht | DPA Version 1 (01.08.2026), Teil der ToS (§ 7(b)); SCC durch Annahme (DPA § 12.2) |
| OpenRouter, Inc. | Weiterleitung der Rezept-Scan-Anfragen an das KI-Modell | USA | SCC Modul 2 (DPA § 13.2), irisches Recht | DPA vom 26.08.2026, Teil der ToS (§ 10.2) |
| Google (Vertex AI) | KI-Modell (Gemini) hinter OpenRouter | Irland / USA | EU-US Data Privacy Framework (Google LLC) | über OpenRouter |
| Sendinblue SAS (Brevo) | Versand von Anmeldecodes und Einladungen (SMTP) | Frankreich, Server in der EU | SCC für Zugriffe von Gruppengesellschaften in Indien/USA | DPA = Anhang 3 der Brevo-Nutzungsbedingungen |

## Verarbeitungstätigkeiten

### 1. Bereitstellung von Website und App

- **Zweck:** Auslieferung der Website und der Web-App, Sicherheit, Abwehr von Angriffen
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO
- **Betroffene:** Besucher der Website, Nutzer der App
- **Daten:** IP-Adresse, Zeitpunkt, aufgerufene URL, Referrer, User-Agent
- **Empfänger:** Cloudflare
- **Löschung:** kurzfristig durch Cloudflare; keine eigene Auswertung oder Speicherung
- **Hinweis:** keine Cookies, kein Tracking, keine Inhalte von Dritten (Schriften selbst gehostet).
  Ausnahme: Brevo fügt E-Mails ein nicht abschaltbares Zählpixel ein (anonymer Modus, keine
  Auswertung). Noch nicht in der Datenschutzerklärung offengelegt; offener Punkt, Ablösung
  geprüft (Brevo-Support oder Scaleway).

### 2. Konto und Anmeldung

- **Zweck:** Registrierung und passwortlose Anmeldung per E-Mail-Code; Zugang nur für Eingeladene
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO; IP-Adresse Art. 6 Abs. 1 lit. f (Missbrauchsschutz)
- **Betroffene:** Nutzer
- **Daten:** E-Mail-Adresse, Nutzer-ID, Zeitpunkte von Registrierung und Anmeldung, IP-Adresse,
  Anmeldecode (kurzlebig), Sitzungstoken
- **Empfänger:** Supabase; Brevo für den Versand des Codes
- **Löschung:** bei Löschung des Kontos (auf Anfrage per E-Mail, innerhalb von 30 Tagen);
  technische Protokolle nach wenigen Tagen

### 3. Notizen und Synchronisierung

- **Zweck:** Speichern der Listen und Notizen und Abgleich zwischen den Geräten eines Nutzers
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO
- **Betroffene:** Nutzer; ggf. Dritte, die in Notizen erwähnt werden
- **Daten:** Listen (Name, Emoji, Reihenfolge), Notizen (Text, Links, Fälligkeit, Wiederholung,
  Status), Zeitstempel, Ersteller-ID; lokale Kopie im Browser (IndexedDB)
- **Empfänger:** Supabase
- **Löschung:** gelöschte Einträge werden als gelöscht markiert und spätestens nach 31 Tagen
  endgültig entfernt (nächtlicher Job `purge-tombstones`); alles Übrige bei Löschung des Kontos.
  Beim Abmelden wird die lokale Kopie gelöscht.

### 4. Geteilte Listen und Einladungen

- **Zweck:** Teilen einzelner Listen mit anderen Personen, Benachrichtigung der Eingeladenen
- **Rechtsgrundlage:** Nutzer: Art. 6 Abs. 1 lit. b; Eingeladene: Art. 6 Abs. 1 lit. f
  (Interesse des Einladenden am Teilen); Information nach Art. 14 Abs. 3 lit. b in der
  Einladungs-E-Mail
- **Betroffene:** Nutzer, eingeladene Personen
- **Daten:** E-Mail-Adresse der eingeladenen Person, einladende Person, Liste, Zeitpunkt;
  Mitglieder sehen den Inhalt der Liste und die E-Mail-Adressen der anderen Mitglieder
- **Empfänger:** Supabase; Brevo für die Einladungs-E-Mail; die anderen Mitglieder
- **Löschung:** Einladung bis zur Annahme oder bis die Liste nicht mehr geteilt bzw. gelöscht
  wird; Löschung auf Widerspruch der eingeladenen Person

### 5. Rezept-Scan (KI)

- **Zweck:** Auslesen der Zutaten von einem Rezeptfoto auf Anforderung des Nutzers
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO
- **Betroffene:** Nutzer; zufällig abgebildete Personen
- **Daten:** verkleinertes Foto (max. 1024 px); keine Nutzer-ID, E-Mail oder IP an OpenRouter
- **Empfänger:** Supabase (Edge Function), OpenRouter, Google Vertex AI
- **Löschung:** keine Speicherung von Foto oder Ergebnis; OpenRouter Zero Data Retention,
  `data_collection: deny`; Google kann Anfragen begrenzt zur Missbrauchserkennung aufbewahren.
  Protokolliert werden nur Modell, Anbieter, Token-Zahl und Erfolg.

## Technische und organisatorische Maßnahmen (Art. 32 DSGVO)

- **Zugang:** Anmeldung nur per E-Mail-Code, keine Passwörter; Registrierung nur für eingeladene
  Adressen (Auth-Hook)
- **Zugriffskontrolle:** Row Level Security auf allen Tabellen; Nutzer sehen nur eigene und
  geteilte Daten; Löschen und Einladen nur durch den Eigentümer einer geteilten Liste;
  Datenbankfunktionen prüfen den Aufrufer selbst; automatisierte Tests der Zugriffsregeln
- **Administration:** Zugriff auf Supabase, Cloudflare, OpenRouter und Brevo nur durch den
  Verantwortlichen; Schlüssel nur in nicht versionierten Dateien und als Secrets, nie im
  (öffentlichen) Repository
- **Übertragung:** durchgehend TLS
- **Speicherort:** Datenbank in der EU (Frankfurt)
- **Datensparsamkeit:** keine Analyse-Tools, keine Cookies (Ausnahme: Brevo-Zählpixel in E-Mails, s. o.); Edge Functions protokollieren nur
  Metadaten; KI-Anbieter mit Zero Data Retention
- **Löschung:** automatischer nächtlicher Purge gelöschter Einträge
- **Prüfung:** Sicherheitsreview bei jeder Änderung an Sync, Teilen, Migrationen, Edge Functions
  oder Secrets
- **Verfügbarkeit:** lokale Kopie der Notizen auf den Geräten der Nutzer

## Änderungen

| Datum | Änderung |
|---|---|
| 27.11.2026 | Verzeichnis angelegt |
| {{date}} | E-Mail-Versand von Gmail auf Brevo umgestellt |

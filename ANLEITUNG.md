# Dont annoy me! – Anleitung

Eine installierbare Web-App (PWA) für PC, Android und iPhone. Kein App Store nötig.
Alles läuft offline auf dem Handy. Es gibt keinen Server, keine Anmeldung und keine Datenbank.

## 1. Online-Adresse

**https://adri80808-max.github.io/dont-annoy-me/** (GitHub Pages, Repository `adri80808-max/dont-annoy-me`)

### Alternative: anders online stellen

Damit man die App installieren kann, muss der Ordner unter einer **https-Adresse** erreichbar sein.
Die einfachste Möglichkeit:

1. **https://app.netlify.com/drop** öffnen und kostenlos anmelden.
2. Den kompletten Ordner `Dont-annoy-me` in das Feld ziehen.
3. Du bekommst eine Adresse wie `https://irgendwas.netlify.app`. Unter *Site settings → Change site name*
   kannst du sie z. B. in `dont-annoy-me-lena.netlify.app` umbenennen.

GitHub Pages oder Cloudflare Pages gehen genauso.

## 2. Einrichten (du, der Nerver)

1. Öffne die Adresse auf **deinem** Handy und installiere die App (siehe Punkt 4).
2. Öffne die installierte App → **„Ich verschenke die App“** → Namen eintragen → **Geschenk-Code erzeugen**.
3. Mit **Link teilen** schickst du ihr den Link, z. B. per WhatsApp. Darin stehen der Code und ihr Name.

## 3. Deine Schwester

* **Android/PC:** Link öffnen → Geburtstags-Begrüßung → App installieren. Die Verbindung bleibt dabei erhalten.
* **iPhone:** Link in **Safari** öffnen → *Teilen → Zum Home-Bildschirm*. Danach die App vom Home-Bildschirm
  starten → „Ich wurde beschenkt“ → den 8-stelligen Code (z. B. `E2QO-T3KQ`) einmal eintippen.
  Grund: iOS gibt installierten Apps einen eigenen Speicher.

## 4. Installieren

| Gerät | So geht's |
|---|---|
| Android (Chrome) | Banner „Installieren“ antippen oder Menü ⋮ → *App installieren* |
| iPhone/iPad (Safari) | Teilen-Symbol □↑ → *Zum Home-Bildschirm* |
| PC (Chrome/Edge) | Installations-Symbol rechts in der Adressleiste |
| Mac (Safari) | Ablage → *Zum Dock hinzufügen* |

## So funktioniert die Bestätigung durch zwei Personen

* Sie drückt **„ER NERVT!“**. Dann hupt es, und das Eintragsfenster öffnet sich. Damit hat sie bestätigt.
* Deine App zeigt einen **4-stelligen Code, der sich jede Minute ändert**. Er wird wie bei Banking-Apps (TOTP)
  aus eurem gemeinsamen Geschenk-Code berechnet. Erst wenn sie deinen aktuellen Code eingibt, zählt der Eintrag.
  Damit hast auch du bestätigt.
* Jeder Code gilt nur einmal und nur etwa 1–2 Minuten. Ohne dich kann sie also nichts eintragen.
  Das funktioniert auch übers Telefon, und keins der Handys braucht Internet.

## Widget / Zahl am Symbol

Echte Homescreen-Widgets können Web-Apps auf Android und iPhone technisch **nicht** anlegen.
Das geht nur mit nativen Store-Apps. Stattdessen zeigt die App den Stand **als Zahl am App-Symbol**
(Badge, z. B. „7“):

* **iPhone (ab iOS 16.4) und Mac:** In der App ⚙︎ → *Stand als Zahl am App-Symbol anzeigen* → Mitteilungen erlauben.
* **Windows (Edge/Chrome):** Funktioniert automatisch in der Taskleiste.
* **Android:** Je nach Launcher erscheint nur ein Punkt statt der Zahl.

## Updates

Wenn du Dateien änderst, erhöhe in `sw.js` die Versionsnummer (`dont-annoy-me-v1` → `v2`) und lade die Änderung hoch: `git add -A`, `git commit -m "Update"`, `git push`.
Sonst behalten die Handys die alte Version im Zwischenspeicher.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Oberfläche |
| `style.css` | Design |
| `app.js` | Logik: Zähler, Codes, Glücksrad, Hupe |
| `sw.js` | Offline-Funktion |
| `manifest.webmanifest` | App-Name, Icon, Installierbarkeit |
| `icons/` | App-Symbole |

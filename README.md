# JCards

Webapp für Schweizer Kartenspiele mit 36 Jasskarten — mobile-first, dunkel, offline-fähig.
Drei Spiele: **Jass** (Schieber, Differenzler, Coiffeur), **Chratzen** und **Fuck Your Neighbour** (FYN).

| Spiel · Modus | Status | Was er macht |
|---|---|---|
| Jass · **Digital** (Multiplayer) | ✅ | Schieber, Differenzler oder Coiffeur zu viert. Trumpf ansagen und schieben, Farbzwang, Weis, Stöck und Match zählt die App. Gleicher Tisch, gleiche Wege (Code, WLAN, Bluetooth); fehlende Plätze füllen Bots. Übungstisch gegen drei Bots. |
| Chratzen · **Companion** (Kasse) | ✅ | Ihr spielt mit echten Karten und sagt am Tisch an. Die App führt **nur die Kasse**: Grundeinsatz, Pott, Ausschüttung, Bete. **Braucht keinen Server.** |
| Chratzen · **Digital** (Multiplayer) | ✅ | Raumcode oder Bluetooth, virtueller Tisch, Austeilen/Tauschen/Stechen automatisch, Wiedereinstieg per Token. |
| FYN · **Block** | ✅ | Ihr spielt mit echten Karten. Die App prüft Ansagen (Geber-Summe, nie zweimal 0), nimmt Stiche auf und zählt Punkte über 11 Runden. **Braucht keinen Server.** |
| FYN · **Digital** (Multiplayer) | ✅ | Stichansage über 11 Runden (6→1→6 Karten), ohne Trumpf, Stechen/Erben, Stirnrunde, Punkte. Gleicher Tisch, gleiche Wege (Code, WLAN, Bluetooth), Bots. |

## Jass

Zu viert, die Partner sitzen sich gegenüber (Plätze 1 + 3 gegen 2 + 4, in der Lobby
per *Partner wechseln* umzustellen). Wer beim Start fehlt, wird durch einen Bot ersetzt;
wer mitten in der Partie rausgeworfen wird, ebenfalls — sein Platz und seine Karten
bleiben, seine Sitzung ist weg.

| Variante | Ablauf | Gezählt |
|---|---|---|
| **Schieber** | Vorhand sagt Trumpf, Obenabe oder Undenufe an — oder schiebt, dann wählt der Partner. Ausspielen tut immer die Vorhand. | Beide Teams. Ziel 1000/1500/2500; wer es zuerst erreicht, bedankt sich, auch mitten in der Runde — Weis vor Stöck vor Stich. Optional gewichtet: Eichel/Rosen ×1, Schellen/Schilten ×2, Obenabe/Undenufe ×3. |
| **Differenzler** | Jeder für sich. Die letzte Karte des Gebers wird aufgedeckt, ihre Farbe ist Trumpf; die Karte bleibt beim Geber. Jeder sagt verdeckt an, wie viele Punkte er macht. | Abweichung als Strafpunkte, nach 4/8/12 Runden gewinnt die kleinste Summe. Kein Weis, Stöck zählen zu den eigenen Punkten. |
| **Coiffeur** | Wie Schieber, aber jedes Team spielt jede Spielart genau einmal: Schellen ×1, Schilten ×2, Rosen ×3, Eichel ×4, Obenabe ×5, Undenufe ×6. | Nur das ansagende Team trägt ein — Karten, Weis und Stöck mal Faktor. Nach zwölf Runden gewinnt die grössere Summe. |

- **Karten**: Trumpf Under (Puur) 20, Neuner (Nell) 14, Ass 11, Banner 10, König 4, Ober 3;
  sonst Ass 11, Banner 10, König 4, Ober 3, Under 2. Ohne Trumpf zählt der Achter 8,
  bei Undenufe tauschen Ass und Sechser. Letzter Stich +5, zusammen 157; Match +100.
- **Bedienen**: Farbe angeben oder trumpfen, trumpfen geht immer. Untertrumpfen ist
  verboten, ausser man hat nur noch Trümpfe. Bei Trumpf muss man Trumpf geben — den
  blutten Puur nicht.
- **Weisen** automatisch mit der ersten Karte: Dreiblatt 20, Vierblatt 50, Fünfblatt 100,
  jede weitere Karte +50; Vier Under 200, Vier Neuner 150, Asse/Könige/Ober/Banner 100.
  Höher ist: mehr Punkte, dann mehr Karten, dann die höhere Folge (Undenufe: die tiefere),
  dann Trumpf, dann wer früher dran ist. Nur das beste Team zählt — alle seine Weise,
  gezeigt nach dem ersten Stich. Bis dahin sieht man von den anderen nur die Punkte.
- **Stöck** (König + Ober im Trumpf) zählen 20, sobald die zweite Karte liegt.
- **Redaction**: fremde Hände und Differenzler-Ansagen verlassen den Tischwirt erst, wenn
  sie öffentlich sind — die Ansagen also erst nach der Runde.

**Bots.** Ausspielen nach Faustregeln (Trumpf ziehen, wer angesagt hat; sichere Stiche
zuerst; schmieren, wenn der Partner sicher sticht; billig überstechen; Puur und Nell nur
für fette Stiche). Für Trumpfwahl und Ansage spielen sie die Runde ein paar Dutzend Mal
mit zufällig verteilten fremden Karten durch — sie kennen nur die eigene Hand. Geschoben
wird, wenn keine Spielart im Schnitt über 104 Teampunkte bringt; durchgespielt ist das
etwa der Punkt, ab dem die Wahl des Partners im Schnitt mehr bringt. Im Differenzler sagen
sie den Median der Durchläufe an (im Schnitt rund 11 Punkte daneben). Rechenzeit am Laptop
gemessen: rund 13 ms pro Trumpfwahl, 5 ms pro Ansage — weit unter dem Bot-Takt von 800 ms.
Den Zug eines trödelnden Spielers übernimmt der Host mit derselben Logik.

## Wer führt den Tisch?

Der digitale Modus braucht genau eine Stelle, die die Verbindungen annimmt und
den Spielstand hält. Dafür gibt es zwei Wege — **dieselbe Logik, anderer Draht**:

| | Tisch auf dem Handy | Tisch auf einem Server |
|---|---|---|
| Wo | APK, Menü → Digital → *Tisch auf diesem Gerät* | Node-Prozess (Cloud, Pi, Laptop) |
| Reichweite | gleiches WLAN, Hotspot des Hosts oder Bluetooth (~10 m) | überall via Internet |
| Kosten | keine, kein Internet nötig | Hosting |
| Gäste | nur ein Browser, keine Installation — per Bluetooth die APK | nur ein Browser |
| Technik | `ChratzenHostPlugin` (Java/NanoWSD) liefert die App per HTTP aus und nimmt am selben Port WebSockets an, `ChratzenBluetoothPlugin` dasselbe per RFCOMM; `TableHost` läuft in TypeScript in der App | `server/index.ts` fährt denselben `TableHost` hinter `ws` |

Der Kern (`src/lib/host.ts`) kennt weder Node noch DOM: er bekommt Nachrichten
und gibt zurück, was an welche Verbindung geht. Deshalb gibt es die Spiellogik
nur einmal.

## Entwickeln

```bash
npm install
npm start        # Web (:5173) + Server (:3001) parallel
npm run dev      # nur Frontend — /ws wird auf :3001 geproxyt
npm run server   # nur Backend
npm test         # 171 Unit-Tests (Regeln, Engines, Bots, Tischwirt, Transport)
npm run smoke    # E2E über echte WebSockets (Server muss laufen)
npm run build    # tsc -b + vite build
npx cap sync android && cd android && ./gradlew assembleRelease   # APK
```

Nach `npm run build` liefert der Server das Frontend gleich mit aus — dann läuft
alles auf `http://localhost:3001`.

## Struktur

```
src/
  lib/money.ts        Rappen-Arithmetik, Largest-Remainder-Split
  lib/rules.ts        Chratzen-Regelwerk, rein funktional (gilt für beide Modi)
  lib/jass.ts         Jass-Engine (Schieber/Differenzler/Coiffeur) + Bots + Redaction
  lib/fyn.ts          Fuck-Your-Neighbour-Engine + Bot + Redaction
  lib/cards.ts        36er-Deck, Stichvergleich, Farbzwang
  lib/game.ts         Autoritative Engine + Redaction pro Spieler
  lib/host.ts         Tischwirt: Räume, Sitzungen, Rauswurf, Bot-Takt
  lib/bot.ts          Bot-Heuristik: ansagen, tauschen, ausspielen
  lib/protocol.ts     JSON-Nachrichten zwischen Gast und Tischwirt
  lib/transport.ts    WebSocket- und Bluetooth-Gast bzw. Host-in-der-WebView
  hooks/useCompanion  Kassen-Zustand des Companion (localStorage, Undo)
  hooks/useOnline     Verbindung, Sitzungs-Token, Auto-Reconnect
  components/         Button/Card/Segmented/Stepper, Spielkarte, Jass-Farben
  screens/            MainMenu, companion/*, digital/*
server/
  index.ts            Express + ws über TableHost, Räume im RAM, TTL 30 min
  smoke.ts            E2E-Check inkl. Verbindungsabbruch
android/
  …/ChratzenHostPlugin.java        WebSocket-Server im LAN, reine Leitung
  …/ChratzenBluetoothPlugin.java   dasselbe per Bluetooth (RFCOMM), Host und Gast
```

## Protokoll

Nacktes JSON über WebSocket — kein socket.io, damit das Handy-Plugin denselben
Draht sprechen kann. Per Bluetooth dieselben Nachrichten, eine pro Zeile.

| Gast → Tischwirt | |
|---|---|
| `{t:'create', name, ante}` | neuen Tisch eröffnen |
| `{t:'join', code, name}` | beitreten — per Bluetooth mit leerem `code`: auf dem Host-Handy steht nur ein Tisch |
| `{t:'rejoin', code, token}` | nach Abbruch zurück an den Platz |
| `{t:'start'}` | Partie starten (nur Host) |
| `{t:'blind', take}` | Blinden annehmen oder ablehnen (nur Geber) |
| `{t:'call', call}` | `kratzen` / `mitgehen` / `weiter` / `letzter` |
| `{t:'exchange', cards}` | 0–4 Karten tauschen |
| `{t:'sleeper', card}` | Schlafkarte abwerfen |
| `{t:'play', card}` | Karte ausspielen |
| `{t:'bid', bid}` | FYN: Stiche ansagen · Differenzler: Punkte ansagen |
| `{t:'trumpf', mode}` | Jass: Trumpffarbe, `obenabe`, `undenufe` oder `schieben` |
| `{t:'jassConfig', config}` | Jass: Variante, Ziel, Zählweise, Runden (nur Host, Lobby) |
| `{t:'teams'}` | Jass: anderer Partner für den ersten Platz (nur Host, Lobby) |
| `{t:'lobby'}` | Jass: nach der Partie zurück in die Lobby (nur Host) |
| `{t:'next'}` | nächste Runde (nur Host) |
| `{t:'kick', playerId}` | rauswerfen (nur Host) |
| `{t:'force'}` | hängenden Zug übernehmen (nur Host) |
| `{t:'addBot'}` | Bot dazusetzen (nur Host, nur in der Lobby) |
| `{t:'setPause', ms}` | Stichpause 0–5000 ms (nur Host) |
| `{t:'setBalances', show}` | fremde Kontostände zeigen (nur Host) |

| Tischwirt → Gast | |
|---|---|
| `{t:'joined', code, token}` | Platz und Sitzungs-Token |
| `{t:'state', code, game}` | pro Spieler redigiert — fremde Hände und Reststapel bleiben geheim |
| `{t:'error', message}` | abgelehnte Aktion |
| `{t:'kicked'}` | Sitzung entwertet |

## Geld (gilt für beide Modi)

- **Grundeinsatz** 0.50 / 1.00 / 2.00 CHF. Alle legen ein, sobald der Pott leer ist.
- **Ausschüttung nach Rolle, nicht nach Stichzahl**: der Kratzer bekommt einen
  doppelten Anteil, jeder Mitgeher einen einfachen. Wer sein Soll verfehlt,
  bekommt nichts. Stiche über dem Minimum bringen kein zusätzliches Geld — sie
  entscheiden nur über geschafft oder Bete. Rappen-genau (Largest Remainder).

  | Runde | Ausschüttung |
  |---|---|
  | Kratzer 2 Stiche, Mitgeher 1 | ⅔ : ⅓ |
  | Kratzer 2, Mitgeher 1, Mitgeher 1 | ½ : ¼ : ¼ |
  | Kratzer 2, Mitgeher 2 | ⅔ : ⅓ — trotz gleich vieler Stiche |
  | Kratzer 1, Mitgeher 2, Mitgeher 1 | 0 : ½ : ½ — Kratzer verfehlt sein Soll |
- **Bete**: Wer sein Soll verfehlt, legt nach — der **Kratzer den doppelten Pott**,
  ein Mitgeher ohne Stich den einfachen. Er riskiert damit doppelt so viel, wie er
  sich verpflichtet hat. Mehrere Verlierer zahlen nebeneinander; zusammen ergeben
  ihre Beträge den Pott der nächsten Runde.

  | Pott 3.00 | Bete | neuer Pott |
  |---|---|---|
  | Kratzer verfehlt | 6.00 | 6.00 |
  | Mitgeher ohne Stich | 3.00 | 3.00 |
  | beide zusammen | 6.00 + 3.00 | 9.00 |
- Gerechnet wird durchgehend in **Rappen als Integer** — keine Float-Rundungsfehler,
  am Ende des Abends geht die Kasse exakt auf.

## Companion: nur die Kasse

Angesagt, getauscht und gestochen wird am Tisch. Die App modelliert den Ablauf
bewusst nicht — kein Geber, kein Trumpf, keine Ansagerunde, kein Letzter, keine
Bannerrunde. Pro Runde braucht sie nur zwei Angaben pro Spieler:

- **Rolle** — raus / kratzt / mit (bestimmt die Strafschwelle: 2 bzw. 1 Stich).
  Kratzen ist exklusiv: tippst du es bei jemand anderem, fällt der bisherige
  Kratzer auf *raus* zurück.
- **Stiche** — 0 bis 4, müssen zusammen 4 ergeben

Daraus fallen Ausschüttung, Bete und der neue Pott heraus. Hat niemand gespielt
und ihr habt neu gemischt: ein Knopf, alle legen nochmals ein.

Eine gespielte Runde hat immer **genau einen Kratzer**. Fehlt er, lässt sich
nicht buchen — ohne Kratzer geht auch niemand mit, dann wurde die Runde nicht
gespielt und es geht mit *Alle legen nochmals ein* weiter. Tippst du Kratzen
bei jemand anderem an, fragt die App nach, bevor sie wechselt: sonst verschöbe
sich still Geld.

### Kasse ohne Bargeld

Gespielt wird auf Pump, abgerechnet am Schluss. Der Kasse-Tab zeigt darum zwei
Dinge:

- **Plus / Minus** — der Stand jedes Spielers, sortiert.
- **Ausgleich** — wer zahlt wem wie viel, mit möglichst wenigen Zahlungen
  (`settleUp` in `src/lib/money.ts`).

Liegt noch Geld im Pott, geht die Rechnung nicht auf null auf. Der Ausgleich
rechnet ihn deshalb gleichmässig zurück und zeigt, wie es aussähe, wenn ihr
jetzt aufhört — plus einen Knopf, das auch wirklich zu buchen.

Dazu Verlauf, manuelle Korrektur in Einsatz-Schritten und Rückgängig.

## Digitaler Modus: volle Regeln

- **Kratzen** = mind. 2 Stiche, **Mitgehen** = mind. 1 Stich, **Weiter** = aussetzen.
- Jede gespielte Runde hat **genau einen Kratzer**. Wer nach ihm dran ist, kann nur
  noch mitgehen oder passen; kratzt niemand, wird nicht gespielt sondern neu aufgedeckt.
- **Zweite Chance**: Wer *vor* dem Kratzer gepasst hat, wird nochmals gefragt — als er
  dran war, gab es ja niemanden, mit dem er hätte mitgehen können. Wer nach dem Kratzer
  gepasst hat, hatte die Wahl bereits; für ihn ist es vorbei.
- **Letzter**: ansagbar, solange schon jemand **gekratzt** hat und noch **niemand
  mitgegangen** ist — sonst gäbe es nichts abzuwarten. Das gilt auch noch in der
  zweiten Chance. **Gefragt wird er immer** — geht bis dahin niemand mit, steht ihm
  nur das Mitgehen offen; geht jemand mit, wählt er frei. Stilles Umbuchen gibt es
  nicht: verpflichtet wird niemand wortlos auf Geld. Nur einer pro Runde.
- **Alle passen**: neuer Trumpf aufdecken, max. 3×; danach neu mischen und alle legen erneut ein. Beim
  Neumischen rückt auch der **Geber** einen weiter — sonst könnte derselbe Spieler den Blinden endlos wiederholen.
- **Bannerrunde**: Trumpf ist eine 10 → Geber muss kratzen, alle anderen müssen mitgehen. Gilt nur beim
  Grundpott (Pott = Grundeinsatz × Spielerzahl); liegt schon Bete drauf, wird ganz normal angesagt.
- **Blinder**: Nur der Geber, und nur direkt nach dem Austeilen — er hat da erst den
  Trumpf gesehen. Er kratzt, ohne seine Karten zu kennen; dafür behält er die
  Trumpfkarte und bekommt vier frische dazu. Vor dem Ausspielen wirft er eine der
  fünf verdeckt ab. Tausch und Abrechnung laufen ganz normal.

  Damit „blind" nicht bloss ein Wort ist, hält der Server dem Geber seine eigene
  Hand zurück, bis er sich entschieden hat — nachschauen und dann ansagen geht nicht.
  Nach einem Trumpfwechsel entfällt das Angebot, da kennt er seine Karten längst.
- Austeilen einzeln reihum, 4 Karten; die letzte Karte des Gebers wird als Trumpf aufgedeckt.
- **Tausch** 0–4 Karten; man landet wieder bei vier. Wer seine **ganze** Hand
  tauscht, zieht eine mehr und wirft vor dem Ausspielen eine **Schlafkarte**
  verdeckt ab.

  | Hand | abgeworfen | zurück | danach |
  |---|---|---|---|
  | 4 | 2 | 2 | 4 |
  | 4 | 4 (ganze Hand) | 5 | 5 → Schlafkarte → 4 |
  | 5 (Blinder) | 3 | 2 | 4 |
  | 5 (Blinder) | 0 | 0 | 5 → Schlafkarte → 4 |
- 36 Karten, 4 Farben (Schellen, Schilten, Rosen, Eichel) à 9 Werte:
  **6, 7, 8, 9, Banner (10), Under, Ober, König, Ass** — in dieser Reihenfolge
  aufsteigend. Trumpf schlägt Farbe.
- **Bedienen oder stechen**: Wer die angespielte Farbe hat, muss sie bedienen — darf
  aber stattdessen immer **Trumpf** spielen. Ist Trumpf angespielt, gilt nur bedienen.
  Wer die Farbe nicht hat, ist frei. Kein Stichzwang und kein Verbot des
  Untertrumpfens — beides bei Bedarf in `src/lib/cards.ts`.
- **Der Kratzer eröffnet**: er tauscht zuerst und spielt den ersten Stich aus.
- **Stichpause**: ein fertiger Stich bleibt liegen (Standard 1 s), damit alle die
  letzte Karte sehen. Solange ist niemand am Zug, die stechende Karte ist markiert.
  Der Host stellt das in der Lobby oder unterwegs im Verwalten-Bereich um
  (Aus / 1 / 2 / 3 s). Die Pause gilt für den ganzen Tisch — pro Spieler ginge
  nicht, alle sehen denselben Zustand.
- Der aufgedeckte Trumpf ist die letzte Karte des Gebers und **bleibt in seiner
  Hand** — der Tisch zeigt darum an, bei wem sie liegt.

## Bots

Allein am Tisch? Der Host setzt in der Lobby Bots dazu (*Bot dazusetzen*), dann
lässt sich zu zweit starten. Bots kratzen, gehen mit, tauschen und spielen aus.
Rauswerfen geht wie bei Menschen.

Sie laufen im `TableHost`, also auf dem Host-Handy genauso wie auf dem Server.
Pro Tick (800 ms) zieht höchstens einer — so kann man ihnen zuschauen, statt
dass die Runde in einem Sprung durchrauscht.

Die Strategie (`src/lib/bot.ts`) ist eine Heuristik, kein Löser — bei vier
Karten und vier Stichen bringt Suchen wenig:

- **Ansage** nach geschätzten Stichen: hohe Trümpfe fast sicher, kleine oft, ein
  Ass manchmal. Ab ~1.8 wird gekratzt, ab 0.8 mitgegangen. Als Letzter, wenn
  sonst niemand will, reicht 1.0 — sonst wird ewig neu aufgedeckt.
- **Niemand kratzt allein**: Wer allein kratzt, räumt den Pott ab, ohne dafür
  spielen zu müssen. Darum hält immer einer dagegen — mit halber Hand über
  „Letzter" (bindet nur, wenn sonst wirklich niemand mitgeht), und spätestens
  der letzte Bot vor Menschen geht selber mit. Auf Menschen wartet er nicht: die
  dürfen passen.
- **Tausch**: Trümpfe und Könige/Asse bleiben, der Rest fliegt — die schwächsten
  Karten zuerst.
- **Ausspielen**: vorne die stärkste Karte, sonst den Stich möglichst billig
  gewinnen, und wenn er nicht zu holen ist, die schwächste Karte abwerfen.

Beim Blinden verzichten Bots grundsätzlich: bewerten könnten sie ihn nur, indem
sie in die eigene Hand schauen — genau das verbietet die Regel.

Bots werden nie Host — geht der Host offline, erbt ein Mensch. Lehnt die Engine
einen Bot-Zug einmal ab, springt eine garantiert legale Notvariante ein, damit
die Runde nicht hängen bleibt.

## Kasse (digitaler Modus)

Der **eigene Stand** steht immer unter dem Pott und öffnet angetippt die Kasse.
Dort: der eigene Stand gross, die Rangliste aller Spieler und der **Ausgleich** —
wer zahlt wem wie viel, mit möglichst wenigen Zahlungen. Ein offener Pott wird
für die Rechnung gleichmässig zurückgerechnet, wie im Companion.

Ob die Stände der anderen sichtbar sind, entscheidet der Host (Lobby oder
Verwalten-Bereich, Standard **alle sehen alles**). Verdeckt heisst wirklich
verdeckt: `redact` liefert fremde Stände dann als 0 aus, sie verlassen den
Server gar nicht erst. Der eigene Stand bleibt in jedem Fall sichtbar; ohne
Freigabe entfällt der Ausgleich, weil er alle Zahlen braucht.

## Host-Rechte (digitaler Modus)

- **Rauswerfen**: in der Lobby sofort, in laufender Partie erst zur nächsten Runde
  (mitten im Stich würden Pott und Stichzählung nicht mehr aufgehen). Die Sitzung
  des Betroffenen wird entwertet, der Token funktioniert nicht mehr.
- **Zug übernehmen**: erst freigeschaltet, wenn der Spieler am Zug offline ist oder
  länger als 30 s nicht reagiert. Erzwungen wird immer die harmlose Variante —
  passen, nicht tauschen, erste legale Karte.
- Die Host-Rolle wandert automatisch weiter, wenn der Host offline geht.
- Beim Server-Betrieb zusätzlich gegen Raum-Spam: max. 5 neue Tische pro IP und Minute.

## Tisch auf dem Handy

**Nur der Host braucht die APK.**

1. Host: APK öffnen → **Digital** → Name → *Tisch auf diesem Gerät*.
2. Die Lobby zeigt eine Adresse wie `192.168.43.1:3001` und den Raumcode.
3. Alle anderen tippen diese Adresse in einen beliebigen Browser — Android,
   iPhone, Laptop — und treten mit dem Code bei.

### Das Netz entscheidet, nicht die Distanz

Am selben Tisch zu sitzen genügt nicht. Mit reinen **Mobildaten geht es nicht**:
jedes Gerät hängt einzeln beim Provider hinter CGNAT und kann die anderen nicht
erreichen. Dann bleibt Bluetooth, siehe unten.

- **Hotspot des Hosts** — zuverlässigste Variante, kostet kein Datenvolumen und
  braucht keine Internetverbindung.
- **Gemeinsames WLAN** — geht, aber öffentliche Netze haben oft AP-Isolation und
  blockieren Gerät-zu-Gerät.

Findet die App kein lokales Netz, warnt die Lobby. Gibt es mehrere Adressen
(WLAN und Hotspot gleichzeitig), lassen sie sich dort durchschalten — der Server
lauscht auf allen.

### Technisch

`ChratzenHostPlugin` fährt einen `NanoWSD`: **HTTP und WebSocket auf einem Port**.
Über HTTP liefert es die Web-Assets aus der APK (`assets/public`) aus, deshalb
braucht kein Gast eine Installation. Die WebSocket-Nachrichten reicht es roh an
die WebView durch, die `TableHost` fährt — denselben Code wie der Node-Server.
Ein Ping alle 20 s deckt tote Verbindungen auf.

Weil die Gästeseite vom Host selbst kommt, liegt der WebSocket am gleichen
Origin — kein Mixed Content, keine Adresse zu konfigurieren. In der App gilt
zusätzlich `androidScheme: 'http'`, sonst würde die Host-WebView ihre eigene
`ws://`-Verbindung blockieren.

Der Bildschirm des Hosts bleibt an, solange der Tisch läuft. Wird die App
geschlossen, ist der Tisch weg.

### Ohne Netz: Bluetooth

Kein WLAN, kein Hotspot — etwa in der Berghütte? Dann per Bluetooth. Dafür
brauchen **alle die APK**: ein Browser kann kein Bluetooth Classic.

1. Host: Tisch eröffnen wie oben, in der Lobby **Bluetooth öffnen**. Android
   fragt nach «Geräte in der Nähe» und macht das Handy ein paar Minuten lang
   sichtbar; *Wieder sichtbar machen* verlängert.
2. Gäste: **Digital** → Name → **Per Bluetooth beitreten** → das Handy des Hosts
   antippen. Kein Code — auf dem Host-Handy steht ja nur ein Tisch.

WLAN und Bluetooth laufen gleichzeitig: ein Gast im Browser und einer per
Bluetooth sitzen am selben Tisch.

- **Bis zu 7 Gäste** — mehr Verbindungen erlaubt Bluetooth nicht, manche Handys
  schaffen weniger.
- **Keine Kopplung nötig.** Wer schon gekoppelt ist, findet den Host auch, wenn
  er nicht mehr sichtbar ist.
- **Abbrüche** (ausser Reichweite, Bluetooth kurz aus) holt die App still nach:
  sie verbindet neu und setzt den Gast an seinen Platz zurück, auch nach einem
  Neustart der App. Klappt schon der erste Versuch nicht, bleibt es bei einer
  Meldung — dann war es wohl das falsche Handy.
- Der **Gerätename** bleibt unangetastet. Die Lobby zeigt ihn an, damit die
  Gäste wissen, welches Handy sie antippen.
- Bis **Android 11** sucht Android nur mit Standort-Berechtigung und
  eingeschaltetem Standort nach Geräten — eine Vorgabe des Systems.

`ChratzenBluetoothPlugin` ist dieselbe dünne Leitung wie das WLAN-Plugin: Es
nimmt Verbindungen an (Host) oder baut eine auf (Gast) und reicht JSON-Zeilen
durch. Die Verbindungs-IDs tragen die Vorsilbe `bt:`, daran erkennt der
Host-Transport, über welches Plugin eine Antwort geht.

## Tisch auf einem Server

```bash
npm run build && npm run server
```

Ein Node-Prozess liefert Frontend und WebSockets. Braucht einen Anbieter mit
WebSocket-Support (Fly.io, Railway, Render, eigener Pi — **nicht** Vercel/Netlify).

| Variable | Default | Zweck |
|---|---|---|
| `PORT` | `3001` | Port |

## APK

GitHub Actions baut sie: Workflow **APK** manuell starten oder einen Tag `v*`
pushen. Ohne Keystore-Secrets kommt eine unsignierte APK als Artifact heraus —
zum Installieren braucht es `KEYSTORE_BASE64`, `KEY_ALIAS` und `KEYSTORE_PASSWORD`
als Repository-Secrets.

## Lizenz

GPL-3.0-or-later — siehe [LICENSE](LICENSE).

Die Kartengrafiken in `public/cards/` stammen aus
[webplatformz/challenge](https://github.com/webplatformz/challenge) (`client/images/cards/german`) —
MIT License, siehe [public/cards/LICENSE.md](public/cards/LICENSE.md).

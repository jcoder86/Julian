# Illustraties: hoe ze gemaakt zijn en hoe je ze vervangt

Alle plaatjes van de zee-kaart en van Naarden-Vesting zijn door een
beeldmodel geschilderd, aangestuurd via **Codex** (de app van
OpenAI/ChatGPT). Er staan geen tijdelijke plaatjes meer in het spel.

| Wat | Bronbestand in `assets/raw/` | Naam voor `gen_art.py` |
|---|---|---|
| De zee vanaf de stenen havenpier | `backdrop-sea.png` | `sea-backdrop` |
| Vangstscherm op de stenen kade | `catch-sea.png` | `sea-catch` |
| De vestinggracht van Naarden-Vesting | `backdrop-naarden.png` | `naarden` |
| Houten wand achter het kaart-keuzescherm | `mapselect.png` | `mapselect-bg` |
| Aas en lures voor de zee (5 x 2) | `baits-sea.png` | `sea-baits` |
| Kaart-knop (kompas) | `icon-map.png` | `icon-map` |
| De twaalf zeevissen, elk klein/middel/groot | `fish-<id>.png` | `fish-<id>` |
| Startscherm met de drie vrienden en Dirk | `start-friends.png` | `start` |
| Vangstscherm per duo en per kaart | `catch-<duo>-<kaart>.png` | `catch-julian-lake` enz. |
| De jongens, per houding | `char-<wie>-<houding>.png` | `char-julian-bite` enz. |
| Dirk (basis voor zijn filmpje) | `char-dirk.png` | `char-dirk` |
| Wolken, per kaart 2 stroken dichtbij + 2 ver weg | `clouds-<kaart>-front-1..2.png`, `clouds-<kaart>-back-1..2.png` | `clouds-lake-front-1` enz. |
| START-bord en de ronde touwlijst | `ui-start.png`, `ui-ring.png` | `ui-start`, `ui-ring` |

De opdracht per plaatje (wat er geschilderd moet worden, en welk bestaand
plaatje het model als voorbeeld voor opzet en stijl meekrijgt) staat in
`scripts/art_prompts.py`. De teksten zijn Engels, omdat beeldmodellen daar
het best op reageren.

## Een plaatje opnieuw laten maken

Nodig: de Codex-app, ingelogd met je ChatGPT-account, en Python met de
pakketten uit `scripts/requirements.txt`. Een plaatje kost een halve tot
een hele minuut.

In een terminal in de Julian-map (PowerShell of Git Bash):

```bash
python scripts/gen_art.py --list
```

toont alle namen. Eerst een probeersel maken om te bekijken, zonder iets
in het spel te veranderen:

```bash
python scripts/gen_art.py fish-shark --out-dir probeersels
```

Bevalt het resultaat, dan hetzelfde zonder `--out-dir` (dat overschrijft
het bronbestand in `assets/raw/`), of kopieer het probeersel daarheen.
Wil je iets anders zien (een andere haai, een vuurtoren op een andere
plek), pas dan eerst de tekst in `scripts/art_prompts.py` aan.

## Daarna: het plaatje in het spel zetten

Ook in een terminal in de Julian-map.

**Een vis, het aas-vel of de kaart-knop** (plaatjes op groen scherm).
Noem wat je opnieuw wilt uitsnijden, bijvoorbeeld:

```bash
python scripts/split_atlas.py fish-shark
```

of `baits-sea`, of `icon-map`; meerdere namen achter elkaar mag ook. Het
resultaat komt in `assets/clean/`. (Zonder naam snijdt het script alle
plaatjes van het spel opnieuw uit.)

**Een schilderij** (zee, Naarden, vangstscherm, houten wand):

```bash
python scripts/make_paintings.py
```

Dat maakt van de zware PNG een lichte JPEG in `assets/clean/` (ongeveer
0,5 MB in plaats van 3 MB); die laadt het spel.

**Wolken.** Die worden in de lucht van het schilderij zelf geschilderd
(een lege kopie daarvan) en er daarna weer af gehaald, zodat ze er echt
in passen: goudgeel avondlicht boven Naarden, helder wit boven zee. Na
het genereren van een strook:

```bash
python scripts/make_clouds.py lake
```

(of `sea`). Per laag worden twee verschillende stroken achter elkaar
gelegd, zodat je nooit twee keer dezelfde wolk in beeld hebt. Heb je het
schilderij van een kaart vervangen, maak dan eerst de lege lucht opnieuw
met `python scripts/make_clouds.py plates` en laat de wolken opnieuw
schilderen.

**Het START-bord of de touwlijst:**

```bash
python scripts/make_ui.py
```

```bash
python scripts/make_characters.py
```

Het eerste commando snijdt bord en lijst uit en maakt van het bord ook de
lege houten borden voor het vissenboek en de menu's. Het tweede zet de
gezichtjes in de lijst (voor de START-knoppen en de ronde knop "verder
vissen").

**Is het een nieuwe achtergrond van een kaart** (zee of Naarden), dan
moeten er nog drie dingen kloppen:

1. Het **luchtmasker**, zodat de wolken achter de bomen, de kerktoren en
   de horizon langs drijven:

   ```bash
   python scripts/make_sky_mask.py --image assets/raw/backdrop-naarden.png --out assets/clean/sky-mask-naarden.png
   ```

   (voor de zee: `backdrop-sea.png` en `sky-mask-sea.png`).
2. De **waterlijn** in `src/data/maps.js`: waar het water begint, en dus
   waar je kunt werpen. Start het spel (`npm run dev`), ga naar de kaart
   en druk op **W**: de lijn wordt over het schilderij getekend. Voor de
   zee is het één getal (`SEA_HORIZON`), voor Naarden een rijtje punten
   (`NAARDEN_WATERLINE`).

3. De **plek van Julian** (`julianAnchor` bij de kaart in
   `src/data/maps.js`): de linkeronderhoek van zijn plaatje. Dirk en de
   hengel schuiven vanzelf mee.

De **steiger of pier moet linksonder blijven**, op ongeveer dezelfde plek
en even groot. De opdrachten in `art_prompts.py` vragen daar uitdrukkelijk
om; controleer het na het genereren altijd even in het spel.

## De jongens en Dirk

Er zijn twee duo's: **Julian & Dirk** en **James & Boaz**. Elk duo heeft
een eigen startknop en een eigen vissenboek. (In de opslag heet het tweede
duo nog `guest`; zo heette de knop toen James eronder begon te sparen.)

De jongens zijn geschilderd naar hun foto's. Die foto's staan alleen op
deze computer, in `work/photos`, en gaan als voorbeeld naar ChatGPT/Codex
wanneer er een houding wordt getekend.

Elke jongen met hengel heeft negen houdingen: `ready`, `castback`,
`castfwd`, `wait`, `wait2`, `bite`, `reel`, `reel2` en `cheer`. Boaz
heeft er vier: `watch`, `look`, `point` en `cheer`. Het spel wisselt
ertussen, laat ze ademen en opspringen, en knoopt de vislijn aan de punt
van de hengel.

Een houding opnieuw laten tekenen en in het spel zetten, in een terminal
in de Julian-map:

```bash
python scripts/gen_art.py char-julian-bite
```

```bash
python scripts/make_characters.py
```

Het tweede commando snijdt alles uit en legt de houdingen van een jongen
precies op elkaar (op zijn viskist). Kijk daarna in `work/check-julian.jpg`
(of `-james`, `-boaz`): daar staan alle houdingen naast elkaar, met de
hengelpunt gemarkeerd.

**Waarom geen filmpjes van de jongens?** Veo (Google) weigert plaatjes van
levensechte kinderen te animeren. Dirk mag wel: zijn filmpje staat in
`work/veo-dirk-idle.mp4` en wordt door hetzelfde script omgezet in losse
beeldjes.

## Bewegend water

Op beide kaarten beweegt het water. Dat is een korte video van het
schilderij, gemaakt met **Veo** van Google via de Gemini-sleutel in
`.env.txt` (in de Julian-map; dat bestand komt niet in git).

In een terminal in de Julian-map:

```bash
python scripts/make_water.py sea
```

(of `lake` voor Naarden). Dat **kost geld**: ongeveer 1 dollar per keer.
Het script stuurt het onderste deel van het schilderij naar Veo, krijgt
8 seconden film terug en zet daarvan alleen het bewegende water terug in
het originele schilderij. Pier, steiger, muren en lucht blijven dus het
scherpe origineel. Het resultaat is `assets/clean/backdrop-<naam>.mp4`.

Wil je ander water (wilder of juist rustiger), pas dan de tekst bij de
kaart aan bovenin `scripts/make_water.py` en draai het opnieuw. Vraag om
rustige, gelijkmatige beweging: bij de eerste poging sloeg er elke 8
seconden een grote golf over de pier, precies waar Julian zit. Die versie
staat nog als `work/veo-sea-bigwave.mp4`.

De ruwe films van Veo (`work/veo-<kaart>.mp4`, 30 MB per stuk) blijven
alleen op deze computer staan: de map `work` komt niet in git. Zolang ze er zijn, kun je met
`python scripts/make_water.py sea --compose` gratis opnieuw samenstellen.
Er zit ook geluid in (golven, vogels) dat nog niet gebruikt wordt.

## Wat er nog niet is

- **Zee-geluid.** `assets/audio/music/sea.mp3` (golven, meeuwen, in een
  lus). Zolang dat bestand ontbreekt klinkt op zee het geluid van het meer.
- **Stemmen voor de zeevissen.** Fragmenten `small_<id>`, `medium_<id>`,
  `large_<id>` in `assets/audio/sfx/vissen.json` + `vissen.mp3`, of losse
  bestanden `assets/audio/voice/<size>-<id>.wav`. Zonder stem klinkt bij
  een vangst alleen het applaus.

## De zeevissen

Maten, aas en zeldzaamheid staan in `src/data/fish.js`.

| id | Naam | klein | middel | groot | bijt op |
|---|---|---|---|---|---|
| `herring` | Haring | 12-18 cm | 20-28 | 30-38 | veertjes |
| `whiting` | Wijting | 15-22 | 25-38 | 45-60 | zeepier, aasvisje, veertjes |
| `mackerel` | Makreel | 18-25 | 28-38 | 42-55 | aasvisje, veertjes, blinker, pilker |
| `flounder` | Bot | 12-20 | 22-32 | 38-50 | zeepier |
| `plaice` | Schol | 15-25 | 28-40 | 50-70 | zeepier |
| `garfish` | Geep | 30-45 | 50-70 | 80-95 | aasvisje, veertjes, blinker |
| `seabass` | Zeebaars | 20-35 | 40-60 | 75-95 | zeepier, aasvisje, blinker, pilker |
| `cod` | Kabeljauw | 25-40 | 50-80 | 100-130 | zeepier, aasvisje, veertjes, pilker |
| `ray` | Rog | 30-45 | 55-80 | 95-120 | zeepier, aasvisje |
| `conger` | Zeepaling | 50-80 | 100-150 | 180-230 | zeepier, aasvisje |
| `tuna` | Tonijn | 60-90 | 120-180 | 220-300 | aasvisje, blinker, pilker |
| `shark` | Haai | 80-120 | 150-210 | 260-350 | aasvisje, pilker |

De haai is de zeldzaamste vis van het hele spel.

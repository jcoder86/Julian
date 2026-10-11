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
| Wolken boven de zee, 3 stroken dichtbij + 3 ver weg | `clouds-sea-front-1..3.png`, `clouds-sea-back-1..3.png` | `clouds-sea-front-1` enz. |

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

**Een wolkenstrook** voor de zee:

```bash
python scripts/make_clouds.py
```

Dat plakt per laag drie verschillende stroken achter elkaar, zodat je
nooit twee keer dezelfde wolk in beeld hebt.

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

## Wat er nog niet is

- **Bewegend water.** Het oude meer had een video (`backdrop.mp4`); die
  hoort bij het oude schilderij en wordt niet meer gebruikt. Naarden en de
  zee zijn nu stilstaande schilderijen (de wolken drijven wel). Maak je
  met een videomodel een lus van het nieuwe schilderij (alleen het water
  beweegt, camera doodstil, ongeveer 6 seconden, naadloos herhaalbaar,
  zonder geluid), zet die dan neer als bijvoorbeeld
  `assets/raw/backdrop-naarden.mp4`; hoe je hem aansluit staat in de
  README onder "Animated backdrop".
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

# Te genereren: de lijst

Wat er aan beeld en geluid gemaakt moet worden als er vissen of kaarten
bijkomen, en hoe het ervoor staat. Nieuwe wensen komen onderaan; wat klaar
is blijft staan, met de datum erbij.

## Ronde van 12 oktober 2026: Frankrijk en de nieuwe vislijsten

Alles hieronder is op 12 oktober 2026 gemaakt en zit in het spel.

### Beeld (Codex, `python scripts/gen_art.py <naam>`)

| Wat | Naam | Klaar |
|---|---|---|
| Kaart Frankrijk: het bergmeer met drijvend ponton | `france` | ja |
| Vangstscherm Frankrijk, Julian & Dirk | `catch-julian-france` | ja |
| Vangstscherm Frankrijk, James & Boaz | `catch-guest-france` | ja |
| Wolken Frankrijk, dichtbij en ver weg | `clouds-france-front-1..2`, `clouds-france-back-1..2` | ja |
| Bewegend water Frankrijk (Veo, betaald) | `python scripts/make_water.py france` | ja |
| Zwartbekgrondel | `fish-goby` | ja |
| Schubkarper (de oude karper leek een graskarper) | `fish-carp` | ja |
| Spiegelkarper | `fish-mirrorcarp` | ja |
| Paling | `fish-eel` | ja |
| Snoek (de grote is nu een dik bakbeest) | `fish-pike` | ja |
| Riviergrondel | `fish-gudgeon` | ja |
| Elrits | `fish-minnow` | ja |
| Barbeel | `fish-barbel` | ja |
| Vlagzalm | `fish-grayling` | ja |
| Regenboogforel | `fish-rainbowtrout` | ja |
| Beekridder | `fish-char` | ja |
| Zalm | `fish-salmon` | ja |
| Steur | `fish-sturgeon` | ja |
| Haringhaai (de oude haai was een blauwe haai) | `fish-shark` | ja |

Niet opnieuw gemaakt, want het klopte al: de blauwvintonijn (het plaatje
was al een blauwvin), de bruine forel (de oude "Forel"), de grootbekbaars
(de oude "Forelbaars"), de kopvoorn en de meerval.

De spelersplaatjes van het startscherm (elk duo samen in een bol) zijn niet
geschilderd maar samengesteld uit de bestaande figuren:
`python scripts/make_characters.py badges`.

### Geluid (ElevenLabs, stem Hugo V, zie "De stem bij een vangst")

Een opname, `vissen-3`: per naam "een kleine ...!", "een ...!" en "een
grote ...!!", en daarna de kaartnamen.

| Wat | Gesproken | Klaar |
|---|---|---|
| Nieuw in Naarden-Vesting | zwartbekgrondel, spiegelkarper, paling | ja |
| Nieuw in Frankrijk | riviergrondel, elrits, barbeel, vlagzalm, regenboogforel, beekridder, zalm, steur | ja |
| Preciezere naam | schubkarper (was karper), grootbekbaars (was forelbaars), bruine forel (was forel), blauwvintonijn (was tonijn), haringhaai (was haai) | ja |
| Kaartnamen, bij het kiezen van een kaart | Naarden-Vesting, Frankrijk, Noordzee | ja |

Frankrijk gebruikt voorlopig de achtergrondgeluiden van Naarden-Vesting
(vogels, een plons, kerkklokken in de verte).

## Ronde van 12 oktober 2026 (middag): kunstaas in zoet water, ontsnapte vis

| Wat | Hoe | Klaar |
|---|---|---|
| Kunstaas voor zoet water: spinner, shad en kunstvlieg, elk hangend aan de lijn en liggend | Codex, `fresh-lures`, daarna `python scripts/split_atlas.py lures-fresh` | ja |
| Stem: "Helaas! De vis is ontsnapt!" | ElevenLabs, opname `stem-spel` | ja |

De automatische luistercontrole van deze laatste zin is niet gedaan: het
tegoed van de Gemini-sleutel was op.

## Nog te doen

Niets.

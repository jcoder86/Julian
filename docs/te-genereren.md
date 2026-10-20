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
| Snoek (de grote is zwaarder gebouwd dan de kleine, maar blijft een lange snoek; de eerste poging was te dik) | `fish-pike` | ja |
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

De automatische luistercontrole van deze laatste zin kon eerst niet (het
tegoed van de Gemini-sleutel was op) en is na het aanvullen alsnog gedaan:
verstaan zoals geschreven.

## Nog te doen

Niets.

## Ronde van 20 oktober 2026 (later): exotischer

Op verzoek ("juist de exotische uitschieters zijn het leukst"): vissen die
op andere kaarten al voorkwamen of erop leken eruit, vreemde en kleurige
erin. Alles hieronder is gemaakt en zit in het spel.

| Wat | Hoe | Klaar |
|---|---|---|
| Griekenland erbij: mediterrane papegaaivis, koraalduivel, zwaardvis | Codex, `fish-parrotfish`, `fish-lionfish`, `fish-swordfish` | ja |
| Zuidpool erbij: bijlvis, spookhaai, koningsvis, riemvis | Codex, `fish-hatchetfish`, `fish-chimaera`, `fish-opah`, `fish-oarfish` | ja |
| Zuidpool opnieuw geschilderd, naar de poster: lantaarnvis (met lantaarntje), ijsvis (glazig), draakvis (zwart, hoektanden), plundervis, rotskabeljauw (rood), tandvis | Codex, `fish-<id>` | ja |
| Stem: de zeven nieuwkomers (klein, gewoon, groot) | ElevenLabs, `vissen-7` | ja |
| Stem: "Wow! Een gigantische ...!" voor die zeven | ElevenLabs, `vissen-gigant-4` | ja |

## Ronde van 20 oktober 2026 (avond): de Zuidpool

Alles hieronder is op 20 oktober 2026 gemaakt en zit in het spel.

| Wat | Hoe | Klaar |
|---|---|---|
| Kaart Zuidpool: de rand van het ijs met een iglo en een vuurkorf, pinguins, ijsberen op een schots, ijsbergen | Codex, `antarctica` | ja |
| Vangstscherm Zuidpool, beide duo's | Codex, `catch-julian-antarctica`, `catch-guest-antarctica` | ja |
| Wolken Zuidpool | Codex, `clouds-antarctica-front-1..2`, `clouds-antarctica-back-1..2` | ja |
| Bewegend water en vuur (Veo, betaald) | `python scripts/make_water.py antarctica` | ja |
| Krill en de lichtjig | Codex, `antarctica-baits`, daarna `python scripts/split_atlas.py baits-antarctica` | ja |
| Twaalf vissen: zilvervis, lantaarnvis, makreelijsvis, ijsvis, draakvis, plundervis, puitaal, slakdolf, gemarmerde rotskabeljauw, sterrog, grenadiervis, tandvis | Codex, `fish-<id>` | ja |
| Stem: de twaalf vissen (klein, gewoon, groot) en "Zuidpool!" | ElevenLabs, `vissen-6` | ja |
| Stem: "Wow! Een gigantische ...!" voor die twaalf | ElevenLabs, `vissen-gigant-3` | ja |
| Knisperend vuur (gemengd met de Griekse golfjes), een afbrekende ijsberg | ElevenLabs Sound Effects, `ice-water`, `ice-calving` | ja |

Niet gelukt, en daarom weggelaten: pinguingeluid (kwam uit als schel
gekrijs of als geen vogel) en golfjes speciaal voor het ijs (klonken als
een fontein of als roeien).

## Ronde van 20 oktober 2026: Griekenland

Alles hieronder is op 20 oktober 2026 gemaakt en zit in het spel.

| Wat | Hoe | Klaar |
|---|---|---|
| Kaart Griekenland: de kust vanaf een kalkstenen rots, met een kaap met dennen en een witte kapel, eilanden in de verte | Codex, `greece` | ja |
| Vangstscherm Griekenland, Julian & Dirk en James & Boaz | Codex, `catch-julian-greece`, `catch-guest-greece` | ja |
| Wolken Griekenland | Codex, `clouds-greece-front-1..2`, `clouds-greece-back-1..2` | ja |
| Bewegend water Griekenland (Veo, betaald) | `python scripts/make_water.py greece` | ja |
| Garnaal, inktvis, plug en werpjig | Codex, `greece-baits`, daarna `python scripts/split_atlas.py baits-greece` | ja |
| Tien nieuwe vissen: goudbrasem, witte zeebrasem, harder, gestreepte zeebarbeel, mediterrane horsmakreel, geelstaartbarracuda, bonito, tandbrasem, amberjack, murene | Codex, `fish-<id>` | ja |
| Stem: de tien nieuwe vissen (klein, gewoon, groot) en "Griekenland!" | ElevenLabs, `vissen-5` | ja |
| Stem: "Wow! Een gigantische ...!" voor die tien | ElevenLabs, `vissen-gigant-2` | ja |
| Golfjes tegen de rotsen, cicaden | ElevenLabs Sound Effects, `greece-waves`, `greece-cicadas` | ja |

De klok van de kapel is die van Naarden-Vesting (`lake-bells`): een eigen
kapelklokje kwam bij ElevenLabs steeds uit als rinkelbelletjes.

## Ronde van 13 oktober 2026: gigantische vissen

| Wat | Hoe | Klaar |
|---|---|---|
| Stem: "Wow! Een gigantische ...!" voor alle 35 vissoorten | ElevenLabs, `python scripts/make_voice_atlas.py vissen-gigant` | ja |

Stralen, glinsteringen en de lichtveeg over een gigantische vis zijn geen
plaatjes maar worden door het spel zelf getekend (`addRays`, `addGlints` in
`src/systems/Ui.js`).

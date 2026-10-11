// Who is fishing. A team is a save profile plus the figures on the jetty:
// one boy with the rod (the "angler") and his companion (the "buddy").
//
// The pictures themselves, and how they fit together, are described by
// assets/clean/characters.json (written by scripts/make_characters.py);
// here is only what the GAME decides: who plays with whom, how tall they
// stand, and where the buddy is relative to the angler's seat.
//
// Pure data. Imports nothing, so any module can import it.

export const TEAMS = [
  {
    // Also the save profile (SaveSystem). 'julian' keeps the original,
    // un-prefixed storage keys.
    id: 'julian',
    label: 'Julian & Dirk',
    collectionTitle: "Julian's vangst",
    // `height`: design px from the top of the boy's head to the ground,
    // seated, in his "ready" pose.
    angler: { who: 'julian', height: 232 },
    // `dx`, `dy`: where the buddy's feet are, in design px from the
    // bottom-left corner of the angler's seat.
    buddy: { who: 'dirk', height: 126, dx: -64, dy: 4 },
  },
  {
    // This profile was called "guest" when it was a try-it-out button, and
    // became James's own save. The id is in his save data: it stays.
    id: 'guest',
    label: 'James & Boaz',
    collectionTitle: 'Vangst van James & Boaz',
    angler: { who: 'james', height: 262 },
    buddy: { who: 'boaz', height: 196, dx: -68, dy: 6 },
  },
];

export const TEAMS_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

/** The team for a save profile; an unknown profile plays as the first team. */
export function getTeam(profileId) {
  return TEAMS_BY_ID[profileId] || TEAMS[0];
}

// What of assets/ does NOT go to the players.
//
// Vite copies assets/ into dist/ wholesale (it is the public folder), but a
// good part of it is only the SOURCE of what the game shows: the generated
// paintings and green-screen sheets in raw/, and earlier versions of
// sprites in clean/. Two places need to know:
//
//   * scripts/prune-dist.js deletes these from dist/ after the build;
//   * vite.config.js keeps them off the service worker's list of files to
//     download for offline play (otherwise the iPad would ask the server
//     for dozens of files that are not there).

// Files in raw/ the game loads directly. Everything else in raw/ is source.
export const RAW_KEEP = ['fishon.png'];

// Files elsewhere that are not loaded any more (or never were).
export const NOT_SHIPPED = [
  'audio/sfx/plop-source.wav',
  // The single-sprite Julian and Dirk and the loose rod, from before the
  // posed characters (assets/clean/char_*.png, systems/Crew.js).
  'clean/dirk-body.png',
  'clean/dirk-head.png',
  'clean/dirk-idle.png',
  'clean/dirk-idle2.png',
  'clean/dirk-idle-sleep.png',
  'clean/julian-cast1.png',
  'clean/julian-cast2.png',
  'clean/julian-fishing.png',
  'clean/julian-fishing-with-rod.png',
  'clean/julian-idle1.png',
  'clean/julian-idle1-pre-rod-long.png',
  'clean/julian-idle2.png',
  'clean/julian-idle3.png',
  'clean/julian_dirk_fishing.png',
  'clean/julian_dirk_general.png',
  'clean/rod-long.png',
  // The rope ring by itself: only an ingredient of the framed pictures
  // (scripts/make_characters.py).
  'clean/ui-ring.png',
  // The first clouds (every map now has its own, painted into its sky).
  'clean/clouds.png',
  'clean/clouds-back.png',
  'clean/clouds-front.png',
  // The first title screen and the first lake's sky mask and waterline.
  'clean/start.png',
  'clean/sky-mask.png',
  'clean/waterline.json',
];

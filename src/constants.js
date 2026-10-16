// Pure constants. No other imports allowed in this file -- it sits at the
// bottom of the module graph so any other file can import from it without
// risking a circular dependency.

// The DESIGN FRAME: the 16:9 area every scene was originally laid out in.
// All hand-tuned positions (Julian's anchor, HUD sizes, rod offsets, ...)
// are expressed in these coordinates, so they stay valid forever.
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// The WORLD: every painting in this game (backdrop, start, catch) is 4:3.
// At the design frame's width that is 1280x960 -- the design frame sits
// in the vertical middle with a 120px band of painting above and below
// it. The Phaser canvas is world-sized and scaled to COVER the screen,
// so a 4:3 iPad shows the whole painting and any other aspect ratio
// crops it instead of letterboxing. See systems/Layout.js.
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 960;

// World edges expressed in design-frame coordinates.
export const WORLD_LEFT = 0;
export const WORLD_TOP = -(WORLD_HEIGHT - GAME_HEIGHT) / 2;   // -120
export const WORLD_RIGHT = WORLD_LEFT + WORLD_WIDTH;           // 1280
export const WORLD_BOTTOM = WORLD_TOP + WORLD_HEIGHT;          // 840

// How big a thing of one centimetre is drawn on the water at full scale --
// at the front edge of the picture (further away it shrinks with the depth
// scale of the fishing scene). Julian sits on the jetty 232 px tall, about
// 85 cm, where things are drawn at 0.83 of full scale: 3.3 px a centimetre.
// A lure, a fish under the water, a fish getting away: all of them are
// drawn to this scale, so that they keep their proportions.
export const PX_PER_CM = 3.2;

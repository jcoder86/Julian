"""
Screen keying for painted characters and buttons (stills and video frames).

    from chroma import key_green
    rgba = key_green(rgb)        # float arrays, 0..255

The screen is normally green. Something that is green itself (a green
button) is painted on a MAGENTA screen instead; which of the two it is, is
read from the picture's border.

A pixel on the edge of a figure is a mix of figure and screen. How green it
is tells how much screen is in it; that share is taken out of its colour
again, so no green (and no dark) rim is left around hair, fur or a thin
fishing rod. Well inside the figure nothing is touched at all: a green
jacket or a leaf sticker stays exactly as painted. Close to the outline
only pixels that are hardly green keep their painted colour -- wispy hair
there is half screen, and would otherwise glow green.
"""

import numpy as np
from scipy import ndimage

DEEP_PX = 10         # this far inside the outline everything is figure
RIM_PX = 3           # ...and from here inwards, whatever is hardly green
RIM_MIN_ALPHA = 0.85
FIGURE_MIN_ALPHA = 0.3


def screen_of(rgb):
    """The screen's colour: whatever the picture's outer border looks like."""
    b = 6
    border = np.concatenate([rgb[:b].reshape(-1, 3), rgb[-b:].reshape(-1, 3),
                             rgb[:, :b].reshape(-1, 3), rgb[:, -b:].reshape(-1, 3)])
    return np.median(border, axis=0)


def key_green(rgb, screen=None):
    """RGB picture on a green screen -> RGBA with straight (unmixed) colours."""
    rgb = np.asarray(rgb, dtype=np.float32)
    screen = screen_of(rgb) if screen is None else np.asarray(screen, dtype=np.float32)
    magenta = min(screen[0], screen[2]) - screen[1] > 100
    def excess_of(c):
        if magenta:                                   # how magenta
            return np.minimum(c[..., 0], c[..., 2]) - c[..., 1]
        return c[..., 1] - np.maximum(c[..., 0], c[..., 2])    # how green
    full = float(excess_of(screen))
    if full < 100:
        raise ValueError("the picture's border is neither a green nor a magenta screen")

    alpha = np.clip(1.0 - excess_of(rgb) / (full * 0.92), 0.0, 1.0)
    alpha[alpha < 0.05] = 0.0
    # Take the screen's share back out of the colour.
    safe = np.maximum(alpha, 0.08)[..., None]
    colour = np.clip((rgb - (1.0 - alpha[..., None]) * screen) / safe, 0, 255)

    # What is left of the green in such an edge pixel after that is an
    # estimate's error, not paint: cap it (half-way between "no greener than
    # red or blue" and "no greener than their average").
    if not magenta:
        r, b = colour[..., 0], colour[..., 2]
        colour[..., 1] = np.minimum(colour[..., 1], 0.5 * np.maximum(r, b) + 0.25 * (r + b))

    figure = alpha > FIGURE_MIN_ALPHA
    core = ndimage.binary_erosion(figure, iterations=DEEP_PX)
    core |= ndimage.binary_erosion(figure, iterations=RIM_PX) & (alpha > RIM_MIN_ALPHA)
    colour[core] = rgb[core]
    alpha[core] = 1.0
    return np.concatenate([colour, alpha[..., None] * 255.0], axis=-1)


def bleed(rgba):
    """
    Colour for the invisible pixels: each takes the colour of the nearest
    visible one. Needed before the colours are saved WITHOUT their alpha
    (as a JPEG): otherwise soft edges pick up whatever sat next to them.
    """
    rgba = np.asarray(rgba, dtype=np.float32)
    visible = rgba[..., 3] > 128
    if not visible.any():
        return rgba[..., :3].copy()
    idx = ndimage.distance_transform_edt(~visible, return_distances=False, return_indices=True)
    return rgba[..., :3][idx[0], idx[1]]

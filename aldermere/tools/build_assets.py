"""Build game-ready art from the generated source sheets in assets/source/.

Usage: python3 aldermere/tools/build_assets.py

Every *_gen.png source was made on a flat magenta (#FF00FF) background. This script
cuts that background out, slices each sheet on its grid, shrinks it to the size the
game draws it at, and writes the results into assets/. Re-run it after replacing a source.
"""
import os
import subprocess
from collections import deque
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', 'assets'))
SRC = os.path.join(ASSETS, 'source')


def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGBA')


def key_magenta(im, strict=False):
    """Make the magenta background transparent and clean the pink fringe around edges.

    strict keys only colours very close to #FF00FF, for art that uses saturated purples."""
    a = np.array(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    pinkness = np.minimum(r, b) - g          # high for magenta, low for real colours
    if strict:
        bg = (r > 200) & (b > 200) & (g < 70) & (np.abs(r - b) < 45)
    else:
        bg = (pinkness > 95) & (np.abs(r - b) < 110)
    out = a.copy()
    out[bg, 3] = 0
    # fringe: pixels touching the background that are still noticeably pink get pulled back
    near = np.zeros_like(bg)
    near[1:, :] |= bg[:-1, :]; near[:-1, :] |= bg[1:, :]; near[:, 1:] |= bg[:, :-1]; near[:, :-1] |= bg[:, 1:]
    if strict:
        fringe = near & ~bg & (r > 180) & (b > 180) & (g < 120)
    else:
        fringe = near & ~bg & (pinkness > 35)
    out[fringe, 3] = 0
    edge = near & ~bg & ~fringe
    # despill what remains on the edge: cap red and blue at green plus a margin
    for ch in (0, 2):
        out[..., ch] = np.where(edge & (pinkness > 10), np.minimum(out[..., ch], g + 40), out[..., ch])
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGBA')


def unmix_magenta(im, bg=(252, 2, 250)):
    """For glowing effects: treat each pixel as a blend of the effect and the magenta background and recover both.

    Alpha is the least coverage that explains the pixel; colour is what remains once the background share is removed."""
    a = np.array(im.convert('RGB')).astype(float)
    m = np.array(bg, float)
    hi = np.where(a > m, (a - m) / np.maximum(255 - m, 1), 0)
    lo = np.where(a < m, (m - a) / np.maximum(m, 1), 0)
    alpha = np.clip(np.maximum(hi, lo).max(2), 0, 1)
    rgb = (a - (1 - alpha[..., None]) * m) / np.maximum(alpha[..., None], 1e-3)
    out = np.concatenate([np.clip(rgb, 0, 255), alpha[..., None] * 255], 2)
    # faint pixels whose colour still reads as magenta are background noise, not glow
    tint = (rgb[..., 0] > rgb[..., 1] + 60) & (rgb[..., 2] > rgb[..., 1] + 60)
    out[(alpha < .22) | (tint & (alpha < .55))] = 0
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def fit_bottom(cell, size, pad=6):
    """Trim a cell to its art and centre it on a square canvas, standing on the bottom edge."""
    box = cell.getchannel('A').getbbox()
    if not box:
        return Image.new('RGBA', (size, size))
    art = cell.crop(box)
    side = max(art.width, art.height) + pad * 2
    sq = Image.new('RGBA', (side, side))
    sq.paste(art, ((side - art.width) // 2, side - art.height - pad))
    return shrink(sq, (size, size))


def recolour_gem(icon, hue):
    """Turn the blue gem of a ring icon another colour (hue in degrees), leaving the metal alone."""
    hsv = np.array(icon.convert('RGB').convert('HSV')).astype(int)
    rgb = np.array(icon.convert('RGB')).astype(int)
    gem = (rgb[..., 2] > rgb[..., 0] + 40) & (rgb[..., 2] > rgb[..., 1] + 15)
    hsv[..., 0] = np.where(gem, hue * 255 // 360, hsv[..., 0])
    out = Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGBA')
    out.putalpha(icon.getchannel('A'))
    return out


def shrink(im, size):
    """Premultiplied box downscale with hard alpha, so edges stay crisp."""
    arr = np.array(im).astype(float)
    al = arr[..., 3:4] / 255
    pm = np.concatenate([arr[..., :3] * al, arr[..., 3:4]], 2).astype(np.uint8)
    small = np.array(Image.fromarray(pm, 'RGBA').resize(size, Image.BOX)).astype(float)
    a = small[..., 3]
    rgb = np.where(a[..., None] > 0, small[..., :3] / np.maximum(a[..., None], 1) * 255, 0)
    out = np.zeros(small.shape, np.uint8)
    keep = a > 100
    out[keep, :3] = np.clip(rgb[keep], 0, 255)
    out[keep, 3] = 255
    return Image.fromarray(out, 'RGBA')


def label(mask):
    """4-connected component labels of a boolean mask (0 = background)."""
    lab = np.zeros(mask.shape, int)
    h, w = mask.shape
    n = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n += 1
        lab[y0, x0] = n
        todo = deque([(y0, x0)])
        while todo:
            y, x = todo.popleft()
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n
                    todo.append((ny, nx))
    return lab, n


def foe_rows(im, rows, cols):
    """Split a foe sheet into its poses: rows x cols groups of pixels, one group per pose.

    Blobs are found on a quarter-size mask (so specks a few pixels apart join up) and given to the row
    their centre falls in. Each row's cols heaviest blobs are the bodies; every other blob joins the
    nearest body to its left, since attacks and spells fly to the right."""
    a = np.array(im)
    opaque = a[..., 3] > 0
    q = 4
    h, w = opaque.shape[0] // q, opaque.shape[1] // q
    small = opaque[:h * q, :w * q].reshape(h, q, w, q).any((1, 3))
    grown = small.copy()
    grown[1:] |= small[:-1]; grown[:-1] |= small[1:]; grown[:, 1:] |= small[:, :-1]; grown[:, :-1] |= small[:, 1:]
    lab, n = label(grown)
    full = np.kron(lab, np.ones((q, q), int))
    full = np.pad(full, ((0, opaque.shape[0] - full.shape[0]), (0, opaque.shape[1] - full.shape[1])))
    full[~opaque] = 0
    blobs = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(full == i)
        if len(ys):
            blobs.append({'id': i, 'mass': len(ys), 'cx': (xs.min() + xs.max()) / 2, 'cy': (ys.min() + ys.max()) / 2,
                          'x0': xs.min(), 'x1': xs.max() + 1, 'y1': ys.max() + 1})
    band = im.height / rows
    out = []
    for r in range(rows):
        row = [b for b in blobs if int(b['cy'] // band) == r]
        bodies = sorted(sorted(row, key=lambda b: -b['mass'])[:cols], key=lambda b: b['cx'])
        if len(bodies) < cols:
            raise SystemExit(f'row {r + 1}: found {len(bodies)} poses, expected {cols}')
        groups = [[b['id']] for b in bodies]
        for b in row:
            if b in bodies:
                continue
            left = [i for i, body in enumerate(bodies) if body['cx'] <= b['cx']]
            k = left[-1] if left else 0
            groups[k].append(b['id'])
        out.append([(np.where(np.isin(full, g)[..., None], a, 0).astype(np.uint8), body) for g, body in zip(groups, bodies)])
    return out


def foe_frames(poses, window, size):
    """Crop one foe's poses to square frames centred on the body, sharing the row's lowest baseline."""
    base = max(body['y1'] for _, body in poses) + 4
    frames = []
    for pix, body in poses:
        cx = int((body['x0'] + body['x1']) / 2)
        frames.append(shrink(Image.fromarray(pix, 'RGBA').crop((cx - window // 2, base - window, cx + window // 2, base)), (size, size)))
    return frames


def cells(im, cols, rows):
    w, h = im.width // cols, im.height // rows
    return [[im.crop((c * w, r * h, (c + 1) * w, (r + 1) * h)) for c in range(cols)] for r in range(rows)]


def save(im, name):
    path = os.path.join(ASSETS, name)
    im.save(path, optimize=True)
    print(f'wrote {name} {im.width}x{im.height}')


def bbox_crop(im, pad=4):
    box = im.getchannel('A').getbbox()
    x0, y0, x1, y1 = box
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def build():
    # Window frame: 9-slice, 192x192 with 32px corners
    win = key_magenta(load('ui_window_gen.png'))
    save(shrink(bbox_crop(win, 0), (192, 192)), 'ui_window.png')

    # Icons: 6x4 grid -> 48px cells
    icons = key_magenta(load('icons_gen.png'))
    sheet = Image.new('RGBA', (48 * 6, 48 * 4))
    for r, row in enumerate(cells(icons, 6, 4)):
        for c, cell in enumerate(row):
            sheet.paste(shrink(cell, (48, 48)), (c * 48, r * 48))
    save(sheet, 'icons.png')

    # House crests: 2x2 grid -> one row of 4 x 96px (ember, tide, thorn, gale)
    crests = key_magenta(load('crests_gen.png'))
    grid = cells(crests, 2, 2)
    row = Image.new('RGBA', (96 * 4, 96))
    for i, cell in enumerate([grid[0][0], grid[0][1], grid[1][0], grid[1][1]]):
        row.paste(shrink(cell, (96, 96)), (i * 96, 0))
    save(row, 'crests.png')

    # Portraits: 2x2 grid -> one row of 4 x 128px (neutral, happy, shocked, sad).
    # The background stays transparent; the dialogue box draws its own backdrop.
    for who in PORTRAITS:
        src = key_magenta(load(f'portrait_{who}_gen.png'))
        grid = cells(src, 2, 2)
        row = Image.new('RGBA', (128 * 4, 128))
        for i, cell in enumerate([grid[0][0], grid[0][1], grid[1][0], grid[1][1]]):
            row.paste(shrink(cell, (128, 128)), (i * 128, 0))
        save(row, f'portrait_{who}.png')

    # Title background: 960x540 to match the canvas
    save(load('title_bg_gen.png').convert('RGB').resize((960, 540), Image.LANCZOS).convert('RGBA'), 'title_bg.png')

    # Logo: trimmed, 720px wide
    logo = bbox_crop(key_magenta(load('logo_gen.png')))
    save(shrink(logo, (720, round(720 * logo.height / logo.width))), 'logo.png')

    # Touch buttons: 2x2 grid -> separate images at 2x their on-screen size
    btn = key_magenta(load('buttons_gen.png'))
    grid = cells(btn, 2, 2)
    for cell, name, w in ((grid[0][0], 'btn_dpad.png', 320), (grid[0][1], 'btn_a.png', 128), (grid[1][0], 'btn_b.png', 128), (grid[1][1], 'btn_menu.png', 176)):
        c = bbox_crop(cell, 2)
        save(shrink(c, (w, round(w * c.height / c.width))), name)

    # Tileset: 6x4 grid -> 32px tiles; the fountain also gets its own 64px image (drawn across 2x2 tiles)
    tiles = key_magenta(load('tiles_gen.png'))
    grid = cells(tiles, 6, 4)
    sheet = Image.new('RGBA', (32 * 6, 32 * 4))
    for r, row in enumerate(grid):
        for c, cell in enumerate(row):
            sheet.paste(shrink(cell, (32, 32)), (c * 32, r * 32))
    save(sheet, 'tiles.png')
    save(shrink(grid[2][5], (64, 64)), 'tile_fountain.png')

    # Mira walking sheet: key the background, then the same cleanup as the hero sheet
    mira = key_magenta(load('mira_field_gen.png'))
    tmp = os.path.join(SRC, '_mira_keyed.png')
    mira.save(tmp)
    subprocess.run([sys.executable, os.path.join(HERE, 'process_sheet.py'), tmp, os.path.join(ASSETS, 'mira_field.png')], check=True)
    os.remove(tmp)

    # NPC walking sheets: same layout and cleanup as the hero sheet
    for who in NPCS:
        keyed = key_magenta(load(f'npc_{who}_gen.png'))
        tmp = os.path.join(SRC, f'_npc_{who}_keyed.png')
        keyed.save(tmp)
        subprocess.run([sys.executable, os.path.join(HERE, 'process_sheet.py'), tmp, os.path.join(ASSETS, f'npc_{who}.png')], check=True)
        os.remove(tmp)

    # Enemy sheets: each row of a 6x4 source is one foe (poses 1-4 idle, 5-6 attack).
    # Game layout is 4x2: row 1 idle x4; row 2 attack 1, attack 2, attack 2 held, then hurt (the first idle pose; the game flashes it).
    for sheet, arts in FOE_SHEETS.items():
        for poses, art in zip(foe_rows(key_magenta(load(sheet), strict=True), 4, 6), arts):
            big = art in BIG_FOES
            f = 96 if big else 64
            frames = foe_frames(poses, 288 if big else 256, f)
            out = Image.new('RGBA', (f * 4, f * 2))
            for i, fr in enumerate(frames[:4] + [frames[4], frames[5], frames[5], frames[0]]):
                out.paste(fr, ((i % 4) * f, (i // 4) * f))
            save(out, f'foe_{art}.png')

    # The Warden: 3x2 source (3 idle poses; 2 attack poses and a hurt pose) -> the usual 4x2 layout, 128px frames
    (idle, act) = [foe_frames(row, 512, 128) for row in foe_rows(key_magenta(load('foe_warden_gen.png'), strict=True), 2, 3)]
    out = Image.new('RGBA', (128 * 4, 128 * 2))
    for i, fr in enumerate([idle[0], idle[1], idle[2], idle[1], act[0], act[1], act[1], act[2]]):
        out.paste(fr, ((i % 4) * 128, (i // 4) * 128))
    save(out, 'foe_warden.png')

    # Familiars: 4x4 source, one familiar per row (2 idle poses, 2 moving poses) -> fam_<id>.png, 4 frames of 40px
    for row, fam in zip(cells(key_magenta(load('familiars_gen.png'), strict=True), 4, 4), ('cat', 'rabbit', 'owl', 'sprout')):
        strip = Image.new('RGBA', (40 * 4, 40))
        box = None
        for c in row:  # one shared crop per familiar so the poses keep their size and footing
            b = c.getchannel('A').getbbox()
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        side = max(box[2] - box[0], box[3] - box[1]) + 8
        for i, c in enumerate(row):
            cx = (box[0] + box[2]) // 2
            strip.paste(shrink(c.crop((cx - side // 2, box[3] + 4 - side, cx + side // 2, box[3] + 4)), (40, 40)), (i * 40, 0))
        save(strip, f'fam_{fam}.png')

    # Props: 6x4 source -> prop_<Name>.png, 64px, standing on the bottom edge
    for row, names in zip(cells(key_magenta(load('props_gen.png'), strict=True), 6, 4), PROPS):
        for c, name in zip(row, names):
            save(fit_bottom(c, 64), f'prop_{name}.png')

    # Spell effects: 8x4 sources, one 8-frame animation per row -> fx_<Name>.png, 8 frames of 96px
    for sheet, names in FX_SHEETS.items():
        src = unmix_magenta(load(sheet))
        cw, ch = src.width / 8, src.height / 4
        for r, name in enumerate(names):
            strip = Image.new('RGBA', (96 * 8, 96))
            for c in range(8):
                cx, cy = (c + .5) * cw, (r + .5) * ch
                strip.paste(shrink(src.crop((int(cx - ch / 2), int(cy - ch / 2), int(cx + ch / 2), int(cy + ch / 2))), (96, 96)), (c * 96, 0))
            save(strip, f'fx_{name}.png')

    # Equipment icons: 6x4 source -> gear48.png (order in GEAR_ICONS in index.html), plus recoloured rings
    grid = cells(key_magenta(load('gear_gen.png'), strict=True), 6, 4)
    icons = [fit_bottom(c, 48, pad=10) for row in grid for c in row]
    icons += [recolour_gem(icons[12], 350), recolour_gem(icons[12], 280), recolour_gem(icons[17], 355)]  # ruby ring, amethyst ring, duel medal
    sheet = Image.new('RGBA', (48 * 6, 48 * 5))
    for i, ic in enumerate(icons):
        sheet.paste(ic, ((i % 6) * 48, (i // 6) * 48))
    save(sheet, 'gear48.png')


PORTRAITS = ('hero', 'mira', 'thorne', 'brannoch', 'quillon', 'aldous', 'pell', 'juniper', 'tobias', 'ghost', 'hob', 'cassius', 'chef', 'bryony', 'warden', 'nurse')
NPCS = ('aldous', 'thorne', 'brannoch', 'quillon', 'pell', 'juniper', 'tobias', 'ghost', 'hob', 'cassius', 'chef', 'bryony')
# Source sheet -> foe art id for each of its four rows
FOE_SHEETS = {
    'foes_a_gen.png': ('dummy', 'imp', 'broom', 'wisp'),
    'foes_b_gen.png': ('toad', 'slime', 'emberslime', 'moth'),
    'foes_c_gen.png': ('shroom', 'gargoyle', 'shade', 'scarab'),
    'foes_d_gen.png': ('bone', 'apprentice', 'cgolem', 'echo'),
}
PROPS = (('Treasure_Chest', 'Treasure_Chest_Open', 'Student_Bed', 'Nightstand', 'Bulletin_Board', 'Magic_Mirror'),
         ('Wood_Desk', 'Study_Chair', 'Potion_Shelf', 'Cauldron', 'Royal_Banner', 'Wishing_Well'),
         ('Astrolabe', 'Grand_Globe', 'Spell_Altar', 'Stained_Glass', 'Academy_Flag', 'Duel_Arena_Glyph'),
         ('Lantern', 'Book_Stack', 'Crystal_Ball', 'Potted_Plant', 'Barrel', 'Scroll_Rack'))
FX_SHEETS = {
    'fx_a_gen.png': ('Fire_Burst', 'Water_Splash', 'Nature_Bloom', 'Wind_Slash'),
    'fx_b_gen.png': ('Arcane_Rune', 'Star_Shower', 'Dark_Pulse', 'Time_Stop'),
    'fx_c_gen.png': ('Healing_Aura', 'Haste', 'Familiar_Summon', 'Barrier'),
}
BIG_FOES = {'gargoyle', 'shade', 'bone', 'apprentice', 'cgolem', 'echo'}


if __name__ == '__main__':
    build()

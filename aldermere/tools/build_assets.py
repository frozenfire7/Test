"""Build game-ready art from the generated source sheets in assets/source/.

Usage: python3 aldermere/tools/build_assets.py

Every *_gen.png source was made on a flat magenta (#FF00FF) background. This script
cuts that background out, slices each sheet on its grid, shrinks it to the size the
game draws it at, and writes the results into assets/. Re-run it after replacing a source.
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', 'assets'))
SRC = os.path.join(ASSETS, 'source')


def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGBA')


def key_magenta(im):
    """Make the magenta background transparent and clean the pink fringe around edges."""
    a = np.array(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    pinkness = np.minimum(r, b) - g          # high for magenta, low for real colours
    bg = (pinkness > 95) & (np.abs(r - b) < 110)
    out = a.copy()
    out[bg, 3] = 0
    # fringe: pixels touching the background that are still noticeably pink get pulled back
    near = np.zeros_like(bg)
    near[1:, :] |= bg[:-1, :]; near[:-1, :] |= bg[1:, :]; near[:, 1:] |= bg[:, :-1]; near[:, :-1] |= bg[:, 1:]
    fringe = near & ~bg & (pinkness > 35)
    out[fringe, 3] = 0
    edge = near & ~bg & ~fringe
    # despill what remains on the edge: cap red and blue at green plus a margin
    for ch in (0, 2):
        out[..., ch] = np.where(edge & (pinkness > 10), np.minimum(out[..., ch], g + 40), out[..., ch])
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGBA')


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
    for who in ('hero', 'mira', 'thorne', 'brannoch', 'quillon'):
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


if __name__ == '__main__':
    build()

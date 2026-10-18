"""Turn an AI-generated character sheet into a game-ready sprite sheet.

Usage: python3 process_sheet.py SOURCE.png OUT.png [--cols 6] [--rows 4] [--frame 64] [--window 224]

The source must have a transparent background and evenly spaced poses.
Each pose is found by its opaque pixels, aligned on its feet and body centre
(so a flowing cape does not shift it), cropped to a square window, shrunk to
--frame pixels, given hard alpha edges, and limited to a small colour set.
"""
import argparse

import numpy as np
from PIL import Image, ImageEnhance


def bands(mask_1d):
    """Return (start, end) runs of True values."""
    out, start = [], None
    for i, v in enumerate(mask_1d):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(mask_1d)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('out')
    ap.add_argument('--cols', type=int, default=6)
    ap.add_argument('--rows', type=int, default=4)
    ap.add_argument('--frame', type=int, default=64)
    ap.add_argument('--window', type=int, default=224)
    ap.add_argument('--colors', type=int, default=40)
    args = ap.parse_args()

    im = Image.open(args.src).convert('RGBA')
    opaque = np.array(im)[..., 3] > 128
    rows = bands(opaque.any(1))
    cols = bands(opaque.any(0))
    if len(rows) != args.rows or len(cols) != args.cols:
        raise SystemExit(f'expected {args.rows}x{args.cols} poses, found {len(rows)}x{len(cols)}')
    # widen column bands to the midpoints between poses
    edges = [0] + [(cols[i][1] + cols[i + 1][0]) // 2 for i in range(len(cols) - 1)] + [im.width]
    cols = [(edges[i], edges[i + 1]) for i in range(len(cols))]

    F, WIN = args.frame, args.window
    sheet = Image.new('RGBA', (F * args.cols, F * args.rows))
    for r, (r0, r1) in enumerate(rows):
        for c, (c0, c1) in enumerate(cols):
            ys, xs = np.nonzero(opaque[r0:r1 + 2, c0:c1])
            bottom = r0 + ys.max() + 1
            body = (ys > ys.max() - 120) & (ys < ys.max() - 20)
            cx = c0 + int(np.median(xs[body]))
            crop = np.array(im.crop((cx - WIN // 2, bottom - WIN, cx + WIN // 2, bottom))).astype(float)
            alpha = crop[..., 3:4] / 255
            premult = np.concatenate([crop[..., :3] * alpha, crop[..., 3:4]], 2).astype(np.uint8)
            small = np.array(Image.fromarray(premult, 'RGBA').resize((F, F), Image.BOX)).astype(float)
            a = small[..., 3]
            rgb = np.where(a[..., None] > 0, small[..., :3] / np.maximum(a[..., None], 1) * 255, 0)
            frame = np.zeros((F, F, 4), np.uint8)
            keep = a > 110
            frame[keep, :3] = np.clip(rgb[keep], 0, 255)
            frame[keep, 3] = 255
            sheet.paste(Image.fromarray(frame, 'RGBA'), (c * F, r * F))

    alpha = sheet.getchannel('A')
    rgb = sheet.convert('RGB').quantize(colors=args.colors, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    rgb = ImageEnhance.Contrast(ImageEnhance.Brightness(rgb).enhance(1.12)).enhance(1.08)
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    out.save(args.out)
    print(f'wrote {args.out} ({out.width}x{out.height})')


if __name__ == '__main__':
    main()

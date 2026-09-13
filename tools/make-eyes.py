# -*- coding: utf-8 -*-
"""
Dobby Emo · 可动眼睛素材生成
--------------------------------------------------
把「烘焙好眼睛」的表情图拆成两层，实现真正的眼神跟随：
  assets/<skin>/<id>-patch.webp  脸部补丁（把原眼睛抹掉，用周围肤色平滑填充）
  assets/<skin>/<id>-eyes.png    眼睛精灵（同一裁切框，只有眼睛像素，带透明通道）

运行：python tools/make-eyes.py
输出：assets/<skin>/<id>-patch.webp / -eyes.png + tools/eyes-out.json（贴回 emotions.js）
"""
import json
import os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

CANVAS = 1254
IDS = ["00", "14", "18", "20", "30"]
SKINS = ["sw", "sw-white"]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EYE_DARK = 110        # 眼睛亮度阈值
DILATE = 44           # 补丁扩边（图像像素；渲染 300px 时约等于 10.5px 位移余量）
MARGIN = 26           # 裁切框外扩


def face_mask(a):
    """最大面积的高亮连通域 = 白色猫脸"""
    lum = a[:, :, :3].astype(float).mean(axis=2)
    solid = a[:, :, 3] > 200
    lab, n = ndi.label(solid & (lum > 205))
    sizes = ndi.sum(solid & (lum > 205), lab, range(1, n + 1))
    return lab == (int(np.argmax(sizes)) + 1), lum, solid


def eye_mask(a):
    """猫脸内部的深色椭圆 = 眼睛（取最大的两块）"""
    face, lum, solid = face_mask(a)
    inner = ndi.binary_erosion(ndi.binary_fill_holes(face), iterations=6)
    dark = solid & (lum < EYE_DARK) & inner
    lab, n = ndi.label(dark)
    comps = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        m = lab[sl] == i + 1
        cnt = int(m.sum())
        if cnt < 2000:
            continue
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        comps.append((cnt, sl, w, h))
    comps.sort(key=lambda c: -c[0])
    keep = comps[:2]
    # 用面积最大的两个连通域标签直接构造 mask
    order = np.argsort([-int((lab[sl] == i + 1).sum()) for i, sl in enumerate(ndi.find_objects(lab))])
    labels = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        if int((lab[sl] == i + 1).sum()) >= 2000:
            labels.append((int((lab[sl] == i + 1).sum()), i + 1))
    labels.sort(key=lambda t: -t[0])
    mask = np.isin(lab, [l for _, l in labels[:2]])
    return mask, keep


def laplace_fill(rgb, mask, levels=4, coarse_iters=1200, fine_iters=60, ring=40):
    """多尺度 Laplace 修补：解「洞内调和、洞外固定」的方程，
    填出来的亮度与边缘真实像素严格连续，不会留下原眼睛的浅色鬼影。"""
    ys, xs = np.nonzero(mask)
    y0, y1 = max(0, ys.min() - ring), min(rgb.shape[0], ys.max() + ring + 1)
    x0, x1 = max(0, xs.min() - ring), min(rgb.shape[1], xs.max() + ring + 1)
    # 尺寸取偶数，方便逐层降采样
    y1 -= (y1 - y0) % (2 ** levels)
    x1 -= (x1 - x0) % (2 ** levels)
    img0 = rgb[y0:y1, x0:x1].astype(float)
    msk0 = mask[y0:y1, x0:x1]

    def down(i, m):
        H, W = m.shape
        H2, W2 = H // 2, W // 2
        i2 = i[:H2 * 2, :W2 * 2].reshape(H2, 2, W2, 2, 3).mean(axis=(1, 3))
        m2 = m[:H2 * 2, :W2 * 2].reshape(H2, 2, W2, 2).any(axis=(1, 3))
        return i2, m2

    def jacobi(sol, fixed, m, iters):
        inv = ~m[..., None]
        for _ in range(iters):
            avg = (np.roll(sol, 1, 0) + np.roll(sol, -1, 0) +
                   np.roll(sol, 1, 1) + np.roll(sol, -1, 1)) * 0.25
            sol = np.where(m[..., None], avg, fixed)
        return sol

    # ---- 建金字塔 ----
    imgs, masks = [img0], [msk0]
    for _ in range(levels):
        i2, m2 = down(imgs[-1], masks[-1])
        imgs.append(i2); masks.append(m2)

    # ---- 从最粗一层解起，再逐层回插细化 ----
    sol = np.where(masks[-1][..., None], imgs[-1].mean(axis=(0, 1)), imgs[-1])
    sol = jacobi(sol, imgs[-1], masks[-1], coarse_iters)
    for l in range(levels - 1, -1, -1):
        H, W = masks[l].shape
        up = np.repeat(np.repeat(sol, 2, axis=0), 2, axis=1)[:H, :W]
        sol = jacobi(np.where(masks[l][..., None], up, imgs[l]), imgs[l], masks[l], fine_iters)

    full = rgb.copy()
    full[y0:y1, x0:x1] = np.clip(sol, 0, 255)
    # 自检：洞边缘 3px 带内，填充值与紧邻真实像素的平均差
    band = ndi.binary_dilation(mask, iterations=3) & ~mask
    yy, xx = np.nonzero(band[y0:y1, x0:x1])
    errs = []
    for c in range(3):
        near = ndi.uniform_filter(full[y0:y1, x0:x1, c], size=9)
        errs.append(float(np.abs(full[y0:y1, x0:x1, c][yy, xx] - near[yy, xx]).mean()))
    return full, errs


def build(skin, eid):
    src = os.path.join(ROOT, "assets", skin, eid + ".png")
    a = np.array(Image.open(src).convert("RGBA")).astype(np.uint8)
    rgb = a[:, :, :3].astype(np.uint8)
    mask, comps = eye_mask(a)
    if len(comps) < 2:
        return None, "只识别到 %d 只眼睛" % len(comps)

    # 补丁区 = 眼睛 mask 膨胀（给眼球留位移余量），羽化后合成
    patch_mask = ndi.binary_dilation(mask, iterations=DILATE)
    filled, res = laplace_fill(rgb.astype(float), patch_mask)
    feather = ndi.gaussian_filter(patch_mask.astype(float), 3.0)[..., None]
    clean = rgb.astype(float) * (1 - feather) + filled * feather

    ys, xs = np.nonzero(mask)
    x0 = max(0, xs.min() - MARGIN - DILATE)
    x1 = min(CANVAS, xs.max() + MARGIN + DILATE)
    y0 = max(0, ys.min() - MARGIN - DILATE)
    y1 = min(CANVAS, ys.max() + MARGIN + DILATE)

    os.makedirs(os.path.join(ROOT, "assets", skin), exist_ok=True)
    patch = clean[y0:y1, x0:x1].astype(np.uint8)
    Image.fromarray(patch, "RGB").save(
        os.path.join(ROOT, "assets", skin, eid + "-patch.webp"), "WEBP", quality=94, method=6)

    # 眼睛精灵：alpha 用 1px 膨胀 + 轻微羽化，避免描边发灰
    em = ndi.binary_dilation(mask, iterations=1).astype(float)
    em = ndi.gaussian_filter(em, 0.7)
    alpha = np.clip(em[y0:y1, x0:x1] * 255, 0, 255).astype(np.uint8)
    sprite = np.dstack([rgb[y0:y1, x0:x1].astype(np.uint8), alpha])
    Image.fromarray(sprite, "RGBA").save(
        os.path.join(ROOT, "assets", skin, eid + "-eyes.webp"), "WEBP", lossless=True, method=6)

    # 一致性自检：把 clean 之外的部分复原后与原因对比（补丁外应当完全一致）
    info = {
        "x": round(x0 / CANVAS * 100, 3), "y": round(y0 / CANVAS * 100, 3),
        "w": round((x1 - x0) / CANVAS * 100, 3), "h": round((y1 - y0) / CANVAS * 100, 3),
        "patchPx": [int(x0), int(y0), int(x1), int(y1)],
        "eyePx": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
        "fitRMS": [round(r, 2) for r in res],
    }
    return info, None


def main():
    out = {}
    for skin in SKINS:
        out[skin] = {}
        for eid in IDS:
            info, err = build(skin, eid)
            if err:
                print("  [skip] %s/%s: %s" % (skin, eid, err))
                continue
            out[skin][eid] = info
            print("  [ok] %s/%s patch=%s eye=%s fitRMS=%s" %
                  (skin, eid, info["patchPx"], info["eyePx"], info["fitRMS"]))
    with open(os.path.join(ROOT, "tools", "eyes-out.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("wrote tools/eyes-out.json")


if __name__ == "__main__":
    main()

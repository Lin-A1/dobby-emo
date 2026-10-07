# -*- coding: utf-8 -*-
"""
Dobby Emo · 通用「抹掉烘焙眼睛」补丁生成
--------------------------------------------------
给任意表情生成无眼补丁：在眼睛所在的横带里找出「与脸底色不同的深色形状」
（胶囊眼、笑眼弧、怒目斜线、X 眼、螺旋眼、星星眼、心形眼…都算），
把它们抹掉并修补成脸颊，输出 <id>-patch.webp。

和 make-eyes.py 的区别：那边是「先定位两只眼睛的连通域，再抽成精灵」，
只对胶囊眼有效；这边不管形状，只要在眼睛带里、与脸底色不同就抹掉，
所以能覆盖全部表情。

用法：python tools/make-patches.py
输出：assets/<skin>/<id>-patch.webp + tools/patch-box.json（贴回 emotions.js 的框）
"""
import io
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKINS = ["sw", "sw-white"]

# 眼睛所在的横带（画布百分比）——由现有 5 个已实测的精灵框取并集再放宽一点。
# 所有表情都是同一只猫同一姿态，眼睛必然落在这条带里；嘴巴在这条带下面。
BAND = {"x0": 24.5, "x1": 72.0, "y0": 36.0, "y1": 67.0}
# 眼睛与嘴在纵向是重叠的（大眼睛的下缘会伸到嘴的上缘附近），
# 所以不能只靠一条横带切分，改成按「连通域质心的高度」分类：
# 实测 12 个表情，眼的质心最高到 55.5%、最靠上的嘴在 56.9%，取 56% 作分界
MOUTH_CY = 56.0

FACE_LUM = 205        # 判定「脸」的亮度下限（取最大亮块 = 脸盘）
FACE_ERODE = 10       # 脸盘往里收，避免把脸外的黑毛当眼睛
DIST_MIN = 58         # 与脸底色的色差阈值
LUM_MAX = 212         # 比这更亮的不算眼睛（高光、白色）
OPEN_ITER = 2         # 形态学开运算，去掉噪点
DILATE = 8            # 抹除范围外扩，盖住描边与柔边
MARGIN = 34           # 补丁裁切外扩


def laplace_fill(rgb, mask, levels=4, coarse_iters=1200, fine_iters=60, ring=40):
    """多尺度 Laplace 修补：洞内取调和解、洞外固定，填出来的明暗与边缘连续"""
    ys, xs = np.nonzero(mask)
    y0, y1 = max(0, ys.min() - ring), min(rgb.shape[0], ys.max() + ring + 1)
    x0, x1 = max(0, xs.min() - ring), min(rgb.shape[1], xs.max() + ring + 1)
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
        for _ in range(iters):
            avg = (np.roll(sol, 1, 0) + np.roll(sol, -1, 0) +
                   np.roll(sol, 1, 1) + np.roll(sol, -1, 1)) * 0.25
            sol = np.where(m[..., None], avg, fixed)
        return sol

    imgs, masks = [img0], [msk0]
    for _ in range(levels):
        i2, m2 = down(imgs[-1], masks[-1])
        imgs.append(i2); masks.append(m2)
    sol = np.where(masks[-1][..., None], imgs[-1].mean(axis=(0, 1)), imgs[-1])
    sol = jacobi(sol, imgs[-1], masks[-1], coarse_iters)
    for l in range(levels - 1, -1, -1):
        H, W = masks[l].shape
        up = np.repeat(np.repeat(sol, 2, axis=0), 2, axis=1)[:H, :W]
        sol = jacobi(np.where(masks[l][..., None], up, imgs[l]), imgs[l], masks[l], fine_iters)
    full = rgb.copy()
    full[y0:y1, x0:x1] = np.clip(sol, 0, 255)
    return full


def eye_mask(rgb, alpha):
    """脸盘内的「眼睛带」里，与脸底色不同的深色形状 = 要抹掉的东西"""
    H, W = rgb.shape[:2]
    lum = rgb.mean(axis=2)

    # 脸盘：最大亮块，往内收一点
    solid = alpha > 200
    bright = solid & (lum > FACE_LUM)
    lab, n = ndi.label(bright)
    if n == 0:
        return None
    sizes = ndi.sum(bright, lab, range(1, n + 1))
    face = lab == (int(np.argmax(sizes)) + 1)
    face = ndi.binary_erosion(ndi.binary_fill_holes(face), iterations=FACE_ERODE)

    # 眼睛带
    band = np.zeros((H, W), bool)
    x0 = int(W * BAND["x0"] / 100); x1 = int(W * BAND["x1"] / 100)
    y0 = int(H * BAND["y0"] / 100); y1 = int(H * BAND["y1"] / 100)
    band[y0:y1, x0:x1] = True
    roi = face & band

    # 脸底色：ROI 内像素的中位色（大部分是奶油脸）
    px = rgb[roi]
    if px.size == 0:
        return None
    face_col = np.median(px, axis=0)
    dist = np.linalg.norm(rgb.astype(float) - face_col, axis=2)
    m = roi & (dist > DIST_MIN) & (lum < LUM_MAX)
    m = ndi.binary_opening(m, iterations=OPEN_ITER)

    # 连通域分类：质心在眼睛带高度之上的算眼睛（要抹），之下的算嘴（必须保住）
    lab2, n2 = ndi.label(m)
    eyes = np.zeros_like(m)
    mouth = np.zeros_like(m)
    for i in range(1, n2 + 1):
        comp = lab2 == i
        cnt = int(comp.sum())
        if cnt < 260:
            continue
        ys2, xs2 = np.nonzero(comp)
        cy = ys2.mean() / H * 100
        (mouth if cy >= MOUTH_CY else eyes).__ior__(comp) if False else None
        if cy >= MOUTH_CY:
            mouth |= comp
        else:
            eyes |= comp

    if eyes.sum() < 400:
        return None
    # 抹除眼睛（外扩盖住描边），再把嘴的那块减掉，避免连嘴一起抹平
    erase = ndi.binary_dilation(eyes, iterations=DILATE)
    if mouth.any():
        erase &= ~ndi.binary_dilation(mouth, iterations=3)
    return erase


def build(skin, eid):
    src = os.path.join(ROOT, "assets", skin, eid + ".png")
    a = np.array(Image.open(src).convert("RGBA"))
    rgb = a[:, :, :3].astype(float)
    alpha = a[:, :, 3]

    mask = eye_mask(rgb, alpha)
    if mask is None or mask.sum() < 500:
        return None, "没找到可抹除的眼睛（mask=%d）" % (0 if mask is None else mask.sum())

    filled = laplace_fill(rgb, mask)
    feather = ndi.gaussian_filter(mask.astype(float), 2.4)[..., None]
    clean = rgb * (1 - feather) + filled * feather

    ys, xs = np.nonzero(mask)
    H, W = rgb.shape[:2]
    y0 = max(0, ys.min() - MARGIN); y1 = min(H, ys.max() + MARGIN)
    x0 = max(0, xs.min() - MARGIN); x1 = min(W, xs.max() + MARGIN)

    out = os.path.join(ROOT, "assets", skin, eid + "-patch.webp")
    Image.fromarray(clean[y0:y1, x0:x1].astype(np.uint8), "RGB").save(
        out, "WEBP", quality=92, method=6)

    box = {
        "x": round(x0 / W * 100, 3), "y": round(y0 / H * 100, 3),
        "w": round((x1 - x0) / W * 100, 3), "h": round((y1 - y0) / H * 100, 3),
    }
    # 自检：补丁与原图在「非眼睛区」的差异
    base = np.array(Image.open(src).convert("RGB")).astype(float)[y0:y1, x0:x1]
    patch = np.array(Image.open(out).convert("RGB")).astype(float)
    band = ndi.binary_dilation(mask, iterations=DILATE + 6)[y0:y1, x0:x1]
    diff = np.abs(patch - base).mean(axis=2)[~band]
    return {"box": box, "px": [int(x0), int(y0), int(x1), int(y1)],
            "maskPx": int(mask.sum()), "restDiff": round(float(diff.mean()), 2)}, None


def main():
    ids = json.loads(io.open(os.path.join(ROOT, "tools", "patch-ids.json"), encoding="utf-8").read())
    out = {}
    for skin in SKINS:
        out[skin] = {}
        for eid in ids:
            info, err = build(skin, eid)
            if err:
                print("  [skip] %s/%s: %s" % (skin, eid, err))
                continue
            out[skin][eid] = info
            print("  [ok] %s/%s box=%s mask=%dpx 非眼区差异=%.2f" %
                  (skin, eid, info["box"], info["maskPx"], info["restDiff"]))
    with io.open(os.path.join(ROOT, "tools", "patch-box.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("wrote tools/patch-box.json")
    print("\n可直接粘贴的框（两皮肤基本一致，取 sw）：")
    for eid, info in out["sw"].items():
        b = info["box"]
        print('  "%s": { x: %g, y: %g, w: %g, h: %g },' % (eid, b["x"], b["y"], b["w"], b["h"]))


if __name__ == "__main__":
    main()

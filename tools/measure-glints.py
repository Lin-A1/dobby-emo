# -*- coding: utf-8 -*-
"""
Dobby Emo · 眼精灵高光定位
--------------------------------------------------
从每个可动眼精灵（assets/<skin>/<id>-eyes.webp）量出眼睛位置，并直接算出
emotions.js 里 eyeLayer.glint 需要的补光锚点：

  glint: [ {x, y, w, hi}, ... ]   每只眼一条，相对精灵框的百分比
    x/y = 高光点中心（不是眼框左上角），w = 点宽，hi=1 表示素材已自带高光、不补

规则（每只眼各算各的，胶囊眼和弯月眼都成立）：
  1. 落点 = 该眼自己包围盒的左上 (32% 宽, 24% 高) —— 不能照搬另一只眼的坐标，
     素材里左右眼高度并不一致（右眼更低），照搬会让高光飘到眼睛外
  2. 点宽 = min(眼宽 × 0.34, 落点到眼缘距离 × 1.9)，弯月形（眨眼）这类细眼睛
     会自动收小，不会糊到脸上
  3. 眼睛内部若有「孔洞」（= 素材自带的高光被抠掉了），跳过补光（hi=1）

运行：python tools/measure-glints.py（hi 由「精灵里的孔洞」自动判定）
输出：tools/glints.json（bbox 参考值 + 可直接粘贴的 glint 锚点）
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKINS = ["sw", "sw-white"]
IDS = ["00", "14", "18", "20", "30"]

ALPHA_MIN = 120       # 精灵只有眼睛不透明
MIN_AREA = 400        # 小于此面积视为噪点
HOLE_MIN = 250        # 「孔洞」面积下限：眼睛里的孔 = 素材自带的高光被抠掉了，
                      # 露出的正是补丁的浅色，等于已经有一处高光
# 高光落点规则
GX_RATIO, GY_RATIO = 0.32, 0.24   # 落点 = 每只眼自己包围盒的左上 (32%, 24%)
W_RATIO = 0.34                    # 点宽上限 = 眼宽 × 0.34
CLEAR_K = 1.9                     # 点宽上限 = 到边缘距离 × 1.9（细眼时按这个收）


def analyze(path):
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    W, H = im.size
    alpha = a[:, :, 3]

    solid = alpha > ALPHA_MIN
    lab, n = ndi.label(solid)
    if n == 0:
        return None

    comps = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        m = lab[sl] == i + 1
        cnt = int(m.sum())
        if cnt < MIN_AREA:
            continue
        comps.append((cnt, sl, m))
    if not comps:
        return None
    comps.sort(key=lambda c: c[1][1].start)      # 左眼 → 右眼

    out = []
    for cnt, sl, m in comps:
        y0, y1 = sl[0].start, sl[0].stop
        x0, x1 = sl[1].start, sl[1].stop
        w, h = x1 - x0, y1 - y0

        # 自带高光检测：眼睛里的「孔洞」（精灵 alpha 为 0、被补丁浅色透出来）。
        # 不能用亮度阈值——描边的抗锯齿像素本身就是亮的，会全部误判。
        inside = np.zeros_like(solid, dtype=bool)
        inside[y0:y1, x0:x1] = m
        holes = ndi.binary_fill_holes(inside) & ~inside
        hl, hn = ndi.label(holes)
        hole_px = max([int((hl == k + 1).sum()) for k in range(hn)] or [0])
        hi = 1 if hole_px >= HOLE_MIN else 0

        bbox = {
            "x": round(x0 / W * 100, 1), "y": round(y0 / H * 100, 1),
            "w": round(w / W * 100, 1), "h": round(h / H * 100, 1),
        }

        # 落点：每只眼自己的左上（32% 宽 / 24% 高处），而不是沿用另一只眼的坐标 ——
        # 左右眼在素材里高度不一样（右眼通常更低），照搬会让高光飘到眼睛外面
        glx, gly = GX_RATIO * w, GY_RATIO * h        # 局部坐标（相对眼框）
        gx, gy = x0 + glx, y0 + gly
        dist = ndi.distance_transform_edt(m)         # 局部：到眼边界的距离（像素）
        pxc = int(min(max(glx, 0), w - 1))
        pyc = int(min(max(gly, 0), h - 1))
        clear = float(dist[pyc, pxc]) if m[pyc, pxc] else 0.0
        # 点宽：常规取眼宽的 1/3；细眼（弯月形）按到边缘的距离收，避免溢出到脸上
        dot_w = min(W_RATIO * w, CLEAR_K * clear) if clear > 0 else W_RATIO * w

        out.append({
            "bbox": bbox,
            "hi": hi,
            "holePx": hole_px,
            "dot": {                            # 锚点：点中心 + 点宽，相对精灵框
                "x": round(gx / W * 100, 1),
                "y": round(gy / H * 100, 1),
                "w": round(dot_w / W * 100, 1),
                "hi": hi,
            },
            "clearPx": round(clear, 1),
        })
    out.sort(key=lambda e: e["bbox"]["x"])
    return out


def main():
    result = {}
    for skin in SKINS:
        result[skin] = {}
        for eid in IDS:
            p = os.path.join(ROOT, "assets", skin, eid + "-eyes.webp")
            if not os.path.exists(p):
                print("  [skip] %s/%s 不存在" % (skin, eid))
                continue
            eyes = analyze(p)
            if not eyes:
                print("  [skip] %s/%s 未识别到眼睛" % (skin, eid))
                continue
            result[skin][eid] = eyes
            desc = "  ".join(
                "eye%d bbox(%.1f,%.1f,%.1f,%.1f) dot(%.1f,%.1f w%.1f) hi=%d(hole %dpx)" %
                (i, e["bbox"]["x"], e["bbox"]["y"], e["bbox"]["w"], e["bbox"]["h"],
                 e["dot"]["x"], e["dot"]["y"], e["dot"]["w"], e["hi"], e["holePx"])
                for i, e in enumerate(eyes))
            print("  [ok] %s/%s  %s" % (skin, eid, desc))

    out = os.path.join(ROOT, "tools", "glints.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("wrote", out)
    print("\n可直接粘贴进 emotions.js 的锚点（运行时两皮肤共用一套，取 sw）：")
    for eid, eyes in result["sw"].items():
        items = ", ".join("{ x: %.1f, y: %.1f, w: %.1f, hi: %d }" %
                          (e["dot"]["x"], e["dot"]["y"], e["dot"]["w"], e["dot"]["hi"]) for e in eyes)
        print('  "%s": [%s],' % (eid, items))


if __name__ == "__main__":
    main()

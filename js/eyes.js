/* ============================================================
 * Dobby Eyes · 矢量眼引擎（参考 emoball / aora-bot）
 *
 * 眼睛 = 28 点参数化闭合轮廓，逐点弹簧插值 → 表情切换是
 * gooey 融化变形；瞳孔独立弹簧追随；眨眼带回弹过冲；
 * 动画原语：pulse / jitter / scan / spin。
 *
 * 几何常量基于 assets/emotes/blank.png 图像比例，可微调。
 * ============================================================ */
(function (global) {
  "use strict";

  const N = 28;                       // 每只眼的轮廓采样点数
  const FILL = "#17171d";             // 眼睛填充色
  const MOUTH_FILL = "#4a2731";       // 嘴填充色

  /* 默认几何（图像比例，基于 assets/emotes/blank.png 实测）；
   * 可通过 new DobbyEyes(mount, size, geoOverride) 为其他底图覆盖 */
  const GEO = {
    faceCx: 0.48, faceCy: 0.63,
    faceRx: 0.333, faceRy: 0.242,
    eyeDX: 0.31,      // 眼中心距脸中心的水平距离（× faceRx）
    eyeY: -0.20,      // 眼中心相对脸中心的纵向偏移（× faceRy）
    eyeW: 0.150,      // 眼宽（× faceRx）
    eyeH: 0.42,       // 眼高（× faceRy）
    mouthY: 0.40,     // 嘴相对脸中心（× faceRy）
    mouthW: 0.42,     // 嘴宽（× faceRx）
    blushDX: 0.52,    // 腮红水平位置（× faceRx）
    blushY: 0.10,     // 腮红纵向偏移（× faceRy）
  };

  /* 形状生成器：θ ∈ [0, 2π) → 单位坐标 [x, y]（y 向下） */
  const SHAPES = {
    oval:   (θ) => [Math.cos(θ), Math.sin(θ)],
    happy:  (θ) => { const s = Math.sin(θ); return [Math.cos(θ), s < 0 ? s : s * 0.12 + 0.07]; },
    sad:    (θ) => { const s = Math.sin(θ); return [Math.cos(θ), s > 0 ? s : s * 0.12 - 0.07]; },
    half:   (θ) => { const s = Math.sin(θ); return [Math.cos(θ), s < 0 ? s * 0.35 : s]; },
    wide:   (θ) => [Math.cos(θ) * 1.12, Math.sin(θ) * 1.28],
    angry:  (θ) => { const x = Math.cos(θ), y = Math.sin(θ) * 0.82; return [x - 0.42 * y, y]; },
    star:   (θ) => { const r = 0.48 + 0.52 * Math.cos(5 * θ); return [r * Math.cos(θ) * 1.3, r * Math.sin(θ) * 0.92]; },
    heart:  (θ) => [
      16 * Math.pow(Math.sin(θ), 3) / 16.5 * 1.35,
      -(13 * Math.cos(θ) - 5 * Math.cos(2 * θ) - 2 * Math.cos(3 * θ) - Math.cos(4 * θ)) / 17,
    ],
    xeye:   (θ) => { const r = 0.46 + 0.54 * Math.abs(Math.sin(2 * θ)); return [r * Math.cos(θ) * 1.35, r * Math.sin(θ) * 0.95]; },
    spiral: (θ, ph) => { const r = 0.68 + 0.26 * Math.sin(3 * θ + ph); return [r * Math.cos(θ) * 1.3, r * Math.sin(θ) * 0.9]; },
    closed: (θ) => [Math.cos(θ), Math.sin(θ) * 0.10 + 0.03],
    gt:     (θ) => { const s = Math.sin(θ); return [0.28 + 0.72 * Math.pow(Math.abs(s), 0.6), s]; },
    lt:     (θ) => { const s = Math.sin(θ); return [-(0.28 + 0.72 * Math.pow(Math.abs(s), 0.6)), s]; },
  };
  const SCLERA_SHAPES = { oval: 1, wide: 1, half: 1 };  // 白底+瞳孔 模式（已弃用，保留兼容）
  const NO_BLINK = { closed: 1 };                        // 这些形状不眨眼
  /* 描边弧模式：小尺寸下比填充块清晰得多 */
  const STROKE_SHAPES = { happy: 1, sad: 1, closed: 1, gt: 1, lt: 1, angryL: 1, angryR: 1 };
  /* 只有这类眼睛显示白色高光点（视线方向） */
  const GLINT_SHAPES = { oval: 1, wide: 1, half: 1 };

  /* 嘴型（单位路径，y 向下） */
  const MOUTHS = {
    none:     { d: "", stroke: false, fill: false },
    smile:    { d: "M -1 0 Q 0 0.85 1 0", stroke: true },
    bigSmile: { d: "M -1 -0.15 Q 0 1.3 1 -0.15 Q 0 0.5 -1 -0.15 Z", fill: true },
    o:        { d: "M -0.48 0 A 0.48 0.62 0 1 0 0.48 0 A 0.48 0.62 0 1 0 -0.48 0 Z", fill: true },
    flat:     { d: "M -0.8 0 L 0.8 0", stroke: true },
    wavy:     { d: "M -1 0.1 Q -0.5 -0.5 0 0.1 Q 0.5 0.7 1 0.1", stroke: true },
    smirk:    { d: "M -0.9 0.15 Q 0.15 0.8 1 -0.1", stroke: true },
  };

  /* 描边弧形 / 折线：t ∈ [0,1] → 眼局部像素坐标（x: ±w/2，向上为负） */
  const STROKES = {
    happy:  (t, w, h) => [-w/2 + w*t, -Math.cos(t * Math.PI) * h * 0.52 + h * 0.06],
    sad:    (t, w, h) => [-w/2 + w*t,  Math.cos(t * Math.PI) * h * 0.52 - h * 0.02],
    closed: (t, w, h) => [-w/2 + w*t,  Math.sin(t * Math.PI) * h * 0.14 + h * 0.05],
    gt:     (t, w, h) => { let x, y; if (t < 0.5) { x = t*2; y = 1 - t*2; } else { x = 2 - t*2; y = -((t - 0.5) * 2); } return [(x - 0.5) * w * 0.95, y * h * 0.5]; },
    lt:     (t, w, h) => { let x, y; if (t < 0.5) { x = t*2; y = 1 - t*2; } else { x = 2 - t*2; y = -((t - 0.5) * 2); } return [(0.5 - x) * w * 0.95, y * h * 0.5]; },
    angryL: (t, w, h) => [-w/2 + w*t, (-0.25 + t * 0.55) * h],   // 左眼：外高内低
    angryR: (t, w, h) => [ w/2 - w*t, (-0.25 + t * 0.55) * h],   // 右眼：内低外高
  };
  function smoothOpenPath(pts) {
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2, my = (pts[i].y + pts[i+1].y) / 2;
      d += ` Q ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
    }
    const p = pts[pts.length - 1];
    return d + ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* 闭合轮廓平滑路径（中点二次曲线） */
  function smoothPath(pts) {
    const n = pts.length;
    const mid = (a, b) => [(a.x + b.x) / 2, (a.y + b.y) / 2];
    const [mx, my] = mid(pts[n - 1], pts[0]);
    let d = `M ${mx.toFixed(2)} ${my.toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const [cx, cy] = mid(p, q);
      d += ` Q ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)}`;
    }
    return d + " Z";
  }

  /* ------------------------------------------------------------
   * DobbyEyes
   * ------------------------------------------------------------ */
  class DobbyEyes {
    constructor(mount, sizePx, geoOverride) {
      this.size = sizePx;
      const G = this.G = Object.assign({}, GEO, geoOverride || {});
      const s = sizePx;
      const geo = this.geo = {
        faceCx: G.faceCx * s, faceCy: G.faceCy * s,
        faceRx: G.faceRx * s, faceRy: G.faceRy * s,
        eyeDX: G.eyeDX * G.faceRx * s,
        eyeY: G.eyeY * G.faceRy * s,
        eyeW: G.eyeW * G.faceRx * s,
        eyeH: G.eyeH * G.faceRy * s,
        mouthY: G.mouthY * G.faceRy * s,
        mouthW: G.mouthW * G.faceRx * s,
        blushDX: G.blushDX * G.faceRx * s,
        blushY: G.blushY * G.faceRy * s,
      };
      this.svg = svgEl("svg", { viewBox: `0 0 ${sizePx} ${sizePx}` }, mount);

      this.cfg = null;
      this.blink = 0;
      this._blinkTimer = 2 + Math.random() * 3;
      this._spiralPhase = 0;
      this._blushA = 0; this._blushTarget = 0;
      this._shadesA = 0; this._shadesTarget = 0;
      this._mouthA = 1;
      this.pupil = { x: 0, y: 0, vx: 0, vy: 0 };
      this._pupilT = { x: 0, y: 0 };

      this._build();
    }

    _build() {
      const g = this.geo, s = this.size;
      const cx = this.G.faceCx * s, cy = this.G.faceCy * s;

      /* 腮红 */
      this.blushG = svgEl("g", {}, this.svg);
      this.blushes = [-1, 1].map((side) => svgEl("ellipse", {
        cx: cx + side * g.blushDX, cy: cy + g.blushY,
        rx: g.eyeW * 0.75, ry: g.eyeW * 0.42,
        fill: "#ff9eb5", opacity: 0,
      }, this.blushG));

      /* 嘴 */
      this.mouthG = svgEl("g", {
        transform: `translate(${cx} ${cy + g.mouthY}) scale(${g.mouthW / 2} ${g.mouthW / 3})`,
      }, this.svg);
      this.mouthPath = svgEl("path", {
        fill: "none", stroke: MOUTH_FILL, "stroke-linecap": "round",
        "stroke-width": 4, "vector-effect": "non-scaling-stroke",
      }, this.mouthG);

      /* 眼睛（左右） */
      this.eyes = [-1, 1].map((side) => this._makeEye(side));

      /* 墨镜 */
      this.shadesG = svgEl("g", { opacity: 0 }, this.svg);
      const shY = cy + g.eyeY, shH = g.eyeH * 0.92, shW = g.eyeW * 1.45, shRx = g.eyeW * 0.4;
      for (const side of [-1, 1]) {
        svgEl("rect", {
          x: cx + side * g.eyeDX - shW / 2, y: shY - shH / 2,
          width: shW, height: shH, rx: shRx,
          fill: "#141419", stroke: "#2c2c36", "stroke-width": 2.5,
        }, this.shadesG);
      }
      svgEl("path", {
        d: `M ${cx - g.eyeDX + shW / 2} ${shY} Q ${cx} ${shY - shH * 0.35} ${cx + g.eyeDX - shW / 2} ${shY}`,
        stroke: "#141419", "stroke-width": 5, fill: "none", "stroke-linecap": "round",
      }, this.shadesG);

      /* 眼泪 */
      this.tearsG = svgEl("g", { opacity: 0 }, this.svg);
      this.tears = [-1, 1].map((side, i) => svgEl("circle", {
        cx: cx + side * g.eyeDX, cy: cy + g.eyeY + g.eyeH * 0.5,
        r: g.eyeW * 0.28, fill: "#8ec8ff", opacity: 0,
      }, this.tearsG));
      this._tearsOn = false;
    }

    _makeEye(side) {
      const g = this.geo, s = this.size;
      const cx = this.G.faceCx * s + side * g.eyeDX;
      const cy = this.G.faceCy * s + g.eyeY;

      const root = svgEl("g", { transform: `translate(${cx} ${cy})` }, this.svg);
      const blinkG = svgEl("g", {}, root);
      /* 描边弧（happy/sad/closed 用）：像素坐标，不受 unit 缩放影响 */
      const strokePath = svgEl("path", {
        fill: "none", stroke: FILL, "stroke-linecap": "round",
        "stroke-width": Math.max(3.5, g.eyeW * 0.30),
      }, blinkG);
      const unit = svgEl("g", {
        transform: `scale(${g.eyeW / 2} ${g.eyeH / 2})`,
      }, blinkG);

      /* 黑色轮廓（主形状） */
      const path = svgEl("path", { fill: FILL }, unit);

      /* 白色高光点（瞳孔位置 → 视线方向），裁剪进眼形 */
      const clipId = `dobby-eye-clip-${side > 0 ? "r" : "l"}`;
      const clip = svgEl("clipPath", { id: clipId }, this.svg);
      const clipPath = svgEl("path", {}, clip);
      const pupilG = svgEl("g", { "clip-path": `url(#${clipId})` }, unit);
      const pupil = svgEl("circle", { cx: 0, cy: 0, r: 0.30, fill: "#ffffff", opacity: 0.95 }, pupilG);

      const pts = [];
      for (let i = 0; i < N; i++) pts.push({ x: Math.cos((i / N) * 2 * Math.PI), y: Math.sin((i / N) * 2 * Math.PI), vx: 0, vy: 0 });

      return { side, root, blinkG, unit, path, clipPath, pupil, pupilG, strokePath, pts, shape: "oval" };
    }

    /* 设置表情（eyes 配置） */
    setEmotion(cfg) {
      this.cfg = cfg;
      const ls = SHAPES[cfg.l] || STROKES[cfg.l] ? cfg.l : "oval";
      const rs = SHAPES[cfg.r] || STROKES[cfg.r] ? cfg.r : "oval";
      const shapes = [ls, rs];
      this.eyes.forEach((eye, i) => {
        const newShape = shapes[i];
        /* 描边(像素空间) ↔ 填充(单位空间) 切换时立即吸附，避免巨大中间形 */
        if (!!STROKE_SHAPES[eye.shape] !== !!STROKE_SHAPES[newShape]) {
          const tg = this._targetsFor(newShape, 0);
          eye.pts.forEach((p, j) => { p.x = tg[j].x; p.y = tg[j].y; p.vx = 0; p.vy = 0; });
        }
        eye.shape = newShape;
      });
      this._blinkable = !(NO_BLINK[ls] || NO_BLINK[rs]) && cfg.blink !== false;
      this._blushTarget = cfg.blush ? 0.55 : 0;
      this._shadesTarget = cfg.shades ? 1 : 0;
      this._tearsOn = !!cfg.tears;

      /* 嘴 */
      const m = MOUTHS[cfg.mouth] || MOUTHS.none;
      this.mouthPath.setAttribute("d", m.d);
      this.mouthPath.setAttribute("fill", m.fill ? MOUTH_FILL : "none");
      this.mouthPath.setAttribute("stroke", m.stroke ? MOUTH_FILL : "none");
      this.mouthG.style.display = m.d ? "" : "none";
    }

    _shapeTargets(shape, phase) {
      const gen = SHAPES[shape];
      const out = new Array(N);
      for (let i = 0; i < N; i++) {
        const [x, y] = gen((i / N) * 2 * Math.PI, phase || 0);
        out[i] = { x, y };
      }
      return out;
    }

    _targetsFor(shape, phase) {
      if (STROKE_SHAPES[shape]) {
        const gen = STROKES[shape];
        const w = this.geo.eyeW * 1.1, h = this.geo.eyeH;
        const out = new Array(N);
        for (let i = 0; i < N; i++) {
          const [x, y] = gen(i / (N - 1), w, h);
          out[i] = { x, y };
        }
        return out;
      }
      return this._shapeTargets(shape, shape === "spiral" ? (phase || 0) : 0);
    }

    tick(dt, t, gaze) {
      if (!this.cfg) return;
      const g = this.geo;
      const anim = this.cfg.anim || [];

      /* 螺旋旋转相位（spin 原语） */
      if (anim.includes("spin")) this._spiralPhase += dt * 3.2;

      /* 眼睛逐点弹簧变形（填充块 or 描边弧） */
      for (const eye of this.eyes) {
        const targets = this._targetsFor(eye.shape, eye.shape === "spiral" ? this._spiralPhase : 0);
        const pts = eye.pts;
        for (let i = 0; i < N; i++) {
          const p = pts[i], tg = targets[i];
          p.vx += ((tg.x - p.x) * 150 - p.vx * 15) * dt;
          p.vy += ((tg.y - p.y) * 150 - p.vy * 15) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        if (STROKE_SHAPES[eye.shape]) {
          eye.strokePath.setAttribute("d", smoothOpenPath(pts));
          eye.strokePath.style.display = "";
          eye.unit.style.display = "none";
        } else {
          const d = smoothPath(pts);
          eye.path.setAttribute("d", d);
          eye.clipPath.setAttribute("d", d);
          eye.strokePath.style.display = "none";
          eye.unit.style.display = "";
          /* 高光点只留给需要视线追踪的眼形，否则会盖住符号眼 */
          eye.pupilG.style.display = GLINT_SHAPES[eye.shape] ? "" : "none";
        }

        /* 眨眼：整只眼压扁 + 回弹过冲 */
        if (this.blink > 0 && this.blink <= 1 && this._blinkable) {
          const bs = 1 - Math.sin(Math.PI * this.blink) * 0.92;
          eye.blinkG.setAttribute("transform", `scale(1 ${bs.toFixed(3)})`);
        } else if (this.blink > 1 && this.blink <= 1.4 && this._blinkable) {
          const bs = 1 + Math.sin(Math.PI * (this.blink - 1) / 0.4) * 0.08;
          eye.blinkG.setAttribute("transform", `scale(1 ${bs.toFixed(3)})`);
        } else {
          eye.blinkG.setAttribute("transform", "scale(1 1)");
        }
      }

      /* 眨眼计时 */
      this._blinkTimer -= dt;
      if (this._blinkTimer <= 0 && this._blinkable) {
        this.blink = 0.0001;
        this._blinkTimer = 2.2 + Math.random() * 3.4;
      }
      if (this.blink > 0) {
        this.blink += dt / 0.2;
        if (this.blink >= 2) this.blink = 0;
      }

      /* 瞳孔弹簧追随（gaze ∈ [-1,1]） */
      let ptx = gaze.x * 0.42, pty = gaze.y * 0.5;
      if (anim.includes("scan")) ptx = Math.sin(t * 2.4) * 0.6;        // 搜索：来回扫视
      if (anim.includes("glanceUp")) pty = -0.42;                       // 思考：往上看
      if (this.cfg.eyesDown) pty += 0.3;                                // 害羞：往下看
      const P = this.pupil;
      P.vx += ((ptx - P.x) * 130 - P.vx * 14) * dt;
      P.vy += ((pty - P.y) * 130 - P.vy * 14) * dt;
      P.x += P.vx * dt; P.y += P.vy * dt;
      /* 所有眼形共用高光点位移（闭合/符号眼会被裁掉，自然隐藏） */
      this._pupilT = P;
      for (const eye of this.eyes) {
        eye.pupil.setAttribute("cx", P.x.toFixed(3));
        eye.pupil.setAttribute("cy", P.y.toFixed(3));
        /* 戴墨镜时眼睛淡出 */
        eye.root.setAttribute("opacity", (1 - this._shadesA * 0.88).toFixed(2));
      }

      /* 动画原语 */
      let scale = 1, jx = 0, jy = 0;
      if (anim.includes("pulse")) scale = 1 + Math.sin(t * 6.2) * 0.07;
      if (anim.includes("jitter")) {
        jx = (Math.random() - 0.5) * 3;
        jy = (Math.random() - 0.5) * 2;
      }
      for (const eye of this.eyes) {
        eye.root.setAttribute("transform",
          `translate(${this.G.faceCx * this.size + eye.side * g.eyeDX + jx} ${this.G.faceCy * this.size + g.eyeY + jy}) scale(${scale})`);
      }

      /* 腮红 / 墨镜 渐显 */
      this._blushA += (this._blushTarget - this._blushA) * Math.min(1, dt * 8);
      this.blushes.forEach((b) => b.setAttribute("opacity", this._blushA.toFixed(2)));
      this._shadesA += (this._shadesTarget - this._shadesA) * Math.min(1, dt * 8);
      this.shadesG.setAttribute("opacity", this._shadesA.toFixed(2));

      /* 眼泪循环下落 */
      this.tearsG.setAttribute("opacity", this._tearsOn ? "1" : "0");
      if (this._tearsOn) {
        this.tears.forEach((tear, i) => {
          const prog = ((t * 55 + i * 26) % 44) / 44;
          const g2 = this.geo;
          tear.setAttribute("cy", this.G.faceCy * this.size + g2.eyeY + g2.eyeH * 0.55 + prog * 44);
          tear.setAttribute("opacity", (0.95 * (1 - prog)).toFixed(2));
        });
      }
    }
  }

  global.DobbyEyes = DobbyEyes;
})(window);

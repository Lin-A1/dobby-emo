/* ============================================================
 * Dobby Emo · 表情引擎
 * 参考 aora-bot 架构：表情注册表 + 共享 rAF 心跳 + 配置驱动。
 * AI 侧只需下发  {"emotionId":"30","tips":"正在思考…"} 。
 *
 * 实例是"自由漫游"的：锚点可设在全屏任意位置，
 * 拖拽离开锚点后弹簧回位；行为层负责决定它何时表达什么。
 * ============================================================ */
(function (global) {
  "use strict";

  /* ---------------- 表情注册表 ---------------- */
  const registry = new Map();          // id -> def
  const registryListeners = new Set(); // 注册表变化时通知 UI 重绘

  function normalizeDef(def) {
    if (!def || typeof def.id !== "string" || !def.id.trim()) return null;
    return {
      id: def.id.trim(),
      name: def.name || def.id,
      en: def.en || "",
      group: def.group || "custom",
      img: def.img || "",
      bob: typeof def.bob === "number" ? def.bob : 1,   // 漂浮幅度系数
      noBlink: !!def.noBlink,
      effect: def.effect || "none",                     // 常驻光环特效
      eyes: def.eyes || null,                           // 矢量眼配置（emoball 式实时眼睛）
    };
  }

  function register(defs) {
    if (!Array.isArray(defs)) defs = [defs];
    let changed = false;
    for (const raw of defs) {
      const def = normalizeDef(raw);
      if (!def) continue;
      registry.set(def.id, def);
      if (def.img) { const im = new Image(); im.src = def.img; } // 预载
      changed = true;
    }
    if (changed) registryListeners.forEach((fn) => fn());
    return changed;
  }

  /* ---------------- 共享 rAF 心跳 + 全局指针 ---------------- */
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, t: performance.now() };

  addEventListener("pointermove", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.t = performance.now();
  }, { passive: true });

  /* ---------------- 工具 ---------------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerpK = (dt, k) => 1 - Math.exp(-dt * k);   // 帧率无关平滑系数
  function el(tag, cls, parent) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ============================================================
   * DobbyEmo 实例
   * ============================================================ */
  class DobbyEmo {
    static instances = new Set();
    static _rafId = null;
    static _lastT = 0;

    constructor(mount, opts = {}) {
      this.mount = mount;
      this.opts = Object.assign(
        { size: 320, gaze: true, blink: true, autosleep: false, autosleepDelay: 20000 },
        opts
      );
      this.onChange = null;   // (def, meta) => {}
      this.onError = null;    // (reason, raw) => {}
      this.onUserActivity = null; // 任意指针活动时回调（供行为层唤醒）

      // 锚点：角色"家"的位置（mount 坐标系；mount 为 fixed 全屏层时即视口坐标）
      this.anchor = {
        x: opts.anchor ? opts.anchor.x : mount.clientWidth / 2,
        y: opts.anchor ? opts.anchor.y : mount.clientHeight / 2,
      };

      this._buildDOM();

      // ---- 运动状态 ----
      this.pos = { x: 0, y: 0 };        // 相对锚点的拖拽位移
      this.vel = { x: 0, y: 0 };
      this.dragTarget = { x: 0, y: 0 };
      this.dragging = false;
      this.gaze = { x: 0, y: 0 };
      this.squash = { s: 1, v: 0 };
      this.hopT = 1;                     // <1 表示正在跳
      this.blink = 0;                    // 0→1→0 眨眼相位
      this._blinkTimer = 2 + Math.random() * 3;
      this.spin = { t: 1, dur: 0.9 };    // t<1 表示旋转中
      this.particles = [];               // 彩带纸屑
      this.ribbon = [];                  // 旋转彩带拖尾
      this.emotion = null;
      this.sticky = false;
      this.follow = false;               // 跟随模式（锚点缓慢追指针）
      this._vs = 1;                      // 视口缩放（小屏整体缩小）

      this._bindDrag();
      this._onResize = () => this.setAnchor(this.anchor.x, this.anchor.y);
      addEventListener("resize", this._onResize);

      DobbyEmo.instances.add(this);
      DobbyEmo._ensureLoop();

      // 初始表情：优先 00，否则注册表第一项
      const first = registry.get("00") || registry.values().next().value;
      if (first) this.setEmotion(first.id, { sticky: false });
    }

    /* ---------------- DOM ---------------- */
    _buildDOM() {
      const root = el("div", "dobby", this.mount);
      this.root = root;
      root.style.width = root.style.height = this.opts.size + "px";
      this._applyAnchor();

      this.bobEl = el("div", "dobby-bob", root);
      this.tiltEl = el("div", "dobby-tilt", this.bobEl);
      this.faceEl = el("div", "dobby-face", this.tiltEl);

      this.imgA = el("img", "show", this.faceEl);
      this.imgB = el("img", "", this.faceEl);
      this.imgA.draggable = this.imgB.draggable = false;
      this._front = this.imgA;

      /* 加载门控：首图就绪前隐藏整个角色（避免光环/气泡先飘出来） */
      root.classList.add("loading");
      const reveal = () => root.classList.remove("loading");
      this.imgA.addEventListener("load", reveal);
      this.imgB.addEventListener("load", reveal);
      if (this.imgA.complete && this.imgA.naturalWidth > 0) reveal();

      this.shadowEl = el("div", "dobby-shadow", root);
      this.tipsEl = el("div", "dobby-tips", root);
      this.zzzEl = el("div", "dobby-zzz", root);
      this.zzzEl.innerHTML = "<span>z</span><span>z</span><span>z</span>";
      this.auraEl = el("div", "dobby-aura", root);   // 常驻特效层（光环/爱心/蒸汽等）
      this._fxType = "";
      this._fxTimer = 0;
      this.speakT = 0;

      this.fx = el("canvas", "dobby-fx", this.mount);
      this._fxSize = { w: 0, h: 0 };

      /* 矢量眼模式：空白脸底图 + SVG 实时眼睛 */
      this.vecWrap = el("div", "dobby-vector", this.faceEl);
      const vimg = el("img", "", this.vecWrap);
      vimg.src = this.opts.bodyImg || "assets/emotes/blank.png";
      vimg.draggable = false;
      this.vecSvg = el("div", "dobby-svg", this.vecWrap);
      this.eyes = null;
      try {
        if (typeof global.DobbyEyes === "function") {
          this.eyes = new global.DobbyEyes(this.vecSvg, this.opts.size, this.opts.eyeGeo);
        }
      } catch (e) { this.eyes = null; }
    }

    _applyAnchor() {
      const s = this.opts.size;
      this.root.style.left = this.anchor.x + "px";
      this.root.style.top = this.anchor.y + "px";
      this.root.style.margin = `${-s / 2}px 0 0 ${-s / 2}px`;
    }

    /* 移动"家"的位置（自动夹在可视范围内） */
    setAnchor(x, y) {
      const s = this.opts.size / 2 + 10;
      this.anchor.x = clamp(x, s, Math.max(s, this.mount.clientWidth - s));
      this.anchor.y = clamp(y, s + 40, Math.max(s + 40, this.mount.clientHeight - s));
      this._applyAnchor();
    }

    /* 当前脸部中心（mount 坐标系） */
    faceCenter() {
      return { x: this.anchor.x + this.pos.x, y: this.anchor.y + this.pos.y + 24 };
    }

    /* 小屏缩放（围绕锚点中心整体缩小，faceCenter 不变） */
    setViewportScale(k) { this._vs = k; }

    /* ---------------- 拖拽 / 点击 ---------------- */
    _bindDrag() {
      const root = this.root;
      let down = null;

      root.addEventListener("pointerdown", (e) => {
        down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
        this.dragging = true;
        this.vel.x = this.vel.y = 0;
        // 记录抓手：把指针增量除以视口缩放，保证小屏下手指按哪儿跟哪儿
        this._grabPX = e.clientX;
        this._grabPY = e.clientY;
        this._grabOX = this.pos.x;
        this._grabOY = this.pos.y;
        root.setPointerCapture(e.pointerId);
        if (this.onUserActivity) this.onUserActivity("drag-start");
      });

      root.addEventListener("pointermove", (e) => {
        if (!this.dragging || !down) return;
        down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
        this.dragTarget.x = this._grabOX + (e.clientX - this._grabPX) / this._vs;
        this.dragTarget.y = this._grabOY + (e.clientY - this._grabPY) / this._vs;
      });

      const release = () => {
        if (!this.dragging) return;
        this.dragging = false;
        if (down && down.moved < 6 && performance.now() - down.t < 400) {
          this.celebrate();          // 点击 → 庆祝
        } else if (this.opts.spin !== false && Math.hypot(this.vel.x, this.vel.y) > 900) {
          this.spin.t = 0;           // 快速甩出 → 顺势旋转（可关）
        }
        down = null;
      };
      root.addEventListener("pointerup", release);
      root.addEventListener("pointercancel", release);
    }

    /* ---------------- 表情切换 ---------------- */
    setEmotion(id, meta = {}) {
      const def = registry.get(String(id).trim());
      if (!def) return false;
      const changed = !this.emotion || this.emotion.id !== def.id;

      this.emotion = def;
      this.sticky = meta.sticky !== false;
      this.root.classList.toggle("sleeping", def.id === "01");
      this._renderAura(def);

      /* 矢量眼 / 素材图 两种模式 */
      const vector = !!(def.eyes && this.eyes);
      this.faceEl.classList.toggle("vector-mode", vector);
      if (vector) this.eyes.setEmotion(def.eyes);

      if (changed) {
        // 变形过渡：旧图淡出，新图弹性弹入（带回弹过冲）
        const next = this._front === this.imgA ? this.imgB : this.imgA;
        next.src = def.img;
        this._front.classList.remove("show");
        next.classList.add("show");
        next.classList.remove("pop");
        void next.offsetWidth;               // 重启动画
        next.classList.add("pop");
        this._front = next;
        // 弹跳挤压脉冲（intensity 调节幅度，整体轻柔）
        const inten = meta.intensity === "high" ? 1.3 : meta.intensity === "low" ? 0.5 : 1;
        this.squash.v = -3.2 * inten;
      }

      if (meta.tips != null) this._showTips(meta.tips);
      if (this.onChange) this.onChange(def, meta);
      return true;
    }

    /* ---------------- 常驻特效层 ---------------- */
    _renderAura(def) {
      const fx = def.effect || "none";
      if (this._fxType === fx) return;
      this._fxType = fx;
      this.root.dataset.fx = fx;
      this.auraEl.className = "dobby-aura fx-" + fx;
      this.auraEl.innerHTML =
        fx === "dots"
          ? '<div class="dots-bubble"><span></span><span></span><span></span></div>'
          : fx === "steam"
            ? '<i style="--sx:-16px;--d:0s"></i><i style="--sx:2px;--d:.55s"></i><i style="--sx:18px;--d:1.1s"></i>'
            : "";
    }

    /* 持续飘浮粒子（爱心 / 星光） */
    _spawnFxParticle() {
      if (this.auraEl.querySelectorAll(".fx-p").length >= 8) return;
      const p = el("span", "fx-p", this.auraEl);
      p.textContent = this._fxType === "hearts" ? "♥" : "✦";
      p.style.left = 26 + Math.random() * 48 + "%";
      p.style.animationDuration = 1.2 + Math.random() * 0.9 + "s";
      setTimeout(() => p.remove(), 2300);
    }

    /* ---------------- 说话（气泡 + 快速小抖动） ---------------- */
    speak(text, dur = 2200) {
      this._showTips(text);
      this.speakT = dur / 1000;
    }

    _showTips(text) {
      this.tipsEl.textContent = text;
      this.tipsEl.classList.add("show");
      clearTimeout(this._tipsTimer);
      this._tipsTimer = setTimeout(() => this.tipsEl.classList.remove("show"), 3200);
    }

    /* 说话（不切换表情，只出气泡） */
    say(text) { this._showTips(text); }

    /* 皮肤切换后刷新当前表情图（就地换图 + 轻微挤压反馈） */
    refreshSkin() {
      if (!this.emotion) return;
      this._front.src = this.emotion.img;
      this.squash.v = -2.5;
    }

    /* ---------------- AI 消息协议 ---------------- */
    handleAIMessage(raw) {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        this._fail("JSON 解析失败", raw);
        return false;
      }
      const id = msg && msg.emotionId != null ? String(msg.emotionId).trim() : "";
      const def = registry.get(id);
      if (!def) {
        this._fail(`未知 emotionId: "${id}"`, raw);
        this.setEmotion("00", { tips: msg && msg.tips, sticky: false }); // 回落待机
        return false;
      }
      this.setEmotion(id, { tips: msg.tips, intensity: msg.intensity });
      return true;
    }

    _fail(reason, raw) {
      if (this.onError) this.onError(reason, raw);
    }

    /* ---------------- 小跳一下（受惊 / 落地等） ---------------- */
    hop(strength = 1) {
      this.hopT = 0;
      this.squash.v = -3.5 * strength;
    }

    /* ---------------- 庆祝：彩带（旋转已按需关闭） ---------------- */
    celebrate() {
      if (this.opts.spin !== false) this.spin.t = 0;
      if (this.onCelebrate) this.onCelebrate();
      const c = this.faceCenter();
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 220 + Math.random() * 420;
        this.particles.push({
          x: c.x, y: c.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 320,          // 向上偏置
          w: 5 + Math.random() * 7,
          h: 8 + Math.random() * 8,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 14,
          hue: Math.floor(Math.random() * 360),
          life: 1.6 + Math.random() * 0.9,
          age: 0,
        });
      }
    }

    /* ---------------- 每帧心跳 ---------------- */
    tick(dt, t) {
      const def = this.emotion;
      if (!def) return;

      /* 跟随模式：锚点缓慢追向指针（拖着不走，睡觉不跟；不遮挡右侧面板） */
      if (this.follow && !this.dragging && def.id !== "01") {
        const rightLimit = Math.max(140, this.mount.clientWidth - 560);
        const fx = clamp(Math.min(pointer.x, rightLimit), 140, this.mount.clientWidth - 140);
        const fy = clamp(pointer.y - 60, 180, this.mount.clientHeight - 160);
        this.anchor.x += (fx - this.anchor.x) * lerpK(dt, 0.8);
        this.anchor.y += (fy - this.anchor.y) * lerpK(dt, 0.8);
        this._applyAnchor();
      }

      /* 拖拽弹簧 / 自由回弹 */
      if (this.dragging) {
        this.vel.x = (this.dragTarget.x - this.pos.x) * 14;
        this.vel.y = (this.dragTarget.y - this.pos.y) * 14;
        this.pos.x += (this.dragTarget.x - this.pos.x) * lerpK(dt, 16);
        this.pos.y += (this.dragTarget.y - this.pos.y) * lerpK(dt, 16);
      } else {
        const k = 110, d = 8.5;                 // 弹性回位
        this.vel.x += (-this.pos.x * k - this.vel.x * d) * dt;
        this.vel.y += (-this.pos.y * k - this.vel.y * d) * dt;
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
        if (!this._landChecked && Math.hypot(this.pos.x, this.pos.y) < 14 &&
            Math.hypot(this.vel.x, this.vel.y) > 260) {
          this.squash.v = -4;                    // 落地挤压
          this._landChecked = true;
        }
        if (Math.hypot(this.pos.x, this.pos.y) > 40) this._landChecked = false;
      }

      /* 视线：跟随指针；指针静止久了就自己四处张望（双正弦漫游） */
      let tx = 0, ty = 0;
      if (this.opts.gaze && !this.dragging) {
        if (performance.now() - pointer.t < 2500) {
          const c = this.faceCenter();
          tx = clamp((pointer.x - c.x) / (innerWidth * 0.35), -1, 1);
          ty = clamp((pointer.y - c.y) / (innerHeight * 0.35), -1, 1);
        } else {
          tx = Math.sin(t * 0.37) * 0.5 + Math.sin(t * 0.13) * 0.28;
          ty = Math.cos(t * 0.31) * 0.38;
        }
      }
      this.gaze.x += (tx - this.gaze.x) * lerpK(dt, 4.2);
      this.gaze.y += (ty - this.gaze.y) * lerpK(dt, 4.2);

      /* 待机漂浮（睡觉放缓；说话时快速小抖动） */
      const sleeping = def.id === "01";
      let bobAmp = 10 * def.bob * (sleeping ? 0.45 : 1);
      let bobSpeed = sleeping ? 1.1 : 2.1;
      if (this.speakT > 0) {
        this.speakT -= dt;
        bobSpeed *= 2.3;
        bobAmp *= 0.5;
      }
      const bobY = Math.sin(t * bobSpeed) * bobAmp;
      const sway = Math.sin(t * 1.05) * (sleeping ? 0.8 : 2);
      const breath = 1 + Math.sin(t * 1.35) * 0.01;   // 呼吸

      /* 眨眼（睡觉不眨） */
      let blinkScale = 1;
      if (this.opts.blink && !def.noBlink && !sleeping) {
        this._blinkTimer -= dt;
        if (this._blinkTimer <= 0) {
          this.blink = 0.0001;
          this._blinkTimer = 2.2 + Math.random() * 3.6;
        }
        if (this.blink > 0) {
          this.blink += dt / 0.22;               // 闭合→睁开→回弹过冲
          if (this.blink >= 2.35) this.blink = 0;
          const p = this.blink;
          if (p <= 1) {
            blinkScale = 1 - Math.sin(Math.PI * p) * 0.92;
          } else if (p <= 1.35) {
            blinkScale = 1 + Math.sin(Math.PI * (p - 1) / 0.35) * 0.06;
          }
        }
      }

      /* 矢量眼模式：脸部不整体眨眼，交给眼引擎（瞳孔追随 + gooey 变形） */
      if (this.faceEl.classList.contains("vector-mode") && this.eyes) {
        blinkScale = 1;
        this.eyes.tick(dt, t, this.gaze);
      }

      /* 表情切换挤压弹簧 */
      const sq = this.squash;
      sq.v += ((1 - sq.s) * 220 - sq.v * 13) * dt;
      sq.s += sq.v * dt;

      /* 跳跃位移 */
      let hopY = 0;
      if (this.hopT < 1) {
        this.hopT = Math.min(1, this.hopT + dt / 0.55);
        hopY = -Math.sin(Math.PI * this.hopT) * 46;
      }

      /* 旋转（点击庆祝 / 甩出） */
      let spinDeg = 0;
      if (this.spin.t < 1) {
        this.spin.t = Math.min(1, this.spin.t + dt / this.spin.dur);
        const p = this.spin.t;
        const ease = 1 - Math.pow(1 - p, 3);
        spinDeg = 360 * ease;
        // 彩带拖尾采样
        const c = this.faceCenter();
        this.ribbon.push({ x: c.x, y: c.y - 30, hue: (t * 420) % 360, age: 0 });
      }

      /* 应用变换（vs：小屏整体缩放，围绕锚点中心） */
      this.root.style.transform =
        `translate3d(${this.pos.x}px, ${this.pos.y + hopY}px, 0) scale(${this._vs})`;
      this.bobEl.style.transform = `translateY(${bobY}px)`;
      const rot = sway + this.gaze.x * 4.5 + spinDeg;
      this.tiltEl.style.transform =
        `translate(${this.gaze.x * 6}px, ${this.gaze.y * 5}px) rotate(${rot}deg)`;
      const sx = (1 + (1 - sq.s) * 0.55) * breath;
      this.faceEl.style.transform =
        `translate(${this.gaze.x * 9}px, ${this.gaze.y * 7}px) scale(${sx}, ${sq.s * blinkScale})`;

      /* 影子随位移缩放变淡 */
      const lift = clamp(Math.hypot(this.pos.x, this.pos.y) / 320, 0, 0.45);
      this.shadowEl.style.transform = `scaleX(${1 - lift})`;
      this.shadowEl.style.opacity = 0.85 - lift;

      /* 彩带纸屑 & 拖尾 */
      this._tickFx(dt);

      /* 常驻特效粒子（爱心 / 星光） */
      this._fxTimer -= dt;
      if (this._fxTimer <= 0 &&
          (this._fxType === "hearts" || this._fxType === "sparkle")) {
        this._fxTimer = 0.55;
        this._spawnFxParticle();
      }

      /* 引擎级自动入睡（默认关闭，行为层接管） */      if (this.opts.autosleep) {
        const idleFor = performance.now() - pointer.t;
        if (!this.sticky && !sleeping && idleFor > this.opts.autosleepDelay) {
          this.setEmotion("01", { sticky: false });
        } else if (sleeping && !this.sticky && idleFor < 200) {
          this.setEmotion("00", { sticky: false });
        }
      }
    }

    /* ---------------- 粒子 & 拖尾绘制 ---------------- */
    _tickFx(dt) {
      const fx = this.fx;
      const w = this.mount.clientWidth, h = this.mount.clientHeight;
      if (this._fxSize.w !== w || this._fxSize.h !== h) {
        this._fxSize = { w, h };
        fx.width = w;
        fx.height = h;
      }
      const ctx = fx.getContext("2d");
      ctx.clearRect(0, 0, fx.width, fx.height);

      /* 纸屑 */
      this.particles = this.particles.filter((p) => {
        p.age += dt;
        if (p.age > p.life) return false;
        p.vy += 900 * dt;                        // 重力
        p.vx *= 1 - 0.6 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const fade = 1 - p.age / p.life;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fade;
        ctx.fillStyle = `hsl(${p.hue}, 90%, 62%)`;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + 0.6 * Math.abs(Math.sin(p.age * 9)))); // 翻转感
        ctx.restore();
        return true;
      });

      /* 旋转彩带：色相渐变拖尾 */
      this.ribbon = this.ribbon.filter((pt) => (pt.age += dt) < 0.75);
      if (this.ribbon.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 1; i < this.ribbon.length; i++) {
          const a = this.ribbon[i - 1], b = this.ribbon[i];
          const alpha = (1 - b.age / 0.75) * 0.85;
          ctx.strokeStyle = `hsla(${b.hue}, 95%, 65%, ${alpha})`;
          ctx.lineWidth = 2 + (1 - b.age / 0.75) * 9;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        if (this.ribbon.length > 46) this.ribbon.splice(0, this.ribbon.length - 46);
      }
    }

    destroy() {
      DobbyEmo.instances.delete(this);
      removeEventListener("resize", this._onResize);
      this.root.remove();
      this.fx.remove();
    }

    /* ---------------- 共享心跳 ---------------- */
    static _ensureLoop() {
      if (DobbyEmo._rafId != null) return;
      DobbyEmo._lastT = performance.now();
      const loop = (now) => {
        const dt = clamp((now - DobbyEmo._lastT) / 1000, 0.0001, 0.05);
        DobbyEmo._lastT = now;
        const t = now / 1000;
        DobbyEmo.instances.forEach((inst) => inst.tick(dt, t));
        DobbyEmo._rafId = requestAnimationFrame(loop);
      };
      DobbyEmo._rafId = requestAnimationFrame(loop);
    }
  }

  /* ---------------- 导出 ---------------- */
  global.DobbyEmo = DobbyEmo;
  global.DobbyEmotions = {
    register,
    get: (id) => registry.get(String(id).trim()),
    list: () => [...registry.values()].sort((a, b) => a.id.localeCompare(b.id)),
    onChange: (fn) => registryListeners.add(fn),
    exportConfig: () =>
      JSON.stringify({ version: 1, model: "dobby-emo", emotions: [...registry.values()] }, null, 2),
    importConfig(json) {
      let data;
      try { data = typeof json === "string" ? JSON.parse(json) : json; }
      catch (e) { return { ok: false, reason: "配置文件不是合法 JSON" }; }
      if (!data || !Array.isArray(data.emotions)) return { ok: false, reason: "缺少 emotions 数组" };
      const bad = data.emotions.find((d) => !normalizeDef(d));
      if (bad) return { ok: false, reason: `表情项格式错误: ${JSON.stringify(bad).slice(0, 60)}` };
      register(data.emotions);
      return { ok: true, count: data.emotions.length };
    },
  };
})(window);

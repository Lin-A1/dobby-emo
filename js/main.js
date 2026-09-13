/* ============================================================
 * Dobby Emo · 展馆逻辑 + 行为反应层 + 羁绊系统
 *
 * 设计：用户选定的表情是"基准情绪"(userState)，
 * 真实交互产生"情境反应"(react) —— 临时覆盖，TTL 到后回落。
 * 羁绊(Bond)：摸摸/陪玩/喂食攒好感，升级解锁跟随模式。
 * ============================================================ */
(function () {
  "use strict";

  /* ============================================================
   * 合成音效（WebAudio，零素材）
   * ============================================================ */
  const Sound = (() => {
    let ctx = null, master = null;
    let muted = localStorage.getItem("dobby-muted") === "1";

    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.12;
        master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    function tone(freq, dur, type = "sine", when = 0, slide = 0) {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      const t0 = c.currentTime + when;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.9, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }
    return {
      unlock() { try { ensure(); } catch (e) {} },
      pop(group) {
        const base = { lifecycle: 300, emotion: 430, agent: 520 }[group] || 400;
        tone(base, 0.09, "sine", 0, base * 1.6);
      },
      squeak() { tone(880, 0.07, "triangle", 0, 1300); tone(1180, 0.06, "triangle", 0.07, 1600); },
      tada() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, "triangle", i * 0.07)); },
      munch() { tone(220, 0.06, "square", 0, 180); tone(190, 0.06, "square", 0.09, 150); },
      levelup() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, "sine", i * 0.08)); },
      toggle() {
        muted = !muted;
        localStorage.setItem("dobby-muted", muted ? "1" : "0");
        return muted;
      },
      get muted() { return muted; },
    };
  })();

  addEventListener("pointerdown", () => Sound.unlock(), { once: true });

  /* ============================================================
   * 注册预设表情 & 漫游实例
   * ============================================================ */
  DobbyEmotions.register(window.DOBBY_EMOTION_PRESET);

  const layer = document.getElementById("dobby-layer");
  const hero = document.querySelector(".hero-panel");
  const statusChip = document.getElementById("statusChip");
  const brandLogo = document.getElementById("brandLogo");

  const hr = hero.getBoundingClientRect();
  const dobby = new DobbyEmo(layer, {
    size: 300,
    anchor: { x: hr.left + hr.width * 0.72, y: hr.top + hr.height * 0.35 },
    autosleep: false,
    spin: false,   // 不旋转（庆祝只放彩带）
  });

  /* 布局稳定后把锚点钉到 hero 右侧空位（并随窗口变化保持） */
  const placeAnchor = () => {
    const r = hero.getBoundingClientRect();
    const mobile = innerWidth < 700;
    if (mobile) {
      // 小屏：角色缩小并驻守 hero 右下角（hero 预留了底部空间）
      dobby.setViewportScale(0.62);
      dobby.setAnchor(r.right - 92, r.bottom - 84);
    } else if (innerWidth < 1100) {
      dobby.setViewportScale(0.82);
      dobby.setAnchor(r.left + r.width * 0.72, r.top + r.height * 0.38);
    } else {
      dobby.setViewportScale(1);
      dobby.setAnchor(r.left + r.width * 0.72, r.top + r.height * 0.35);
    }
  };
  requestAnimationFrame(placeAnchor);
  addEventListener("load", placeAnchor);
  addEventListener("resize", placeAnchor);

  /* 滚出首屏时渐进淡出（避免挡住下方内容），回来再出现 */
  const updatePresence = () => {
    const r = hero.getBoundingClientRect();
    const vh = innerHeight;
    const visible = r.bottom > 60;
    layer.classList.toggle("away", !visible);
    // hero 只剩视口 40% 高度以下时开始线性淡出
    layer.style.opacity = visible
      ? Math.max(0, Math.min(1, (r.bottom - 60) / (vh * 0.4))).toFixed(2)
      : "0";
  };
  addEventListener("scroll", updatePresence, { passive: true });
  updatePresence();

  /* ============================================================
   * 通知 & 爱心飘字
   * ============================================================ */
  function toast(msg) {
    const box = document.getElementById("toasts");
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), 3400);
  }

  function floatHearts(n = 3) {
    const c = dobby.faceCenter();
    for (let i = 0; i < n; i++) {
      const h = document.createElement("span");
      h.className = "f-heart";
      h.textContent = "♥";
      h.style.left = c.x - 10 + (Math.random() - 0.5) * 90 + "px";
      h.style.top = c.y - 20 + (Math.random() - 0.5) * 40 + "px";
      h.style.setProperty("--dx", (Math.random() - 0.5) * 60 + "px");
      layer.appendChild(h);
      setTimeout(() => h.remove(), 1500);
    }
  }

  /* ============================================================
   * 羁绊（好感度）
   * ============================================================ */
  const Bond = (() => {
    const LEVELS = [
      { xp: 0, name: "陌生路人" },
      { xp: 25, name: "点头之交" },
      { xp: 60, name: "形影不离" },
      { xp: 110, name: "最佳损友" },
      { xp: 180, name: "灵魂搭档" },
    ];
    let xp = Number(localStorage.getItem("dobby-xp") || 0);
    let curLv = 0;

    const elLevel = document.getElementById("bondLevel");
    const elXp = document.getElementById("bondXp");
    const elFill = document.getElementById("bondFill");
    const elHint = document.getElementById("bondHint");

    function level() {
      let l = 0;
      for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].xp) l = i;
      return l;
    }
    function render() {
      const lv = level();
      elLevel.textContent = `Lv.${lv + 1} · ${LEVELS[lv].name}`;
      elXp.textContent = `${xp} XP`;
      const cur = LEVELS[lv].xp;
      const next = LEVELS[lv + 1] ? LEVELS[lv + 1].xp : cur;
      elFill.style.width = next > cur ? `${((xp - cur) / (next - cur)) * 100}%` : "100%";
      elHint.textContent = "摸摸它、陪它玩、喂饼干可以提升好感，升级有庆祝彩带哦";
    }
    function add(n) {
      xp += n;
      localStorage.setItem("dobby-xp", xp);
      render();
      const lv = level();
      if (lv > curLv) {
        curLv = lv;
        onLevelUp(lv);
      }
    }
    function onLevelUp(lv) {
      toast(`羁绊升级！Lv.${lv + 1} · ${LEVELS[lv].name}`);
      Sound.levelup();
      dobby.celebrate();
      floatHearts(8);
    }
    curLv = level();
    render();
    return { add, get level() { return level(); }, get xp() { return xp; } };
  })();

  /* ============================================================
   * 基准情绪 & 情境反应
   * ============================================================ */
  const userState = { id: "00" };
  let lastUserSet = -1e9;
  let ambientTimer = null;

  function setUser(id, meta = {}) {
    userState.id = String(id);
    lastUserSet = performance.now();
    clearTimeout(ambientTimer);
    dobby.setEmotion(userState.id, Object.assign({ sticky: true }, meta));
  }

  const PET_TIPS = ["再靠近一点嘛～", "诶？你在摸我吗", "嘿嘿，好痒"];
  const WHIP_TIPS = ["哇哦好快！", "跟不上啦～", "好晕好晕"];
  const TYPE_TIPS = ["你在写什么？", "嗯嗯，我看看…", "这个词是什么意思？"];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function react(id, opts = {}) {
    const ttl = opts.ttl || 1600;
    if (dobby.dragging) return;
    if (dobby.emotion && dobby.emotion.id === "01") return;
    if (performance.now() - lastUserSet < 2500) return;
    clearTimeout(ambientTimer);
    dobby.setEmotion(id, { tips: opts.tips, sticky: false, intensity: opts.intensity });
    ambientTimer = setTimeout(() => {
      dobby.setEmotion(userState.id, { sticky: true });
    }, ttl);
  }

  /* ============================================================
   * 指针行为：接近 / 抚摸 / 挥动
   * ============================================================ */
  let lastPX = null, lastPY = null, lastPT = 0;
  let lastPointer = performance.now();
  let sleeping = false;
  const cd = {};
  function cooldown(key, ms) {
    const n = performance.now();
    if ((cd[key] || 0) > n) return false;
    cd[key] = n + ms;
    return true;
  }

  addEventListener("pointermove", (e) => {
    const now = performance.now();
    lastPointer = now;

    /* 唤醒 */
    if (sleeping && userState.id !== "01") {
      sleeping = false;
      dobby.setEmotion(userState.id, { tips: "唔…你回来啦", sticky: true });
      Bond.add(2);
      return;
    }

    if (lastPX != null) {
      const dt = Math.max(now - lastPT, 1);
      const speed = Math.hypot(e.clientX - lastPX, e.clientY - lastPY) / dt;
      const c = dobby.faceCenter();
      const d = Math.hypot(e.clientX - c.x, e.clientY - c.y);

      if (speed > 1.3 && cooldown("whip", 4000)) {
        react(pick(["13", "11"]), { tips: pick(WHIP_TIPS), ttl: 1300 });
        Bond.add(2);
      } else if (d < 90 && cooldown("pet", 5000)) {
        react("12", { tips: "♥", ttl: 1300 });
        Sound.squeak();
        floatHearts(3);
        Bond.add(6);
      } else if (d < 190 && cooldown("close", 7000)) {
        react("18", { tips: pick(PET_TIPS), ttl: 1700 });
        Bond.add(2);
      }
    }
    lastPX = e.clientX; lastPY = e.clientY; lastPT = now;
  }, { passive: true });

  /* ---------------- 点击空白：吓一跳 ---------------- */
  addEventListener("pointerdown", (e) => {
    if (e.target.closest("#dobby-layer .dobby, button, a, input, textarea, select, .wall-item")) return;
    dobby.hop(0.8);
    if (Math.random() < 0.35 && cooldown("scare", 9000)) {
      react("14", { tips: "哇！", ttl: 1100 });
    }
  });

  /* ---------------- 快速滚动：转晕 ---------------- */
  let lastScrollY = scrollY, lastScrollT = performance.now();
  addEventListener("scroll", () => {
    const now = performance.now();
    const dt = now - lastScrollT;
    const dy = scrollY - lastScrollY;
    lastScrollY = scrollY; lastScrollT = now;
    if (dt > 300) return;
    const v = Math.abs(dy) / dt;
    if (v > 2.2 && cooldown("scroll", 6000)) {
      react("34", { tips: "转晕了…", ttl: 1300 });
    }
  }, { passive: true });

  /* ---------------- 静置入睡（25s） + 盯太久会害羞 ---------------- */
  setInterval(() => {
    const now = performance.now();
    if (!sleeping && userState.id !== "01" &&
        now - lastPointer > 25000 && !dobby.dragging) {
      sleeping = true;
      dobby.setEmotion("01", { sticky: false });
      return;
    }
    // 指针停着不动、还一直近距离盯着它
    if (!sleeping && !dobby.dragging && now - lastPT > 4000 &&
        lastPX != null && dobby.emotion && dobby.emotion.id === userState.id) {
      const c = dobby.faceCenter();
      if (Math.hypot(lastPX - c.x, lastPY - c.y) < 180 && cooldown("stare", 45000)) {
        react("18", { tips: "一直盯着我看…会害羞的", ttl: 1800 });
      }
    }
  }, 3000);

  /* ---------------- 标签页切换：睡着了 / 回来了 ---------------- */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (!sleeping) {
        sleeping = true;
        dobby.setEmotion("01", { sticky: false });
      }
    } else if (sleeping && userState.id !== "01") {
      sleeping = false;
      dobby.setEmotion(userState.id, { tips: "你回来啦！", sticky: true });
      Bond.add(2);
    }
  });

  /* ---------------- 连戳它 → 生气 ---------------- */
  const pokes = [];
  dobby.onCelebrate = () => {
    Sound.tada();
    Bond.add(4);
    const now = performance.now();
    pokes.push(now);
    while (pokes.length && pokes[0] < now - 2000) pokes.shift();
    if (pokes.length >= 3 && cooldown("poke", 5000)) {
      react("15", { tips: "别戳了！", ttl: 1500 });
    }
  };

  /* ---------------- 按键太吵 → 捂耳 ---------------- */
  const keys = [];
  addEventListener("keydown", (e) => {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    if (e.key.startsWith("Arrow") || e.key === "Shift" || e.key === "Control" || e.key === "Meta" || e.key === "Alt") return;
    const now = performance.now();
    keys.push(now);
    while (keys.length && keys[0] < now - 1000) keys.shift();
    if (keys.length > 6 && cooldown("keys", 12000)) {
      react("15", { tips: "吵死啦！", ttl: 1400 });
    }
  });

  /* ---------------- autonomous 小动作 & 闲聊 ---------------- */
  (function idleActs() {
    setTimeout(() => {
      const now = performance.now();
      if (!sleeping && !dobby.dragging &&
          now - lastPointer > 6000 && now - lastUserSet > 5000 &&
          dobby.emotion && dobby.emotion.id === userState.id &&
          userState.id !== "01") {
        react(pick(["20", "31", "14"]), { ttl: 1400 });
      }
      idleActs();
    }, 9000 + Math.random() * 8000);
  })();

  const CHATTER = [
    "今天也要开心呀", "你在忙什么？", "我在这儿呢～", "好无聊，陪陪我嘛",
    "听说点我会有彩带哦", "拖动我去逛逛页面？",
  ];
  const CHATTER_NIGHT = ["夜深了，还不睡吗…", "我都有点困了…"];
  const CHATTER_BOND = ["最喜欢你了 ♥", "有你在真好", "明天也一起玩吧"];
  (function chatter() {
    setTimeout(() => {
      const now = performance.now();
      if (!sleeping && !dobby.dragging && document.visibilityState === "visible" &&
          now - lastPointer > 5000 && dobby.emotion && dobby.emotion.id === userState.id) {
        const hour = new Date().getHours();
        let pool = CHATTER;
        if (hour >= 23 || hour < 6) pool = CHATTER_NIGHT;
        else if (Bond.level >= 3) pool = CHATTER.concat(CHATTER_BOND);
        dobby.say(pick(pool));
      }
      chatter();
    }, 16000 + Math.random() * 10000);
  })();

  /* ============================================================
   * 状态栏 / 徽标联动
   * ============================================================ */
  let firstChange = true;
  dobby.onChange = (def) => {
    const list = DobbyEmotions.list();
    statusChip.textContent = `ID ${def.id} / ${list.length} · ${def.name}`;
    brandLogo.src = def.img;
    document.querySelectorAll(".wall-item").forEach((n) => {
      n.classList.toggle("active", n.dataset.id === def.id);
    });
    if (firstChange) { firstChange = false; return; }
    Sound.pop(def.group);
  };

  dobby.onError = (reason) => {
    userState.id = "00";
    log(`✗ ${reason}`, "err");
  };

  /* ---------------- 开场打招呼 ---------------- */
  setTimeout(() => {
    react("11", { tips: "嗨！我是 Dobby 👋 靠近我、拖着我玩～", ttl: 3600 });
  }, 700);

  /* ---------------- 喂食 ---------------- */
  const feedBtn = document.getElementById("feedBtn");
  feedBtn.addEventListener("click", () => {
    if (feedBtn.disabled) return;
    feedBtn.disabled = true;
    setTimeout(() => (feedBtn.disabled = false), 15000);
    Sound.munch();
    floatHearts(5);
    Bond.add(10);
    react("11", { tips: "好吃！还要～", ttl: 1500 });
  });

  /* ============================================================
   * 陈列墙
   * ============================================================ */
  const wall = document.getElementById("wall");
  const wallCount = document.getElementById("wallCount");
  const GROUP_NAMES = { lifecycle: "生命", emotion: "情绪", agent: "智能体", custom: "自定义" };

  function renderWall() {
    const list = DobbyEmotions.list();
    wall.innerHTML = "";
    wallCount.textContent = `共 ${list.length} 种`;
    list.forEach((def) => {
      const item = document.createElement("div");
      item.className = "wall-item";
      item.dataset.id = def.id;
      item.innerHTML = `
        <span class="w-group">${GROUP_NAMES[def.group] || def.group}</span>
        <img src="${def.img}" alt="${def.name}" loading="lazy">
        <div class="w-name">${def.name}</div>
        <div class="w-id">${def.id} · ${def.en}</div>`;
      item.addEventListener("click", () => {
        stopTour();
        setUser(def.id, { tips: def.name });
      });
      let hoverTimer = null;
      item.addEventListener("mouseenter", () => {
        if (dobby.dragging) return;
        clearTimeout(ambientTimer);
        clearTimeout(hoverTimer);
        dobby.setEmotion(def.id, { tips: def.name, sticky: false });
      });
      item.addEventListener("mouseleave", () => {
        hoverTimer = setTimeout(() => {
          if (!dobby.dragging) dobby.setEmotion(userState.id, { sticky: true });
        }, 120);
      });
      wall.appendChild(item);
    });
    if (dobby.emotion) dobby.onChange(dobby.emotion, {});
  }
  renderWall();
  DobbyEmotions.onChange(renderWall);

  /* ---------------- 键盘翻页 ---------------- */
  addEventListener("keydown", (e) => {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    stopTour();
    const list = DobbyEmotions.list();
    if (!list.length) return;
    const idx = list.findIndex((d) => dobby.emotion && d.id === dobby.emotion.id);
    const next = e.key === "ArrowRight"
      ? list[(idx + 1 + list.length) % list.length]
      : list[(idx - 1 + list.length) % list.length];
    setUser(next.id, { tips: next.name });
  });

  /* ============================================================
   * AI 消息控制台
   * ============================================================ */
  const aiInput = document.getElementById("aiInput");
  const aiLog = document.getElementById("aiLog");

  function log(text, cls) {
    const li = document.createElement("li");
    if (cls) li.className = cls;
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    li.innerHTML = `<time>${time}</time>${text.replace(/</g, "&lt;")}`;
    aiLog.prepend(li);
    while (aiLog.children.length > 30) aiLog.lastChild.remove();
  }

  function send(msg) {
    const text = (msg != null ? msg : aiInput.value).trim();
    if (!text) return;
    const ok = dobby.handleAIMessage(text);
    if (ok) {
      const m = text.match(/"emotionId"\s*:\s*"(\d+)"/);
      if (m) { userState.id = m[1]; lastUserSet = performance.now(); }
    }
    log(`${ok ? "✓" : "✗"} ${text}`, ok ? "ok" : "err");
  }

  document.getElementById("aiSend").addEventListener("click", () => send());
  aiInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
  });
  aiInput.addEventListener("input", () => {
    if (cooldown("type", 1800)) {
      react("30", { tips: pick(TYPE_TIPS), ttl: 1500 });
      Bond.add(1);
    }
  });
  document.querySelectorAll("[data-sample]").forEach((btn) => {
    btn.addEventListener("click", () => {
      aiInput.value = btn.dataset.sample;
      send(btn.dataset.sample);
    });
  });

  /* ============================================================
   * 聊天演示：像真实聊天机器人一样驱动头像
   * 收到消息 → 思考光环 → 带着表情开口回复
   * ============================================================ */
  const chatLog = document.getElementById("chatLog");
  const chatInput = document.getElementById("chatInput");
  const CHAT_RULES = [
    { re: /你好|嗨|哈喽|hello|hi/i, emo: "10", reply: "你好呀！今天过得怎么样？" },
    { re: /你是谁|名字|介绍/i, emo: "19", reply: "我是 Dobby，你的桌面小助手～" },
    { re: /喜欢|爱/i, emo: "12", reply: "我也最喜欢你了 ♥" },
    { re: /错|报错|bug|失败|不行/i, emo: "32", reply: "出错了？让我看看日志…啊，是这里！", intensity: "high" },
    { re: /谢谢|感谢|thx/i, emo: "18", reply: "嘿嘿，不客气～" },
    { re: /天气|下雨|晴天/i, emo: "30", reply: "让我想想…今天适合写代码！" },
    { re: /再见|拜拜|晚安/i, emo: "16", reply: "拜拜…记得回来找我玩" },
    { re: /困|睡觉|好累/i, emo: "01", reply: "那我先睡一会儿…zZ" },
    { re: /哈哈|好笑|笑死/i, emo: "11", reply: "哈哈哈对吧！" },
    { re: /完成|做好|搞定|成功/i, emo: "33", reply: "太棒了！庆祝一下 🎉" },
    { re: /在吗|在不在/i, emo: "20", reply: "在呢在呢，一直都在～" },
  ];
  const CHAT_FALLBACK = [
    { emo: "10", reply: "嗯嗯，我在听！" },
    { emo: "13", reply: "好耶！" },
    { emo: "20", reply: "你猜～" },
    { emo: "30", reply: "这个问题值得想一想…" },
    { emo: "14", reply: "哇，真的吗？" },
  ];
  let chatBusy = false;

  function chatBubble(text, who) {
    const b = document.createElement("div");
    b.className = "msg " + who;
    b.textContent = text;
    chatLog.appendChild(b);
    chatLog.scrollTop = chatLog.scrollHeight;
    return b;
  }
  function chatTyping() {
    const t = document.createElement("div");
    t.className = "chat-typing";
    t.innerHTML = "<i></i><i></i><i></i>";
    chatLog.appendChild(t);
    chatLog.scrollTop = chatLog.scrollHeight;
    return t;
  }

  function chatSend() {
    const text = chatInput.value.trim();
    if (!text || chatBusy) return;
    chatBusy = true;
    chatInput.value = "";
    chatBubble(text, "user");

    // 1. 思考中：头顶光环 + 聊天气泡圆点
    const rule = CHAT_RULES.find((r) => r.re.test(text)) ||
      CHAT_FALLBACK[Math.floor(Math.random() * CHAT_FALLBACK.length)];
    dobby.setEmotion("30", { tips: "正在思考…", sticky: false });
    const typing = chatTyping();

    // 2. 回复：表情 + 说话抖动 + 气泡
    const thinkMs = 900 + Math.min(text.length * 40, 1200);
    setTimeout(() => {
      typing.remove();
      chatBubble(rule.reply, "bot");
      setUser(rule.emo);
      dobby.speak(rule.reply, Math.max(1600, rule.reply.length * 110));
      if (rule.intensity) {
        dobby.setEmotion(rule.emo, { intensity: rule.intensity, sticky: true });
      }
      chatBusy = false;
    }, thinkMs);
  }

  document.getElementById("chatSend").addEventListener("click", chatSend);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") chatSend();
  });
  // 开场白
  setTimeout(() => {
    chatBubble("嗨，我是 Dobby！跟我聊聊天吧～", "bot");
  }, 1800);

  /* ---------------- 自动巡演 ---------------- */
  const tourToggle = document.getElementById("tourToggle");
  const tourInterval = document.getElementById("tourInterval");
  let tourTimer = null;

  function startTour() {
    stopTour();
    tourTimer = setInterval(() => {
      const list = DobbyEmotions.list();
      if (!list.length) return;
      const idx = list.findIndex((d) => d.id === userState.id);
      const next = list[(idx + 1 + list.length) % list.length];
      setUser(next.id);
    }, Number(tourInterval.value));
  }
  function stopTour() {
    if (tourTimer) { clearInterval(tourTimer); tourTimer = null; }
    if (tourToggle.checked) tourToggle.checked = false;
  }
  tourToggle.addEventListener("change", () => (tourToggle.checked ? startTour() : stopTour()));
  tourInterval.addEventListener("change", () => { if (tourToggle.checked) startTour(); });

  /* ---------------- 配置导入 / 导出 ---------------- */
  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([DobbyEmotions.exportConfig()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dobby-emo-config.json";
    a.click();
    URL.revokeObjectURL(a.href);
    log("✓ 配置已导出", "ok");
  });

  const importFile = document.getElementById("importFile");
  document.getElementById("importBtn").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = DobbyEmotions.importConfig(reader.result);
      log(res.ok ? `✓ 已导入 ${res.count} 个表情配置` : `✗ 导入失败：${res.reason}`, res.ok ? "ok" : "err");
      importFile.value = "";
    };
    reader.readAsText(file);
  });

  /* ============================================================
   * 黑白形象切换（dark: 经典黑 / light: 奶白）
   * ============================================================ */
  const SKINS = { dark: "assets/sw", light: "assets/sw-white" };
  const skinToggle = document.getElementById("skinToggle");
  let skin = localStorage.getItem("dobby-skin") === "light" ? "light" : "dark";

  function applySkin(s, silent) {
    skin = s;
    localStorage.setItem("dobby-skin", s);
    // 注册表内就地替换图片路径
    DobbyEmotions.list().forEach((def) => {
      def.img = `${SKINS[s]}/${def.id}.webp`;
      const im = new Image(); im.src = def.img;   // 预载
    });
    skinToggle.textContent = s === "dark" ? "🤍" : "🖤";
    skinToggle.title = s === "dark" ? "切换到白色形象" : "切换到黑色形象";
    renderWall();
    if (dobby.emotion) {
      dobby.refreshSkin();
      brandLogo.src = dobby.emotion.img;
    }
    if (!silent) log(`✓ 已切换为${s === "dark" ? "黑色" : "白色"}形象`, "ok");
  }
  skinToggle.addEventListener("click", () => applySkin(skin === "dark" ? "light" : "dark"));
  applySkin(skin, true);   // 启动时应用持久化的选择

  /* ---------------- 主题 & 音效开关 ---------------- */
  const themeToggle = document.getElementById("themeToggle");
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const dark = html.dataset.theme === "dark";
    html.dataset.theme = dark ? "light" : "dark";
    themeToggle.textContent = dark ? "☀️" : "🌙";
  });

  const soundToggle = document.getElementById("soundToggle");
  if (Sound.muted) soundToggle.textContent = "🔇";
  soundToggle.addEventListener("click", () => {
    soundToggle.textContent = Sound.toggle() ? "🔇" : "🔊";
  });

  /* ---------------- 暴露给控制台调试 ---------------- */
  window.dobby = dobby;
  window.DobbyEmotions = DobbyEmotions;
  window.DobbyBond = Bond;
  window.dobbySet = (id, meta) => setUser(id, meta);   // 调试/外部接线入口（会清掉情境反应定时器）
})();

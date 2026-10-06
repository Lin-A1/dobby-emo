/* ============================================================
 * Dobby Emo · 表情馆
 * 舞台 + 陈列墙：每张缩略图都是「底图 + 无眼补丁 + 眼环」的实时渲染，
 * 与主页角色同一套几何，所以两处显示一致；悬停时这一张才动起来。
 * ============================================================ */
(function () {
  "use strict";

  DobbyEmotions.register(window.DOBBY_EMOTION_PRESET);

  const GROUP_NAMES = { lifecycle: "生命", emotion: "情绪", agent: "智能体", custom: "自定义" };
  const GROUP_ORDER = ["all", "lifecycle", "emotion", "agent"];

  /* 每个表情的一句话说明：给舞台用（素材画了什么、特效在做什么） */
  const DESC = {
    "00": "常态：眼睛在平静与聆听之间换，偶尔眨一下眼，视线跟着你走",
    "01": "闭眼成两条弧线，右上角飘 z 字，只剩缓慢呼吸",
    "10": "弯月笑眼，嘴角上扬",
    "11": "大笑：笑眼加大张的嘴",
    "12": "心形眼 + 腮红",
    "13": "星星眼，兴奋到发光",
    "14": "圆睁到最大，惊讶时眼睛是定住的（不眨眼）",
    "15": "怒目：两道斜眉压下来，头顶冒蒸汽",
    "16": "眼睛下垂、眉毛内八",
    "17": "哭到闭眼，两行泪",
    "18": "羞怯的小圆眼 + 浓腮红，视线往旁边躲",
    "19": "墨镜一戴，谁也不爱",
    "20": "只闭右眼——矢量眼才做得到的单眼闭合",
    "30": "在四组扫读环之间来回扫，像在检索；头顶冒思考气泡",
    "31": "搜索：眼睛持续扫视，头顶环绕探照点",
    "32": "叉叉眼，整只猫在故障抖动",
    "33": "闪光眼 + 环绕星光",
    "34": "螺旋眼，头顶一条流动的进度光带"
  };

  const wall = document.getElementById("wall");
  const wallCount = document.getElementById("wallCount");
  const filters = document.getElementById("filters");
  const stageBox = document.getElementById("stageBox");
  const stageId = document.getElementById("stageId");
  const stageName = document.getElementById("stageName");
  const stageEn = document.getElementById("stageEn");
  const stageDesc = document.getElementById("stageDesc");
  const stageTags = document.getElementById("stageTags");
  const statusChip = document.getElementById("statusChip");
  const brandLogo = document.getElementById("brandLogo");

  let skin = localStorage.getItem("dobby-skin") === "light" ? "light" : "dark";
  let filter = "all";
  let current = null;
  let stageThumb = null;
  const thumbs = new Map();

  /* ---------------- 舞台 ---------------- */
  function showOnStage(def) {
    current = def;
    if (stageThumb) stageThumb.destroy();
    stageThumb = new EmotionThumb(stageBox, def, skin, { animate: true });
    stageId.textContent = def.id;
    stageName.textContent = def.name;
    stageEn.textContent = def.en || "";
    stageDesc.textContent = DESC[def.id] || "";
    stageTags.innerHTML =
      `<span>${GROUP_NAMES[def.group] || def.group}</span>` +
      (def.effect && def.effect !== "none" ? `<span>特效 ${def.effect}</span>` : "") +
      (def.eyeRings ? "<span>矢量眼环</span>" : "<span>素材表情</span>");
    statusChip.textContent = `ID ${def.id} / ${DobbyEmotions.list().length} · ${def.name}`;
    brandLogo.src = def.img;
    document.querySelectorAll(".wcard").forEach((n) => n.classList.toggle("active", n.dataset.id === def.id));
  }

  /* ---------------- 陈列墙 ---------------- */
  function buildWall() {
    const list = DobbyEmotions.list().filter((d) => filter === "all" || d.group === filter);
    wall.innerHTML = "";
    thumbs.forEach((t) => t.destroy());
    thumbs.clear();

    list.forEach((def) => {
      const card = document.createElement("div");
      card.className = "wcard";
      card.dataset.id = def.id;
      card.innerHTML =
        `<span class="w-group">${GROUP_NAMES[def.group] || def.group}</span>` +
        `<div class="wface"></div>` +
        `<div class="wmeta"><div class="w-name">${def.name}</div>` +
        `<div class="w-id">${def.id} · ${def.en}</div></div>`;

      const face = card.querySelector(".wface");
      const thumb = new EmotionThumb(face, def, skin, {});
      thumbs.set(def.id, thumb);

      /* 悬停才让这张动起来（18 张同时跑没必要，也费电） */
      card.addEventListener("mouseenter", () => thumb.play());
      card.addEventListener("mouseleave", () => thumb.stop());
      card.addEventListener("click", () => showOnStage(def));
      wall.appendChild(card);
    });

    wallCount.textContent = `共 ${list.length} 种`;
    if (current) {
      const still = list.some((d) => d.id === current.id);
      document.querySelectorAll(".wcard").forEach((n) => n.classList.toggle("active", n.dataset.id === current.id));
      if (!still) stageId.classList.add("dim");
    }
  }

  function buildFilters() {
    const all = DobbyEmotions.list();
    const counts = { all: all.length };
    all.forEach((d) => { counts[d.group] = (counts[d.group] || 0) + 1; });
    filters.innerHTML = "";
    GROUP_ORDER.forEach((key) => {
      if (key !== "all" && !counts[key]) return;
      const b = document.createElement("button");
      b.className = "filter" + (filter === key ? " active" : "");
      b.innerHTML = `${key === "all" ? "全部" : GROUP_NAMES[key]}<i>${counts[key] || 0}</i>`;
      b.addEventListener("click", () => {
        filter = key;
        buildFilters();
        buildWall();
      });
      filters.appendChild(b);
    });
  }

  /* ---------------- 键盘 / 皮肤 / 主题 ---------------- */
  addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const list = DobbyEmotions.list();
    if (!list.length) return;
    const idx = list.findIndex((d) => current && d.id === current.id);
    const next = e.key === "ArrowRight"
      ? list[(idx + 1 + list.length) % list.length]
      : list[(idx - 1 + list.length) % list.length];
    /* 翻到当前筛选外的表情时，自动切回「全部」，免得舞台与墙对不上 */
    if (filter !== "all" && next.group !== filter) { filter = "all"; buildFilters(); }
    buildWall();
    showOnStage(next);
  });

  const skinToggle = document.getElementById("skinToggle");
  function syncSkinBtn() { skinToggle.classList.toggle("off", skin !== "dark"); }
  skinToggle.addEventListener("click", () => {
    skin = skin === "dark" ? "light" : "dark";
    localStorage.setItem("dobby-skin", skin);
    syncSkinBtn();
    buildWall();
    if (current) showOnStage(current);
  });
  syncSkinBtn();

  const themeToggle = document.getElementById("themeToggle");
  const syncTheme = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    themeToggle.classList.toggle("off", !dark);
  };
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark";
    syncTheme();
  });
  document.documentElement.dataset.theme = localStorage.getItem("dobby-theme") || "dark";
  syncTheme();

  /* ---------------- 启动 ---------------- */
  buildFilters();
  buildWall();
  showOnStage(DobbyEmotions.get("00") || DobbyEmotions.list()[0]);

  window.galleryShow = showOnStage;
})();

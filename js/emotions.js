/* ============ Dobby Emo · 表情数据 ============
 * ID 分段约定（沿用 aora-bot）:
 *   00-09 生命周期  10-29 情绪  30-49 智能体状态  50+ 自定义
 * 空位保留，已有 ID 永不变更。
 *
 * 这一版只保留 emoball（aora-bot / Emotion Ball）里存在的状态 —— 那边没有的
 * （大笑 / 花痴心形眼 / 哭泣 / 耍酷墨镜 / 眨眼）不再保留，眼睛一律交给
 * 眼环驱动。每个状态的眼环池、眨眼间隔都直接对应 emoball 的同名状态：
 *
 *   本表   对应 emoball   眼环池
 *   00 待机    02 待机放空    0, 8
 *   01 睡觉    00 睡眠        13, 22, 4
 *   10 开心    10 开心        2, 11, 17, 19
 *   13 兴奋    17 慌张        3, 21
 *   14 惊讶    13 惊讶        3, 21
 *   15 生气    21 生气        7, 16
 *   16 难过    12 失落        4, 13, 22
 *   18 害羞    14 害羞        0, 24, 13
 *   30 思考中  30 思考中      8, 16, 14, 17, 5
 *   31 搜索中  40 检索资料    15, 9, 3, 20, 12, 18
 *   32 出错了  34 出错        3, 21
 *   33 完成    33 任务完成    2, 8, 17
 *   34 处理中  32 处理中忙碌  7, 16, 11, 10
 *
 * eyeRings 字段：
 *   pool     眼环池（池内按 poolMs 轮换；环的形状与「瞟向哪边」都烘焙在点里）
 *   poolMs   池内轮换间隔基准
 *   blinkMs  眨眼间隔（null = 不眨眼）
 *   open     常驻开合度（1 = 睁满）
 *   look     采纳「环自带偏移」的比例：0 = 只取形状、眼睛居中，越大越保留
 *            「瞟向哪边」。我们这张脸比小球小得多、眼睛下方就是嘴，所以
 *            整体收着用（0 ~ 0.55）
 *   patch    无眼补丁（由 tools/make-patches.py 生成：抹掉烘焙眼睛的脸）
 *   x/y/w/h  补丁位置（画布百分比）
 *
 * effect 只保留表达「状态」的：think 思考气泡 | orbit 环绕探照点 | bar 进度光带
 *          | glitch 故障抖动 | steam 冒蒸汽 | sleep 睡觉（月亮 + zzz）
 */
/* 素材版本号：图片本身没有版本，浏览器会一直用缓存里的旧图。
   补丁图重生成过、底图也可能重生成，所以统一挂一个版本参数 */
window.DOBBY_ASSET_V = "80";

window.DOBBY_EMOTION_PRESET = [

  { id: "00", name: "待机", en: "Idle", group: "lifecycle", img: "assets/sw/00.webp?v=80",
    eyeRings: { pool: [0, 8], poolMs: 4200, blinkMs: 6000, look: 0.3, patch: "assets/sw/00-patch.webp?v=80", x: 31.34, y: 42.903, w: 31.26, h: 21.132 } },
  { id: "01", name: "睡觉", en: "Sleep", group: "lifecycle", img: "assets/sw/01.webp?v=80", effect: "sleep",
    eyeRings: { pool: [13, 22, 4], poolMs: 6000, blinkMs: null, open: 0.35, look: 0.0, patch: "assets/sw/01-patch.webp?v=80", x: 26.236, y: 46.411, w: 42.105, h: 14.833 } },

  { id: "10", name: "开心", en: "Happy", group: "emotion", img: "assets/sw/10.webp?v=80",
    eyeRings: { pool: [2, 11, 17, 19], poolMs: 3200, blinkMs: 2500, size: 0.82, look: 0.15, patch: "assets/sw/10-patch.webp?v=80", x: 27.592, y: 44.019, w: 38.676, h: 16.427 } },
  { id: "13", name: "兴奋", en: "Excited", group: "emotion", img: "assets/sw/13.webp?v=80",
    eyeRings: { pool: [3, 21], poolMs: 1800, blinkMs: 1200, size: 0.86, look: 0.25, patch: "assets/sw/13-patch.webp?v=80", x: 26.396, y: 35.805, w: 43.381, h: 24.641 } },
  { id: "14", name: "惊讶", en: "Surprised", group: "emotion", img: "assets/sw/14.webp?v=80",
    eyeRings: { pool: [3, 21], poolMs: 1800, blinkMs: 1800, open: 1.08, look: 0.0, patch: "assets/sw/14-patch.webp?v=80", x: 28.309, y: 41.228, w: 39.075, h: 21.531 } },
  { id: "15", name: "生气", en: "Angry", group: "emotion", img: "assets/sw/15.webp?v=80", effect: "steam",
    eyeRings: { pool: [7, 16], poolMs: 3600, blinkMs: 3500, look: 0.2, patch: "assets/sw/15-patch.webp?v=80", x: 27.99, y: 43.062, w: 39.234, h: 18.9 } },
  { id: "16", name: "难过", en: "Sad", group: "emotion", img: "assets/sw/16.webp?v=80",
    eyeRings: { pool: [4, 13, 22], poolMs: 4600, blinkMs: 4000, look: 0.2, patch: "assets/sw/16-patch.webp?v=80", x: 28.788, y: 44.498, w: 37.48, h: 17.624 } },
  { id: "18", name: "害羞", en: "Shy", group: "emotion", img: "assets/sw/18.webp?v=80",
    eyeRings: { pool: [0, 24, 13], poolMs: 3600, blinkMs: 3000, look: 0.4, patch: "assets/sw/18-patch.webp?v=80", x: 29.904, y: 44.099, w: 34.848, h: 18.82 } },

  { id: "30", name: "思考中", en: "Thinking", group: "agent", img: "assets/sw/30.webp?v=80", effect: "think",
    eyeRings: { pool: [8, 16, 14, 17, 5], poolMs: 1600, blinkMs: 3500, look: 0.5, patch: "assets/sw/30-patch.webp?v=80", x: 31.1, y: 40.271, w: 33.812, h: 19.139 } },
  { id: "31", name: "搜索中", en: "Searching", group: "agent", img: "assets/sw/31.webp?v=80", effect: "orbit",
    eyeRings: { pool: [15, 9, 3, 20, 12, 18], poolMs: 1500, blinkMs: 1600, look: 0.55, patch: "assets/sw/31-patch.webp?v=80", x: 34.609, y: 41.228, w: 36.045, h: 20.654 } },
  { id: "32", name: "出错了", en: "Error", group: "agent", img: "assets/sw/32.webp?v=80", effect: "glitch",
    eyeRings: { pool: [3, 21], poolMs: 1800, blinkMs: null, open: 1.05, look: 0.0, patch: "assets/sw/32-patch.webp?v=80", x: 28.23, y: 41.707, w: 38.437, h: 21.053 } },
  { id: "33", name: "完成", en: "Success", group: "agent", img: "assets/sw/33.webp?v=80",
    eyeRings: { pool: [2, 8, 17], poolMs: 3000, blinkMs: 2200, size: 0.86, look: 0.2, patch: "assets/sw/33-patch.webp?v=80", x: 30.144, y: 38.995, w: 35.486, h: 20.893 } },
  { id: "34", name: "处理中", en: "Loading", group: "agent", img: "assets/sw/34.webp?v=80", effect: "bar",
    eyeRings: { pool: [7, 16, 11, 10], poolMs: 2800, blinkMs: 2800, look: 0.25, patch: "assets/sw/34-patch.webp?v=80", x: 26.715, y: 40.51, w: 41.547, h: 21.691 } },
];

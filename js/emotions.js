/* ============ Dobby Emo · 表情数据 ============
 * ID 分段约定（沿用 aora-bot）:
 *   00-09 生命周期  10-29 情绪  30-49 智能体状态  50+ 自定义
 * 空位保留，已有 ID 永不变更。
 *
 * 表情由两层组成：
 *   pose  驱动头身姿态：整体缩放、倾斜、左右转头、俯仰和位移
 *   shell 驱动外壳情绪：色调、轮廓光、轻微位移与呼吸倍率
 * 眼环只负责眼神。这样表情变化能同时被看到、又不让角色持续摇晃。
 */
window.DOBBY_ASSET_V = "80";

window.DOBBY_EMOTION_PRESET = [
  { id: "00", name: "待机", en: "Idle", group: "lifecycle", img: "assets/sw/00.webp?v=80",
    pose: { sy: 1.000, sx: 1.000, rot: 0.0, yaw: 0.0, pitch: 0.0, y: 0, x: 0 },
    shell: { tone: "quiet", rhythm: "still", lift: 0, lean: 0, tilt: 0, stretch: 1, squash: 1, bob: 0.2, speed: 0.75 },
    eyeRings: { pool: [0, 8], poolMs: 4200, blinkMs: 6000, look: 0.3, patch: "assets/sw/00-patch.webp?v=80", x: 31.34, y: 42.903, w: 31.26, h: 21.132 } },
  { id: "01", name: "睡觉", en: "Sleep", group: "lifecycle", img: "assets/sw/01.webp?v=80", effect: "sleep",
    pose: { sy: 0.968, sx: 1.008, rot: -4.2, yaw: -2.2, pitch: 1.5, y: 5, x: -2 },
    shell: { tone: "low", rhythm: "still", lift: -5, lean: -1, tilt: 0, stretch: 1, squash: 0.985, bob: 0.12, speed: 0.6 },
    eyeRings: { pool: [13, 22, 4], poolMs: 6000, blinkMs: null, open: 0.35, look: 0.0, patch: "assets/sw/01-patch.webp?v=80", x: 26.236, y: 46.411, w: 42.105, h: 14.833 } },

  { id: "10", name: "开心", en: "Happy", group: "emotion", img: "assets/sw/10.webp?v=80",
    pose: { sy: 1.034, sx: 1.012, rot: 2.4, yaw: 1.6, pitch: -1.8, y: -7, x: 0 },
    shell: { tone: "open", rhythm: "still", lift: 4, lean: 0, tilt: 0, stretch: 1.005, squash: 1, bob: 0.12, speed: 0.8 },
    eyeRings: { pool: [2, 11, 17, 19], poolMs: 3200, blinkMs: 2500, size: 0.82, look: 0.15, patch: "assets/sw/10-patch.webp?v=80", x: 27.592, y: 44.019, w: 38.676, h: 16.427 } },
  { id: "13", name: "兴奋", en: "Excited", group: "emotion", img: "assets/sw/13.webp?v=80",
    pose: { sy: 1.040, sx: 1.014, rot: 3.4, yaw: 2.6, pitch: -3.0, y: -9, x: 1 },
    shell: { tone: "open", rhythm: "still", lift: 7, lean: 0, tilt: 0, stretch: 1.01, squash: 1, bob: 0.15, speed: 0.9 },
    eyeRings: { pool: [3, 21], poolMs: 1800, blinkMs: 1200, size: 0.86, look: 0.25, patch: "assets/sw/13-patch.webp?v=80", x: 26.396, y: 35.805, w: 43.381, h: 24.641 } },
  { id: "14", name: "惊讶", en: "Surprised", group: "emotion", img: "assets/sw/14.webp?v=80",
    pose: { sy: 1.040, sx: 0.988, rot: -2.0, yaw: -3.2, pitch: 2.6, y: -8, x: -1 },
    shell: { tone: "alert", rhythm: "still", lift: 8, lean: 0, tilt: 0, stretch: 1, squash: 1.005, bob: 0.1, speed: 0.8 },
    eyeRings: { pool: [3, 21], poolMs: 1800, blinkMs: 1800, open: 1.08, look: 0.0, patch: "assets/sw/14-patch.webp?v=80", x: 28.309, y: 41.228, w: 39.075, h: 21.531 } },
  { id: "15", name: "生气", en: "Angry", group: "emotion", img: "assets/sw/15.webp?v=80", effect: "steam",
    pose: { sy: 1.010, sx: 1.024, rot: -2.0, yaw: 1.8, pitch: 3.0, y: 1, x: 1 },
    shell: { tone: "alert", rhythm: "still", lift: -4, lean: 1, tilt: 0, stretch: 1.006, squash: 0.995, bob: 0.12, speed: 0.7 },
    eyeRings: { pool: [7, 16], poolMs: 3600, blinkMs: 3500, look: 0.2, patch: "assets/sw/15-patch.webp?v=80", x: 27.99, y: 43.062, w: 39.234, h: 18.9 } },
  { id: "16", name: "难过", en: "Sad", group: "emotion", img: "assets/sw/16.webp?v=80",
    pose: { sy: 0.964, sx: 1.016, rot: -3.6, yaw: -1.8, pitch: -2.0, y: 5, x: -1 },
    shell: { tone: "low", rhythm: "still", lift: -4, lean: -1, tilt: 0, stretch: 0.996, squash: 0.99, bob: 0.1, speed: 0.6 },
    eyeRings: { pool: [4, 13, 22], poolMs: 4600, blinkMs: 4000, look: 0.2, patch: "assets/sw/16-patch.webp?v=80", x: 28.788, y: 44.498, w: 37.48, h: 17.624 } },
  { id: "18", name: "害羞", en: "Shy", group: "emotion", img: "assets/sw/18.webp?v=80",
    pose: { sy: 0.984, sx: 1.010, rot: 3.8, yaw: -4.2, pitch: -2.0, y: 2, x: -2 },
    shell: { tone: "soft", rhythm: "still", lift: -2, lean: -1, tilt: 0, stretch: 0.998, squash: 0.99, bob: 0.1, speed: 0.65 },
    eyeRings: { pool: [0, 24, 13], poolMs: 3600, blinkMs: 3000, look: 0.4, patch: "assets/sw/18-patch.webp?v=80", x: 29.904, y: 44.099, w: 34.848, h: 18.82 } },

  { id: "30", name: "思考中", en: "Thinking", group: "agent", img: "assets/sw/30.webp?v=80", effect: "think",
    pose: { sy: 1.010, sx: 0.996, rot: -2.2, yaw: 2.6, pitch: -2.8, y: -1, x: 1 },
    shell: { tone: "quiet", rhythm: "still", lift: -2, lean: 1, tilt: 0, stretch: 0.998, squash: 0.995, bob: 0.1, speed: 0.65 },
    eyeRings: { pool: [8, 16, 14, 17, 5], poolMs: 1600, blinkMs: 3500, look: 0.5, patch: "assets/sw/30-patch.webp?v=80", x: 31.1, y: 40.271, w: 33.812, h: 19.139 } },
  { id: "31", name: "搜索中", en: "Searching", group: "agent", img: "assets/sw/31.webp?v=80", effect: "orbit",
    pose: { sy: 1.014, sx: 0.998, rot: 1.8, yaw: 0.0, pitch: -1.5, y: -2, x: 0 },
    shell: { tone: "focus", rhythm: "still", lift: 2, lean: 0, tilt: 0, stretch: 1, squash: 1, bob: 0.12, speed: 0.75 },
    eyeRings: { pool: [15, 9, 3, 20, 12, 18], poolMs: 1500, blinkMs: 1600, look: 0.55, patch: "assets/sw/31-patch.webp?v=80", x: 34.609, y: 41.228, w: 36.045, h: 20.654 } },
  { id: "32", name: "出错了", en: "Error", group: "agent", img: "assets/sw/32.webp?v=80", effect: "glitch",
    pose: { sy: 0.990, sx: 1.014, rot: -1.2, yaw: 0.0, pitch: 1.2, y: 1, x: 0 },
    shell: { tone: "fault", rhythm: "still", lift: -2, lean: 0, tilt: 0, stretch: 1, squash: 0.997, bob: 0.1, speed: 0.7 },
    eyeRings: { pool: [3, 21], poolMs: 1800, blinkMs: null, open: 1.05, look: 0.0, patch: "assets/sw/32-patch.webp?v=80", x: 28.23, y: 41.707, w: 38.437, h: 21.053 } },
  { id: "33", name: "完成", en: "Success", group: "agent", img: "assets/sw/33.webp?v=80",
    pose: { sy: 1.030, sx: 1.008, rot: 2.0, yaw: 0.0, pitch: -2.2, y: -5, x: 0 },
    shell: { tone: "open", rhythm: "still", lift: 6, lean: 0, tilt: 0, stretch: 1.008, squash: 1, bob: 0.12, speed: 0.85 },
    eyeRings: { pool: [2, 8, 17], poolMs: 3000, blinkMs: 2200, size: 0.86, look: 0.2, patch: "assets/sw/33-patch.webp?v=80", x: 30.144, y: 38.995, w: 35.486, h: 20.893 } },
  { id: "34", name: "处理中", en: "Loading", group: "agent", img: "assets/sw/34.webp?v=80", effect: "bar",
    pose: { sy: 1.010, sx: 1.000, rot: 0.0, yaw: 0.0, pitch: 0.0, y: -2, x: 0 },
    shell: { tone: "focus", rhythm: "still", lift: 0, lean: 0, tilt: 0, stretch: 1, squash: 0.99, bob: 0.1, speed: 0.7 },
    eyeRings: { pool: [7, 16, 11, 10], poolMs: 2800, blinkMs: 2800, look: 0.25, patch: "assets/sw/34-patch.webp?v=80", x: 26.715, y: 40.51, w: 41.547, h: 21.691 } },
];

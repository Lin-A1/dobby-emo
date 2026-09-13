/* ============ Dobby Emo · 表情数据 ============
 * ID 分段约定（参考 aora-bot）:
 *   00-09 生命周期  10-29 情绪  30-49 智能体状态  50+ 自定义
 * 空位保留，已有 ID 永不变更。
 * effect:   常驻光环特效（ring 旋转光环 | dots 思考气泡 | hearts 飘爱心
 *           | sparkle 环绕星光 | glitch 故障抖动 | steam 冒蒸汽 | sleep 月亮）
 * img:      软件部固定形象烘焙表情（assets/sw/*.webp）
 * eyeLayer: 可动眼层 —— patch 是「抹掉烘焙眼睛」的脸部补丁，sprite 是眼球精灵，
 *           x/y/w/h 为图像坐标百分比，max 为 300px 尺寸下眼球最大位移（px）。
 *           带眼层的表情会真的跟着鼠标 / 手指转眼球，其余表情只做头部倾斜。
 *           素材由 tools/make-eyes.py 生成（Laplace 修补 + 精灵抽取）。
 */
window.DOBBY_EMOTION_PRESET = [
  { id: "00", name: "待机",    en: "Idle",      group: "lifecycle", img: "assets/sw/00.webp",
    eyeLayer: { patch: "assets/sw/00-patch.webp", sprite: "assets/sw/00-eyes.webp",
                x: 29.107, y: 40.75, w: 35.646, h: 25.439, max: 9, maxY: 6.5 } },
  { id: "01", name: "睡觉",    en: "Sleep",     group: "lifecycle", img: "assets/sw/01.webp", effect: "sleep" },

  { id: "10", name: "开心",    en: "Happy",     group: "emotion", img: "assets/sw/10.webp" },
  { id: "11", name: "大笑",    en: "Laugh",     group: "emotion", img: "assets/sw/11.webp" },
  { id: "12", name: "花痴",    en: "Love",      group: "emotion", img: "assets/sw/12.webp", effect: "hearts" },
  { id: "13", name: "兴奋",    en: "Excited",   group: "emotion", img: "assets/sw/13.webp", effect: "sparkle" },
  { id: "14", name: "惊讶",    en: "Surprised", group: "emotion", img: "assets/sw/14.webp",
    eyeLayer: { patch: "assets/sw/14-patch.webp", sprite: "assets/sw/14-eyes.webp",
                x: 26.077, y: 38.995, w: 43.541, h: 25.997, max: 9, maxY: 7 } },
  { id: "15", name: "生气",    en: "Angry",     group: "emotion", img: "assets/sw/15.webp", effect: "steam" },
  { id: "16", name: "难过",    en: "Sad",       group: "emotion", img: "assets/sw/16.webp" },
  { id: "17", name: "哭泣",    en: "Cry",       group: "emotion", img: "assets/sw/17.webp" },
  { id: "18", name: "害羞",    en: "Shy",       group: "emotion", img: "assets/sw/18.webp",
    eyeLayer: { patch: "assets/sw/18-patch.webp", sprite: "assets/sw/18-eyes.webp",
                x: 27.671, y: 41.866, w: 39.314, h: 23.206, max: 8, maxY: 6 } },
  { id: "19", name: "耍酷",    en: "Cool",      group: "emotion", img: "assets/sw/19.webp" },
  { id: "20", name: "眨眼",    en: "Wink",      group: "emotion", img: "assets/sw/20.webp",
    eyeLayer: { patch: "assets/sw/20-patch.webp", sprite: "assets/sw/20-eyes.webp",
                x: 29.187, y: 39.952, w: 41.069, h: 24.003, max: 9, maxY: 6.5 } },

  { id: "30", name: "思考中",  en: "Thinking",  group: "agent", img: "assets/sw/30.webp", effect: "ring",
    eyeLayer: { patch: "assets/sw/30-patch.webp", sprite: "assets/sw/30-eyes.webp",
                x: 28.868, y: 38.038, w: 38.198, h: 23.525, max: 8.5, maxY: 6 } },
  { id: "31", name: "搜索中",  en: "Searching", group: "agent", img: "assets/sw/31.webp", effect: "ring" },
  { id: "32", name: "出错了",  en: "Error",     group: "agent", img: "assets/sw/32.webp", effect: "glitch" },
  { id: "33", name: "完成",    en: "Success",   group: "agent", img: "assets/sw/33.webp", effect: "sparkle" },
  { id: "34", name: "处理中",  en: "Loading",   group: "agent", img: "assets/sw/34.webp", effect: "dots" },
];

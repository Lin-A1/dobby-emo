/* ============ Dobby Emo · 表情数据 ============
 * ID 分段约定（参考 aora-bot）:
 *   00-09 生命周期  10-29 情绪  30-49 智能体状态  50+ 自定义
 * 空位保留，已有 ID 永不变更。
 * effect:   常驻状态特效（think 思考气泡 | orbit 环绕探照点 | bar 进度光带
 *           | glitch 故障抖动 | steam 冒蒸汽 | sleep 月亮）
 *           注意：飘爱心 / 星光这类装饰粒子已整体移除——只保留表达「状态」的特效
 * img:      软件部固定形象烘焙表情（assets/sw/*.webp）
 * eyeLayer: 可动眼层 —— patch 是「抹掉烘焙眼睛」的脸部补丁，sprite 是眼球精灵，
 *           x/y/w/h 为图像坐标百分比，max 为 300px 尺寸下眼球最大位移（px）。
 *           glint 是每只眼的补光锚点（相对精灵框的百分比，见下）；
 *           带眼层的表情会真的跟着鼠标 / 手指转眼球，其余表情只做头部倾斜。
 *           素材由 tools/make-eyes.py 生成（Laplace 修补 + 精灵抽取）。
 * glint:    烘焙素材的眼睛是哑光的，缺镜面点就读成色块而不是眼睛。
 *           每条 = 一只眼的补光锚点（相对眼精灵框的百分比）：
 *             x/y/w     主光：中心 + 点宽
 *             kx/ky/kw  副光：右下角那粒冷调反射光（kw=0 不画）
 *             hi: 1     素材已自带高光（如 14 号），整只眼不再叠加
 *           由 tools/measure-glints.py 实测：主光取每只眼自己包围盒的左上
 *           (32%, 24%)，点宽 = min(眼宽×0.30, 到眼缘距离×1.9)；副光取
 *           右下 (68%, 62%)，细眼放不下就自动归零。换素材后重跑脚本即可。
 */
/* 每只眼的补光锚点：相对眼精灵框的百分比，顺序 = 左眼、右眼。
   x/y 是主光点的中心（不是眼框左上角），kx/ky 是副光点的中心。 */
var GLINT = {
  "00": [{ x: 21.9, y: 33.9, w: 6.0, kx: 29.1, ky: 53.3, kw: 3.8, hi: 0 },
         { x: 70.2, y: 39.4, w: 6.4, kx: 77.9, ky: 59.0, kw: 4.1, hi: 0 }],
  "14": [{ x: 20.6, y: 33.3, w: 7.5, kx: 29.6, ky: 52.5, kw: 4.7, hi: 1 },
         { x: 69.1, y: 39.7, w: 8.1, kx: 78.9, ky: 59.4, kw: 5.2, hi: 1 }],
  "18": [{ x: 20.9, y: 34.4, w: 6.5, kx: 28.8, ky: 51.2, kw: 4.1, hi: 0 },
         { x: 69.8, y: 42.2, w: 7.2, kx: 78.5, ky: 59.4, kw: 4.6, hi: 0 }],
  "20": [{ x: 18.9, y: 36.0, w: 5.2, kx: 25.1, ky: 56.7, kw: 3.3, hi: 0 },
         { x: 67.4, y: 49.7, w: 4.8, kx: 77.7, ky: 60.1, kw: 0.9, hi: 0 }],
  "30": [{ x: 20.6, y: 36.2, w: 5.8, kx: 27.6, ky: 56.6, kw: 3.7, hi: 0 },
         { x: 70.2, y: 45.4, w: 6.2, kx: 78.5, ky: 57.6, kw: 4.4, hi: 0 }]
};

window.DOBBY_EMOTION_PRESET = [
  { id: "00", name: "待机",    en: "Idle",      group: "lifecycle", img: "assets/sw/00.webp",
    eyeLayer: { patch: "assets/sw/00-patch.webp", sprite: "assets/sw/00-eyes.webp",
                x: 29.107, y: 40.75, w: 35.646, h: 25.439, max: 7, maxY: 5,
                glint: GLINT["00"] } },
  { id: "01", name: "睡觉",    en: "Sleep",     group: "lifecycle", img: "assets/sw/01.webp", effect: "sleep" },

  { id: "10", name: "开心",    en: "Happy",     group: "emotion", img: "assets/sw/10.webp" },
  { id: "11", name: "大笑",    en: "Laugh",     group: "emotion", img: "assets/sw/11.webp" },
  { id: "12", name: "花痴",    en: "Love",      group: "emotion", img: "assets/sw/12.webp" },
  { id: "13", name: "兴奋",    en: "Excited",   group: "emotion", img: "assets/sw/13.webp" },
  { id: "14", name: "惊讶",    en: "Surprised", group: "emotion", img: "assets/sw/14.webp",
    eyeLayer: { patch: "assets/sw/14-patch.webp", sprite: "assets/sw/14-eyes.webp",
                x: 26.077, y: 38.995, w: 43.541, h: 25.997, max: 7, maxY: 5.5,
                glint: GLINT["14"] } },
  { id: "15", name: "生气",    en: "Angry",     group: "emotion", img: "assets/sw/15.webp", effect: "steam" },
  { id: "16", name: "难过",    en: "Sad",       group: "emotion", img: "assets/sw/16.webp" },
  { id: "17", name: "哭泣",    en: "Cry",       group: "emotion", img: "assets/sw/17.webp" },
  { id: "18", name: "害羞",    en: "Shy",       group: "emotion", img: "assets/sw/18.webp",
    eyeLayer: { patch: "assets/sw/18-patch.webp", sprite: "assets/sw/18-eyes.webp",
                x: 27.671, y: 41.866, w: 39.314, h: 23.206, max: 6.5, maxY: 4.8,
                glint: GLINT["18"] } },
  { id: "19", name: "耍酷",    en: "Cool",      group: "emotion", img: "assets/sw/19.webp" },
  { id: "20", name: "眨眼",    en: "Wink",      group: "emotion", img: "assets/sw/20.webp",
    eyeLayer: { patch: "assets/sw/20-patch.webp", sprite: "assets/sw/20-eyes.webp",
                x: 29.187, y: 39.952, w: 41.069, h: 24.003, max: 7, maxY: 5,
                glint: GLINT["20"] } },

  { id: "30", name: "思考中",  en: "Thinking",  group: "agent", img: "assets/sw/30.webp", effect: "think",
    eyeLayer: { patch: "assets/sw/30-patch.webp", sprite: "assets/sw/30-eyes.webp",
                x: 28.868, y: 38.038, w: 38.198, h: 23.525, max: 6.5, maxY: 4.8,
                glint: GLINT["30"] } },
  { id: "31", name: "搜索中",  en: "Searching", group: "agent", img: "assets/sw/31.webp", effect: "orbit" },
  { id: "32", name: "出错了",  en: "Error",     group: "agent", img: "assets/sw/32.webp", effect: "glitch" },
  { id: "33", name: "完成",    en: "Success",   group: "agent", img: "assets/sw/33.webp" },
  { id: "34", name: "处理中",  en: "Loading",   group: "agent", img: "assets/sw/34.webp", effect: "bar" },
];

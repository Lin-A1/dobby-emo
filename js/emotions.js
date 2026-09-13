/* ============ Dobby Emo · 表情数据 ============
 * ID 分段约定（参考 aora-bot）:
 *   00-09 生命周期  10-29 情绪  30-49 智能体状态  50+ 自定义
 * 空位保留，已有 ID 永不变更。
 * effect: 常驻光环特效（ring 旋转光环 | dots 思考气泡 | hearts 飘爱心
 *         | sparkle 环绕星光 | glitch 故障抖动 | steam 冒蒸汽 | sleep 月亮）
 * img: 软件部固定形象烘焙表情（assets/sw/*.png）
 */
window.DOBBY_EMOTION_PRESET = [
  { id: "00", name: "待机",    en: "Idle",      group: "lifecycle", img: "assets/sw/00.webp" },
  { id: "01", name: "睡觉",    en: "Sleep",     group: "lifecycle", img: "assets/sw/01.webp", effect: "sleep" },

  { id: "10", name: "开心",    en: "Happy",     group: "emotion", img: "assets/sw/10.webp" },
  { id: "11", name: "大笑",    en: "Laugh",     group: "emotion", img: "assets/sw/11.webp" },
  { id: "12", name: "花痴",    en: "Love",      group: "emotion", img: "assets/sw/12.webp", effect: "hearts" },
  { id: "13", name: "兴奋",    en: "Excited",   group: "emotion", img: "assets/sw/13.webp", effect: "sparkle" },
  { id: "14", name: "惊讶",    en: "Surprised", group: "emotion", img: "assets/sw/14.webp" },
  { id: "15", name: "生气",    en: "Angry",     group: "emotion", img: "assets/sw/15.webp", effect: "steam" },
  { id: "16", name: "难过",    en: "Sad",       group: "emotion", img: "assets/sw/16.webp" },
  { id: "17", name: "哭泣",    en: "Cry",       group: "emotion", img: "assets/sw/17.webp" },
  { id: "18", name: "害羞",    en: "Shy",       group: "emotion", img: "assets/sw/18.webp" },
  { id: "19", name: "耍酷",    en: "Cool",      group: "emotion", img: "assets/sw/19.webp" },
  { id: "20", name: "眨眼",    en: "Wink",      group: "emotion", img: "assets/sw/20.webp" },

  { id: "30", name: "思考中",  en: "Thinking",  group: "agent", img: "assets/sw/30.webp", effect: "ring" },
  { id: "31", name: "搜索中",  en: "Searching", group: "agent", img: "assets/sw/31.webp", effect: "ring" },
  { id: "32", name: "出错了",  en: "Error",     group: "agent", img: "assets/sw/32.webp", effect: "glitch" },
  { id: "33", name: "完成",    en: "Success",   group: "agent", img: "assets/sw/33.webp", effect: "sparkle" },
  { id: "34", name: "处理中",  en: "Loading",   group: "agent", img: "assets/sw/34.webp", effect: "dots" },
];

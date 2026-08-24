/**
 * 18 张鱼卡定义 —— 全项目唯一数据源。
 * 字段：id(唯一键) / name(中文名) / nameEn(英文名) / points(分值) /
 *       strength(所需钩数 0-5，即"难度") / hooks(钓获后提供的钩数，用于满足更强鱼) /
 *       type(fair 正品 | foul 污秽) /
 *       ability(一次性能力类型，null 表示无能力) / art(卡图 key，对应 artPrompts.js)
 *
 * 卡名参考官方权威来源 thefamilygamers.com/shallow-regrets/ 与
 * Card Gamer / Button Shy 资料（Eversquid、Kelpie、Whiptail Stingray、Barracuda、
 * Giant Octopus、Oarfish、Lamprey、Moray Eel、Kraken、Foot、Day Octopus、
 * Mermaid、Eye Blob 等为真实卡名）；具体数值为平衡性设计。
 * 能力类型见 js/core/abilities.js。
 *
 * 钩子机制（官方规则）：钓到鱼后，其 hooks 计入你的当前钩子数；
 * 小鱼（strength 0）开局易钓且提供 1 钩，用于逐步钓起更强的大鱼。
 */

/**
 * @typedef {Object} FishCard
 * @property {string} id
 * @property {string} name
 * @property {string} nameEn
 * @property {number} points
 * @property {number} strength
 * @property {number} hooks
 * @property {'fair'|'foul'} type
 * @property {string|null} ability
 * @property {string} art
 */

/** @type {FishCard[]} */
export const CARDS = [
  // —— 小鱼（strength 0，开局易钓，钓获提供 1 钩）——
  { id: 'sardine', name: '沙丁鱼', nameEn: 'Sardine', points: 1, strength: 0, hooks: 1, type: 'fair', ability: null, art: 'sardine' },
  { id: 'clownfish', name: '小丑鱼', nameEn: 'Clownfish', points: 2, strength: 0, hooks: 1, type: 'fair', ability: null, art: 'clownfish' },
  { id: 'pufferfish', name: '河豚', nameEn: 'Pufferfish', points: 2, strength: 0, hooks: 1, type: 'fair', ability: 'immunity', art: 'pufferfish' },
  { id: 'lanternfish', name: '灯笼鱼', nameEn: 'Lanternfish', points: 2, strength: 0, hooks: 1, type: 'fair', ability: 'peek_shoal', art: 'lanternfish' },
  { id: 'jellyfish', name: '水母', nameEn: 'Jellyfish', points: 1, strength: 0, hooks: 1, type: 'foul', ability: null, art: 'jellyfish' },
  { id: 'foot', name: '怪脚', nameEn: 'The Nasty Foot', points: -1, strength: 0, hooks: 1, type: 'foul', ability: null, art: 'foot' },

  // —— 中型鱼（strength 1-2）——
  { id: 'dayOctopus', name: '昼章鱼', nameEn: 'Day Octopus', points: 3, strength: 1, hooks: 1, type: 'fair', ability: 'swap_fish', art: 'dayOctopus' },
  { id: 'stingray', name: '魟鱼', nameEn: 'Whiptail Stingray', points: 3, strength: 1, hooks: 1, type: 'fair', ability: 'force_exhaust', art: 'stingray' },
  { id: 'lamprey', name: '七鳃鳗', nameEn: 'Lamprey', points: 3, strength: 1, hooks: 1, type: 'fair', ability: 'draw_extra', art: 'lamprey' },
  { id: 'barracuda', name: '梭鱼', nameEn: 'Barracuda', points: 4, strength: 2, hooks: 2, type: 'fair', ability: null, art: 'barracuda' },
  { id: 'morayEel', name: '海鳗', nameEn: 'Moray Eel', points: 4, strength: 2, hooks: 2, type: 'fair', ability: 'immunity', art: 'morayEel' },
  { id: 'eyeBlob', name: '眼球怪', nameEn: 'Eye Blob', points: 4, strength: 2, hooks: 2, type: 'foul', ability: 'peek_shoal', art: 'eyeBlob' },
  { id: 'mermaid', name: '美人鱼', nameEn: 'Mermaid', points: 4, strength: 2, hooks: 2, type: 'foul', ability: 'force_exhaust', art: 'mermaid' },
  { id: 'giantOctopus', name: '巨型章鱼', nameEn: 'Giant Octopus', points: 5, strength: 2, hooks: 2, type: 'fair', ability: 'swap_fish', art: 'giantOctopus' },

  // —— 大鱼（strength 3-5，需积累钩数）——
  { id: 'oarfish', name: '皇带鱼', nameEn: 'Oarfish', points: 6, strength: 3, hooks: 3, type: 'fair', ability: 'draw_extra', art: 'oarfish' },
  { id: 'eversquid', name: '永恒乌贼', nameEn: 'Eversquid', points: 6, strength: 3, hooks: 3, type: 'foul', ability: 'draw_extra', art: 'eversquid' },
  { id: 'kelpie', name: '凯尔派', nameEn: 'Kelpie', points: 7, strength: 4, hooks: 4, type: 'foul', ability: 'shuffle_shoals', art: 'kelpie' },
  { id: 'kraken', name: '克拉肯', nameEn: 'Kraken', points: 8, strength: 5, hooks: 5, type: 'fair', ability: 'shuffle_shoals', art: 'kraken' },
];

/** id → 卡牌 的索引，便于 O(1) 查找 */
export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export const TOTAL_CARDS = CARDS.length; // 18

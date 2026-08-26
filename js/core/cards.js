/**
 * 24 张鱼卡定义 —— 全项目唯一数据源。
 * 字段：
 *   id        唯一键（也是卡图 key：public/cards/{id}.jpg）
 *   name      中文名
 *   nameEn    英文名
 *   points    积分（可负：污秽惩罚之外的负分鱼）
 *   strength  难度（所需钩数，0-5）
 *   hooks     钓获后提供的钩数
 *   type      fair 正品 | foul 邪秽
 *   ability   能力键（null 表示无能力；见 js/core/abilities.js 的 ABILITIES 表）
 *
 * 能力频率（已与作者确认）：
 *   active  一次性主动：整局仅一次，发动后横置（exhausted）
 *   passive 永续被动：常驻起效；被横置（无论自用与否）后失效
 *   能力阶段（每回合开始，该玩家钓到的未横置主动牌逐个发动）。
 *
 * 钩子机构：钓到鱼后其 hooks 计入你的钩池；捕鱼要求 当前钩数 ≥ 目标难度。
 *   分值 > 3 的大鱼与部分中鱼不供钩（单卡钩子数显式给出，不沿用"分值>3不供钩"旧规则）。
 */
export const CARDS = [
  // —— 小鱼（strength 0，开局易钓）——
  { id: 'lamprey', name: '七鳃鳗', nameEn: 'Lamprey', points: 1, strength: 0, hooks: 1, type: 'fair', ability: 'draw_plus1' },
  { id: 'seaBishop', name: '海主教', nameEn: 'Sea Bishop', points: 1, strength: 0, hooks: 1, type: 'foul', ability: 'shuffle_all' },
  { id: 'seaMonkey', name: '海猴', nameEn: 'Sea Monkey', points: -2, strength: 0, hooks: 3, type: 'foul', ability: 'catch_restrict_zero' },
  { id: 'severedFoot', name: '断脚', nameEn: 'Severed Foot', points: -1, strength: 0, hooks: 2, type: 'foul', ability: 'give_card' },
  { id: 'eyeballBlob', name: '眼球团', nameEn: 'Eyeball Blob', points: 1, strength: 0, hooks: 1, type: 'foul', ability: 'rearrange_shoal' },
  { id: 'rotfish', name: '腐鱼', nameEn: 'Rotfish', points: -1, strength: 0, hooks: 2, type: 'foul', ability: 'pass_left' },
  { id: 'dayOctopus', name: '日间章鱼', nameEn: 'Day Octopus', points: 1, strength: 0, hooks: 0, type: 'fair', ability: 'swap_zero' },
  { id: 'barracuda', name: '梭子鱼', nameEn: 'Barracuda', points: 0, strength: 0, hooks: 1, type: 'fair', ability: 'remove_zero' },
  { id: 'whiptailStingray', name: '鞭尾魟鱼', nameEn: 'Whiptail Stingray', points: 0, strength: 0, hooks: 1, type: 'fair', ability: 'exhaust_any' },

  // —— 低中鱼（strength 1）——
  { id: 'oarfish', name: '皇带鱼', nameEn: 'Oarfish', points: 2, strength: 1, hooks: 1, type: 'fair', ability: 'draw_plus2' },
  { id: 'mermaid', name: '美人鱼', nameEn: 'Mermaid', points: 2, strength: 1, hooks: 1, type: 'foul', ability: 'peek_multi' },
  { id: 'snowEel', name: '雪鳗', nameEn: 'Snow Eel', points: 2, strength: 1, hooks: 1, type: 'fair', ability: 'snow_guard' },
  { id: 'manOWar', name: '僧帽水母', nameEn: "Man o' War", points: 0, strength: 1, hooks: 1, type: 'fair', ability: 'counter_exhaust' },
  { id: 'lionfish', name: '狮子鱼', nameEn: 'Lionfish', points: 0, strength: 1, hooks: 1, type: 'fair', ability: 'force_swap_lionfish' },

  // —— 中鱼（strength 2）——
  { id: 'sealMan', name: '海豹人', nameEn: 'Seal Man', points: 3, strength: 2, hooks: 1, type: 'foul', ability: 'swap_any' },
  { id: 'banshee', name: '女妖', nameEn: 'Banshee', points: 3, strength: 2, hooks: 1, type: 'foul', ability: 'redirect_target' },
  { id: 'everSquid', name: '永动鱿鱼', nameEn: 'Ever-Squid', points: 2, strength: 2, hooks: 0, type: 'foul', ability: 'exhaust_fair' },
  { id: 'giantOctopus', name: '巨型章鱼', nameEn: 'Giant Octopus', points: 2, strength: 2, hooks: 1, type: 'fair', ability: 'swap_fair' },

  // —— 大鱼（strength 3-5）——
  { id: 'swordfish', name: '旗鱼', nameEn: 'Swordfish', points: 3, strength: 3, hooks: 0, type: 'fair', ability: 'exhaust_foul' },
  { id: 'giantSquid', name: '巨型乌贼', nameEn: 'Giant Squid', points: 3, strength: 3, hooks: 0, type: 'fair', ability: 'untargetable' },
  { id: 'greatWhite', name: '大白鲨', nameEn: 'Great White Shark', points: 3, strength: 3, hooks: 0, type: 'fair', ability: 'power_plus3' },
  { id: 'elderThing', name: '旧日支配者', nameEn: 'Elder Thing', points: 5, strength: 4, hooks: 0, type: 'foul', ability: 'catch_restrict_high' },
  { id: 'kelpie', name: '凯尔派', nameEn: 'Kelpie', points: 4, strength: 4, hooks: 0, type: 'foul', ability: 'reveal_all' },
  { id: 'kraken', name: '挪威海怪', nameEn: 'Norwegian Kraken', points: 5, strength: 5, hooks: 0, type: 'foul', ability: null },
];

/** id → 卡牌 的索引，便于 O(1) 查找 */
export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export const TOTAL_CARDS = CARDS.length; // 24
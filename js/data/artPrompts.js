/**
 * 18 张鱼卡的 AI 绘图提示词清单（中 + 英）。
 * 统一风格：克苏鲁 + 海洋恐怖 + 手绘漫画/水彩。
 *
 * 卡图采用「本地方案」：用种子图生成工具（如 Seedream）按下列提示词批量产出，
 * 存为 public/cards/{artKey}.jpg，构建后复制到 dist/cards/ 并被相对路径引用。
 * 这样本地双击、GitHub Pages（根/子路径）均能稳定加载，不再依赖外网图片接口。
 */

const STYLE_ZH = '克苏鲁海洋恐怖风格，手绘水彩漫画插画，深海诡异生物，暗色调，青绿与深蓝配色，细腻笔触，卡牌插画，无文字';
const STYLE_EN =
  'Cthulhu ocean horror style, hand-drawn watercolor comic illustration, eerie deep-sea creature, dark tones, teal and deep blue palette, fine brushwork, card illustration, no text';

/**
 * @typedef {Object} ArtPrompt
 * @property {string} zh
 * @property {string} en
 */

/** @type {Record<string, ArtPrompt>} */
export const ART_PROMPTS = {
  sardine: {
    zh: `一群银色小沙丁鱼在深蓝海水中游动，普通无害，${STYLE_ZH}`,
    en: `A school of small silver sardines swimming in deep blue water, ordinary and harmless, ${STYLE_EN}`,
  },
  clownfish: {
    zh: `一条橙色小丑鱼在诡异珊瑚礁间游动，看似正常却略显阴森，${STYLE_ZH}`,
    en: `An orange clownfish swimming among eerie coral reefs, seemingly normal yet slightly sinister, ${STYLE_EN}`,
  },
  pufferfish: {
    zh: `一条鼓起全身尖刺的河豚，防御姿态，眼神警惕，${STYLE_ZH}`,
    en: `A pufferfish fully puffed up with sharp spines, defensive posture, wary eyes, ${STYLE_EN}`,
  },
  lanternfish: {
    zh: `头顶悬挂发光灯笼的深海灯笼鱼，光晕照亮黑暗海水，${STYLE_ZH}`,
    en: `A deep-sea lanternfish with a glowing lantern hanging above its head, halo of light illuminating dark water, ${STYLE_EN}`,
  },
  jellyfish: {
    zh: `半透明发光水母，触手如丝带般缠绕飘动，诡异美丽，${STYLE_ZH}`,
    en: `A translucent glowing jellyfish with ribbon-like tentacles drifting and tangling, eerie beauty, ${STYLE_EN}`,
  },
  foot: {
    zh: `一只巨大的诡异人脚掌生物从海水中伸出，脚趾间有海草，令人不安，${STYLE_ZH}`,
    en: `A giant eerie human foot creature emerging from the sea, seaweed between its toes, unsettling, ${STYLE_EN}`,
  },
  dayOctopus: {
    zh: `一只白天的章鱼，触手舒展呈星形，吸盘清晰可见，${STYLE_ZH}`,
    en: `A day octopus with tentacles spread out in a star shape, suckers clearly visible, ${STYLE_EN}`,
  },
  stingray: {
    zh: `一条鞭尾魟鱼，扁平身体如风筝，细长尾巴如鞭子甩动，${STYLE_ZH}`,
    en: `A whiptail stingray with a flat kite-like body and a long whip-like tail lashing, ${STYLE_EN}`,
  },
  lamprey: {
    zh: `一条七鳃鳗，圆盘状口器布满利齿，吸附在岩石上，${STYLE_ZH}`,
    en: `A lamprey with a circular disc mouth full of sharp teeth, attached to a rock, ${STYLE_EN}`,
  },
  barracuda: {
    zh: `一条凶猛梭鱼，长嘴利齿，眼神冷酷，蓄势待发，${STYLE_ZH}`,
    en: `A fierce barracuda with a long snout and sharp teeth, cold eyes, poised to strike, ${STYLE_EN}`,
  },
  morayEel: {
    zh: `一条海鳗从珊瑚礁洞穴中探出半个身体，张开的嘴露出利齿，${STYLE_ZH}`,
    en: `A moray eel emerging halfway from a coral reef cave, mouth open showing sharp teeth, ${STYLE_EN}`,
  },
  eyeBlob: {
    zh: `一团漂浮的诡异眼球团块，无数眼睛在粘稠身体上转动，${STYLE_ZH}`,
    en: `A floating eerie blob of eyes, countless eyeballs rotating on a viscous body, ${STYLE_EN}`,
  },
  mermaid: {
    zh: `一条诡异的美人鱼，苍白皮肤，空洞眼神，鱼尾鳞片发暗，${STYLE_ZH}`,
    en: `An eerie mermaid with pale skin, hollow eyes, and dark fish scales on her tail, ${STYLE_EN}`,
  },
  giantOctopus: {
    zh: `一只巨型章鱼，粗壮触手翻腾卷曲，占据整个画面，${STYLE_ZH}`,
    en: `A giant octopus with massive tentacles churning and coiling, filling the entire frame, ${STYLE_EN}`,
  },
  oarfish: {
    zh: `一条极长的皇带鱼，银色身体如绸带，红色背鳍飘动，${STYLE_ZH}`,
    en: `An extremely long oarfish with a silver ribbon-like body and flowing red dorsal fin, ${STYLE_EN}`,
  },
  eversquid: {
    zh: `一只永恒乌贼，触手如胡须般垂落，身体散发幽光，${STYLE_ZH}`,
    en: `An eversquid with tentacles hanging like whiskers, body emitting an eerie glow, ${STYLE_EN}`,
  },
  kelpie: {
    zh: `凯尔派，水中的马形怪物，鬃毛如水草，眼神空洞，${STYLE_ZH}`,
    en: `A kelpie, a horse-shaped water monster with mane like seaweed and hollow eyes, ${STYLE_EN}`,
  },
  kraken: {
    zh: `巨型海怪克拉肯，无数触手从深海翻腾而起，掀起巨浪，${STYLE_ZH}`,
    en: `The Kraken, a colossal sea monster with countless tentacles rising from the deep, churning waves, ${STYLE_EN}`,
  },
};

/** 卡背插画提示词（可选，用于卡背装饰） */
export const CARD_BACK_PROMPT = {
  zh: `深海卡牌背面图案，暗蓝色漩涡与鱼钩符号，克苏鲁风格，${STYLE_ZH}`,
  en: `Deep sea card back pattern, dark blue swirls and fish hook symbols, Cthulhu style, ${STYLE_EN}`,
};

/** 返回某张卡（或卡背）的本地图片相对路径（本地方案）。图片存放于 public/cards/，构建后位于 dist/cards/。 */
export function getArtUrl(artKey, _size = 'square') {
  return `cards/${artKey}.jpg`;
}

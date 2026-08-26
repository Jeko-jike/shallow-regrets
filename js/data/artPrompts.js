/**
 * 24 张鱼卡的 AI 绘图提示词清单（中 + 英）。
 * 统一风格：克苏鲁 + 海洋恐怖 + 手绘漫画/水彩。
 *
 * 卡图采用「本地方案」：用种子图生成工具（如 Seedream）按下列提示词批量产出，
 * 存为 public/cards/{id}.jpg（key = 卡 id），构建后复制到 dist/cards/ 并被相对路径引用。
 * 这样本地双击、GitHub Pages（根/子路径）均能稳定加载，不再依赖外网图片接口。
 */

const STYLE_ZH = '克苏鲁海洋恐怖风格，手绘水彩漫画插画，深海诡异生物，暗色调，青绿与深蓝配色，细腻笔触，卡牌插画，无文字';
const STYLE_EN =
  'Cthulhu ocean horror style, hand-drawn watercolor comic illustration, eerie deep-sea creature, dark tones, teal and deep blue palette, fine brushwork, card illustration, no text';

/** @typedef {Object} ArtPrompt
 * @property {string} zh
 * @property {string} en */

/** @type {Record<string, ArtPrompt>} */
export const ART_PROMPTS = {
  lamprey: {
    zh: `一条七鳃鳗，圆盘状口器布满利齿，吸附在幽暗礁石上，${STYLE_ZH}`,
    en: `A lamprey with a circular disc mouth full of sharp teeth, clinging to a dark reef, ${STYLE_EN}`,
  },
  seaBishop: {
    zh: `诡异的海主教，头戴天然鱼骨法冠的僧侣形人鱼，手捧发光的贝壳，${STYLE_ZH}`,
    en: `An eerie sea bishop, a monk-shaped merman crowned with a natural fishbone mitre, holding a glowing shell, ${STYLE_EN}`,
  },
  seaMonkey: {
    zh: `一只诡异的海猴，稀疏毛发湿润，咧嘴露出尖牙，趴在浮木上，${STYLE_ZH}`,
    en: `An eerie sea monkey with sparse wet fur, baring sharp teeth in a grin, perched on a driftwood log, ${STYLE_EN}`,
  },
  severedFoot: {
    zh: `一只断脚从海水中缓缓浮起，切口处缠绕海草与藤壶，诡异瘆人，${STYLE_ZH}`,
    en: `A severed foot slowly rising from the sea, the cut end wrapped in seaweed and barnacles, eerie and unsettling, ${STYLE_EN}`,
  },
  eyeballBlob: {
    zh: `一团漂浮的诡异眼球团块，无数眼睛在粘稠半透明的身体上转动，${STYLE_ZH}`,
    en: `A floating eerie blob of eyes, countless eyeballs rotating on a viscous translucent body, ${STYLE_EN}`,
  },
  rotfish: {
    zh: `一条正在腐烂的鱼，鳞片脱落露出腐肉，周身萦绕暗影，${STYLE_ZH}`,
    en: `A decaying fish with falling scales revealing rotten flesh, wreathed in shadow, ${STYLE_EN}`,
  },
  dayOctopus: {
    zh: `一条昼行章鱼，触手舒展呈星形，吸盘清晰可见，白日海面微光，${STYLE_ZH}`,
    en: `A day octopus with tentacles spread out in a star shape, suckers clearly visible, dim daylight over the sea, ${STYLE_EN}`,
  },
  barracuda: {
    zh: `一条凶猛梭鱼，长嘴利齿，眼神冷酷，在阴暗水层中潜行蓄势待发，${STYLE_ZH}`,
    en: `A fierce barracuda with a long snout and sharp teeth, cold eyes, lurking in dark water poised to strike, ${STYLE_EN}`,
  },
  whiptailStingray: {
    zh: `一条鞭尾魟鱼，扁平身体如暗色风筝，细长尾巴如鞭子甩动，${STYLE_ZH}`,
    en: `A whiptail stingray with a flat dark kite-like body and a long whip-like tail lashing, ${STYLE_EN}`,
  },
  oarfish: {
    zh: `一条极长的皇带鱼，银色身体如绸带，红色背鳍如旗帜飘动，${STYLE_ZH}`,
    en: `An extremely long oarfish with a silver ribbon-like body and a flowing red dorsal fin like a banner, ${STYLE_EN}`,
  },
  mermaid: {
    zh: `一条诡异的美人鱼，苍白皮肤，空洞发光的双眼，暗沉鱼尾鳞片，${STYLE_ZH}`,
    en: `An eerie mermaid with pale skin, hollow luminous eyes, and dark dull fish scales on her tail, ${STYLE_EN}`,
  },
  snowEel: {
    zh: `一条雪鳗，晶莹半透明的身体泛着寒光，在冷雾中蜿蜒游动，${STYLE_ZH}`,
    en: `A snow eel with a crystalline translucent body gleaming coldly, winding through cold mist, ${STYLE_EN}`,
  },
  manOWar: {
    zh: `一只僧帽水母，蓝紫色气囊如帆浮于海面，长长毒性触手垂入深海，${STYLE_ZH}`,
    en: `A Portuguese man o' war with a blue-purple gas bladder like a sail floating on the sea, long venomous tentacles trailing into the deep, ${STYLE_EN}`,
  },
  lionfish: {
    zh: `一条狮子鱼，露出根根尖刺剧烈展开的棘鳍，红白相间条纹，戒备姿态，${STYLE_ZH}`,
    en: `A lionfish with fully extended venomous spiny fins, red and white stripes, defensive stance, ${STYLE_EN}`,
  },
  sealMan: {
    zh: `一个诡异的海豹人，人形躯体披着湿漉漉的灰色兽皮，眼睛纯黑无瞳，${STYLE_ZH}`,
    en: `An eerie seal man, a humanoid wrapped in wet grey pelt, pitch-black soulless eyes, ${STYLE_EN}`,
  },
  banshee: {
    zh: `一只女妖海灵，苍白长发如海藻飘散，口中无声哀嚎，周围海水结冰泛灰，${STYLE_ZH}`,
    en: `A banshee sea spirit with pale seaweed-like flowing hair, screaming silently, the surrounding water turning gray and icy, ${STYLE_EN}`,
  },
  everSquid: {
    zh: `一只永恒乌贼，触手如胡须般垂落延长，身体散发永不熄灭的幽光，${STYLE_ZH}`,
    en: `An ever-squid with tentacles hanging down like whiskers, its body radiating an endless eerie glow, ${STYLE_EN}`,
  },
  giantOctopus: {
    zh: `一只巨型章鱼，粗壮触手翻腾卷曲，占据整个画面，深渊中注视，${STYLE_ZH}`,
    en: `A giant octopus with massive tentacles churning and coiling, filling the entire frame, watching from the abyss, ${STYLE_EN}`,
  },
  swordfish: {
    zh: `一条旗鱼，利剑般的长吻刺破黑暗水流，身影矫健迅疾，${STYLE_ZH}`,
    en: `A swordfish with a sword-like bill piercing through dark currents, swift and sleek silhouette, ${STYLE_EN}`,
  },
  giantSquid: {
    zh: `一只巨型乌贼潜伏深渊，巨大的眼睛半睁，细长触手在水中缓慢伸展，${STYLE_ZH}`,
    en: `A giant squid lurking in the abyss, huge half-open eyes, slender tentacles stretching slowly through the water, ${STYLE_EN}`,
  },
  greatWhite: {
    zh: `一头大白鲨，灰蓝色脊背破浪而出，张开的巨口露出成排利齿，${STYLE_ZH}`,
    en: `A great white shark bursting through the waves with blue-grey back, gaping jaws revealing rows of teeth, ${STYLE_EN}`,
  },
  elderThing: {
    zh: `一只旧日支配者，星形触手与无数复眼组成的上古恐怖实体，盘踞于遗迹海床，${STYLE_ZH}`,
    en: `An elder thing, an ancient horror of star-shaped tentacles and countless compound eyes, coiled upon the ruins of the seafloor, ${STYLE_EN}`,
  },
  kelpie: {
    zh: `凯尔派，水中的马形怪物，鬃毛如水草，眼神空洞，立于雾气笼罩的浅滩，${STYLE_ZH}`,
    en: `A kelpie, a horse-shaped water monster with mane like seaweed and hollow eyes, standing on a fog-shrouded shoal, ${STYLE_EN}`,
  },
  kraken: {
    zh: `巨型海怪克拉肯，无数触手从深海翻腾而起，掀起巨浪，令人绝望，${STYLE_ZH}`,
    en: `The Kraken, a colossal sea monster with countless tentacles rising from the deep, churning up monstrous waves, despairing, ${STYLE_EN}`,
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
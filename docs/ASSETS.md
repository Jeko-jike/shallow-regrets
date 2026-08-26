# 资源登记表（ASSETS.md）

> 本文件登记《浅滩鱼悔》全部美术/音效资源的来源、许可与署名要求。
> 硬性约束：全部卡面由 AI 生成；非核心美术仅从 CC0 / CC-BY 渠道获取，禁止使用有版权素材。

## 一、卡面（AI 生成）

24 张鱼卡全部由 AI 生成，提示词清单见 `js/data/artPrompts.js`（中 + 英双语，统一克苏鲁 + 海洋恐怖 + 手绘水彩风格）。

**本地方案（不再依赖外网图片接口）**：卡图存于 `public/cards/{id}.jpg`，`getArtUrl(id)` 返回相对路径 `cards/{id}.jpg`，构建时由 Vite 复制到 `dist/cards/`。本地双击、GitHub Pages（根/子路径）均稳定加载，因此 `assets/` 目录保持为空。

| 卡牌 id | 中文名 | 英文名 | 类型 | 提示词 key |
|---------|--------|--------|------|------------|
| lamprey | 七鳃鳗 | Lamprey | fair 正品 | `ART_PROMPTS.lamprey` |
| seaBishop | 海主教 | Sea Bishop | foul 邪秽 | `ART_PROMPTS.seaBishop` |
| seaMonkey | 海猴 | Sea Monkey | foul 邪秽 | `ART_PROMPTS.seaMonkey` |
| severedFoot | 断脚 | Severed Foot | foul 邪秽 | `ART_PROMPTS.severedFoot` |
| eyeballBlob | 眼球团 | Eyeball Blob | foul 邪秽 | `ART_PROMPTS.eyeballBlob` |
| rotfish | 腐鱼 | Rotfish | foul 邪秽 | `ART_PROMPTS.rotfish` |
| dayOctopus | 日间章鱼 | Day Octopus | fair 正品 | `ART_PROMPTS.dayOctopus` |
| barracuda | 梭子鱼 | Barracuda | fair 正品 | `ART_PROMPTS.barracuda` |
| whiptailStingray | 鞭尾魟鱼 | Whiptail Stingray | fair 正品 | `ART_PROMPTS.whiptailStingray` |
| oarfish | 皇带鱼 | Oarfish | fair 正品 | `ART_PROMPTS.oarfish` |
| mermaid | 美人鱼 | Mermaid | foul 邪秽 | `ART_PROMPTS.mermaid` |
| snowEel | 雪鳗 | Snow Eel | fair 正品 | `ART_PROMPTS.snowEel` |
| manOWar | 僧帽水母 | Man o' War | fair 正品 | `ART_PROMPTS.manOWar` |
| lionfish | 狮子鱼 | Lionfish | fair 正品 | `ART_PROMPTS.lionfish` |
| sealMan | 海豹人 | Seal Man | foul 邪秽 | `ART_PROMPTS.sealMan` |
| banshee | 女妖 | Banshee | foul 邪秽 | `ART_PROMPTS.banshee` |
| everSquid | 永动鱿鱼 | Ever-Squid | foul 邪秽 | `ART_PROMPTS.everSquid` |
| giantOctopus | 巨型章鱼 | Giant Octopus | fair 正品 | `ART_PROMPTS.giantOctopus` |
| swordfish | 旗鱼 | Swordfish | fair 正品 | `ART_PROMPTS.swordfish` |
| giantSquid | 巨型乌贼 | Giant Squid | fair 正品 | `ART_PROMPTS.giantSquid` |
| greatWhite | 大白鲨 | Great White Shark | fair 正品 | `ART_PROMPTS.greatWhite` |
| elderThing | 旧日支配者 | Elder Thing | foul 邪秽 | `ART_PROMPTS.elderThing` |
| kelpie | 凯尔派 | Kelpie | foul 邪秽 | `ART_PROMPTS.kelpie` |
| kraken | 挪威海怪 | Norwegian Kraken | foul 邪秽 | `ART_PROMPTS.kraken` |
| （卡背） | 卡背插画 | Card Back | — | `CARD_BACK_PROMPT`（CSS 矢量绘制，无需位图） |

> 历史旧卡（sardine/clownfish/pufferfish/lanternfish/jellyfish/morayEel/foot/eyeBlob/stingray/eversquid 等）已被 24 卡集取代并删除，不再存在于游戏内。

## 二、非核心美术（CC0 / CC-BY，按需引入）

UI 面板 / 牌框 / 背景 / 能力小图标 / 音效等非核心资源，仅从以下渠道获取，并在此登记。

### 已登记资源

| 资源 | 来源 | 许可 | 作者 | 需署名 | 用途 |
|------|------|------|------|--------|------|
| （暂无） | — | — | — | — | — |

> 当前 UI 全部由纯 CSS 实现（`css/`），尚未引入外部美术资源。引入时须在本表登记。

### 指定渠道（引入时从这些来源获取）

| 渠道 | 许可 | 说明 |
|------|------|------|
| [Kenney.nl](https://kenney.nl/) | CC0 | UI / 牌框 / 背景 / 图标 |
| [game-icons.net](https://game-icons.net/) | CC-BY 3.0 | 能力小图标（需署名作者） |
| [freesound.org](https://freesound.org/) | 仅用 CC0 | 音效（记录来源与作者） |

## 三、署名要求

- CC0 资源：无需署名，但建议在 CHANGELOG 中记录来源。
- CC-BY 3.0 资源（如 game-icons.net 图标）：必须在游戏内"关于/设置"页或本文件登记作者署名。
- 引入任何新资源时，必须同步更新本表，禁止使用来源不明的素材。
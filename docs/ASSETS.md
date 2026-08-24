# 资源登记表（ASSETS.md）

> 本文件登记《浅滩鱼悔》全部美术/音效资源的来源、许可与署名要求。
> 硬性约束：全部卡面由 AI 生成；非核心美术仅从 CC0 / CC-BY 渠道获取，禁止使用有版权素材。

## 一、卡面（AI 生成）

18 张鱼卡 + 卡背插画全部由 AI 生成，提示词清单见 `js/data/artPrompts.js`（中 + 英双语）。

- 统一风格：克苏鲁 + 海洋恐怖 + 手绘漫画/水彩。
- 渲染接口（唯一允许来源，prompt 需 URL 编码）：

  ```
  https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt={prompt}&image_size=square_hd
  ```

- 运行时通过 `getArtUrl(artKey)` 生成图片 URL，无需本地文件，因此 `assets/` 目录当前为空。

| 卡牌 id | 中文名 | 英文名 | 提示词 key |
|---------|--------|--------|------------|
| sardine | 沙丁鱼 | Sardine | `ART_PROMPTS.sardine` |
| clownfish | 小丑鱼 | Clownfish | `ART_PROMPTS.clownfish` |
| pufferfish | 河豚 | Pufferfish | `ART_PROMPTS.pufferfish` |
| lanternfish | 灯笼鱼 | Lanternfish | `ART_PROMPTS.lanternfish` |
| jellyfish | 水母 | Jellyfish | `ART_PROMPTS.jellyfish` |
| foot | 怪脚 | The Nasty Foot | `ART_PROMPTS.foot` |
| dayOctopus | 昼章鱼 | Day Octopus | `ART_PROMPTS.dayOctopus` |
| stingray | 魟鱼 | Whiptail Stingray | `ART_PROMPTS.stingray` |
| lamprey | 七鳃鳗 | Lamprey | `ART_PROMPTS.lamprey` |
| barracuda | 梭鱼 | Barracuda | `ART_PROMPTS.barracuda` |
| morayEel | 海鳗 | Moray Eel | `ART_PROMPTS.morayEel` |
| eyeBlob | 眼球怪 | Eye Blob | `ART_PROMPTS.eyeBlob` |
| mermaid | 美人鱼 | Mermaid | `ART_PROMPTS.mermaid` |
| giantOctopus | 巨型章鱼 | Giant Octopus | `ART_PROMPTS.giantOctopus` |
| oarfish | 皇带鱼 | Oarfish | `ART_PROMPTS.oarfish` |
| eversquid | 永恒乌贼 | Eversquid | `ART_PROMPTS.eversquid` |
| kelpie | 凯尔派 | Kelpie | `ART_PROMPTS.kelpie` |
| kraken | 克拉肯 | Kraken | `ART_PROMPTS.kraken` |
| （卡背） | 卡背插画 | Card Back | `CARD_BACK_PROMPT` |

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

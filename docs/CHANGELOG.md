# 变更记录（CHANGELOG）

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本（SemVer）。

## [0.8.0] - 2026-08-26

### 变更
- 卡牌全集由 18 张重写为 **24 张**（`js/core/cards.js` 为唯一数据源）：新增 `points` 积分（支持负分污秽鱼）/ `strength` 所需钩数（0-5）/ `hooks` 提供钩数 / `type`（fair 正品｜foul 邪秽）/ `ability` 能力键，`TOTAL_CARDS = 24`。
- 能力系统重构（`js/core/abilities.js`）为三类：
  - 主动（一次性，整局仅一次，发动后横置）：抽牌 +1/+2、洗堆、偷看 ≤3 鱼群、横置对方、多类交换、送牌、移除难度 0、腐鱼传牌、眼球团改组、雪鳗护体、补充力量等；
  - 静态被动（纯限制规则，横置则失效）：海猴禁钓难度 0、旧日支配者限制可钓难度、巨型乌贼不可被横置、狮子鱼强制交换等；
  - 反应被动：经状态机 `PENDING` 阶段处理交互窗口 —— `REDIRECT`（女妖改向）/ `COUNTER`（僧帽横置攻击方一条鱼）/ `REARRANGE`（眼球团重排浅滩）/ `PASS_LEFT`（腐鱼向左传递一圈）；`autoResolution` 供 AI / 服务端自动消解避免死锁。
- 状态机与规则（`stateMachine.js` / `rules.js`）：N 人轮转（2-4 人）、6 浅滩 × 4 牌、能力 → 抽牌 → 捕鱼 → 回合结束；
  - 新增**停滞保护**：连续整轮无人钓获即触发终局，解决"策略性不钓"死循环；
  - DRAW 阶段若抽 0 张（浅滩被梭子鱼移空）直接收束回合，兜底防空 catch 死循环。
- 计分（`scoring.js`）：终局 = 基础分之和；钓到**最多污秽鱼**的玩家额外 -2 分罚分。
- 规则确认（作者拍板）：**断脚送牌 = 对方获得整卡**（含 type/hooks/points，整卡转移）；**凯尔派揭示的浅滩顶牌回合结束后由玩家放回**（揭示仅翻面顶牌，牌仍在堆中，回合末揭示态清空）。

### 卡图
- 按 `artPrompts.js` 24 条提示词重新生成全部新卡图（手绘水彩克苏鲁风格，竖版高清），存 `public/cards/{id}.jpg`；废弃的非 24 卡旧图（sardine/clownfish/pufferfish/lanternfish/jellyfish/morayEel/foot/eyeBlob/stingray/eversquid 等）已删除。

### 测试
- 全量 158 例全绿（17 文件：core / ai / spectate / ui / defense 防线）；新增 24 卡能力链路场景测试 `tests/core/abilities24.test.js` 与浅滩卡背徽标 ⇔ 实际翻开卡一一对应不变式。

## [0.7.0] - 2026-08-25

### 变更
- 卡图压缩：1920×1920 → 512×512 JPEG，全副约 1.2MB，加载显著加速。
- 卡片尺寸：基准卡 92×138 → **118×177**，大号抽卡 120×180 → 154×231；移动端（≤520px）100×150 / 130×195，仍适配三列浅滩。
- 开局顶牌：`ensureSmallTops` 改为确定性跨浅滩交换，保证 ≥3 个浅滩顶牌为强度 ≤0 的小鱼；修复交换处数据损坏 Bug，新增 2000 种子不变量回归。
- 卡面布局重做：上半 50% 插画 + 下半 50% 信息区（absolute 叠层 + 文字阴影），数字置于单位/emoji 前（`需⚓5` → `需5⚓`），供钩为 0 灰显。
- 新功能「卡牌详情」：点击卡面弹出大图 + 能力 + 数值，能力阶段可点「发动能力」。
- 空浅滩放回卡死修复：空浅滩整堆可点（`.shoal-stack.selectable` + 高亮）。
- 移动端：`跳过能力阶段` 按钮移至抽出牌区下方。
- 构建产物 `dist/` 由 main 解除追踪，改由 gh-pages 分支独家部署。

### 测试
- 134 → 135 例全绿；`npm run build` 通过且 dist 完全内联可双击。

## [0.6.1] - 2026-08-25

### 变更
- 卡图改为「本地方案」：由图片生成工具按 `artPrompts.js` 提示词批量产出 18 张卡图（`public/cards/{id}.jpg`，手绘水彩克苏鲁风格），构建时复制到 `dist/cards/` 并被相对路径引用。
- `getArtUrl` 不再返回外网图片生成接口 URL，改为返回本地相对路径 `cards/{artKey}.jpg`；不再依赖 `trae-api-cn.mchost.guru`，本地离线双击与 GitHub Pages（根/子路径）均可稳定加载。
- 卡背维持 CSS 矢量绘制（漩涡 + 鱼钩 + 难度区间徽章），不使用位图。

### 测试
- 133 例全绿；新增对 `getArtUrl` 相对路径返回的依赖（本地化后与网络解耦）。

## [0.6.0] - 2026-08-25

### 修复
- 抽牌选牌交互：原实现可无限多选超上限导致确认按钮永久禁用、卡死在抽牌回合；现改为"本回合应抽数"为总上限、点击已选浅滩可取消、提供"清空重选"按钮、提示 `已选 x/y`。
- 卡背不显示鱼群难度区间：卡背新增 `难度区间` 徽章，按 `[strength-1, strength+1]` 截断 0-5 计算（如难度 4 → "3-5"）。
- 分数与钩数混淆：玩家条 / 钓获区顶部现同时显示实时"分"与"⚓钩"，二者明确分离（`getRawScore`）。
- 获取难度（需钩）与获取钩数（供钩）混淆：卡面信息区同时标注"需 ⚓N"与"供 ⚓N"，供钩为 0（大鱼）灰显以示区分。
- Solo 特色目标「全程未钓到污秽鱼」开局即判定达成：改为三态（进行中 ○ / 已失败 ✗ / 已达成 ✓），仅终局且全程无污秽才达成。
- Solo 玩家回合结束后无法轮到脚本回合：玩家动作若结束本回合即自动调度脚本回合（`runScript`），脚本意图与行动日志恢复显示。
- AI 死锁（M4 观战 seed=6 不终局）：AI 反复抽放不可钓大鱼而永不终局。
  - 根因：`chooseDrawAction` 对"次顶牌可钓"仅 +6 分且 `from` 每浅滩只抽 1 张，次顶牌永远埋在顶牌下无法触及。
  - 修复：把"可钓的顶牌/次顶牌"改为绝对优先（+100），且顶牌不可钓而次顶牌可钓时连抽同一浅滩两张（`from=[i,i]`）以挖到次顶牌。
- 放回目标：已有满堆（3 张）的浅滩不再作为合法放回目标（`getLegalThrowTargets`）。

### 变更
- 卡面布局重做：上半 50% 插画 + 下半 50% 信息区（分值 / 需钩 / 供钩 / 名称 / 能力），信息可读性大幅提升。
- 平衡性：分值 > 3 的大鱼不再提供钩数（`hooks: 0`），钩数仅靠小鱼逐步积累，避免滚雪球。
- `js/ui/soloUI.js`：目标三态渲染、回合结束自动调度脚本、开新局时重置脚本意图文案。

### 测试
- 全量测试由 129 例增至 133 例；新增：放回满堆排除、分值 > 3 不供钩断言、Solo noFoul 三态回归、Solo 玩家回合后自动轮到脚本回合（UI 回归）。

## [0.5.0] - 2026-08-25

### 新增
- M5 Solo 挑战《渔夫与青蛙》：
  - `js/solo/soloScript.js`：脚本对手由 6 张固定目标卡构成（kraken/kelpie/oarfish/eversquid/barracuda/morayEel），
    全部决策为纯函数（固定能力顺序 / 目标浅滩取牌 / 目标优先钓走 / 污秽优先放回），无随机与评估分支；
  - `js/solo/soloFlow.js`：`SoloController` 管理玩家/脚本回合、动作派发校验、实时特色目标（`getLiveGoals`）与结算评价（`getEvaluation`，星级 + 等级）；
  - `js/ui/soloUI.js`：Solo 面板（脚本对手信息 / 特色目标进度 / 脚本意图提示 / 脚本行动日志）与结算评价渲染。
- 共享棋盘交互 `js/ui/boardInteraction.js`：从 main.js 抽取玩家棋盘点击处理（M1/M2/M3/M5 共用，工厂注入）。
- `js/ui/interaction.js` 新增 `buildBoardUi` 共享棋盘 UI 描述（浅滩可点/选中、放回目标、能力目标、状态文案）。
- 测试：`tests/solo/soloScript.test.js`（12 例）、`tests/solo/soloFlow.test.js`（9 例）、`tests/ui/soloUI.test.js`（4 例）。

### 变更
- `js/main.js`：接入 M5 模式路由与 Solo 生命周期（返回 / 再来一局 / 返回首页）；`getUi` 改用 `buildBoardUi`。
- `index.html`：对局页内嵌 `#soloPanel`，结算页新增 `#soloResult` 评价容器。
- `css/board.css` / `css/responsive.css`：Solo 面板与结算评价样式、窄屏单列。
- 补齐文档：`README.md`、`docs/ARCHITECTURE.md`、`docs/ASSETS.md`、`docs/ISSUE_TEMPLATE.md`、`tools/README.md`。

## [0.4.0] - 2026-08-25

### 新增
- M4 AI 斗蛐蛐观战界面（`js/ui/spectateUI.js`）：
  - 自动/手动回合控制，对局中可随时切换；
  - 速度档位（慢 3s / 中 1.5s / 快 0.5s），仅影响展示节奏，不改变对局结果；
  - 手动模式支持"下一回合 / 自动 5 回合 / 立即结束本局"；
  - 战斗日志面板逐条展示回合、行动方、动作描述、AI 决策理由与结算反馈，关键节点（能力发动 / 污秽鱼被钓 / 终局）高亮；
  - 回放导出为 JSON（含 seed 与完整动作序列）。
- 共享屏幕切换模块 `js/ui/screens.js`。
- M4 观战 UI 集成测试 `tests/ui/spectateUI.test.js`。

### 变更
- `js/ui/render.js`：`renderDrawn` 支持 `{ spectate: true }` 隐藏钓走/放回按钮。
- `js/main.js`：接入 M4 模式路由与观战生命周期（返回首页 / 再来一局）。
- `package.json`：`build` 脚本改为 `vite build && node tools/inline-build.mjs`，产物可双击离线运行。
- `index.html` / `css/board.css` / `css/responsive.css`：新增观战面板与响应式布局。

### 修复
- 钩子机制死锁：`strength`（所需钩数）与 `hooks`（提供钩数）分离，小鱼钓获提供 1 钩，保证 AI 对局可推进至终局（回归测试覆盖 40 种子）。
- AI 放回逻辑避免把牌放回来源浅滩而埋住可钓牌。
- AI `swap_fish` 能力处理中 `me` 未定义导致的 ReferenceError。

## [0.3.0] - 2026-08-24

### 新增
- M3 联机对战：Socket.IO + cloudflared 临时公网 URL；房间码、准备/开始、踢人、断线 AI 托管、对局回放。
- `server/server.js` / `server/room.js` / `server/gameServer.js`；`js/net/socketClient.js` / `js/net/protocol.js`。
- 协议一致性测试与房间/服务端测试。

## [0.2.0] - 2026-08-24

### 新增
- M2 单人 AI 对战：启发式 AI（`js/ai/heuristicAI.js`），与玩家走同一动作接口。
- AI 决策理由生成 `js/ai/aiDecision.js`。

## [0.1.0] - 2026-08-24

### 新增
- 项目骨架与目录结构。
- M1 本地对战（热座）：core 层（cards/gameState/stateMachine/rules/abilities/scoring）+ UI 层 + 单测。
- 18 张卡牌数据、六种能力、计分与污秽惩罚。
